// ** import types
import type {
  VectorMetadata,
  VectorSearchResult,
  VectorSearchOptions,
  HybridSearchOptions,
  FusionAlgorithm,
  QueryMode,
} from "@repo/shared";

// ** import lib
import { Index, type IndexConfig } from "@upstash/vector";

// ** import utils
import { logger } from "@repo/logs";

// Upstash Vector metadata type - must be flat with primitive values only
type VectorDbMetadata = Record<
  string,
  string | number | boolean | Array<string>
>;

/**
 * Upstash Fusion Algorithm enum mapping
 */
const FUSION_ALGORITHM_MAP: Record<FusionAlgorithm, string> = {
  RRF: "RRF",
  DBSF: "DBSF",
};

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
    vector: Array<number>;
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
 * Upsert vectors with text data for hybrid index (auto-generates sparse BM25 vectors)
 * Used for hybrid search with both semantic and keyword matching
 */
export async function upsertHybridVectors(
  vectors: Array<{
    id: string;
    vector: Array<number>;
    data: string; // Text data for BM25 sparse vector generation
    metadata: VectorMetadata;
  }>,
): Promise<void> {
  try {
    logger.info(`Upserting ${vectors.length} hybrid vectors`);

    // Convert and sanitize metadata to Upstash-compatible format
    const formattedVectors = vectors.map((v) => ({
      id: v.id,
      vector: v.vector,
      data: v.data, // Text for automatic sparse vector generation
      metadata: sanitizeMetadata(v.metadata),
    }));

    // Upstash Vector supports batch upserts with data field for hybrid index
    await vectorIndex.upsert(formattedVectors);

    logger.info(`Successfully upserted ${vectors.length} hybrid vectors`);
  } catch (error) {
    logger.error("Failed to upsert hybrid vectors", error);
    throw error;
  }
}

/**
 * Search for similar vectors using a query vector
 * Returns the most similar chunks based on cosine similarity
 */
export async function searchVectors(
  queryVector: Array<number>,
  options: VectorSearchOptions = {},
): Promise<Array<VectorSearchResult>> {
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
    const mappedResults: Array<VectorSearchResult> = results
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
 * Hybrid search using text query for combined dense + sparse (BM25) search
 * Automatically handles both semantic similarity and keyword matching
 * Requires a hybrid index in Upstash
 */
export async function searchHybridVectors(
  query: string,
  queryVector: Array<number>,
  options: HybridSearchOptions = {},
): Promise<Array<VectorSearchResult>> {
  const {
    topK = 15,
    filter,
    includeMetadata = true,
    minScore,
    queryMode = "HYBRID",
    fusionAlgorithm = "RRF",
  } = options;

  try {
    logger.info("Performing hybrid search", {
      topK,
      queryMode,
      fusionAlgorithm,
      hasFilter: !!filter,
    });

    // Build query options based on query mode
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let queryOptions: any;

    if (queryMode === "HYBRID") {
      // Hybrid mode: use both vector and text data
      queryOptions = {
        vector: queryVector,
        data: query, // Text for BM25 sparse matching
        topK,
        includeMetadata,
        filter: filter as string | undefined,
        fusionAlgorithm: FUSION_ALGORITHM_MAP[fusionAlgorithm],
      };
    } else if (queryMode === "DENSE") {
      // Dense only: semantic similarity
      queryOptions = {
        vector: queryVector,
        topK,
        includeMetadata,
        filter: filter as string | undefined,
      };
    } else {
      // Sparse only: BM25 keyword matching
      queryOptions = {
        data: query,
        topK,
        includeMetadata,
        filter: filter as string | undefined,
      };
    }

    const results = await vectorIndex.query(queryOptions);

    // Map results to our type and optionally filter by minScore
    const mappedResults: Array<VectorSearchResult> = results
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

    logger.info(`Hybrid search found ${mappedResults.length} results`, {
      queryMode,
      fusionAlgorithm: queryMode === "HYBRID" ? fusionAlgorithm : "N/A",
    });

    return mappedResults;
  } catch (error) {
    logger.error("Failed to perform hybrid search", error);
    throw error;
  }
}

/**
 * Search with text data only (for hybrid index without pre-computed embedding)
 * Useful when you want Upstash to handle both dense and sparse vector generation
 */
export async function searchWithTextQuery(
  query: string,
  options: HybridSearchOptions = {},
): Promise<Array<VectorSearchResult>> {
  const {
    topK = 15,
    filter,
    includeMetadata = true,
    minScore,
    fusionAlgorithm = "RRF",
  } = options;

  try {
    logger.info("Searching with text query", {
      topK,
      fusionAlgorithm,
      hasFilter: !!filter,
    });

    const results = await vectorIndex.query({
      data: query, // Text for automatic vector generation
      topK,
      includeMetadata,
      filter: filter as string | undefined,
      fusionAlgorithm: FUSION_ALGORITHM_MAP[fusionAlgorithm],
    } as Parameters<typeof vectorIndex.query>[0]);

    // Map results to our type and optionally filter by minScore
    const mappedResults: Array<VectorSearchResult> = results
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

    logger.info(`Text query search found ${mappedResults.length} results`);

    return mappedResults;
  } catch (error) {
    logger.error("Failed to search with text query", error);
    throw error;
  }
}

/**
 * Delete vectors by their IDs
 * Used when deleting files and their associated chunks
 */
export async function deleteVectors(ids: Array<string>): Promise<void> {
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
  ids: Array<string>,
): Promise<
  Array<{ id: string; vector: Array<number>; metadata: VectorMetadata } | null>
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
        vector: result.vector as Array<number>,
        metadata: result.metadata as unknown as VectorMetadata,
      };
    });
  } catch (error) {
    logger.error("Failed to fetch vectors", error);
    throw error;
  }
}
