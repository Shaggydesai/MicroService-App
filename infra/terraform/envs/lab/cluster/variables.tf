variable "project_id" {
  description = "GCP project that hosts the ShopVerse lab."
  type        = string
  default     = "shopverse-lab"
}

variable "region" {
  description = "Region of the VPC subnet. Must match the persistent layer."
  type        = string
  default     = "asia-south1"
}

variable "zone" {
  description = "Zone of the cluster. A single-zone cluster qualifies for the GKE free management credit."
  type        = string
  default     = "asia-south1-a"
}

variable "machine_type" {
  description = "Node machine type. e2-standard-4 = 4 vCPU / 16 GB."
  type        = string
  default     = "e2-standard-4"
}

variable "node_count" {
  description = "Number of nodes (fixed size, no autoscaling)."
  type        = number
  default     = 2
}

variable "spot" {
  description = "Use Spot VMs (about 3x cheaper, can be reclaimed). Set false on demo-recording day for stable nodes."
  type        = bool
  default     = true
}

variable "node_disk_size_gb" {
  description = "Boot disk size per node."
  type        = number
  default     = 50
}

variable "enable_argocd_bootstrap" {
  description = "Install Argo CD and the root app right after the cluster is created (scripts/argocd-bootstrap.sh). Set false for a bare cluster."
  type        = bool
  default     = true
}
