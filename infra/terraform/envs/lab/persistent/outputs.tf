output "ingress_ip" {
  description = "Reserved IP for ingress-nginx (null when reserve_ingress_ip = false). scripts/set-ingress-ip.sh writes it into gitops/."
  value       = local.ingress_ip
}

output "hostnames" {
  description = "sslip.io hostnames that resolve to the ingress IP, with no DNS setup (empty when no IP is reserved)."
  value = local.ingress_ip == null ? {} : {
    for name in ["shop-dev", "shop", "argocd", "grafana", "prometheus", "vault"] :
    name => "${name}.${replace(local.ingress_ip, ".", "-")}.sslip.io"
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
