// ** import types
import type { Context } from "hono";
import type { FileProcessingResult, VectorMetadata } from "@repo/shared";

// ** import lib
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

// ** import schema
import { ingestSchema, type IngestRequest } from "@/schema/ingest";

// ** import utils
import { getSignedDownloadUrl } from "@repo/gcs";
import { gcsClient } from "@/utils";
import {
  getFileMetadata,
  updateFileStatus,
  cacheOcrResult,
  getCachedOcrResult,
  upsertWithEmbedding,
} from "@repo/storage";
import {
  extractTextWithMistralOCR,
  isSupportedFileType,
  chunkText,
} from "@repo/ingest";
import { generateGraphFromChunks, mergeGraphIntoMain } from "@repo/graph";
import { logger } from "@repo/logs";

const ingestRoute = new Hono();

/**
 * GET /api/ingest/status/:fileId
 * Get the processing status of a file
 */
ingestRoute.get("/status/:fileId", async (c: Context) => {
  try {
    const fileId = c.req.param("fileId");

    if (!fileId) {
      return c.json({ error: "File ID is required" }, 400);
    }

    logger.info("Getting ingest status", { fileId });

    const metadata = await getFileMetadata(fileId);

    if (!metadata) {
      return c.json({ error: "File not found" }, 404);
    }

    return c.json({
      fileId: metadata.fileId,
      status: metadata.status,
      fileName: metadata.fileName,
      createdAt: metadata.createdAt,
      processedAt: metadata.processedAt,
      error: metadata.error,
    });
  } catch (error) {
    logger.error("Failed to get ingest status", error);
    return c.json(
      {
        error: "Failed to get ingest status",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * POST /api/ingest
 * Process an uploaded file through the complete ingestion pipeline:
 * 1. Fetch file from GCS
 * 2. OCR extraction (Mistral)
 * 3. Text chunking
 * 4. Store in Vector DB with Upstash native embedding (BAAI model)
 * 5. Knowledge graph generation (Gemini)
 * 6. Merge graph into user's main graph (Redis)
 */
ingestRoute.post("/", zValidator("json", ingestSchema), async (c: Context) => {
  const startTime = Date.now();
  let fileId: string = "";
  let userId: string = "";

  try {
    const body = c.req.valid("json" as never) as IngestRequest;
    fileId = body.fileId;
    userId = body.userId;

    logger.info("Starting ingestion pipeline", { fileId, userId });

    // 1. Get file metadata and validate
    const metadata = await getFileMetadata(fileId);

    if (!metadata) {
      return c.json({ error: "File not found" }, 404);
    }

    if (metadata.userId !== userId) {
      return c.json({ error: "Unauthorized" }, 403);
    }

    if (metadata.status === "processing") {
      return c.json({ error: "File is already being processed" }, 409);
    }

    if (metadata.status === "processed") {
      return c.json(
        {
          error: "File has already been processed",
          fileId,
          status: "processed",
        },
        409,
      );
    }

    // Update status to processing
    await updateFileStatus(fileId, "processing");

    // 2. Get signed URL for the file
    logger.info("Getting signed download URL", {
      fileId,
      filePath: metadata.filePath,
    });

    const { signedUrl } = await getSignedDownloadUrl(
      gcsClient,
      process.env.GCS_BUCKET_NAME!,
      metadata.filePath,
      { expiresInMinutes: 60 },
    );

    // 3. OCR Extraction
    let ocrText: string;

    // Check for cached OCR result
    const cachedOcr = await getCachedOcrResult<{ markdown: string }>(fileId);

    if (cachedOcr) {
      logger.info("Using cached OCR result", { fileId });
      ocrText = cachedOcr.markdown;
    } else {
      // Check if file type needs OCR or is plain text
      if (
        metadata.contentType === "text/plain" ||
        metadata.contentType === "text/markdown"
      ) {
        // For plain text files, download and read directly
        logger.info("Processing plain text file", {
          fileId,
          contentType: metadata.contentType,
        });

        const response = await fetch(signedUrl);
        ocrText = await response.text();
      } else if (isSupportedFileType(metadata.contentType)) {
        // Use Mistral OCR for PDFs, images, and documents
        logger.info("Starting OCR extraction", {
          fileId,
          contentType: metadata.contentType,
        });

        const ocrResult = await extractTextWithMistralOCR(signedUrl);
        ocrText = ocrResult.markdown;

        // Cache the result
        await cacheOcrResult(fileId, ocrResult, 3600); // Cache for 1 hour

        logger.info("OCR extraction completed", {
          fileId,
          pageCount: ocrResult.pageCount,
          confidence: ocrResult.confidence,
          contentLength: ocrText.length,
        });
      } else {
        await updateFileStatus(
          fileId,
          "failed",
          `Unsupported content type: ${metadata.contentType}`,
        );
        return c.json(
          { error: `Unsupported file type: ${metadata.contentType}` },
          400,
        );
      }
    }

    // Check if we got any content
    if (!ocrText || ocrText.trim().length === 0) {
      await updateFileStatus(
        fileId,
        "failed",
        "No text content extracted from file",
      );
      return c.json(
        { error: "No text content could be extracted from the file" },
        400,
      );
    }

    // 4. Text Chunking
    logger.info("Starting text chunking", {
      fileId,
      textLength: ocrText.length,
    });

    const chunkingResult = chunkText(ocrText, fileId, {
      chunkSize: 1000,
      chunkOverlap: 200,
      preserveHeaders: true,
    });

    logger.info("Text chunking completed", {
      fileId,
      totalChunks: chunkingResult.totalChunks,
      averageChunkSize: chunkingResult.averageChunkSize,
    });

    // 5. Store in Vector DB with Upstash native embedding
    // Upstash automatically generates embeddings server-side using BAAI model
    logger.info("Storing chunks with Upstash native embedding", {
      fileId,
      chunkCount: chunkingResult.totalChunks,
    });

    const vectorItems = chunkingResult.chunks.map((chunk) => ({
      id: chunk.id,
      data: chunk.content, // Text - Upstash generates embedding automatically
      metadata: {
        content: chunk.content,
        fileId: chunk.fileId,
        chunkIndex: chunk.chunkIndex,
        userId,
        fileName: metadata.fileName,
        section: chunk.metadata?.section,
      } as VectorMetadata,
    }));

    await upsertWithEmbedding(vectorItems);

    logger.info("Chunks stored successfully with Upstash embedding", {
      fileId,
      chunkCount: vectorItems.length,
    });

    // 7. Generate Knowledge Graph
    logger.info("Starting knowledge graph generation", { fileId });

    // Use a subset of chunks for graph generation to avoid rate limits
    const chunksForGraph = chunkingResult.chunks.slice(0, 10).map((chunk) => ({
      content: chunk.content,
      id: chunk.id,
    }));

    const graph = await generateGraphFromChunks(chunksForGraph, fileId);

    logger.info("Knowledge graph generated", {
      fileId,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    });

    // 8. Merge Graph into User's Main Graph
    logger.info("Merging knowledge graph", { fileId, userId });

    const mergeResult = await mergeGraphIntoMain(userId, graph, fileId);

    logger.info("Knowledge graph merged", {
      fileId,
      userId,
      ...mergeResult,
    });

    // Update file status to processed
    await updateFileStatus(fileId, "processed");

    const processingTimeMs = Date.now() - startTime;

    const result: FileProcessingResult = {
      fileId,
      status: "processed",
      chunksCount: chunkingResult.totalChunks,
      graphNodesCount: graph.nodes.length,
      graphEdgesCount: graph.edges.length,
      processingTimeMs,
    };

    logger.info("Ingestion pipeline completed successfully", {
      userId,
      processingTimeMs,
      chunksCount: result.chunksCount,
      graphNodesCount: result.graphNodesCount,
      graphEdgesCount: result.graphEdgesCount,
    });

    return c.json(result);
  } catch (error) {
    logger.error("Ingestion pipeline failed", error);

    // Update file status to failed
    if (fileId) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await updateFileStatus(fileId, "failed", errorMessage).catch((e) =>
        logger.error("Failed to update file status", e),
      );
    }

    return c.json(
      {
        error: "Ingestion pipeline failed",
        message: error instanceof Error ? error.message : "Unknown error",
        fileId,
      },
      500,
    );
  }
});

export { ingestRoute };
