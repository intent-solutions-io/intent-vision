# IntentVision Infrastructure
# Main Terraform configuration

locals {
  service_name = "intentvision-api"
  labels = {
    app         = "intentvision"
    environment = var.environment
    managed_by  = "terraform"
  }
}

# Configure the Google Cloud provider
provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "firestore.googleapis.com",
    "iam.googleapis.com",
    "cloudresourcemanager.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# Artifact Registry for container images
resource "google_artifact_registry_repository" "containers" {
  location      = var.region
  repository_id = "intentvision"
  format        = "DOCKER"
  description   = "IntentVision container images"
  labels        = local.labels

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

# Service account for Cloud Run
resource "google_service_account" "cloud_run" {
  account_id   = "${local.service_name}-${var.environment}"
  display_name = "IntentVision API (${var.environment})"
  description  = "Service account for IntentVision Cloud Run service"
}

# Grant Firestore access to the service account
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Grant Secret Manager access
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Cloud Run service
resource "google_cloud_run_v2_service" "api" {
  name     = "${local.service_name}-${var.environment}"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.cloud_run.email

    scaling {
      min_instance_count = var.cloud_run_min_instances
      max_instance_count = var.cloud_run_max_instances
    }

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/intentvision/api:latest"

      resources {
        limits = {
          cpu    = var.cloud_run_cpu
          memory = var.cloud_run_memory
        }
      }

      env {
        name  = "INTENTVISION_ENV"
        value = var.environment
      }

      env {
        name  = "NODE_ENV"
        value = var.environment == "production" ? "production" : "development"
      }

      startup_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        initial_delay_seconds = 5
        period_seconds        = 10
        failure_threshold     = 3
      }

      liveness_probe {
        http_get {
          path = "/health"
          port = 8080
        }
        period_seconds    = 30
        failure_threshold = 3
      }
    }
  }

  labels = local.labels

  depends_on = [
    google_project_service.apis["run.googleapis.com"],
    google_artifact_registry_repository.containers,
  ]
}

# Allow unauthenticated access (public API)
resource "google_cloud_run_v2_service_iam_member" "public" {
  name     = google_cloud_run_v2_service.api.name
  location = var.region
  role     = "roles/run.invoker"
  member   = "allUsers"
}
