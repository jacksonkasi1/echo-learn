# Echo-Learn Server

The API server for Echo-Learn, built with [Hono](https://hono.dev/) and [Bun](https://bun.sh/).

## Installation

```sh
bun install
```

## Development

```sh
bun run dev
```

Open http://localhost:8787

## Build

```sh
bun run build
```

## Production

```sh
bun run start
```

---

## 🚀 Deployment to Google Cloud Run

The server can be deployed to Google Cloud Run using the provided deployment scripts.

### Prerequisites

1. **Google Cloud SDK** - Install from https://cloud.google.com/sdk/docs/install
2. **Service Account Key** - Place your `gcp-service-account.json` in `apps/server/`
   - The service account needs these roles:
     - `Cloud Run Admin`
     - `Cloud Build Editor`
     - `Storage Admin`
     - `Service Account User`

### Deploy Commands

From the `apps/server` directory:

```sh
# Deploy to sandbox (development/testing)
bun run deploy:sandbox

# Deploy to beta (staging)
bun run deploy:beta

# Deploy to production
bun run deploy:prod
```

Or from the monorepo root:

```sh
cd apps/server && bun run deploy:prod
```

### Environment Configurations

| Environment | Memory | CPU | Min Instances | Max Instances | Use Case |
|-------------|--------|-----|---------------|---------------|----------|
| `sandbox`   | 512Mi  | 1   | 0             | 2             | Development & Testing |
| `beta`      | 1Gi    | 1   | 0             | 5             | Staging & QA |
| `prod`      | 2Gi    | 2   | 1             | 10            | Production |

### Service Names

- **Sandbox**: `echo-learn-server-sandbox`
- **Beta**: `echo-learn-server-beta`
- **Production**: `echo-learn-server-prod`

### Environment Variables

The following environment variables are automatically set during deployment:

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `ENVIRONMENT` | `prod` / `beta` / `sandbox` |

To add additional environment variables, modify the `--set-env-vars` flag in `scripts/deploy.sh`.

### Troubleshooting

**Service account not found:**
```
Error: Service account key not found at apps/server/gcp-service-account.json
```
→ Ensure your `gcp-service-account.json` file is in the `apps/server/` directory.

**Permission denied:**
```
ERROR: (gcloud.run.deploy) PERMISSION_DENIED
```
→ Verify your service account has the required IAM roles.

**Build timeout:**
→ The build timeout is set to 20 minutes. For larger builds, increase the `--timeout` flag in `scripts/deploy.sh`.