# Minimal identity for the nodes. GKE's default (the Compute Engine default service account)
# has project-wide Editor; this one can only write logs and metrics.
resource "google_service_account" "gke_nodes" {
  account_id   = "gke-nodes"
  display_name = "GKE nodes (shopverse-lab)"
}

resource "google_project_iam_member" "gke_nodes" {
  project = var.project_id
  role    = "roles/container.defaultNodeServiceAccount"
  member  = google_service_account.gke_nodes.member
}
