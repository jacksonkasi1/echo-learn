// ** import types
import type { Storage } from '@google-cloud/storage'

// ** import lib
import { nanoid } from 'nanoid'

export interface SignedUploadUrlOptions {
  organizationId: string
  fileName: string
  contentType: string
  expiresInMinutes?: number
}

export interface SignedUploadUrlResult {
  signedUrl: string
  filePath: string
  uniqueFileName: string
}

/**
 * Generate a signed URL for uploading a file to GCS
 * The URL is valid for a limited time (default 15 minutes)
 */
export async function getSignedUploadUrl(
  storage: Storage,
  bucketName: string,
  options: SignedUploadUrlOptions
): Promise<SignedUploadUrlResult> {
  const { organizationId, fileName, contentType, expiresInMinutes = 15 } = options

  // Generate a unique file name to prevent collisions
  const uniqueFileName = `${nanoid()}-${fileName}`
  const filePath = `uploads/${organizationId}/${uniqueFileName}`

  const [signedUrl] = await storage
    .bucket(bucketName)
    .file(filePath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
      contentType,
    })

  return { signedUrl, filePath, uniqueFileName }
}

export interface UploadBufferOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface UploadBufferResult {
  filePath: string
  publicUrl: string
}

/**
 * Upload a buffer directly to GCS
 * Useful for server-side uploads
 */
export async function uploadBuffer(
  storage: Storage,
  bucketName: string,
  buffer: Buffer,
  filePath: string,
  options: UploadBufferOptions = {}
): Promise<UploadBufferResult> {
  const file = storage.bucket(bucketName).file(filePath)

  await file.save(buffer, {
    contentType: options.contentType,
    metadata: options.metadata,
  })

  const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`

  return { filePath, publicUrl }
}

/**
 * Upload a file from a readable stream
 */
export async function uploadStream(
  storage: Storage,
  bucketName: string,
  stream: NodeJS.ReadableStream,
  filePath: string,
  options: UploadBufferOptions = {}
): Promise<UploadBufferResult> {
  const file = storage.bucket(bucketName).file(filePath)

  return new Promise((resolve, reject) => {
    const writeStream = file.createWriteStream({
      contentType: options.contentType,
      metadata: options.metadata,
    })

    stream
      .pipe(writeStream)
      .on('error', reject)
      .on('finish', () => {
        const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`
        resolve({ filePath, publicUrl })
      })
  })
}
