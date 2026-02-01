# IntentVision Terraform Infrastructure

Infrastructure as Code for IntentVision on Google Cloud Platform.

## Prerequisites

1. **Terraform >= 1.5.0**
   ```bash
   brew install terraform  # macOS
   ```

2. **GCP Authentication**
   ```bash
   gcloud auth application-default login
   ```

3. **Create State Bucket** (one-time setup)
   ```bash
   PROJECT_ID=intentvision
   gsutil mb -p ${PROJECT_ID} -l us-central1 gs://${PROJECT_ID}-tfstate
   gsutil versioning set on gs://${PROJECT_ID}-tfstate
   ```

## Usage

### Initialize

```bash
cd infrastructure/terraform
terraform init
```

### Plan (Staging)

```bash
terraform plan -var-file=environments/staging/terraform.tfvars
```

### Apply (Staging)

```bash
terraform apply -var-file=environments/staging/terraform.tfvars
```

### Plan (Production)

```bash
terraform plan -var-file=environments/production/terraform.tfvars
```

### Apply (Production)

```bash
terraform apply -var-file=environments/production/terraform.tfvars
```

## Structure

```
infrastructure/terraform/
├── main.tf                 # Main configuration
├── variables.tf            # Input variables
├── outputs.tf              # Output values
├── versions.tf             # Provider versions
├── backend.tf              # Remote state (GCS)
├── environments/
│   ├── staging/
│   │   └── terraform.tfvars
│   └── production/
│       └── terraform.tfvars
└── modules/                # Reusable modules (future)
```

## Resources Created

| Resource | Description |
|----------|-------------|
| Cloud Run Service | API server |
| Artifact Registry | Container images |
| Service Account | Cloud Run identity |
| IAM Bindings | Firestore, Secret Manager access |

## State Management

- State stored in GCS: `gs://intentvision-tfstate/terraform/state`
- Versioning enabled for rollback
- Lock via GCS object locking

## CI/CD Integration

GitHub Actions workflow uses Workload Identity Federation (WIF):
- No service account keys in CI
- See `.github/workflows/ci.yml` for deployment steps
