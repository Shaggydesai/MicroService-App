#!/usr/bin/env bash
# Safe teardown of the paid part of the lab (the "cluster" Terraform layer).
# The persistent layer (KMS key, static IP, unseal bucket) is kept.
#
# Order matters: Kubernetes creates cloud resources on its own (a load balancer for each
# LoadBalancer Service, a persistent disk for each PVC). Terraform doesn't know about them,
# so they must be deleted from inside the cluster BEFORE the cluster is destroyed, or they
# keep billing.
set -euo pipefail

ROOT=$(git rev-parse --show-toplevel)
PROJECT=${PROJECT:-shopverse-lab}
ZONE=${ZONE:-asia-south1-a}
CLUSTER=shopverse-lab

echo "This will delete the GKE cluster '$CLUSTER', its nodes and its VPC in project '$PROJECT'."
echo "The static IP, KMS key and Terraform state are kept."
read -rp "Type the cluster name to confirm: " answer
[[ "$answer" == "$CLUSTER" ]] || { echo "Aborted."; exit 1; }

if gcloud container clusters describe "$CLUSTER" --zone "$ZONE" --project "$PROJECT" >/dev/null 2>&1; then
  gcloud container clusters get-credentials "$CLUSTER" --zone "$ZONE" --project "$PROJECT"

  echo "==> 1/5 Removing the GitOps root app (Argo CD deletes everything it manages)"
  if kubectl -n argocd get application shopverse-root >/dev/null 2>&1; then
    kubectl -n argocd delete application shopverse-root --wait=true --timeout=15m || true
  else
    echo "    (no Argo CD root app, skipping)"
  fi

  echo "==> 2/5 Deleting LoadBalancer Services (their cloud load balancers)"
  kubectl get svc -A -o jsonpath='{range .items[?(@.spec.type=="LoadBalancer")]}{.metadata.namespace}{" "}{.metadata.name}{"\n"}{end}' |
    while read -r ns name; do
      [[ -n "$ns" ]] && kubectl -n "$ns" delete svc "$name" --wait=true --timeout=5m
    done

  echo "==> 3/5 Deleting PersistentVolumeClaims (their disks)"
  kubectl delete pvc --all -A --wait=true --timeout=10m || true
  for _ in $(seq 1 30); do
    remaining=$(kubectl get pv --no-headers 2>/dev/null | wc -l)
    [[ "$remaining" -eq 0 ]] && break
    echo "    waiting for $remaining volume(s) to be released..."
    sleep 10
  done
else
  echo "Cluster not found; skipping in-cluster cleanup."
fi

# GKE's service controller (running inside the cluster) removes a load balancer's forwarding rule,
# target pool, health check and k8s-* firewall rules only AFTER its Service is gone. Destroying the
# cluster before it finishes leaves them behind, and a leftover firewall rule blocks deleting the VPC.
echo "==> 4/5 Waiting for GKE to remove its load-balancer resources"
leftover() {
  gcloud compute forwarding-rules list --project "$PROJECT" --filter="IPAddress=$INGRESS_IP" --format="value(name)" 2>/dev/null
  gcloud compute firewall-rules list --project "$PROJECT" --filter="network:$NETWORK AND name~^k8s-" --format="value(name)" 2>/dev/null
}
INGRESS_IP=$(gcloud compute addresses describe shopverse-ingress --region "${ZONE%-*}" --project "$PROJECT" --format="value(address)" 2>/dev/null || true)
NETWORK=shopverse-vpc
for _ in $(seq 1 30); do
  [[ -z "$(leftover)" ]] && break
  echo "    still present: $(leftover | tr '\n' ' ')"
  sleep 10
done
# Anything still left belongs to this lab's VPC only; delete it so the VPC can go.
for rule in $(gcloud compute firewall-rules list --project "$PROJECT" --filter="network:$NETWORK AND name~^k8s-" --format="value(name)" 2>/dev/null); do
  echo "    deleting leftover firewall rule $rule"
  gcloud compute firewall-rules delete "$rule" --project "$PROJECT" --quiet
done

echo "==> 5/5 terraform destroy (cluster layer)"
terraform -chdir="$ROOT/infra/terraform/envs/lab/cluster" destroy

# Vault's data died with the cluster, so its stored unseal keys are now useless.
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT" --format="value(projectNumber)")
gcloud storage rm "gs://vault-unseal-${PROJECT_NUMBER}/**" --project "$PROJECT" 2>/dev/null || true

"$ROOT/scripts/lab-status.sh"
