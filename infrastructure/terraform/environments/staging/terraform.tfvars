# Staging environment configuration

project_id  = "intentvision"
region      = "us-central1"
environment = "staging"

# Cloud Run sizing (minimal for staging)
cloud_run_cpu           = "1"
cloud_run_memory        = "512Mi"
cloud_run_min_instances = 0
cloud_run_max_instances = 3

# Image tag (override in CI with git SHA)
image_tag = "latest"
