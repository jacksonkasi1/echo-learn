// ** import types
import type { Context } from 'hono'
import type { SignedUrlResponse } from '@repo/shared'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// ** import utils
import { createGCSClient, getSignedUploadUrl } from '@repo/gcs'
import { setFileMetadata, addFileToUser } from '@/lib/upstash/redis'
import { logger } from '@repo/logs'

const uploadRoute = new Hono()

// Initialize GCS client
const gcsClient = createGCSClient({
  projectId: process.env.GCS_PROJECT_ID!,
  keyFilename: process.env.GCS_KEY_FILE,
})

// Request schema for signed URL generation
const signedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.string().min(1, 'Content type is required'),
  userId: z.string().min(1, 'User ID is required'),
})

// Supported file types
const SUPPORTED_CONTENT_TYPES = [
  'application/pdf',
  'text/plain',
  'text/markdown',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'application/msword',
  'image/png',
  'image/jpeg',
  'image/webp',
]

/**
 * POST /api/upload/signed-url
 * Generate a signed URL for uploading a file to GCS
 */
uploadRoute.post(
  '/signed-url',
  zValidator('json', signedUrlSchema),
  async (c: Context) => {
    try {
      const { fileName, contentType, userId } = c.req.valid('json' as never) as z.infer<
        typeof signedUrlSchema
      >

      // Validate content type
      if (!SUPPORTED_CONTENT_TYPES.includes(contentType)) {
        logger.warn('Unsupported content type', { contentType, fileName })
        return c.json(
          {
            error: 'Unsupported file type',
            supportedTypes: SUPPORTED_CONTENT_TYPES,
          },
          400
        )
      }

      // Generate signed upload URL using GCS package
      const { signedUrl, filePath, uniqueFileName } = await getSignedUploadUrl(
        gcsClient,
        process.env.GCS_BUCKET_NAME!,
        {
          organizationId: userId, // Using userId as organizationId
          fileName,
          contentType,
          expiresInMinutes: 15,
        }
      )

      // Generate unique file ID
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`

      // Store file metadata in Redis
      await setFileMetadata(fileId, {
        fileId,
        fileName,
        uniqueFileName,
        filePath,
        userId,
        contentType,
        status: 'pending_upload',
        createdAt: new Date().toISOString(),
      })

      // Add to user's file list
      await addFileToUser(userId, fileId)

      logger.info('Generated signed URL for file upload', {
        fileId,
        fileName,
        userId,
        contentType,
      })

      const response: SignedUrlResponse = {
        signedUrl,
        fileId,
        filePath,
        expiresIn: 900, // 15 minutes in seconds
      }

      return c.json(response)
    } catch (error) {
      logger.error('Error generating signed URL', error)
      return c.json({ error: 'Failed to generate upload URL' }, 500)
    }
  }
)

/**
 * POST /api/upload/confirm
 * Confirm that a file has been uploaded and trigger processing
 */
const confirmSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  userId: z.string().min(1, 'User ID is required'),
})

uploadRoute.post(
  '/confirm',
  zValidator('json', confirmSchema),
  async (c: Context) => {
    try {
      const { fileId, userId } = c.req.valid('json' as never) as z.infer<typeof confirmSchema>

      // Import here to avoid circular dependencies
      const { updateFileStatus, getFileMetadata } = await import('@/lib/upstash/redis')

      // Verify file exists and belongs to user
      const metadata = await getFileMetadata(fileId)

      if (!metadata) {
        return c.json({ error: 'File not found' }, 404)
      }

      if (metadata.userId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403)
      }

      // Update status to uploaded
      await updateFileStatus(fileId, 'uploaded')

      logger.info('File upload confirmed', { fileId, userId })

      return c.json({
        success: true,
        fileId,
        status: 'uploaded',
        message: 'File upload confirmed. Processing will begin shortly.',
      })
    } catch (error) {
      logger.error('Error confirming upload', error)
      return c.json({ error: 'Failed to confirm upload' }, 500)
    }
  }
)

export { uploadRoute }
