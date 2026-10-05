# Lab environment (Phase 6)

Two Terraform root configurations. Both store state in `tfstate-684852499708`, created by the bootstrap.

| Layer | Folder | What it creates | Lifetime | Cost |
|---|---|---|---|---|
| **persistent** | `persistent/` | Vault auto-unseal KMS key ring + key, unseal bucket, `vault-unseal` service account, ingress static IP | Kept for the whole project | About ₹20/day while the IP is unused, plus a few rupees a month |
| **cluster** | `cluster/` | VPC + subnet, GKE zonal cluster, Spot node pool (2 × e2-standard-4), `gke-nodes` service account, Vault Workload Identity binding | Create for a session, destroy afterwards | About ₹6–10/hour on Spot (about ₹25–28/hour on-demand) |

Prices are estimates for asia-south1; check the [pricing calculator](https://cloud.google.com/products/calculator).

## Key design choices

- **Two layers:** KMS key rings can never be deleted in GCP, and a fixed IP keeps the app's hostnames stable. Everything that costs money while idle sits in `cluster/`, which is safe to destroy.
- **Dataplane V2** (`datapath_provider = "ADVANCED_DATAPATH"`): GKE only enforces NetworkPolicies with it, and the ShopVerse chart relies on them.
- **Workload Identity:** pods get Google permissions without key files. Vault's pod (`vault/vault`) acts as `vault-unseal@…` to use the KMS key.
- **Minimal node identity:** nodes run as `gke-nodes@…` with only `roles/container.defaultNodeServiceAccount`, not the Compute default account (which has Editor).
- **Logging:** only GKE system components go to Cloud Logging; the apps use Loki.
- **Spot nodes:** about 3× cheaper. Google may reclaim a node; GKE replaces it and pods restart.
- **`deletion_protection = false`:** so `terraform destroy` works (GKE's default is `true`).

## Prerequisites (one time, in WSL)

```bash
sudo apt-get install -y kubectl google-cloud-cli-gke-gcloud-auth-plugin
kubectl version --client
```

The auth plugin lets `kubectl` log in to GKE with your gcloud account.

## Create

```bash
cd infra/terraform/envs/lab/persistent
terraform init
terraform plan -out=persistent.tfplan      # review: 7 resources, no cluster
terraform apply persistent.tfplan
terraform output                           # note ingress_ip and hostnames

cd ../cluster
terraform init
terraform plan -out=cluster.tfplan         # review: 7 resources
terraform apply cluster.tfplan             # takes 8-10 minutes; billing for nodes starts here
```

Then connect and check:

```bash
$(terraform output -raw get_credentials)
kubectl get nodes -o wide                  # 2 nodes, Ready
kubectl get nodes -L cloud.google.com/gke-spot   # SPOT column should say true
```

## Destroy (stops node billing)

```bash
make lab-down       # from the repo root
```

`scripts/lab-down.sh` asks you to type the cluster name, then:

1. Deletes the Argo CD root app (from Phase 7 on), so Argo CD removes its workloads.
2. Deletes LoadBalancer Services and PVCs. Kubernetes then deletes their cloud load balancers and disks, which Terraform doesn't know about.
3. Runs `terraform destroy` on the cluster layer.
4. Empties the Vault unseal bucket (Vault's data is gone with the cluster).
5. Runs `make lab-status`, which lists anything that could still cost money.

**Expected after teardown:** no clusters, instances, disks or forwarding rules. One address, `shopverse-ingress`, stays in status `RESERVED`; that's kept on purpose.

## Common tweaks

| Want | Command |
|---|---|
| Stable (non-Spot) nodes for demo day | `terraform apply -var spot=false` in `cluster/` (creates the new pool before removing the old one) |
| Spot capacity unavailable (`ZONE_RESOURCE_POOL_EXHAUSTED`) | `-var zone=asia-south1-b` (or `-c`) |
| Check what's billing | `make lab-status` |

## Full cleanup (end of project)

After `make lab-down`, run `terraform destroy` in `persistent/`. The KMS crypto key has `prevent_destroy`, so you must remove that line first. Then run `terraform destroy` in `infra/terraform/bootstrap`. The key ring itself always remains in GCP (free).
