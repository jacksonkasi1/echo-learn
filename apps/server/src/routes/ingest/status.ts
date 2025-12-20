// ** import types
import type { Context } from "hono";

// ** import lib
import { Hono } from "hono";

// ** import utils
import { getFileMetadata } from "@repo/storage";
import { logger } from "@repo/logs";

const statusRoute = new Hono();

/**
 * GET /api/ingest/status/:fileId
 * Get the processing status of a file
 */
statusRoute.get("/status/:fileId", async (c: Context) => {
  try {
    const fileId = c.req.param("fileId");

    if (!fileId) {
      return c.json({ error: "File ID is required" }, 400);
    }

    const metadata = await getFileMetadata(fileId);

    if (!metadata) {
      return c.json({ error: "File not found" }, 404);
    }

    return c.json({
      fileId,
      status: metadata.status,
      fileName: metadata.fileName,
      createdAt: metadata.createdAt,
      processedAt: metadata.processedAt,
      error: metadata.error,
    });
  } catch (error) {
    logger.error("Error getting file status", error);
    return c.json({ error: "Failed to get file status" }, 500);
  }
});

export { statusRoute };
