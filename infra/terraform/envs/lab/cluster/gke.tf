resource "google_container_cluster" "lab" {
  name     = "shopverse-lab"
  location = var.zone # zonal

  # Lab cluster: must be destroyable by `terraform destroy` (GKE defaults this to true).
  deletion_protection = false

  network         = google_compute_network.vpc.id
  subnetwork      = google_compute_subnetwork.gke.id
  networking_mode = "VPC_NATIVE"
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Dataplane V2 (eBPF): enforces the chart's NetworkPolicies. Without it they are ignored.
  datapath_provider = "ADVANCED_DATAPATH"

  # Pods get Google identities without key files (used by Vault for KMS auto-unseal).
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  release_channel {
    channel = "REGULAR"
  }

  # Only GKE's own components go to Cloud Logging / Monitoring; the apps use Loki and Prometheus.
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS"]
  }
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = false
    }
  }

  addons_config {
    # We use ingress-nginx, not the GCE ingress controller.
    http_load_balancing {
      disabled = true
    }
  }

  # GKE requires a node pool at creation; replace it with the managed pool below.
  remove_default_node_pool = true
  initial_node_count       = 1
  node_config {
    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"]
  }

  lifecycle {
    ignore_changes = [node_config] # belongs to the temporary default pool only
  }

  depends_on = [google_project_iam_member.gke_nodes]
}

resource "google_container_node_pool" "primary" {
  name       = var.spot ? "primary-spot" : "primary-standard"
  cluster    = google_container_cluster.lab.id
  location   = var.zone
  node_count = var.node_count

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }

  node_config {
    machine_type = var.machine_type
    spot         = var.spot
    disk_type    = "pd-balanced"
    disk_size_gb = var.node_disk_size_gb

    service_account = google_service_account.gke_nodes.email
    oauth_scopes    = ["https://www.googleapis.com/auth/cloud-platform"] # access is limited by IAM, not scopes

    workload_metadata_config {
      mode = "GKE_METADATA" # required for Workload Identity
    }

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    labels = {
      pool = "primary"
    }
    resource_labels = {
      app = "shopverse"
      env = "lab"
    }
  }

  lifecycle {
    create_before_destroy = true # switching Spot <-> standard keeps the cluster usable
  }
}
