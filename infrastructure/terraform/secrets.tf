# Secret Manager resources for IntentVision
# Secrets are created empty - values must be set manually or via CI

locals {
  # Secret naming convention: {environment}-{service}-{key}
  secrets = {
    turso_url   = "${var.environment}-turso-url"
    turso_token = "${var.environment}-turso-token"
    nixtla_key  = "${var.environment}-nixtla-api-key"
    resend_key  = "${var.environment}-resend-api-key"
  }
}

# Create secrets (empty - values set externally)
resource "google_secret_manager_secret" "secrets" {
  for_each  = local.secrets
  secret_id = each.value

  replication {
    auto {}
  }

  labels = merge(local.labels, {
    secret_type = each.key
  })

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

# Grant Cloud Run service account access to read secrets
resource "google_secret_manager_secret_iam_member" "cloud_run_access" {
  for_each  = google_secret_manager_secret.secrets
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.cloud_run.email}"
}

# Output secret names for reference
output "secret_names" {
  description = "Secret Manager secret names"
  value       = { for k, v in local.secrets : k => v }
}
