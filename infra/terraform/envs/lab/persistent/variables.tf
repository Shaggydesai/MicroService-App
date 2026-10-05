variable "project_id" {
  description = "GCP project that hosts the ShopVerse lab."
  type        = string
  default     = "shopverse-lab"
}

variable "region" {
  description = "Region for the KMS key, unseal bucket and static IP. Must match the cluster's region."
  type        = string
  default     = "asia-south1"
}
