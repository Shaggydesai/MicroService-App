# Remote state for the main configuration (infra/terraform/envs/lab) and, after migration,
# for this bootstrap stage too. The project number makes the name globally unique.
resource "google_storage_bucket" "tfstate" {
  name     = "tfstate-${data.google_project.this.number}"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false # never lose state by accident

  versioning {
    enabled = true # every state write is kept, so a bad apply can be rolled back
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 20
      with_state         = "ARCHIVED"
    }
    action {
      type = "Delete"
    }
  }

  depends_on = [google_project_service.apis]
}
