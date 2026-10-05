output "project_number" {
  value = data.google_project.this.number
}

output "state_bucket" {
  description = "Use as the GCS backend bucket in infra/terraform/envs/lab."
  value       = google_storage_bucket.tfstate.name
}

output "workload_identity_provider" {
  description = "Full provider name for google-github-actions/auth."
  value       = google_iam_workload_identity_pool_provider.github.name
}

output "tf_plan_service_account" {
  value = google_service_account.tf_plan.email
}

output "tf_apply_service_account" {
  value = google_service_account.tf_apply.email
}

output "github_actions_variables" {
  description = "Add these as repository variables (Settings > Secrets and variables > Actions > Variables). None are secret."
  value = {
    GCP_PROJECT_ID   = var.project_id
    GCP_REGION       = var.region
    GCP_WIF_PROVIDER = google_iam_workload_identity_pool_provider.github.name
    GCP_TF_PLAN_SA   = google_service_account.tf_plan.email
    GCP_TF_APPLY_SA  = google_service_account.tf_apply.email
    TF_STATE_BUCKET  = google_storage_bucket.tfstate.name
  }
}
