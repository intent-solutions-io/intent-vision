# Remote state configuration using GCS
# State bucket must be created manually before first terraform init:
#   gsutil mb -p ${PROJECT_ID} -l us-central1 gs://${PROJECT_ID}-tfstate
#   gsutil versioning set on gs://${PROJECT_ID}-tfstate

terraform {
  backend "gcs" {
    bucket = "intentvision-tfstate"
    prefix = "terraform/state"
  }
}
