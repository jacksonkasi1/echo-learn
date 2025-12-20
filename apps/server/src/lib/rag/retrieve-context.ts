// ** import types
import type { VectorSearchResult } from "@repo/shared";

// ** import lib
import { generateQueryEmbedding } from "@/lib/embedding/gemini-embed";
import { searchVectors } from "@/lib/upstash/vector";

// ** import utils
import { logger } from "@repo/logs";

export interface RetrievedContext {
  chunks: string[];
  sources: string[];
  scores: number[];
}

export interface RetrieveContextOptions {
  topK?: number;
  minScore?: number;
  userId?: string;
}

const DEFAULT_OPTIONS: RetrieveContextOptions = {
  topK: 5,
  minScore: 0.7,
};

/**
 * Retrieve relevant context from the vector database based on a query
 * Used for RAG (Retrieval Augmented Generation) in the chat pipeline
 */
export async function retrieveContext(
  query: string,
  userId: string,
  options: RetrieveContextOptions = {},
): Promise<RetrievedContext> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    logger.info("Retrieving context for query", {
      queryLength: query.length,
      userId,
      topK: opts.topK,
    });

    // 1. Generate query embedding using Gemini
    const queryEmbedding = await generateQueryEmbedding(query);

    // 2. Search Vector DB for similar chunks
    // Filter by userId to only get chunks from user's uploaded files
    // Upstash Vector uses string-based filter syntax
    const filter = userId ? `userId = '${userId}'` : undefined;

    const results = await searchVectors(queryEmbedding, {
      topK: opts.topK,
      minScore: opts.minScore,
      includeMetadata: true,
      filter,
    });

    // 3. Extract content and sources from results
    const chunks: string[] = [];
    const sources: string[] = [];
    const scores: number[] = [];

    for (const result of results) {
      if (result.metadata?.content) {
        chunks.push(result.metadata.content);
        scores.push(result.score);

        if (
          result.metadata.fileId &&
          !sources.includes(result.metadata.fileId)
        ) {
          sources.push(result.metadata.fileId);
        }
      }
    }

    logger.info("Context retrieved successfully", {
      userId,
      chunksFound: chunks.length,
      uniqueSources: sources.length,
      avgScore:
        scores.length > 0
          ? scores.reduce((a, b) => a + b, 0) / scores.length
          : 0,
    });

    return {
      chunks,
      sources,
      scores,
    };
  } catch (error) {
    logger.error("Failed to retrieve context", error);
    throw error;
  }
}

/**
 * Retrieve context with additional metadata for debugging/analytics
 */
export async function retrieveContextWithMetadata(
  query: string,
  userId: string,
  options: RetrieveContextOptions = {},
): Promise<{
  context: RetrievedContext;
  results: VectorSearchResult[];
  queryEmbedding: number[];
}> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    // Search Vector DB
    const results = await searchVectors(queryEmbedding, {
      topK: opts.topK,
      minScore: opts.minScore,
      includeMetadata: true,
    });

    // Extract context
    const chunks: string[] = [];
    const sources: string[] = [];
    const scores: number[] = [];

    for (const result of results) {
      if (result.metadata?.content) {
        chunks.push(result.metadata.content);
        scores.push(result.score);

        if (
          result.metadata.fileId &&
          !sources.includes(result.metadata.fileId)
        ) {
          sources.push(result.metadata.fileId);
        }
      }
    }

    return {
      context: { chunks, sources, scores },
      results,
      queryEmbedding,
    };
  } catch (error) {
    logger.error("Failed to retrieve context with metadata", error);
    throw error;
  }
}

/**
 * Format retrieved chunks as a context string for the LLM
 * Adds separators and source attribution
 */
export function formatContextForPrompt(
  chunks: string[],
  options: { includeSeparators?: boolean; maxLength?: number } = {},
): string {
  const { includeSeparators = true, maxLength = 8000 } = options;

  if (chunks.length === 0) {
    return "No relevant information found in your uploaded materials.";
  }

  const separator = includeSeparators ? "\n\n---\n\n" : "\n\n";
  let formattedContext = chunks.join(separator);

  // Truncate if too long
  if (formattedContext.length > maxLength) {
    formattedContext = formattedContext.slice(0, maxLength);
    // Try to cut at a sentence boundary
    const lastPeriod = formattedContext.lastIndexOf(".");
    if (lastPeriod > maxLength * 0.8) {
      formattedContext = formattedContext.slice(0, lastPeriod + 1);
    }
    formattedContext += "\n\n[Context truncated due to length...]";
  }

  return formattedContext;
}

/**
 * Check if query is related to uploaded content
 * Returns true if relevant chunks are found above threshold
 */
export async function isQueryRelevantToContent(
  query: string,
  userId: string,
  threshold = 0.75,
): Promise<boolean> {
  try {
    const { chunks, scores } = await retrieveContext(query, userId, {
      topK: 3,
      minScore: threshold,
    });

    return chunks.length > 0 && scores.some((score) => score >= threshold);
  } catch (error) {
    logger.error("Failed to check query relevance", error);
    return false;
  }
}
