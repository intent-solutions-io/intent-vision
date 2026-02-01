# Input variables for IntentVision infrastructure

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for resources"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (staging, production)"
  type        = string
  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be 'staging' or 'production'."
  }
}

# Cloud Run configuration
variable "cloud_run_cpu" {
  description = "CPU allocation for Cloud Run service"
  type        = string
  default     = "1"
}

variable "cloud_run_memory" {
  description = "Memory allocation for Cloud Run service"
  type        = string
  default     = "512Mi"
}

variable "cloud_run_min_instances" {
  description = "Minimum number of Cloud Run instances"
  type        = number
  default     = 0
}

variable "cloud_run_max_instances" {
  description = "Maximum number of Cloud Run instances"
  type        = number
  default     = 10
}

# Domain configuration
variable "domain" {
  description = "Custom domain for the API"
  type        = string
  default     = ""
}

# Feature flags
variable "enable_cdn" {
  description = "Enable Cloud CDN for static assets"
  type        = bool
  default     = false
}

variable "enable_armor" {
  description = "Enable Cloud Armor WAF"
  type        = bool
  default     = false
}
