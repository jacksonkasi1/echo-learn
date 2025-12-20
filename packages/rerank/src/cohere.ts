// ** Cohere Reranking Implementation
// Uses Cohere's re-ranking models for improved retrieval precision

// ** import types
import type {
  RerankDocument,
  RerankResult,
  RerankOptions,
  RerankResponse,
  CohereRerankConfig,
  CohereRerankModel,
} from "./types.js";

// ** import lib
import { CohereClient } from "cohere-ai";

// ** import utils
import { logger } from "@repo/logs";
import { DEFAULT_COHERE_CONFIG, DEFAULT_RERANK_CONFIG } from "./types.js";

// Singleton Cohere client
let cohereClient: CohereClient | null = null;

/**
 * Initialize or get the Cohere client
 */
function getCohereClient(apiKey?: string): CohereClient {
  const key = apiKey || process.env.COHERE_API_KEY;

  if (!key) {
    throw new Error(
      "Cohere API key not found. Set COHERE_API_KEY environment variable or pass apiKey in config.",
    );
  }

  if (!cohereClient) {
    cohereClient = new CohereClient({
      token: key,
    });
  }

  return cohereClient;
}

/**
 * Reset the Cohere client (useful for testing or changing API keys)
 */
export function resetCohereClient(): void {
  cohereClient = null;
}

/**
 * Rerank documents using Cohere's reranking models
 *
 * @param query - The query to rank documents against
 * @param documents - Array of documents to rerank
 * @param options - Reranking options
 * @param config - Cohere-specific configuration
 * @returns Reranked results sorted by relevance
 */
export async function rerankWithCohere(
  query: string,
  documents: Array<RerankDocument>,
  options: RerankOptions = {},
  config: Partial<CohereRerankConfig> = {},
): Promise<RerankResponse> {
  const startTime = Date.now();

  const mergedOptions = { ...DEFAULT_RERANK_CONFIG, ...options };
  const mergedConfig = { ...DEFAULT_COHERE_CONFIG, ...config };

  // Limit documents for cost control
  const docsToRerank = documents.slice(0, mergedOptions.maxDocuments);

  if (docsToRerank.length === 0) {
    return {
      results: [],
      provider: "cohere",
      model: mergedConfig.model,
      processingTimeMs: Date.now() - startTime,
      documentsProcessed: 0,
      documentsFiltered: 0,
    };
  }

  logger.info("Starting Cohere reranking", {
    query: query.slice(0, 50) + (query.length > 50 ? "..." : ""),
    documentCount: docsToRerank.length,
    model: mergedConfig.model,
    topN: mergedOptions.topN,
  });

  try {
    const client = getCohereClient(config.apiKey);

    // Prepare documents as strings for Cohere
    const documentTexts = docsToRerank.map((doc) => doc.text);

    // Call Cohere rerank API
    const response = await client.rerank({
      model: mergedConfig.model as CohereRerankModel,
      query,
      documents: documentTexts,
      topN: mergedOptions.topN,
      returnDocuments: mergedOptions.returnDocuments,
    });

    // Map results back to our format
    const results: Array<RerankResult> = response.results
      .map((result) => {
        const originalDoc = docsToRerank[result.index];
        if (!originalDoc) {
          return null;
        }

        const rerankResult: RerankResult = {
          id: originalDoc.id,
          originalIndex: result.index,
          relevanceScore: result.relevanceScore,
          text: originalDoc.text,
        };

        if (originalDoc.metadata) {
          rerankResult.metadata = originalDoc.metadata;
        }
        if (originalDoc.originalScore !== undefined) {
          rerankResult.originalScore = originalDoc.originalScore;
        }

        return rerankResult;
      })
      .filter((r): r is RerankResult => r !== null);

    // Filter by minimum relevance score
    const filteredResults = results.filter(
      (r) => r.relevanceScore >= mergedOptions.minRelevanceScore,
    );

    const processingTimeMs = Date.now() - startTime;

    logger.info("Cohere reranking completed", {
      resultsReturned: filteredResults.length,
      documentsFiltered: results.length - filteredResults.length,
      processingTimeMs,
      topScore: filteredResults[0]?.relevanceScore ?? 0,
    });

    return {
      results: filteredResults,
      provider: "cohere",
      model: mergedConfig.model,
      processingTimeMs,
      documentsProcessed: docsToRerank.length,
      documentsFiltered: results.length - filteredResults.length,
    };
  } catch (error) {
    logger.error("Cohere reranking failed", error);

    // Check for specific error types
    if (error instanceof Error) {
      if (error.message.includes("rate limit")) {
        throw new Error("Cohere rate limit exceeded. Please try again later.");
      }
      if (error.message.includes("API key")) {
        throw new Error("Invalid Cohere API key.");
      }
    }

    throw error;
  }
}

/**
 * Check if Cohere reranking is available (API key is set)
 */
export function isCohereAvailable(): boolean {
  return !!process.env.COHERE_API_KEY;
}

/**
 * Get available Cohere models for reranking
 */
export function getCohereModels(): Array<{
  id: CohereRerankModel;
  description: string;
  contextLength: number;
}> {
  return [
    {
      id: "rerank-v3.5",
      description: "Multilingual, good balance of quality and cost",
      contextLength: 4096,
    },
    {
      id: "rerank-english-v3.0",
      description: "English only, optimized for English text",
      contextLength: 4096,
    },
    {
      id: "rerank-v4.0-fast",
      description: "Light version for low latency, high throughput",
      contextLength: 32000,
    },
    {
      id: "rerank-v4.0-pro",
      description: "State-of-the-art, multilingual, best quality",
      contextLength: 32000,
    },
  ];
}
