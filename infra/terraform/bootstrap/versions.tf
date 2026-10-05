terraform {
  # Runs locally (or in Cloud Shell) by a project Owner. CI never applies this stage.
  required_version = ">= 1.9, < 2.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.5"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region

  # The Billing Budgets API needs a quota project when called with user credentials.
  user_project_override = true
  billing_project       = var.project_id
}

data "google_project" "this" {
  project_id = var.project_id
}
