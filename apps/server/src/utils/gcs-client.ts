// ** import lib
import { createGCSClient } from '@repo/gcs'

export const gcsClient = createGCSClient({
  projectId: process.env.GCS_PROJECT_ID!,
  keyFilename: process.env.GCS_KEY_FILE,
})
