# Every API the lab uses, enabled in one place. Keeping them on when this stage is destroyed
# avoids breaking resources that other stages created.
locals {
  apis = [
    "billingbudgets.googleapis.com",       # budget below
    "cloudkms.googleapis.com",             # Vault auto-unseal key (Phase 6)
    "cloudresourcemanager.googleapis.com", # project metadata / IAM
    "compute.googleapis.com",              # VPC, static IP, nodes
    "container.googleapis.com",            # GKE
    "iam.googleapis.com",                  # service accounts, Workload Identity
    "iamcredentials.googleapis.com",       # short-lived tokens for impersonation
    "serviceusage.googleapis.com",         # enabling APIs
    "storage.googleapis.com",              # Terraform state, Vault unseal bucket
    "sts.googleapis.com",                  # token exchange for GitHub OIDC
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.apis)

  service            = each.value
  disable_on_destroy = false
}
