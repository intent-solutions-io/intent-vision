# Production environment configuration

project_id  = "intentvision"
region      = "us-central1"
environment = "production"

# Cloud Run sizing (production scale)
cloud_run_cpu          = "2"
cloud_run_memory       = "1Gi"
cloud_run_min_instances = 1
cloud_run_max_instances = 10

# Domain
domain = "api.intentvision.io"

# Features (enabled for production)
enable_cdn   = true
enable_armor = true
