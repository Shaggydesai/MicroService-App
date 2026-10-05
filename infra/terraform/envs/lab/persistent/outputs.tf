output "ingress_ip" {
  description = "Set as controller.service.loadBalancerIP for ingress-nginx (Phase 8)."
  value       = google_compute_address.ingress.address
}

output "hostnames" {
  description = "sslip.io hostnames that resolve to the ingress IP, with no DNS setup."
  value = {
    for name in ["shop-dev", "shop", "argocd", "grafana", "prometheus", "vault"] :
    name => "${name}.${replace(google_compute_address.ingress.address, ".", "-")}.sslip.io"
  }
}

output "vault_unseal" {
  description = "Values for the Bank-Vaults unsealConfig.google block (Phase 8)."
  value = {
    kms_project     = var.project_id
    kms_location    = var.region
    kms_key_ring    = google_kms_key_ring.vault.name
    kms_crypto_key  = google_kms_crypto_key.vault_unseal.name
    storage_bucket  = google_storage_bucket.vault_unseal.name
    service_account = google_service_account.vault_unseal.email
  }
}
