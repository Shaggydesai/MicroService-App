# State for this stage lives in the bucket it created (migrated with `terraform init -migrate-state`).
# The very first apply ran with this block commented out, because the bucket did not exist yet.
terraform {
  backend "gcs" {
    bucket = "tfstate-684852499708"
    prefix = "bootstrap"
  }
}
