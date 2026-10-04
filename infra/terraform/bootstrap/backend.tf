# Step 1 (first apply): leave this commented, so state is kept locally while the bucket
# does not exist yet.
# Step 2: replace BUCKET with the `state_bucket` output, uncomment, and run
#   terraform init -migrate-state
# so this stage's state also lives in the versioned bucket.
#
# terraform {
#   backend "gcs" {
#     bucket = "BUCKET"
#     prefix = "bootstrap"
#   }
# }
