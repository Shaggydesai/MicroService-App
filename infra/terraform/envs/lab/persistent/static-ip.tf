# Public IP for ingress-nginx. The sslip.io hostnames in gitops/ contain it, so a reserved IP keeps them
# stable between cluster rebuilds, but an unused reservation costs about US$7 a month.
#
# Off by default: release it between sessions. To bring the lab back:
#   terraform apply -var reserve_ingress_ip=true      (here, in persistent/)
#   ../../../../../scripts/set-ingress-ip.sh           (writes the new IP into gitops/; open a PR, merge)
#   then apply the cluster layer as usual.
resource "google_compute_address" "ingress" {
  count = var.reserve_ingress_ip ? 1 : 0

  name         = "shopverse-ingress"
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "PREMIUM"
  description  = "ingress-nginx LoadBalancer IP for the ShopVerse lab"
}

# The address used to be a single resource; keep its state if it is reserved again later.
moved {
  from = google_compute_address.ingress
  to   = google_compute_address.ingress[0]
}

locals {
  ingress_ip = one(google_compute_address.ingress[*].address)
}
