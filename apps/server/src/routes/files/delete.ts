// ** import types
import type { Context } from 'hono'
import type { FileDeleteResponse } from '@repo/shared'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// ** import utils
import { createGCSClient, deleteFile as deleteGCSFile } from '@repo/gcs'
import {
  getFileMetadata,
  deleteFileMetadata,
  removeFileFromUser,
} from '@/lib/upstash/redis'
import { deleteVectorsByFileId } from '@/lib/upstash/vector'
import { removeFileFromGraph } from '@/lib/graph/graph-merger'
import { logger } from '@repo/logs'

const filesRoute = new Hono()

// Initialize GCS client
const gcsClient = createGCSClient({
  projectId: process.env.GCS_PROJECT_ID!,
  keyFilename: process.env.GCS_KEY_FILE,
})

// Request schema for file deletion
const deleteSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  userId: z.string().min(1, 'User ID is required'),
})

/**
 * DELETE /api/files
 * Delete a file and all associated data (cascade cleanup):
 * 1. Delete vectors from Upstash Vector DB
 * 2. Remove file contribution from knowledge graph
 * 3. Delete file from GCS
 * 4. Remove file metadata from Redis
 * 5. Remove file from user's file list
 */
filesRoute.delete(
  '/',
  zValidator('json', deleteSchema),
  async (c: Context) => {
    try {
      const { fileId, userId } = c.req.valid('json' as never) as z.infer<typeof deleteSchema>

      logger.info('Starting file deletion', { fileId, userId })

      // 1. Get file metadata and validate ownership
      const metadata = await getFileMetadata(fileId)

      if (!metadata) {
        return c.json({ error: 'File not found' }, 404)
      }

      if (metadata.userId !== userId) {
        return c.json({ error: 'Unauthorized' }, 403)
      }

      let deletedChunks = 0
      const errors: string[] = []

      // 2. Delete vectors from Vector DB
      try {
        logger.info('Deleting vectors from database', { fileId })
        deletedChunks = await deleteVectorsByFileId(fileId)
        logger.info('Vectors deleted', { fileId, deletedChunks })
      } catch (error) {
        const message = `Failed to delete vectors: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(message, error)
        errors.push(message)
      }

      // 3. Remove file contribution from knowledge graph
      try {
        logger.info('Removing file from knowledge graph', { fileId, userId })
        const graphResult = await removeFileFromGraph(userId, fileId)
        logger.info('Removed from knowledge graph', {
          fileId,
          userId,
          nodesRemoved: graphResult.nodesRemoved,
          edgesRemoved: graphResult.edgesRemoved,
        })
      } catch (error) {
        const message = `Failed to update knowledge graph: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(message, error)
        errors.push(message)
      }

      // 4. Delete file from GCS
      try {
        logger.info('Deleting file from GCS', { fileId, filePath: metadata.filePath })
        await deleteGCSFile(gcsClient, process.env.GCS_BUCKET_NAME!, metadata.filePath)
        logger.info('File deleted from GCS', { fileId })
      } catch (error) {
        const message = `Failed to delete from GCS: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(message, error)
        errors.push(message)
      }

      // 5. Delete file metadata from Redis
      try {
        logger.info('Deleting file metadata', { fileId })
        await deleteFileMetadata(fileId)
        logger.info('File metadata deleted', { fileId })
      } catch (error) {
        const message = `Failed to delete metadata: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(message, error)
        errors.push(message)
      }

      // 6. Remove file from user's file list
      try {
        logger.info('Removing file from user file list', { fileId, userId })
        await removeFileFromUser(userId, fileId)
        logger.info('File removed from user file list', { fileId, userId })
      } catch (error) {
        const message = `Failed to remove from user list: ${error instanceof Error ? error.message : 'Unknown error'}`
        logger.error(message, error)
        errors.push(message)
      }

      // Log completion
      if (errors.length > 0) {
        logger.warn('File deletion completed with errors', {
          fileId,
          userId,
          errors,
          deletedChunks,
        })
      } else {
        logger.info('File deletion completed successfully', {
          fileId,
          userId,
          deletedChunks,
        })
      }

      const response: FileDeleteResponse = {
        success: errors.length === 0,
        deletedFileId: fileId,
        deletedChunks,
      }

      // Return success even with partial errors to indicate the file is gone
      return c.json(response)
    } catch (error) {
      logger.error('File deletion failed', error)
      return c.json(
        {
          error: 'Failed to delete file',
          message: error instanceof Error ? error.message : 'Unknown error',
        },
        500
      )
    }
  }
)

/**
 * GET /api/files
 * Get all files for a user
 */
const listSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

filesRoute.get(
  '/',
  zValidator('query', listSchema),
  async (c: Context) => {
    try {
      const { userId } = c.req.valid('query' as never) as z.infer<typeof listSchema>

      // Import here to avoid circular dependencies
      const { getUserFiles } = await import('@/lib/upstash/redis')

      logger.info('Fetching user files', { userId })

      const files = await getUserFiles(userId)

      logger.info('User files fetched', { userId, fileCount: files.length })

      return c.json({
        files,
        total: files.length,
      })
    } catch (error) {
      logger.error('Failed to fetch user files', error)
      return c.json({ error: 'Failed to fetch files' }, 500)
    }
  }
)

/**
 * GET /api/files/:fileId
 * Get details of a specific file
 */
filesRoute.get('/:fileId', async (c: Context) => {
  try {
    const fileId = c.req.param('fileId')
    const userId = c.req.query('userId')

    if (!fileId) {
      return c.json({ error: 'File ID is required' }, 400)
    }

    const metadata = await getFileMetadata(fileId)

    if (!metadata) {
      return c.json({ error: 'File not found' }, 404)
    }

    // If userId provided, validate ownership
    if (userId && metadata.userId !== userId) {
      return c.json({ error: 'Unauthorized' }, 403)
    }

    return c.json(metadata)
  } catch (error) {
    logger.error('Failed to fetch file details', error)
    return c.json({ error: 'Failed to fetch file details' }, 500)
  }
})

export { filesRoute }
