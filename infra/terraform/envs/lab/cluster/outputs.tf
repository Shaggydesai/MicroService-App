output "cluster_name" {
  value = google_container_cluster.lab.name
}

output "cluster_location" {
  value = google_container_cluster.lab.location
}

output "get_credentials" {
  description = "Run this to point kubectl at the cluster."
  value       = "gcloud container clusters get-credentials ${google_container_cluster.lab.name} --zone ${var.zone} --project ${var.project_id}"
}

output "node_pool" {
  value = "${google_container_node_pool.primary.name}: ${var.node_count} x ${var.machine_type}${var.spot ? " (Spot)" : ""}"
}
