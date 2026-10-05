# Dedicated VPC with planned IP ranges (instead of the auto-created "default" network).
resource "google_compute_network" "vpc" {
  name                    = "shopverse-vpc"
  auto_create_subnetworks = false
  routing_mode            = "REGIONAL"
}

resource "google_compute_subnetwork" "gke" {
  name                     = "gke-${var.region}"
  region                   = var.region
  network                  = google_compute_network.vpc.id
  ip_cidr_range            = "10.10.0.0/20" # nodes (4,096 addresses)
  private_ip_google_access = true

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = "10.20.0.0/16" # 65,536 pod IPs
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = "10.30.0.0/20" # 4,096 Service IPs
  }
}
