#!/bin/bash
# IntentVision Cloud Run Deployment Script
# Beads Task: intentvision-xyq.5
#
# Usage: ./deploy.sh [PROJECT_ID] [REGION]
# Example: ./deploy.sh my-gcp-project us-central1

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

PROJECT_ID="${1:-${GCP_PROJECT:-}}"
REGION="${2:-us-central1}"
SERVICE_NAME="intentvision"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# =============================================================================
# Validation
# =============================================================================

if [[ -z "$PROJECT_ID" ]]; then
    echo "ERROR: PROJECT_ID is required"
    echo "Usage: ./deploy.sh PROJECT_ID [REGION]"
    echo "Or set GCP_PROJECT environment variable"
    exit 1
fi

echo "=========================================="
echo "IntentVision Cloud Run Deployment"
echo "=========================================="
echo "Project:  $PROJECT_ID"
echo "Region:   $REGION"
echo "Service:  $SERVICE_NAME"
echo "Image:    $IMAGE_NAME"
echo "=========================================="

# =============================================================================
# Pre-flight Checks
# =============================================================================

echo ""
echo "[1/6] Running pre-flight checks..."

# Check gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "ERROR: gcloud CLI is not installed"
    exit 1
fi

# Check Docker is installed
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed"
    exit 1
fi

# Verify gcloud project
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null)
if [[ "$CURRENT_PROJECT" != "$PROJECT_ID" ]]; then
    echo "Setting project to $PROJECT_ID..."
    gcloud config set project "$PROJECT_ID"
fi

echo "Pre-flight checks passed!"

# =============================================================================
# Build Docker Image
# =============================================================================

echo ""
echo "[2/6] Building Docker image..."

# Move to project root
cd "$(dirname "$0")/../.."

# Build the image
docker build -t "${IMAGE_NAME}:latest" .

echo "Docker image built successfully!"

# =============================================================================
# Push to Container Registry
# =============================================================================

echo ""
echo "[3/6] Pushing to Container Registry..."

# Configure Docker for GCR
gcloud auth configure-docker gcr.io --quiet

# Push the image
docker push "${IMAGE_NAME}:latest"

echo "Image pushed successfully!"

# =============================================================================
# Create Secrets (if not exists)
# =============================================================================

echo ""
echo "[4/6] Checking secrets..."

# Check if secrets exist, prompt if not
for SECRET_NAME in turso-database-url turso-auth-token nixtla-api-key; do
    if ! gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
        echo "WARNING: Secret '$SECRET_NAME' does not exist."
        echo "Create it with: gcloud secrets create $SECRET_NAME --data-file=-"
        echo "Then add a version: echo -n 'value' | gcloud secrets versions add $SECRET_NAME --data-file=-"
    else
        echo "Secret '$SECRET_NAME' exists"
    fi
done

# =============================================================================
# Deploy to Cloud Run
# =============================================================================

echo ""
echo "[5/6] Deploying to Cloud Run..."

gcloud run deploy "$SERVICE_NAME" \
    --image "${IMAGE_NAME}:latest" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --cpu 2 \
    --memory 1Gi \
    --timeout 300 \
    --concurrency 80 \
    --min-instances 0 \
    --max-instances 10 \
    --set-env-vars "NODE_ENV=production,FUNCTION_TARGET=runPipeline" \
    --set-secrets "INTENTVISION_DB_URL=turso-database-url:latest,INTENTVISION_DB_AUTH_TOKEN=turso-auth-token:latest,NIXTLA_API_KEY=nixtla-api-key:latest" \
    --project "$PROJECT_ID"

# =============================================================================
# Verify Deployment
# =============================================================================

echo ""
echo "[6/6] Verifying deployment..."

# Get the service URL
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region "$REGION" \
    --project "$PROJECT_ID" \
    --format 'value(status.url)')

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Service URL: $SERVICE_URL"
echo ""
echo "Test the deployment:"
echo "  curl -X POST ${SERVICE_URL} -H 'Content-Type: application/json' -d '{\"useSynthetic\": true}'"
echo ""
echo "View logs:"
echo "  gcloud run logs read $SERVICE_NAME --region $REGION --project $PROJECT_ID"
echo "=========================================="
