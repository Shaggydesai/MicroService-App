variable "project_id" {
  description = "GCP project that hosts the ShopVerse lab."
  type        = string
}

variable "region" {
  description = "Default region for regional resources (state bucket, cluster later)."
  type        = string
  default     = "asia-south1"
}

variable "github_repository" {
  description = "GitHub repository allowed to authenticate to GCP, as owner/name (case-sensitive)."
  type        = string
  default     = "Shaggydesai/MicroService-App"
}

variable "github_apply_environment" {
  description = "GitHub Actions environment whose jobs may use the apply service account. Protect it with required reviewers."
  type        = string
  default     = "gcp-infra"
}

variable "billing_account_id" {
  description = "Billing account ID (XXXXXX-XXXXXX-XXXXXX), shown on Billing > Overview."
  type        = string
}

variable "budget_amount" {
  description = "Monthly budget in the billing account's currency."
  type        = number
  default     = 2500
}

variable "budget_currency" {
  description = "Must match the billing account currency."
  type        = string
  default     = "INR"
}
