// ** Gemini-based Reranking Fallback
// Uses Gemini LLM to score document relevance when Cohere is unavailable

// ** import types
import type {
  RerankDocument,
  RerankResult,
  RerankOptions,
  RerankResponse,
  GeminiRerankConfig,
} from "./types.js";

// ** import lib
import { generateStructuredResponse } from "@repo/llm";

// ** import utils
import { logger } from "@repo/logs";
import {
  DEFAULT_GEMINI_RERANK_CONFIG,
  DEFAULT_RERANK_CONFIG,
} from "./types.js";

/**
 * Schema for Gemini reranking response
 */
interface GeminiRerankResponseSchema {
  rankings: Array<{
    index: number;
    relevanceScore: number;
    reasoning?: string;
  }>;
}

/**
 * Build the prompt for Gemini reranking
 */
function buildRerankPrompt(
  query: string,
  documents: Array<RerankDocument>,
): string {
  const docList = documents
    .map(
      (doc, idx) =>
        `[Document ${idx}]:\n${doc.text.slice(0, 1000)}${doc.text.length > 1000 ? "..." : ""}`,
    )
    .join("\n\n");

  return `You are a relevance scoring expert. Your task is to evaluate how relevant each document is to the given query.

QUERY: "${query}"

DOCUMENTS:
${docList}

For each document, provide a relevance score between 0 and 1, where:
- 1.0 = Highly relevant, directly answers the query
- 0.7-0.9 = Relevant, contains useful information
- 0.4-0.6 = Somewhat relevant, tangentially related
- 0.1-0.3 = Slightly relevant, mentions related concepts
- 0.0 = Not relevant at all

Respond with a JSON object containing an array of rankings.
Each ranking should have:
- index: the document index (0-based)
- relevanceScore: a number between 0 and 1

Sort the rankings by relevanceScore in descending order.`;
}

/**
 * Rerank documents using Gemini LLM as a fallback
 * Uses structured output for reliable relevance scoring
 *
 * @param query - The query to rank documents against
 * @param documents - Array of documents to rerank
 * @param options - Reranking options
 * @param config - Gemini-specific configuration
 * @returns Reranked results sorted by relevance
 */
export async function rerankWithGemini(
  query: string,
  documents: Array<RerankDocument>,
  options: RerankOptions = {},
  config: Partial<GeminiRerankConfig> = {},
): Promise<RerankResponse> {
  const startTime = Date.now();

  const mergedOptions = { ...DEFAULT_RERANK_CONFIG, ...options };
  const mergedConfig = { ...DEFAULT_GEMINI_RERANK_CONFIG, ...config };

  // Limit documents for cost control
  const docsToRerank = documents.slice(0, mergedOptions.maxDocuments);

  if (docsToRerank.length === 0) {
    return {
      results: [],
      provider: "gemini",
      model: mergedConfig.model,
      processingTimeMs: Date.now() - startTime,
      documentsProcessed: 0,
      documentsFiltered: 0,
    };
  }

  logger.info("Starting Gemini reranking (fallback)", {
    query: query.slice(0, 50) + (query.length > 50 ? "..." : ""),
    documentCount: docsToRerank.length,
    model: mergedConfig.model,
    topN: mergedOptions.topN,
  });

  try {
    const prompt = buildRerankPrompt(query, docsToRerank);

    // Use Gemini's structured output for reliable parsing
    const response =
      await generateStructuredResponse<GeminiRerankResponseSchema>({
        prompt,
        schema: {
          type: "object",
          properties: {
            rankings: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  index: { type: "number" },
                  relevanceScore: { type: "number" },
                  reasoning: { type: "string" },
                },
                required: ["index", "relevanceScore"],
              },
            },
          },
          required: ["rankings"],
        },
        temperature: mergedConfig.temperature,
        maxTokens: mergedConfig.maxTokens,
      });

    // Map results back to our format
    const mappedResults = response.rankings
      .filter((r) => r.index >= 0 && r.index < docsToRerank.length)
      .map((ranking) => {
        const originalDoc = docsToRerank[ranking.index];
        if (!originalDoc) {
          return null;
        }

        const rerankResult: RerankResult = {
          id: originalDoc.id,
          originalIndex: ranking.index,
          relevanceScore: Math.max(0, Math.min(1, ranking.relevanceScore)),
          text: originalDoc.text,
        };

        if (originalDoc.metadata) {
          rerankResult.metadata = originalDoc.metadata;
        }
        if (originalDoc.originalScore !== undefined) {
          rerankResult.originalScore = originalDoc.originalScore;
        }

        return rerankResult;
      });

    const results: Array<RerankResult> = mappedResults
      .filter((r): r is RerankResult => r !== null)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, mergedOptions.topN);

    // Filter by minimum relevance score
    const filteredResults = results.filter(
      (r) => r.relevanceScore >= mergedOptions.minRelevanceScore,
    );

    const processingTimeMs = Date.now() - startTime;

    logger.info("Gemini reranking completed", {
      resultsReturned: filteredResults.length,
      documentsFiltered: results.length - filteredResults.length,
      processingTimeMs,
      topScore: filteredResults[0]?.relevanceScore ?? 0,
    });

    return {
      results: filteredResults,
      provider: "gemini",
      model: mergedConfig.model,
      processingTimeMs,
      documentsProcessed: docsToRerank.length,
      documentsFiltered: results.length - filteredResults.length,
    };
  } catch (error) {
    logger.error("Gemini reranking failed", error);
    throw error;
  }
}

/**
 * Check if Gemini reranking is available
 * Gemini is typically always available as the fallback
 */
export function isGeminiAvailable(): boolean {
  return !!(
    process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );
}
