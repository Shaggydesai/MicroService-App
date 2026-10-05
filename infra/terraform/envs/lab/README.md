# Lab environment (Phases 6-8)

Two Terraform root configurations. Both store state in `tfstate-684852499708`, created by the bootstrap.

| Layer | Folder | What it creates | Lifetime | Cost |
|---|---|---|---|---|
| **persistent** | `persistent/` | Vault auto-unseal KMS key ring + key, unseal bucket, `vault-unseal` service account, ingress static IP | Kept for the whole project | About ₹20/day while the IP is unused, plus a few rupees a month |
| **cluster** | `cluster/` | VPC + subnet, GKE zonal cluster, Spot node pool (2 × e2-standard-4), `gke-nodes` service account, Vault Workload Identity binding, Argo CD hand-off | Create for a session, destroy afterwards | About ₹6–10/hour on Spot (about ₹25–28/hour on-demand) |

Prices are estimates for asia-south1; check the [pricing calculator](https://cloud.google.com/products/calculator).

## Key design choices

- **Two layers:** KMS key rings can never be deleted in GCP, and a fixed IP keeps the app's hostnames stable. Everything that costs money while idle sits in `cluster/`, which is safe to destroy.
- **Dataplane V2** (`datapath_provider = "ADVANCED_DATAPATH"`): GKE only enforces NetworkPolicies with it, and the ShopVerse chart relies on them.
- **Workload Identity:** pods get Google permissions without key files. Vault's pod (`vault/vault`) acts as `vault-unseal@…` to use the KMS key.
- **Minimal node identity:** nodes run as `gke-nodes@…` with only `roles/container.defaultNodeServiceAccount`, not the Compute default account (which has Editor).
- **Logging:** only GKE system components go to Cloud Logging; the apps use Loki.
- **Spot nodes:** about 3× cheaper. Google may reclaim a node; GKE replaces it and pods restart.
- **`deletion_protection = false`:** so `terraform destroy` works (GKE's default is `true`).
- **GitOps hand-off** (`argocd-bootstrap.tf`): once the nodes exist, Terraform runs `scripts/argocd-bootstrap.sh`, which installs Argo CD from `gitops/bootstrap` and applies the root app. It runs once per cluster (keyed on the cluster ID). Everything inside the cluster then comes from the `main` branch; Terraform never manages Kubernetes objects. Skip it with `-var enable_argocd_bootstrap=false`.

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
terraform plan -out=cluster.tfplan         # review: 8 resources (7 + terraform_data.argocd_bootstrap)
terraform apply cluster.tfplan             # 8-10 minutes for GKE, then the Argo CD hand-off; billing for nodes starts here
```

Before the first apply with the hand-off, make sure `main` holds the `gitops/` you want, CI has pushed the images,
and the GHCR packages are public: Argo CD deploys whatever `main` says.

Then connect and check:

```bash
$(terraform output -raw get_credentials)
kubectl get nodes -o wide                  # 2 nodes, Ready
kubectl get nodes -L cloud.google.com/gke-spot   # SPOT column should say true
kubectl -n argocd get applications -w            # the platform converges in about 10-15 minutes
```

The URLs and logins are in the root [README](../../../../README.md#3-open-the-uis).

## Destroy (stops node billing)

```bash
make lab-down       # from the repo root
```

`scripts/lab-down.sh` asks you to type the cluster name, then:

1. Deletes the Argo CD root app, so Argo CD removes its workloads.
2. Deletes LoadBalancer Services and PVCs. Kubernetes then deletes their cloud load balancers and disks, which Terraform doesn't know about.
3. Runs `terraform destroy` on the cluster layer.
4. Empties the Vault unseal bucket (Vault's data is gone with the cluster).
5. Runs `make lab-status`, which lists anything that could still cost money.

**Expected after teardown:** no clusters, instances, disks or forwarding rules. One address, `shopverse-ingress`, stays in status `RESERVED`; that's kept on purpose.

## From GitHub Actions (Phase 10)

`.github/workflows/terraform.yaml` runs the same two layers in CI, logging in with GitHub OIDC (no keys):

| When | Job | Google identity | Result |
|---|---|---|---|
| A pull request changes `infra/terraform/envs/**` | **plan** for `persistent` and `cluster` | `tf-plan@` (read-only) | The plan is posted as a PR comment and in the job summary |
| **Actions → Terraform → Run workflow** (pick a layer) | **apply** | `tf-apply@`, usable only from the `gcp-infra` environment | Waits for your approval, then plans and applies; the cluster layer also runs the Argo CD hand-off |

Nothing is applied on merge, and destroying stays local (`make lab-down`), because the cluster needs in-cluster
cleanup first. `bootstrap/` is never run by CI.

One-time setup in the GitHub repository settings:

1. **Secrets and variables → Actions → Variables**: `GCP_WIF_PROVIDER`, `GCP_TF_PLAN_SA`, `GCP_TF_APPLY_SA`
   (values from `terraform output github_actions_variables` in `infra/terraform/bootstrap`; none are secret).
2. **Environments → New environment** `gcp-infra`, with yourself as **Required reviewer**.

## Common tweaks

| Want | Command |
|---|---|
| Stable (non-Spot) nodes for demo day | `terraform apply -var spot=false` in `cluster/` (creates the new pool before removing the old one) |
| Spot capacity unavailable (`ZONE_RESOURCE_POOL_EXHAUSTED`) | `-var zone=asia-south1-b` (or `-c`) |
| Check what's billing | `make lab-status` |

## Full cleanup (end of project)

After `make lab-down`, run `terraform destroy` in `persistent/`. The KMS crypto key has `prevent_destroy`, so you must remove that line first. Then run `terraform destroy` in `infra/terraform/bootstrap`. The key ring itself always remains in GCP (free).
