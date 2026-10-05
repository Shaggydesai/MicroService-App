terraform {
  required_version = ">= 1.9, < 2.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.5"
    }
  }

  backend "gcs" {
    bucket = "tfstate-684852499708"
    prefix = "lab/cluster"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}
