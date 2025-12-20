// ** import types
import type { Context } from "hono";
import type { FileDeleteResponse } from "@repo/shared";

// ** import lib
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

// ** import schema
import { deleteFileSchema, type DeleteFileRequest } from "@/schema/files";

// ** import utils
import { deleteFile as deleteGCSFile } from "@repo/gcs";
import { gcsClient } from "@/utils";
import {
  getFileMetadata,
  deleteFileMetadata,
  removeFileFromUser,
} from "@/lib/upstash/redis";
import { deleteVectorsByFileId } from "@/lib/upstash/vector";
import { removeFileFromGraph } from "@/lib/graph/graph-merger";
import { logger } from "@repo/logs";

const deleteRoute = new Hono();

/**
 * DELETE /api/files
 * Delete a file and all associated data (cascade cleanup):
 * 1. Delete vectors from Upstash Vector DB
 * 2. Remove file contribution from knowledge graph
 * 3. Delete file from GCS
 * 4. Remove file metadata from Redis
 * 5. Remove file from user's file list
 */
deleteRoute.delete(
  "/",
  zValidator("json", deleteFileSchema),
  async (c: Context) => {
    try {
      const { fileId, userId } = c.req.valid(
        "json" as never,
      ) as DeleteFileRequest;

      logger.info("Starting file deletion", { fileId, userId });

      // 1. Get file metadata and validate ownership
      const metadata = await getFileMetadata(fileId);

      if (!metadata) {
        return c.json({ error: "File not found" }, 404);
      }

      if (metadata.userId !== userId) {
        return c.json({ error: "Unauthorized" }, 403);
      }

      let deletedChunks = 0;
      const errors: string[] = [];

      // 2. Delete vectors from Vector DB
      try {
        logger.info("Deleting vectors from database", { fileId });
        deletedChunks = await deleteVectorsByFileId(fileId);
        logger.info("Vectors deleted", { fileId, deletedChunks });
      } catch (error) {
        const message = `Failed to delete vectors: ${error instanceof Error ? error.message : "Unknown error"}`;
        logger.error(message, error);
        errors.push(message);
      }

      // 3. Remove file contribution from knowledge graph
      try {
        logger.info("Removing file from knowledge graph", { fileId, userId });
        const graphResult = await removeFileFromGraph(userId, fileId);
        logger.info("Removed from knowledge graph", {
          fileId,
          userId,
          nodesRemoved: graphResult.nodesRemoved,
          edgesRemoved: graphResult.edgesRemoved,
        });
      } catch (error) {
        const message = `Failed to update knowledge graph: ${error instanceof Error ? error.message : "Unknown error"}`;
        logger.error(message, error);
        errors.push(message);
      }

      // 4. Delete file from GCS
      try {
        logger.info("Deleting file from GCS", {
          fileId,
          filePath: metadata.filePath,
        });
        await deleteGCSFile(
          gcsClient,
          process.env.GCS_BUCKET_NAME!,
          metadata.filePath,
        );
        logger.info("File deleted from GCS", { fileId });
      } catch (error) {
        const message = `Failed to delete from GCS: ${error instanceof Error ? error.message : "Unknown error"}`;
        logger.error(message, error);
        errors.push(message);
      }

      // 5. Delete file metadata from Redis
      try {
        logger.info("Deleting file metadata", { fileId });
        await deleteFileMetadata(fileId);
        logger.info("File metadata deleted", { fileId });
      } catch (error) {
        const message = `Failed to delete metadata: ${error instanceof Error ? error.message : "Unknown error"}`;
        logger.error(message, error);
        errors.push(message);
      }

      // 6. Remove file from user's file list
      try {
        logger.info("Removing file from user file list", { fileId, userId });
        await removeFileFromUser(userId, fileId);
        logger.info("File removed from user file list", { fileId, userId });
      } catch (error) {
        const message = `Failed to remove from user list: ${error instanceof Error ? error.message : "Unknown error"}`;
        logger.error(message, error);
        errors.push(message);
      }

      // Log completion
      if (errors.length > 0) {
        logger.warn("File deletion completed with errors", {
          fileId,
          userId,
          errors,
          deletedChunks,
        });
      } else {
        logger.info("File deletion completed successfully", {
          fileId,
          userId,
          deletedChunks,
        });
      }

      const response: FileDeleteResponse = {
        success: errors.length === 0,
        deletedFileId: fileId,
        deletedChunks,
      };

      // Return success even with partial errors to indicate the file is gone
      return c.json(response);
    } catch (error) {
      logger.error("File deletion failed", error);
      return c.json(
        {
          error: "Failed to delete file",
          message: error instanceof Error ? error.message : "Unknown error",
        },
        500,
      );
    }
  },
);

export { deleteRoute };
