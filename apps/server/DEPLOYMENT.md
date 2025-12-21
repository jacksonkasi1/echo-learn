# Deployment Guide

## Local Development

```bash
cp example.env .env
# Edit .env with your values
bun run dev
```

## Cloud Run Deployment

### Setup

1. Save GCP service account JSON:
```bash
cp your-service-account.json apps/server/gcp-service-account.json
```

2. Create environment file:
```bash
cp example.env apps/server/.env.prod
# Edit with your production values
nano apps/server/.env.prod
```

### Deploy

```bash
./apps/server/scripts/deploy.sh prod
./apps/server/scripts/deploy.sh beta
./apps/server/scripts/deploy.sh sandbox
```

### Customize Region & Service Account Path

```bash
GCP_REGION=us-central1 ./apps/server/scripts/deploy.sh prod
GCP_SA_KEY_PATH=./my-sa-key.json ./apps/server/scripts/deploy.sh prod
```

## Environment Files

- `.env` - Local development (gitignored)
- `.env.prod` - Production (gitignored)
- `.env.beta` - Beta (gitignored)
- `.env.sandbox` - Sandbox (gitignored)

Use `example.env` as template.

## Troubleshooting

- **Service account not found**: Check `gcp-service-account.json` exists or set `GCP_SA_KEY_PATH`
- **Environment file not found**: Create `.env.prod` from `example.env`
- **Container failed to start**: Check Cloud Run logs via deployment output link
- **API key errors**: Verify all keys in `.env.prod` are correct and active
