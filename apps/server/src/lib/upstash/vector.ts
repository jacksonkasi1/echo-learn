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

// Upstash Vector metadata type
type VectorDbMetadata = Record<string, string | number | boolean | string[]>;

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

    // Convert metadata to Upstash-compatible format
    const formattedVectors = vectors.map((v) => ({
      id: v.id,
      vector: v.vector,
      metadata: v.metadata as unknown as VectorDbMetadata,
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
 * Uses filter to find all chunks belonging to a file
 */
export async function deleteVectorsByFileId(fileId: string): Promise<number> {
  try {
    logger.info(`Deleting vectors for file: ${fileId}`);

    // First, query to get all vector IDs for this file
    // We use a dummy vector since we're filtering by metadata
    const dummyVector = new Array(768).fill(0); // Adjust dimension as needed

    const results = await vectorIndex.query({
      vector: dummyVector,
      topK: 10000, // Large number to get all
      includeMetadata: true,
      filter: `fileId = '${fileId}'`,
    });

    if (results.length === 0) {
      logger.info(`No vectors found for file: ${fileId}`);
      return 0;
    }

    const ids = results.map((r) => r.id as string);
    await vectorIndex.delete(ids);

    logger.info(`Deleted ${ids.length} vectors for file: ${fileId}`);
    return ids.length;
  } catch (error) {
    logger.error(`Failed to delete vectors for file: ${fileId}`, error);
    throw error;
  }
}

/**
 * Delete all vectors for a specific user
 */
export async function deleteVectorsByUserId(userId: string): Promise<number> {
  try {
    logger.info(`Deleting all vectors for user: ${userId}`);

    const dummyVector = new Array(768).fill(0);

    const results = await vectorIndex.query({
      vector: dummyVector,
      topK: 10000,
      includeMetadata: true,
      filter: `userId = '${userId}'`,
    });

    if (results.length === 0) {
      logger.info(`No vectors found for user: ${userId}`);
      return 0;
    }

    const ids = results.map((r) => r.id as string);
    await vectorIndex.delete(ids);

    logger.info(`Deleted ${ids.length} vectors for user: ${userId}`);
    return ids.length;
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
