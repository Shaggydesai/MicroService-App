# The one imperative step: hand the new cluster to Argo CD (scripts/argocd-bootstrap.sh).
# After this, Git (branch main) is the source of truth for everything inside the cluster;
# Terraform only owns the cloud resources.
#
# Runs once per cluster: the trigger is the cluster ID, so changing the node pool (e.g. -var spot=false)
# doesn't re-run it, while a destroyed and re-created cluster does.
# Needs kubectl and gcloud (with gke-gcloud-auth-plugin) on the machine running terraform apply.
resource "terraform_data" "argocd_bootstrap" {
  count = var.enable_argocd_bootstrap ? 1 : 0

  triggers_replace = [google_container_cluster.lab.id]

  provisioner "local-exec" {
    command = "bash ${abspath("${path.module}/../../../../../scripts/argocd-bootstrap.sh")}"
    environment = {
      PROJECT = var.project_id
      ZONE    = var.zone
      CLUSTER = google_container_cluster.lab.name
    }
  }

  # Nodes to run Argo CD on, and Vault's Google identity in place before Argo CD deploys Vault.
  depends_on = [
    google_container_node_pool.primary,
    google_service_account_iam_member.vault_workload_identity,
  ]
}
