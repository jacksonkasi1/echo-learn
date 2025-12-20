// Ingest API module
// Handles all document ingestion-related API calls to the backend

import { apiClient } from './client'

// Types for ingest operations
export interface IngestRequest {
  fileId: string
  userId: string
}

export interface IngestResponse {
  fileId: string
  status: 'processed' | 'failed'
  chunksCount?: number
  graphNodesCount?: number
  graphEdgesCount?: number
  processingTimeMs?: number
  error?: string
}

export interface IngestStatusResponse {
  fileId: string
  status: 'pending_upload' | 'uploaded' | 'processing' | 'processed' | 'failed'
  fileName: string
  createdAt: string
  processedAt?: string
  error?: string
}

/**
 * Trigger document ingestion for an uploaded file
 * This processes the file through OCR, chunking, embedding, and graph generation
 */
export async function ingestFile(request: IngestRequest): Promise<IngestResponse> {
  const response = await apiClient.post<IngestResponse>('/api/ingest', request)
  return response.data
}

/**
 * Get the processing status of a file
 */
export async function getIngestStatus(fileId: string): Promise<IngestStatusResponse> {
  const response = await apiClient.get<IngestStatusResponse>(
    `/api/ingest/status/${fileId}`,
  )
  return response.data
}

/**
 * Poll for ingestion completion
 * Returns when the file is processed or failed, or when maxAttempts is reached
 */
export async function waitForIngestion(
  fileId: string,
  options: {
    pollIntervalMs?: number
    maxAttempts?: number
    onStatusChange?: (status: IngestStatusResponse) => void
  } = {},
): Promise<IngestStatusResponse> {
  const { pollIntervalMs = 2000, maxAttempts = 60, onStatusChange } = options

  let attempts = 0

  while (attempts < maxAttempts) {
    const status = await getIngestStatus(fileId)

    if (onStatusChange) {
      onStatusChange(status)
    }

    if (status.status === 'processed' || status.status === 'failed') {
      return status
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
    attempts++
  }

  throw new Error(`Ingestion timed out after ${maxAttempts} attempts`)
}

/**
 * Upload and ingest a file in one flow
 * Combines file upload with automatic ingestion trigger
 */
export async function uploadAndIngest(
  file: File,
  userId: string,
  options: {
    onUploadComplete?: (fileId: string) => void
    onIngestStart?: () => void
    onIngestComplete?: (result: IngestResponse) => void
    onError?: (error: Error) => void
  } = {},
): Promise<IngestResponse> {
  const { onUploadComplete, onIngestStart, onIngestComplete, onError } = options

  try {
    // Import files API dynamically to avoid circular dependency
    const { uploadFile } = await import('./files')

    // Step 1: Upload file
    const uploadResult = await uploadFile(file, userId)

    if (onUploadComplete) {
      onUploadComplete(uploadResult.fileId)
    }

    // Step 2: Trigger ingestion
    if (onIngestStart) {
      onIngestStart()
    }

    const ingestResult = await ingestFile({
      fileId: uploadResult.fileId,
      userId,
    })

    if (onIngestComplete) {
      onIngestComplete(ingestResult)
    }

    return ingestResult
  } catch (error) {
    if (onError && error instanceof Error) {
      onError(error)
    }
    throw error
  }
}

// Export the ingest API as a namespace for cleaner imports
export const ingestApi = {
  ingestFile,
  getIngestStatus,
  waitForIngestion,
  uploadAndIngest,
}

export default ingestApi
