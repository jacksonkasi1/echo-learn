// ** import types
import type {
  VectorMetadata,
  VectorSearchResult,
  VectorSearchOptions,
} from "@repo/shared";

// ** import lib
import { Index, type IndexConfig } from "@upstash/vector";

// ** import utils
import { logger } from "@repo/logs";

// Upstash Vector metadata type - must be flat with primitive values only
type VectorDbMetadata = Record<string, string | number | boolean | string[]>;

/**
 * Sanitize metadata for Upstash Vector compatibility
 * Ensures all values are primitive types (string, number, boolean, or string[])
 * Removes undefined/null values and converts objects to strings
 */
function sanitizeMetadata(metadata: VectorMetadata): VectorDbMetadata {
  const sanitized: VectorDbMetadata = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (value === undefined || value === null) {
      // Skip undefined/null values
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      sanitized[key] = value;
    } else if (Array.isArray(value)) {
      // Convert array elements to strings if needed
      sanitized[key] = value.map((v) => String(v));
    } else if (typeof value === "object") {
      // Convert objects to JSON strings
      sanitized[key] = JSON.stringify(value);
    } else {
      // Convert anything else to string
      sanitized[key] = String(value);
    }
  }

  return sanitized;
}

// Initialize Upstash Vector client
const vectorConfig: IndexConfig = {
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
};

export const vectorIndex: Index<VectorDbMetadata> = new Index(vectorConfig);

/**
 * Upsert vectors into the database
 * Used after generating embeddings for text chunks
 */
export async function upsertVectors(
  vectors: Array<{
    id: string;
    vector: number[];
    metadata: VectorMetadata;
  }>,
): Promise<void> {
  try {
    logger.info(`Upserting ${vectors.length} vectors`);

    // Convert and sanitize metadata to Upstash-compatible format
    const formattedVectors = vectors.map((v) => ({
      id: v.id,
      vector: v.vector,
      metadata: sanitizeMetadata(v.metadata),
    }));

    // Upstash Vector supports batch upserts
    await vectorIndex.upsert(formattedVectors);

    logger.info(`Successfully upserted ${vectors.length} vectors`);
  } catch (error) {
    logger.error("Failed to upsert vectors", error);
    throw error;
  }
}

/**
 * Search for similar vectors using a query vector
 * Returns the most similar chunks based on cosine similarity
 */
export async function searchVectors(
  queryVector: number[],
  options: VectorSearchOptions = {},
): Promise<VectorSearchResult[]> {
  const { topK = 5, filter, includeMetadata = true, minScore } = options;

  try {
    logger.info("Searching vectors", { topK, hasFilter: !!filter });

    const results = await vectorIndex.query({
      vector: queryVector,
      topK,
      includeMetadata,
      filter: filter as string | undefined,
    });

    // Map results to our type and optionally filter by minScore
    const mappedResults: VectorSearchResult[] = results
      .filter((result) => {
        if (minScore !== undefined && result.score < minScore) {
          return false;
        }
        return true;
      })
      .map((result) => ({
        id: result.id as string,
        score: result.score,
        metadata: result.metadata as unknown as VectorMetadata,
      }));

    logger.info(`Found ${mappedResults.length} similar vectors`);

    return mappedResults;
  } catch (error) {
    logger.error("Failed to search vectors", error);
    throw error;
  }
}

/**
 * Delete vectors by their IDs
 * Used when deleting files and their associated chunks
 */
export async function deleteVectors(ids: string[]): Promise<void> {
  if (ids.length === 0) return;

  try {
    logger.info(`Deleting ${ids.length} vectors`);

    await vectorIndex.delete(ids);

    logger.info(`Successfully deleted ${ids.length} vectors`);
  } catch (error) {
    logger.error("Failed to delete vectors", error);
    throw error;
  }
}

/**
 * Delete all vectors for a specific file
 * Uses Upstash Vector's filter-based deletion
 */
export async function deleteVectorsByFileId(fileId: string): Promise<number> {
  try {
    logger.info(`Deleting vectors for file: ${fileId}`);

    // Use filter-based deletion - much more efficient than query + delete
    const result = await vectorIndex.delete({
      filter: `fileId = '${fileId}'`,
    });

    const deletedCount = result.deleted;

    if (deletedCount === 0) {
      logger.info(`No vectors found for file: ${fileId}`);
    } else {
      logger.info(`Deleted ${deletedCount} vectors for file: ${fileId}`);
    }

    return deletedCount;
  } catch (error) {
    logger.error(`Failed to delete vectors for file: ${fileId}`, error);
    throw error;
  }
}

/**
 * Delete all vectors for a specific user
 * Uses Upstash Vector's filter-based deletion
 */
export async function deleteVectorsByUserId(userId: string): Promise<number> {
  try {
    logger.info(`Deleting all vectors for user: ${userId}`);

    // Use filter-based deletion - much more efficient than query + delete
    const result = await vectorIndex.delete({
      filter: `userId = '${userId}'`,
    });

    const deletedCount = result.deleted;

    if (deletedCount === 0) {
      logger.info(`No vectors found for user: ${userId}`);
    } else {
      logger.info(`Deleted ${deletedCount} vectors for user: ${userId}`);
    }

    return deletedCount;
  } catch (error) {
    logger.error(`Failed to delete vectors for user: ${userId}`, error);
    throw error;
  }
}

/**
 * Get info about the vector index
 */
export async function getIndexInfo(): Promise<{
  vectorCount: number;
  dimension: number;
}> {
  try {
    const info = await vectorIndex.info();
    return {
      vectorCount: info.vectorCount,
      dimension: info.dimension,
    };
  } catch (error) {
    logger.error("Failed to get index info", error);
    throw error;
  }
}

/**
 * Fetch vectors by their IDs
 */
export async function fetchVectors(
  ids: string[],
): Promise<
  Array<{ id: string; vector: number[]; metadata: VectorMetadata } | null>
> {
  try {
    const results = await vectorIndex.fetch(ids, {
      includeMetadata: true,
      includeVectors: true,
    });

    return results.map((result) => {
      if (!result) return null;
      return {
        id: result.id as string,
        vector: result.vector as number[],
        metadata: result.metadata as unknown as VectorMetadata,
      };
    });
  } catch (error) {
    logger.error("Failed to fetch vectors", error);
    throw error;
  }
}
