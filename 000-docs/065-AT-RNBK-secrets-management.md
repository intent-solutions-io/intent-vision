# Secrets Management Runbook

**Document ID:** 065-AT-RNBK-secrets-management
**Category:** AT (Artifact) - RNBK (Runbook)
**Status:** Active
**Last Updated:** 2026-02-03

---

## Overview

IntentVision uses Google Cloud Secret Manager for all sensitive credentials. Secrets are created via Terraform and values are set manually or via CI.

## Naming Convention

```
{environment}-{service}-{key}
```

| Environment | Examples |
|-------------|----------|
| `staging` | `staging-turso-url`, `staging-nixtla-api-key` |
| `production` | `production-turso-url`, `production-nixtla-api-key` |

## Secret Inventory

| Secret Name | Purpose | Required | Rotation |
|-------------|---------|----------|----------|
| `{env}-turso-url` | Turso database connection URL | Yes | On compromise |
| `{env}-turso-token` | Turso authentication token | Yes | 90 days |
| `{env}-nixtla-api-key` | Nixtla TimeGPT API key | No | On compromise |
| `{env}-resend-api-key` | Resend email service API key | No | On compromise |

## Creating Secrets (Terraform)

Secrets are created empty by Terraform:

```bash
cd infrastructure/terraform

# Staging
terraform apply -var-file=environments/staging/terraform.tfvars

# Production
terraform apply -var-file=environments/production/terraform.tfvars
```

## Setting Secret Values

### Via gcloud CLI

```bash
# Set a new secret value
echo -n "your-secret-value" | gcloud secrets versions add {secret-name} --data-file=-

# Example: Set production Turso URL
echo -n "libsql://your-db.turso.io" | gcloud secrets versions add production-turso-url --data-file=-

# Example: Set production Turso token
echo -n "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9..." | gcloud secrets versions add production-turso-token --data-file=-
```

### Via Console

1. Go to [Secret Manager Console](https://console.cloud.google.com/security/secret-manager?project=intentvision)
2. Click on the secret name
3. Click "New Version"
4. Enter the secret value
5. Click "Add New Version"

## Viewing Secrets

```bash
# List all secrets
gcloud secrets list --filter="labels.app=intentvision"

# List versions of a secret
gcloud secrets versions list {secret-name}

# Access latest version (requires secretAccessor role)
gcloud secrets versions access latest --secret={secret-name}
```

## Rotation Procedure

### 1. Generate New Credential

Obtain new credential from the service provider:
- **Turso:** Dashboard > Database > Generate Token
- **Nixtla:** Dashboard > API Keys > Create
- **Resend:** Dashboard > API Keys > Create

### 2. Add New Version

```bash
echo -n "new-credential-value" | gcloud secrets versions add {secret-name} --data-file=-
```

### 3. Verify Application

```bash
# Trigger a new Cloud Run revision to pick up the new secret
gcloud run services update intentvision-api-{env} \
  --region=us-central1 \
  --update-env-vars=ROTATION_TRIGGER=$(date +%s)

# Verify health
# Staging: https://stg.intentvision.intent-solutions.io/health
# Production: https://api.intentvision.io/health
curl https://{your-environment-url}/health
```

### 4. Disable Old Version (After Verification)

```bash
# List versions
gcloud secrets versions list {secret-name}

# Disable old version (keep for rollback window)
gcloud secrets versions disable {version-id} --secret={secret-name}

# Destroy old version (after 7 days)
gcloud secrets versions destroy {version-id} --secret={secret-name}
```

## Emergency Rotation

If a secret is compromised:

```bash
# 1. Immediately rotate at source (revoke old, create new)
# 2. Add new version
echo -n "new-value" | gcloud secrets versions add {secret-name} --data-file=-

# 3. Force redeploy (replace {env} with staging or production)
gcloud run services update intentvision-api-{env} \
  --region=us-central1 \
  --update-env-vars=EMERGENCY_ROTATION=$(date +%s)

# 4. Destroy compromised version (find ID via: gcloud secrets versions list {secret-name})
gcloud secrets versions destroy {version-id} --secret={secret-name}

# 5. Audit access logs
gcloud logging read 'resource.type="secretmanager.googleapis.com/Secret"' --limit=100
```

## Rotation Schedule

| Secret Type | Frequency | Next Rotation |
|-------------|-----------|---------------|
| Turso tokens | 90 days | Track in calendar |
| API keys | On compromise | N/A |

## Access Control

Secrets are accessible only to:
- Cloud Run service account (`intentvision-api-{env}@intentvision.iam.gserviceaccount.com`)
- Project owners (for management)

IAM is granted per-secret, not project-wide (least privilege).

## Troubleshooting

### Secret Not Found

```bash
# Verify secret exists
gcloud secrets describe {secret-name}

# Check IAM bindings
gcloud secrets get-iam-policy {secret-name}
```

### Access Denied

```bash
# Verify service account has access
gcloud secrets get-iam-policy {secret-name} \
  --format="table(bindings.role,bindings.members)"

# Grant access if missing (via Terraform preferred)
gcloud secrets add-iam-policy-binding {secret-name} \
  --member="serviceAccount:{sa-email}" \
  --role="roles/secretmanager.secretAccessor"
```

### Application Not Picking Up New Secret

Cloud Run caches secrets. Force a new revision:

```bash
gcloud run services update intentvision-api-{env} \
  --region=us-central1 \
  --update-env-vars=SECRET_REFRESH=$(date +%s)
```

---

## References

- [Secret Manager Documentation](https://cloud.google.com/secret-manager/docs)
- [Terraform secrets.tf](../infrastructure/terraform/secrets.tf)
- [Deploy Runbook](./051-AT-RNBK-intentvision-deploy-rollback.md)
