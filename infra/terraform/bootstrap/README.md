# Terraform bootstrap (Phase 5)

The foundation that Terraform and CI need before any infrastructure exists. You run this stage
**once, by hand, as the project Owner**. CI never applies it.

## What it creates (30 resources, about ₹0/month)

| File | Resources | Why |
|---|---|---|
| `apis.tf` | 10 × `google_project_service` | Enables Compute, GKE, KMS, IAM, STS, Storage, Billing Budgets… in one place |
| `state-bucket.tf` | `google_storage_bucket` `tfstate-<project-number>` | Remote, versioned Terraform state with public access blocked. `force_destroy = false` so state can't be deleted by accident |
| `github-oidc.tf` | Workload Identity pool + provider | Lets GitHub Actions log in to GCP with short-lived OIDC tokens. Only tokens from `Shaggydesai/MicroService-App` are accepted |
| | `tf-plan` service account | Read-only (`viewer`, `iam.securityReviewer`). Any workflow run in the repo may use it, so PRs can run `terraform plan` |
| | `tf-apply` service account | Can change infrastructure, but **only** from jobs running in the GitHub environment `gcp-infra`. You'll protect that environment with a required reviewer (you) in Phase 10 |
| | Bucket IAM | Both accounts can read and write state (plan needs to take the state lock) |
| `budget.tf` | `google_billing_budget` | Your ₹2,500 monthly budget as code: credits excluded, alerts at 25% (actual), 50/90/100% (forecasted) and 100% (actual) |
| `outputs.tf` | – | Values for the next phase and for the GitHub repository variables |
| `backend.tf` | – | Commented out at first. After the first apply, it moves this stage's own state into the bucket |

There are no keys, passwords or tokens anywhere in this stage.

## How the GitHub → GCP login works

```
GitHub job ──(OIDC token: repo, ref, environment)──► GCP STS ──checks pool condition──► short-lived token
                                                                                          │
   any job in the repo ───────────────────────────────► may impersonate tf-plan (read-only)
   only jobs in environment "gcp-infra" (sub claim) ──► may impersonate tf-apply
```

## Before you start (one time)

Terraform reads the project's details (`data "google_project"`) before it can enable any API,
and that read needs the Cloud Resource Manager API, which is off in new projects. Enable it once by hand:

```bash
gcloud services enable cloudresourcemanager.googleapis.com serviceusage.googleapis.com
```

Without it, `terraform plan` fails with `Error 403: Cloud Resource Manager API has not been used in project ...`.
Everything else is enabled by `apis.tf`.

You can run this stage from Cloud Shell or from your own machine (WSL, Linux, macOS). On your own machine,
install Terraform and the Google Cloud CLI, then log in twice: `gcloud auth login` for gcloud, and
`gcloud auth application-default login` followed by `gcloud auth application-default set-quota-project <project-id>`
for Terraform. On the consent screen, tick every permission box.

## Run it (Cloud Shell recommended)

Cloud Shell already has `terraform`, `gcloud` and `git`, and is logged in as you, so you don't need to install anything on Windows.

1. In the Google Cloud console, select project **shopverse-lab** and click the **`>_`** icon (top right) to open Cloud Shell.
2. Get the code:
   ```bash
   git clone https://github.com/Shaggydesai/MicroService-App.git
   cd MicroService-App
   git checkout claude/hopeful-brown-3cjaqi
   cd infra/terraform/bootstrap
   ```
3. Create your variables file and fill in the billing account ID (Billing → Overview):
   ```bash
   cp terraform.tfvars.example terraform.tfvars
   nano terraform.tfvars        # set billing_account_id, then Ctrl+O, Enter, Ctrl+X
   ```
4. Initialise, then **review the plan before applying anything**:
   ```bash
   terraform init
   terraform plan -out=bootstrap.tfplan
   ```
   Expect `Plan: 30 to add, 0 to change, 0 to destroy.` Read through the list.
5. Apply exactly that plan:
   ```bash
   terraform apply bootstrap.tfplan
   terraform output
   ```
6. Move this stage's state into the new bucket:
   ```bash
   # put the state_bucket output value into backend.tf, uncomment the block, then:
   terraform init -migrate-state      # answer "yes"
   ```
7. Delete the budget you created by hand in the console (Billing → Budgets & alerts), so you don't get duplicate emails. The Terraform one is named **"shopverse-lab (terraform)"**.
8. Keep the generated `.terraform.lock.hcl` file (it pins the provider checksums): run `cat .terraform.lock.hcl` and paste the output to Claude to commit, or push it yourself. `terraform.tfvars` and the state stay out of Git via `.gitignore`.

## Undo

`terraform destroy` removes everything here except the APIs, which stay enabled, and the state bucket, which refuses to delete while it holds state. That's deliberate.
