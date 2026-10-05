# Lets the Kubernetes service account vault/vault act as the vault-unseal Google service account
# (created in the persistent layer) to use the KMS key and unseal bucket.
# Needs the cluster first: the workload identity pool only exists once a cluster enables it.
data "google_service_account" "vault_unseal" {
  account_id = "vault-unseal"
}

resource "google_service_account_iam_member" "vault_workload_identity" {
  service_account_id = data.google_service_account.vault_unseal.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[vault/vault]"

  depends_on = [google_container_cluster.lab]
}
