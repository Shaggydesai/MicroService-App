# Keyless authentication from GitHub Actions to GCP (Workload Identity Federation).
# GitHub issues a short-lived OIDC token per job; GCP exchanges it for a short-lived
# access token of one of the service accounts below. No JSON keys exist anywhere.

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  description               = "OIDC identities from GitHub Actions workflows"

  depends_on = [google_project_service.apis]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-actions"
  display_name                       = "GitHub Actions OIDC"

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_mapping = {
    "google.subject"             = "assertion.sub"
    "attribute.repository"       = "assertion.repository"
    "attribute.repository_owner" = "assertion.repository_owner"
    "attribute.ref"              = "assertion.ref"
  }

  # Only tokens from this repository are accepted at all.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""
}

# --- terraform plan: read-only, usable by any workflow run in the repo (PRs included) ---
resource "google_service_account" "tf_plan" {
  account_id   = "tf-plan"
  display_name = "Terraform plan (GitHub Actions, read-only)"
}

resource "google_project_iam_member" "tf_plan" {
  for_each = toset([
    "roles/viewer",               # read resources
    "roles/iam.securityReviewer", # read IAM policies, needed to plan IAM resources
  ])

  project = var.project_id
  role    = each.value
  member  = google_service_account.tf_plan.member
}

resource "google_service_account_iam_member" "tf_plan_wif" {
  service_account_id = google_service_account.tf_plan.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

# --- terraform apply: can change infrastructure, but ONLY from jobs that run in the protected
#     GitHub environment (required reviewers), identified by the token's subject claim ---
resource "google_service_account" "tf_apply" {
  account_id   = "tf-apply"
  display_name = "Terraform apply (GitHub Actions, protected environment)"
}

resource "google_project_iam_member" "tf_apply" {
  for_each = toset([
    "roles/compute.admin",                   # VPC, firewall, static IP, instances
    "roles/container.admin",                 # GKE cluster and node pools
    "roles/cloudkms.admin",                  # Vault unseal key ring and key
    "roles/storage.admin",                   # Vault unseal bucket
    "roles/iam.serviceAccountAdmin",         # service accounts for nodes and Vault
    "roles/iam.serviceAccountUser",          # attach service accounts to nodes
    "roles/resourcemanager.projectIamAdmin", # Workload Identity bindings
    "roles/serviceusage.serviceUsageAdmin",  # enable APIs
  ])

  project = var.project_id
  role    = each.value
  member  = google_service_account.tf_apply.member
}

resource "google_service_account_iam_member" "tf_apply_wif" {
  service_account_id = google_service_account.tf_apply.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principal://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/subject/repo:${var.github_repository}:environment:${var.github_apply_environment}"
}

# Both service accounts read/write state (plan needs to take the state lock).
resource "google_storage_bucket_iam_member" "tfstate" {
  for_each = {
    plan  = google_service_account.tf_plan.member
    apply = google_service_account.tf_apply.member
  }

  bucket = google_storage_bucket.tfstate.name
  role   = "roles/storage.objectAdmin"
  member = each.value
}
