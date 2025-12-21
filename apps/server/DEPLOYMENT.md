# Echo-Learn Server Deployment Guide

## Quick Start

### Local Development

1. Copy the example environment file:
```bash
cp example.env .env
```

2. Fill in your API keys and configuration values in `.env`

3. Start the development server:
```bash
bun run dev
```

### Production Deployment to Google Cloud Run

#### Prerequisites

- GCP project with Cloud Run enabled
- Service account with Cloud Run Admin and Container Registry roles
- `gcloud` CLI installed and authenticated
- API keys for all external services (Upstash, Gemini, Cohere, Mistral, ElevenLabs)

#### Setup

1. **Create service account key:**
```bash
# Save your GCP service account JSON to:
cp your-service-account.json apps/server/gcp-service-account.json
```

2. **Create environment file for your target environment:**
```bash
# For production
cp example.env apps/server/.env.prod
# For beta
cp example.env apps/server/.env.beta
# For sandbox
cp example.env apps/server/.env.sandbox
```

3. **Edit the environment file with your values:**
```bash
nano apps/server/.env.prod
```

#### Deploy

```bash
# Deploy to production
./apps/server/scripts/deploy.sh prod

# Deploy to beta
./apps/server/scripts/deploy.sh beta

# Deploy to sandbox
./apps/server/scripts/deploy.sh sandbox
```

#### Customize Region and Service Account Path

The deploy script can be customized via environment variables:

```bash
# Use a different GCP region
GCP_REGION=us-central1 ./apps/server/scripts/deploy.sh prod

# Use a different service account key path
GCP_SA_KEY_PATH=./my-sa-key.json ./apps/server/scripts/deploy.sh prod

# Both together
GCP_REGION=europe-west1 GCP_SA_KEY_PATH=./sa-keys/prod.json ./apps/server/scripts/deploy.sh prod
```

## Environment Variables

See `example.env` for detailed descriptions of all environment variables.

### Required Variables

- **Upstash Vector**: `UPSTASH_VECTOR_REST_URL`, `UPSTASH_VECTOR_REST_TOKEN`
- **Upstash Redis**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- **GCS**: `GCS_PROJECT_ID`, `GCS_KEY_FILE`, `GCS_BUCKET_NAME`
- **Gemini AI**: `GOOGLE_GENERATIVE_AI_API_KEY`
- **Cohere**: `COHERE_API_KEY`
- **Mistral**: `MISTRAL_API_KEY`
- **ElevenLabs**: `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_AGENT_SECRET`

### Server Configuration

- **PORT**: Default `8787`
- **NODE_ENV**: `development` or `production`
- **CORS_ORIGINS**: Comma-separated list of allowed origins

## File Structure

```
apps/server/
├── example.env              # Template with descriptions
├── .env                     # Local development (gitignored)
├── .env.prod                # Production config (gitignored)
├── .env.beta                # Beta config (gitignored)
├── .env.sandbox             # Sandbox config (gitignored)
├── scripts/
│   └── deploy.sh            # Cloud Run deployment script
├── gcp-service-account.json # Service account key (gitignored)
└── src/
    └── index.ts             # Server entry point
```

## Troubleshooting

### Deployment Script Errors

#### "Service account key not found"
- Ensure `gcp-service-account.json` exists in `apps/server/`
- Or provide path: `GCP_SA_KEY_PATH=/path/to/key.json ./scripts/deploy.sh prod`

#### "Environment file not found"
- Create `.env.prod` (or `.env.beta`, `.env.sandbox`)
- Or place `.env` as fallback
- Example: `cp example.env .env.prod`

#### "Container failed to start"
- Check Cloud Run logs: Follow the link in deployment output
- Ensure all required environment variables are set
- Verify API keys are correct and active

#### "Build failed - lockfile had changes"
- Run locally first to update `bun.lock`
- Commit the lockfile
- Retry deployment

### Cloud Run Health Check Issues

If Cloud Run can't reach the health endpoint:
- Check CORS_ORIGINS includes your domain
- Verify PORT is set to 8787
- Check Cloud Run logs for startup errors

## Security Best Practices

1. **Never commit secrets:**
   - Keep `.env.*` files in `.gitignore`
   - Use Cloud Run Secret Manager for production
   - Reference secrets in environment variables

2. **Rotate API keys regularly:**
   - Set reminders to rotate credentials quarterly
   - Use Cloud Run's deployment versioning to track key changes

3. **Use service-specific keys:**
   - Each external service should have its own API key
   - Don't share keys across services

4. **Monitor resource usage:**
   - Set appropriate memory/CPU limits
   - Configure auto-scaling settings
   - Monitor Cloud Run metrics

## Deployment Environments

### Production (`prod`)
- Memory: 2Gi
- CPU: 2
- Min Instances: 1
- Max Instances: 10
- Concurrency: 80

### Beta (`beta`)
- Memory: 1Gi
- CPU: 1
- Min Instances: 0
- Max Instances: 5
- Concurrency: 80

### Sandbox (`sandbox`)
- Memory: 512Mi
- CPU: 1
- Min Instances: 0
- Max Instances: 2
- Concurrency: 40

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review the deployment script output and Cloud Run logs
3. Verify all environment variables are set correctly
