// ** import lib
import { createGCSClient } from "@repo/gcs";

/**
 * Create GCS client with support for both:
 * 1. Key file path (for local development) - GCS_KEY_FILE
 * 2. Direct credentials via environment variables (for Cloud Run) - GCS_CLIENT_EMAIL and GCS_PRIVATE_KEY
 *
 * Cloud Run approach: Pass the service account credentials as environment variables
 * instead of bundling the JSON file in the container image.
 */
function getGCSClient() {
  const projectId = process.env.GCS_PROJECT_ID!;
  const keyFilename = process.env.GCS_KEY_FILE;
  const clientEmail = process.env.GCS_CLIENT_EMAIL;
  const privateKey = process.env.GCS_PRIVATE_KEY;

  // If direct credentials are provided (preferred for Cloud Run), use them
  if (clientEmail && privateKey) {
    return createGCSClient({
      projectId,
      credentials: {
        client_email: clientEmail,
        // Private key from env var needs newlines restored
        // (they get escaped when passed as env vars)
        private_key: privateKey.replace(/\\n/g, "\n"),
      },
    });
  }

  // Fall back to key file path (for local development)
  return createGCSClient({
    projectId,
    keyFilename,
  });
}

export const gcsClient = getGCSClient();
