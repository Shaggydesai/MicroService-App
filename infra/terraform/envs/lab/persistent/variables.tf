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

variable "reserve_ingress_ip" {
  description = "Reserve the static ingress IP (about US$7/month while unused). Turn on before bringing the cluster back, then run scripts/set-ingress-ip.sh."
  type        = bool
  default     = false
}
