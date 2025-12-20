// ** import types
import type {
  RagRetrievalOptions,
  RetrievedContext,
  VectorSearchResult,
  HybridSearchOptions,
  QueryMode,
  FusionAlgorithm,
} from "@repo/shared";

// ** import lib
import { searchVectors, searchHybridVectors } from "@repo/storage";

// ** import utils
import { mergeRagConfig } from "./config/rag-config.js";
import { generateQueryEmbedding } from "./embedding/gemini-embed.js";
import { logger } from "@repo/logs";
import {
  selectChunksWithBudget,
  reorderChunksForContext,
  type ContextBudgetConfig,
} from "./context-manager.js";

/**
 * Extended RAG retrieval options with hybrid search support
 */
export interface ExtendedRagRetrievalOptions extends RagRetrievalOptions {
  /** Enable hybrid search (combines dense + sparse BM25) */
  useHybridSearch?: boolean;
  /** Query mode for hybrid index: HYBRID, DENSE, or SPARSE */
  queryMode?: QueryMode;
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
  useHybridSearch: true, // Default to hybrid search if available
  queryMode: "HYBRID",
  fusionAlgorithm: "RRF",
  useContextBudget: true,
  reorderChunks: false,
};

/**
 * Retrieve relevant context from the vector database based on a query
 * Supports both traditional dense search and hybrid search with BM25
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
      useHybridSearch: extendedOptions.useHybridSearch,
      queryMode: extendedOptions.queryMode,
      useContextBudget: extendedOptions.useContextBudget,
    });

    // 1. Generate query embedding using Gemini
    const queryEmbedding = await generateQueryEmbedding(query);

    // 2. Build filter for user-specific content
    const filter = userId ? `userId = '${userId}'` : undefined;

    // 3. Search Vector DB - use hybrid or traditional search
    let results: VectorSearchResult[];

    if (extendedOptions.useHybridSearch) {
      // Use hybrid search with fusion algorithm
      const hybridOptions: HybridSearchOptions = {
        topK: extendedOptions.useContextBudget ? config.topK * 2 : config.topK, // Fetch more for context budget
        minScore: config.minScore,
        includeMetadata: true,
        filter,
        queryMode: extendedOptions.queryMode,
        fusionAlgorithm: extendedOptions.fusionAlgorithm,
      };

      results = await searchHybridVectors(query, queryEmbedding, hybridOptions);
    } else {
      // Traditional dense vector search
      results = await searchVectors(queryEmbedding, {
        topK: extendedOptions.useContextBudget ? config.topK * 2 : config.topK,
        minScore: config.minScore,
        includeMetadata: true,
        filter,
      });
    }

    // 4. Apply context budget management if enabled
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
      // Traditional extraction without budget management
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
      searchMode: extendedOptions.useHybridSearch ? "hybrid" : "dense",
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
  queryEmbedding: number[];
  searchMode: "hybrid" | "dense";
  queryMode?: QueryMode;
  fusionAlgorithm?: FusionAlgorithm;
}> {
  const config = mergeRagConfig(options);
  const extendedOptions = { ...DEFAULT_EXTENDED_OPTIONS, ...options };

  try {
    // Generate query embedding
    const queryEmbedding = await generateQueryEmbedding(query);

    // Filter by userId to only get chunks from user's uploaded files
    const filter = userId ? `userId = '${userId}'` : undefined;

    // Search Vector DB
    let results: VectorSearchResult[];
    const searchMode = extendedOptions.useHybridSearch ? "hybrid" : "dense";

    if (extendedOptions.useHybridSearch) {
      const hybridOptions: HybridSearchOptions = {
        topK: config.topK,
        minScore: config.minScore,
        includeMetadata: true,
        filter,
        queryMode: extendedOptions.queryMode,
        fusionAlgorithm: extendedOptions.fusionAlgorithm,
      };

      results = await searchHybridVectors(query, queryEmbedding, hybridOptions);
    } else {
      results = await searchVectors(queryEmbedding, {
        topK: config.topK,
        minScore: config.minScore,
        includeMetadata: true,
        filter,
      });
    }

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
      queryEmbedding,
      searchMode,
      queryMode: extendedOptions.useHybridSearch
        ? extendedOptions.queryMode
        : undefined,
      fusionAlgorithm: extendedOptions.useHybridSearch
        ? extendedOptions.fusionAlgorithm
        : undefined,
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
      useHybridSearch: true,
      useContextBudget: false,
    });

    return chunks.length > 0 && scores.some((score) => score >= threshold);
  } catch (error) {
    logger.error("Failed to check query relevance", error);
    return false;
  }
}
