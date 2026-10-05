# Vault auto-unseal key. Bank-Vaults encrypts Vault's unseal keys with this key before storing
# them in the unseal bucket, so a restarted (or preempted) Vault pod unseals itself.
#
# Key rings can never be deleted in GCP: `terraform destroy` only forgets them. That is why
# this lives in the long-lived "persistent" layer and not with the cluster.
resource "google_kms_key_ring" "vault" {
  name     = "shopverse-vault"
  location = var.region
}

resource "google_kms_crypto_key" "vault_unseal" {
  name            = "vault-unseal"
  key_ring        = google_kms_key_ring.vault.id
  purpose         = "ENCRYPT_DECRYPT"
  rotation_period = "7776000s" # 90 days; old versions stay usable for decryption

  lifecycle {
    prevent_destroy = true # losing this key means the stored unseal keys can't be decrypted
  }
}
