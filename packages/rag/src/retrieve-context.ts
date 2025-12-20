// ** import types
import type {
  RagRetrievalOptions,
  RetrievedContext,
  VectorSearchResult,
  FusionAlgorithm,
} from "@repo/shared";

// ** import lib
import { searchWithEmbedding } from "@repo/storage";

// ** import utils
import { mergeRagConfig } from "./config/rag-config.js";
import { logger } from "@repo/logs";
import {
  selectChunksWithBudget,
  reorderChunksForContext,
  type ContextBudgetConfig,
} from "./context-manager.js";

/**
 * Extended RAG retrieval options with Upstash hybrid search
 */
export interface ExtendedRagRetrievalOptions extends RagRetrievalOptions {
  /** Fusion algorithm: RRF or DBSF */
  fusionAlgorithm?: FusionAlgorithm;
  /** Use context budget manager for dynamic chunk selection */
  useContextBudget?: boolean;
  /** Context budget configuration */
  contextBudgetConfig?: Partial<ContextBudgetConfig>;
  /** Reorder chunks for better context flow */
  reorderChunks?: boolean;
}

/**
 * Default extended options
 */
const DEFAULT_EXTENDED_OPTIONS: Required<
  Omit<
    ExtendedRagRetrievalOptions,
    keyof RagRetrievalOptions | "contextBudgetConfig"
  >
> = {
  fusionAlgorithm: "RRF",
  useContextBudget: true,
  reorderChunks: false,
};

/**
 * Retrieve relevant context from the vector database based on a query
 * Uses Upstash's built-in hybrid search with BAAI embedding model
 * Used for RAG (Retrieval Augmented Generation) in the chat pipeline
 */
export async function retrieveContext(
  query: string,
  userId: string,
  options: ExtendedRagRetrievalOptions = {},
): Promise<RetrievedContext> {
  const config = mergeRagConfig(options);
  const extendedOptions = { ...DEFAULT_EXTENDED_OPTIONS, ...options };

  try {
    logger.info("Retrieving context for query", {
      queryLength: query.length,
      userId,
      topK: config.topK,
      minScore: config.minScore,
      fusionAlgorithm: extendedOptions.fusionAlgorithm,
      useContextBudget: extendedOptions.useContextBudget,
    });

    // Build filter for user-specific content
    const filter = userId ? `userId = '${userId}'` : undefined;
    const effectiveTopK = extendedOptions.useContextBudget
      ? config.topK * 2
      : config.topK;

    // Search with Upstash's built-in hybrid embedding
    const results = await searchWithEmbedding(query, {
      topK: effectiveTopK,
      minScore: config.minScore,
      includeMetadata: true,
      filter,
      fusionAlgorithm: extendedOptions.fusionAlgorithm,
    });

    // Apply context budget management if enabled
    let context: RetrievedContext;

    if (extendedOptions.useContextBudget && results.length > 0) {
      const budgetResult = selectChunksWithBudget(
        results,
        extendedOptions.contextBudgetConfig,
      );

      logger.info("Context budget applied", {
        totalCandidates: budgetResult.stats.totalCandidates,
        selectedCount: budgetResult.stats.selectedCount,
        uniqueSources: budgetResult.stats.uniqueSources,
        estimatedTokens: budgetResult.estimatedTokens,
        budgetUsed: `${budgetResult.stats.budgetUsed}%`,
      });

      // Optionally reorder chunks for better context flow
      if (extendedOptions.reorderChunks) {
        const reordered = reorderChunksForContext(
          budgetResult.chunks,
          budgetResult.sources,
          budgetResult.scores,
          results,
        );
        context = {
          chunks: reordered.chunks,
          sources: [...new Set(reordered.sources)],
          scores: reordered.scores,
        };
      } else {
        context = {
          chunks: budgetResult.chunks,
          sources: budgetResult.sources,
          scores: budgetResult.scores,
        };
      }
    } else {
      // Extract without budget management
      context = extractContextFromResults(results);
    }

    logger.info("Context retrieved successfully", {
      userId,
      chunksFound: context.chunks.length,
      uniqueSources: context.sources.length,
      avgScore:
        context.scores.length > 0
          ? context.scores.reduce((a, b) => a + b, 0) / context.scores.length
          : 0,
    });

    return context;
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
  options: ExtendedRagRetrievalOptions = {},
): Promise<{
  context: RetrievedContext;
  results: VectorSearchResult[];
  fusionAlgorithm: FusionAlgorithm;
}> {
  const config = mergeRagConfig(options);
  const extendedOptions = { ...DEFAULT_EXTENDED_OPTIONS, ...options };

  try {
    // Build filter for user-specific content
    const filter = userId ? `userId = '${userId}'` : undefined;

    // Search with Upstash's built-in hybrid embedding
    const results = await searchWithEmbedding(query, {
      topK: config.topK,
      minScore: config.minScore,
      includeMetadata: true,
      filter,
      fusionAlgorithm: extendedOptions.fusionAlgorithm,
    });

    // Extract context (with or without budget management)
    let context: RetrievedContext;

    if (extendedOptions.useContextBudget && results.length > 0) {
      const budgetResult = selectChunksWithBudget(
        results,
        extendedOptions.contextBudgetConfig,
      );
      context = {
        chunks: budgetResult.chunks,
        sources: budgetResult.sources,
        scores: budgetResult.scores,
      };
    } else {
      context = extractContextFromResults(results);
    }

    return {
      context,
      results,
      fusionAlgorithm: extendedOptions.fusionAlgorithm,
    };
  } catch (error) {
    logger.error("Failed to retrieve context with metadata", error);
    throw error;
  }
}

/**
 * Extract chunks, sources, and scores from vector search results
 */
function extractContextFromResults(
  results: VectorSearchResult[],
): RetrievedContext {
  const chunks: string[] = [];
  const sources: string[] = [];
  const scores: number[] = [];

  for (const result of results) {
    if (result.metadata?.content) {
      chunks.push(result.metadata.content);
      scores.push(result.score);

      if (result.metadata.fileId && !sources.includes(result.metadata.fileId)) {
        sources.push(result.metadata.fileId);
      }
    }
  }

  return { chunks, sources, scores };
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
      useContextBudget: false,
    });

    return chunks.length > 0 && scores.some((score) => score >= threshold);
  } catch (error) {
    logger.error("Failed to check query relevance", error);
    return false;
  }
}
