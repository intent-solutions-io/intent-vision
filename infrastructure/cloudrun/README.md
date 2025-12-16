# IntentVision Cloud Run Deployment

## Prerequisites

1. **Google Cloud SDK** installed and configured
2. **Docker** installed and running
3. **GCP Project** with billing enabled
4. **APIs enabled:**
   - Cloud Run API
   - Container Registry API
   - Secret Manager API

## Quick Start

```bash
# 1. Set up secrets
gcloud secrets create turso-database-url --data-file=-
echo -n "libsql://your-db.turso.io" | gcloud secrets versions add turso-database-url --data-file=-

gcloud secrets create turso-auth-token --data-file=-
echo -n "your-turso-token" | gcloud secrets versions add turso-auth-token --data-file=-

gcloud secrets create nixtla-api-key --data-file=-
echo -n "your-nixtla-key" | gcloud secrets versions add nixtla-api-key --data-file=-

# 2. Deploy
./deploy.sh YOUR_PROJECT_ID us-central1
```

## Manual Deployment

```bash
# Build
docker build -t gcr.io/PROJECT_ID/intentvision .

# Push
docker push gcr.io/PROJECT_ID/intentvision

# Deploy
gcloud run deploy intentvision \
  --image gcr.io/PROJECT_ID/intentvision \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `INTENTVISION_DB_URL` | Turso database URL | Secret Manager |
| `INTENTVISION_DB_AUTH_TOKEN` | Turso auth token | Secret Manager |
| `NIXTLA_API_KEY` | Nixtla TimeGPT API key | Secret Manager |
| `NODE_ENV` | Environment (production) | Set directly |
| `FUNCTION_TARGET` | Cloud Functions entry point | Set directly |

## Testing

```bash
# Health check
curl https://intentvision-xxx.run.app/

# Run pipeline
curl -X POST https://intentvision-xxx.run.app/ \
  -H "Content-Type: application/json" \
  -d '{"useSynthetic": true}'
```

## Monitoring

```bash
# View logs
gcloud run logs read intentvision --region us-central1

# Describe service
gcloud run services describe intentvision --region us-central1
```
