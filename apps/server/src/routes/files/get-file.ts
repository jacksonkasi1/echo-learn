// ** import types
import type { Context } from 'hono'

// ** import lib
import { Hono } from 'hono'

// ** import utils
import { getFileMetadata } from '@/lib/upstash/redis'
import { logger } from '@repo/logs'

const getRoute = new Hono()

/**
 * GET /api/files/:fileId
 * Get details of a specific file
 */
getRoute.get('/:fileId', async (c: Context) => {
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

export { getRoute }
