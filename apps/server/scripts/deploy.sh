#!/bin/bash
set -e

# ===========================================
# Echo-Learn Server - GCP Cloud Run Deployment
# ===========================================
# Usage: ./deploy.sh <prod|beta|sandbox>
# ===========================================

ENV=$1

if [ -z "$ENV" ]; then
  echo "❌ Usage: $0 <prod|beta|sandbox>"
  exit 1
fi

if [[ ! "$ENV" =~ ^(prod|beta|sandbox)$ ]]; then
  echo "❌ Invalid environment: $ENV"
  echo "   Valid options: prod, beta, sandbox"
  exit 1
fi

# ===========================================
# Directory Resolution
# ===========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(dirname "$SCRIPT_DIR")"
ROOT_DIR="$(dirname "$(dirname "$SERVER_DIR")")"
SA_KEY="$SERVER_DIR/gcp-service-account.json"

echo "📁 Root directory: $ROOT_DIR"
echo "📁 Server directory: $SERVER_DIR"

# ===========================================
# Environment File Validation
# ===========================================
ENV_FILE="$SERVER_DIR/.env.$ENV"
if [ ! -f "$ENV_FILE" ]; then
  # Fallback to .env if .env.$ENV doesn't exist
  ENV_FILE="$SERVER_DIR/.env"
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Error: Environment file not found at $SERVER_DIR/.env.$ENV or $SERVER_DIR/.env"
  exit 1
fi

echo "📋 Using environment file: $ENV_FILE"

# ===========================================
# Service Account Validation
# ===========================================
if [ ! -f "$SA_KEY" ]; then
  echo "❌ Error: Service account key not found at $SA_KEY"
  echo "   Please place your 'gcp-service-account.json' in apps/server/"
  exit 1
fi

# ===========================================
# GCP Authentication
# ===========================================
echo ""
echo "🔐 Authenticating with Service Account..."
gcloud auth activate-service-account --key-file="$SA_KEY" --quiet

PROJECT_ID=$(grep '"project_id":' "$SA_KEY" | head -1 | cut -d '"' -f 4)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: Could not parse project_id from service account file."
  exit 1
fi

echo "📌 Project ID: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" --quiet

# ===========================================
# Environment-Specific Configuration
# ===========================================
SERVICE_NAME="echo-learn-server-$ENV"
IMAGE_NAME="asia-southeast1-docker.pkg.dev/$PROJECT_ID/echo-learn/$SERVICE_NAME"
REGION="asia-southeast1"  # Thailand region (nearest to India)

# Set resources based on environment
case $ENV in
  prod)
    MEMORY="2Gi"
    CPU="2"
    MIN_INSTANCES="1"
    MAX_INSTANCES="10"
    CONCURRENCY="80"
    ;;
  beta)
    MEMORY="1Gi"
    CPU="1"
    MIN_INSTANCES="0"
    MAX_INSTANCES="5"
    CONCURRENCY="80"
    ;;
  sandbox)
    MEMORY="512Mi"
    CPU="1"
    MIN_INSTANCES="0"
    MAX_INSTANCES="2"
    CONCURRENCY="40"
    ;;
esac

echo ""
echo "🌍 Environment: $ENV"
echo "📦 Service Name: $SERVICE_NAME"
echo "🖼️  Image: $IMAGE_NAME"
echo "📍 Region: $REGION"
echo "💾 Memory: $MEMORY"
echo "🔧 CPU: $CPU"
echo "📊 Instances: $MIN_INSTANCES - $MAX_INSTANCES"

# ===========================================
# Create Artifact Registry if not exists
# ===========================================
echo ""
echo "📦 Ensuring Artifact Registry repository exists..."
gcloud artifacts repositories describe echo-learn \
  --location="$REGION" \
  --quiet 2>/dev/null || \
gcloud artifacts repositories create echo-learn \
  --repository-format=docker \
  --location="$REGION" \
  --description="Echo-Learn Docker images" \
  --quiet

# ===========================================
# Build Container Image
# ===========================================
echo ""
echo "🏗️  Building container image..."
cd "$ROOT_DIR"

# Build and push using Cloud Build with cloudbuild.yaml
gcloud builds submit \
  --config=cloudbuild.yaml \
  --substitutions=_IMAGE_NAME="$IMAGE_NAME" \
  --timeout=20m \
  --region="$REGION" \
  --quiet

# ===========================================
# Prepare Environment Variables
# ===========================================
echo ""
echo "📋 Preparing environment variables..."

TEMP_ENV_YAML="$SERVER_DIR/.deploy-env.yaml"
echo "NODE_ENV: \"production\"" > "$TEMP_ENV_YAML"
echo "ENVIRONMENT: \"$ENV\"" >> "$TEMP_ENV_YAML"

while IFS='=' read -r key value || [[ -n "$key" ]]; do
  # Skip empty lines and comments
  [[ -z "$key" || "$key" =~ ^[[:space:]]*# ]] && continue

  # Clean the key (remove any whitespace)
  key=$(echo "$key" | tr -d '[:space:]')

  # Clean the value (remove surrounding quotes if present)
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")

  # Skip if key or value is empty after cleaning
  [[ -z "$key" || -z "$value" ]] && continue

  # Skip NODE_ENV and PORT as they're already added or reserved
  [[ "$key" == "NODE_ENV" || "$key" == "PORT" ]] && continue

  # Escape special characters for YAML
  value=$(echo "$value" | sed 's/"/\\"/g')

  # Add to YAML environment file
  echo "${key}: \"${value}\"" >> "$TEMP_ENV_YAML"
  echo "  ✓ Added: $key"
done < "$ENV_FILE"

# ===========================================
# Deploy to Cloud Run
# ===========================================
echo ""
echo "🚀 Deploying to Cloud Run..."

gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --memory "$MEMORY" \
  --cpu "$CPU" \
  --min-instances "$MIN_INSTANCES" \
  --max-instances "$MAX_INSTANCES" \
  --concurrency "$CONCURRENCY" \
  --timeout 300 \
  --env-vars-file="$TEMP_ENV_YAML" \
  --quiet

# Clean up temp env file
rm -f "$TEMP_ENV_YAML"

# ===========================================
# Get Service URL
# ===========================================
echo ""
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --platform managed \
  --region "$REGION" \
  --format 'value(status.url)')

echo "============================================"
echo "✅ Deployment Complete!"
echo "============================================"
echo "🌍 Environment: $ENV"
echo "📦 Service: $SERVICE_NAME"
echo "🔗 URL: $SERVICE_URL"
echo "============================================"
