// ** import types
import type { Context } from 'hono'
import type { SignedUrlResponse } from '@repo/shared'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

// ** import schema
import { signedUrlSchema, type SignedUrlRequest } from '@/schema/upload'

// ** import utils
import { getSignedUploadUrl } from '@repo/gcs'
import { gcsClient } from '@/utils'
import { setFileMetadata, addFileToUser } from '@/lib/upstash/redis'
import { logger } from '@repo/logs'

// ** import constants
import { SUPPORTED_CONTENT_TYPES } from './constants'

const signedUrlRoute = new Hono()

/**
 * POST /api/upload/signed-url
 * Generate a signed URL for uploading a file to GCS
 */
signedUrlRoute.post(
  '/signed-url',
  zValidator('json', signedUrlSchema),
  async (c: Context) => {
    try {
      const { fileName, contentType, userId } = c.req.valid('json' as never) as SignedUrlRequest

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

export { signedUrlRoute }
