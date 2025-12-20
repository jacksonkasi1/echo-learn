// ** import types
import type { Context } from 'hono'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

// ** import schema
import { listFilesSchema, type ListFilesRequest } from '@/schema/files'

// ** import utils
import { getUserFiles } from '@/lib/upstash/redis'
import { logger } from '@repo/logs'

const listRoute = new Hono()

/**
 * GET /api/files
 * Get all files for a user
 */
listRoute.get(
  '/',
  zValidator('query', listFilesSchema),
  async (c: Context) => {
    try {
      const { userId } = c.req.valid('query' as never) as ListFilesRequest

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

export { listRoute }
