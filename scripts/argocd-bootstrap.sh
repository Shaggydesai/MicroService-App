#!/usr/bin/env bash
# Hands a fresh cluster over to GitOps. Terraform runs this once per cluster
# (infra/terraform/envs/lab/cluster/argocd-bootstrap.tf); you can also run it by hand.
#
#   1. Install Argo CD from gitops/bootstrap (the same Kustomize directory Argo CD later manages itself).
#   2. Wait until Argo CD is up.
#   3. Apply the root app. From here on, Argo CD installs everything else from the main branch.
set -euo pipefail

ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
PROJECT=${PROJECT:-shopverse-lab}
ZONE=${ZONE:-asia-south1-a}
CLUSTER=${CLUSTER:-shopverse-lab}
CONTEXT="gke_${PROJECT}_${ZONE}_${CLUSTER}"

# Every kubectl call names the context, so this can never touch another cluster in your kubeconfig.
k() { kubectl --context "$CONTEXT" "$@"; }

retry() {
  local attempt
  for attempt in 1 2 3 4 5 6; do
    "$@" && return 0
    echo "    attempt $attempt failed; retrying in 20s..."
    sleep 20
  done
  echo "    giving up after $attempt attempts: $*" >&2
  return 1
}

echo "==> 1/4 Fetching credentials for $CLUSTER"
gcloud container clusters get-credentials "$CLUSTER" --zone "$ZONE" --project "$PROJECT"

# Right after creation the control plane can briefly refuse requests while GKE finishes setting it up.
echo "==> 2/4 Installing Argo CD (gitops/bootstrap)"
retry k apply -k "$ROOT/gitops/bootstrap" --server-side --force-conflicts

echo "==> 3/4 Waiting for Argo CD to be ready"
k wait --for=condition=Established crd/applications.argoproj.io crd/appprojects.argoproj.io --timeout=5m
for workload in deployment/argocd-server deployment/argocd-repo-server statefulset/argocd-application-controller; do
  k -n argocd rollout status "$workload" --timeout=10m
done

echo "==> 4/4 Applying the root app (Argo CD takes over from here)"
retry k apply -f "$ROOT/gitops/argocd/root-app.yaml"

cat <<EOF

Argo CD is installed and syncing gitops/argocd from the main branch.
Watch the platform come up (about 10-15 minutes):
  kubectl -n argocd get applications -w
Admin password for the first login:
  kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d; echo
EOF
