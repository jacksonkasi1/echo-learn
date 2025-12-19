// ** import lib
import { Storage } from '@google-cloud/storage'

// ** import types
export interface GCSConfig {
  projectId: string
  keyFilename?: string
  credentials?: {
    client_email: string
    private_key: string
  }
}

/**
 * Create a Google Cloud Storage client
 * Supports both key file and direct credentials
 */
export function createGCSClient(config: GCSConfig): Storage {
  if (config.credentials) {
    return new Storage({
      projectId: config.projectId,
      credentials: config.credentials,
    })
  }

  return new Storage({
    projectId: config.projectId,
    keyFilename: config.keyFilename,
  })
}

/**
 * Create a GCS client from environment variables
 */
export function createGCSClientFromEnv(): Storage {
  const projectId = process.env.GCS_PROJECT_ID
  const keyFilename = process.env.GCS_KEY_FILE

  if (!projectId) {
    throw new Error('GCS_PROJECT_ID environment variable is required')
  }

  return createGCSClient({
    projectId,
    keyFilename,
  })
}
