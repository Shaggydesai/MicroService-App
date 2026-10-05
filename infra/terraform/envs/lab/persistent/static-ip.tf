# Fixed public IP for ingress-nginx. Kept when the cluster is destroyed so the app's sslip.io
# hostnames (and the values in Git) never change. Costs a little per hour while unused.
resource "google_compute_address" "ingress" {
  name         = "shopverse-ingress"
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "PREMIUM"
  description  = "ingress-nginx LoadBalancer IP for the ShopVerse lab"
}
