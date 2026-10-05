# Where Bank-Vaults stores the KMS-encrypted unseal keys and root token.
# Empty it when you destroy the cluster (Vault's data is gone then); scripts/lab-down.sh does it.
resource "google_storage_bucket" "vault_unseal" {
  name     = "vault-unseal-${data.google_project.this.number}"
  location = var.region

  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = true # only holds encrypted, rebuildable material

  versioning {
    enabled = false
  }
}

# Google identity used by the Vault pods (through Workload Identity, bound in the cluster layer).
resource "google_service_account" "vault_unseal" {
  account_id   = "vault-unseal"
  display_name = "Vault auto-unseal (Bank-Vaults, via Workload Identity)"
}

resource "google_kms_crypto_key_iam_member" "vault_unseal" {
  crypto_key_id = google_kms_crypto_key.vault_unseal.id
  role          = "roles/cloudkms.cryptoKeyEncrypterDecrypter"
  member        = google_service_account.vault_unseal.member
}

resource "google_storage_bucket_iam_member" "vault_unseal" {
  bucket = google_storage_bucket.vault_unseal.name
  role   = "roles/storage.objectAdmin"
  member = google_service_account.vault_unseal.member
}
