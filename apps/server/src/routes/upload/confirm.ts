// ** import types
import type { Context } from "hono";

// ** import lib
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

// ** import schema
import {
  confirmUploadSchema,
  type ConfirmUploadRequest,
} from "@/schema/upload";

// ** import utils
import { updateFileStatus, getFileMetadata } from "@repo/storage";
import { logger } from "@repo/logs";

const confirmRoute = new Hono();

/**
 * POST /api/upload/confirm
 * Confirm that a file has been uploaded and trigger processing
 */
confirmRoute.post(
  "/confirm",
  zValidator("json", confirmUploadSchema),
  async (c: Context) => {
    try {
      const { fileId, userId } = c.req.valid(
        "json" as never,
      ) as ConfirmUploadRequest;

      // Verify file exists and belongs to user
      const metadata = await getFileMetadata(fileId);

      if (!metadata) {
        return c.json({ error: "File not found" }, 404);
      }

      if (metadata.userId !== userId) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      // Update status to uploaded
      await updateFileStatus(fileId, "uploaded");

      logger.info("File upload confirmed", { fileId, userId });

      return c.json({
        success: true,
        fileId,
        status: "uploaded",
        message: "File upload confirmed. Processing will begin shortly.",
      });
    } catch (error) {
      logger.error("Error confirming upload", error);
      return c.json({ error: "Failed to confirm upload" }, 500);
    }
  },
);

export { confirmRoute };
