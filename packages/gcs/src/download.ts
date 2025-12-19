// ** import types
import type { Storage } from '@google-cloud/storage'

export interface SignedDownloadUrlOptions {
  expiresInMinutes?: number
}

export interface SignedDownloadUrlResult {
  signedUrl: string
  expiresAt: Date
}

/**
 * Generate a signed URL for downloading a file from GCS
 * The URL is valid for a limited time (default 60 minutes)
 */
export async function getSignedDownloadUrl(
  storage: Storage,
  bucketName: string,
  filePath: string,
  options: SignedDownloadUrlOptions = {}
): Promise<SignedDownloadUrlResult> {
  const { expiresInMinutes = 60 } = options

  const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000)

  const [signedUrl] = await storage
    .bucket(bucketName)
    .file(filePath)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    })

  return { signedUrl, expiresAt }
}

export interface DownloadFileResult {
  buffer: Buffer
  contentType: string | undefined
  size: number
}

/**
 * Download a file from GCS as a buffer
 */
export async function downloadFile(
  storage: Storage,
  bucketName: string,
  filePath: string
): Promise<DownloadFileResult> {
  const file = storage.bucket(bucketName).file(filePath)

  const [buffer] = await file.download()
  const [metadata] = await file.getMetadata()

  return {
    buffer,
    contentType: metadata.contentType,
    size: Number(metadata.size) || buffer.length,
  }
}

/**
 * Download a file as a readable stream
 * Useful for large files to avoid loading into memory
 */
export function downloadAsStream(
  storage: Storage,
  bucketName: string,
  filePath: string
): NodeJS.ReadableStream {
  const file = storage.bucket(bucketName).file(filePath)
  return file.createReadStream()
}

/**
 * Get the public URL for a file (only works if file is publicly accessible)
 */
export function getPublicUrl(bucketName: string, filePath: string): string {
  return `https://storage.googleapis.com/${bucketName}/${filePath}`
}

/**
 * Get file metadata without downloading the content
 */
export async function getFileMetadata(
  storage: Storage,
  bucketName: string,
  filePath: string
): Promise<{
  size: number
  contentType: string | undefined
  created: Date | undefined
  updated: Date | undefined
}> {
  const file = storage.bucket(bucketName).file(filePath)
  const [metadata] = await file.getMetadata()

  return {
    size: Number(metadata.size) || 0,
    contentType: metadata.contentType,
    created: metadata.timeCreated ? new Date(metadata.timeCreated) : undefined,
    updated: metadata.updated ? new Date(metadata.updated) : undefined,
  }
}
