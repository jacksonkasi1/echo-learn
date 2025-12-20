// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";

// ** import lib
import { z } from "zod";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Rerank tool input schema
 */
const rerankInputSchema = z.object({
  query: z.string().describe("The query to use for re-ranking"),
  documents: z
    .array(
      z.object({
        text: z.string(),
        metadata: z.record(z.unknown()).optional(),
      }),
    )
    .describe("Documents to re-rank"),
  topK: z
    .number()
    .int()
    .positive()
    .default(10)
    .describe("Number of top results to return after re-ranking"),
});

type RerankInput = z.output<typeof rerankInputSchema>;

/**
 * Rerank tool output
 */
export interface RerankOutput {
  rankedDocuments: Array<{
    text: string;
    metadata?: Record<string, unknown>;
    relevanceScore: number;
    originalIndex: number;
  }>;
  query: string;
  method: string;
  executionTimeMs: number;
}

/**
 * Simple LLM-based re-ranking using relevance scoring
 * This is a placeholder implementation - can be replaced with Cohere or other services
 */
async function rerankDocuments(
  query: string,
  documents: Array<{ text: string; metadata?: Record<string, unknown> }>,
  topK: number,
): Promise<RerankOutput["rankedDocuments"]> {
  // Simple scoring based on keyword overlap and semantic similarity
  // In production, replace this with Cohere Rerank API or similar
  const scored = documents.map((doc, index) => {
    // Normalize texts
    const queryLower = query.toLowerCase();
    const textLower = doc.text.toLowerCase();

    // Simple scoring: keyword matches
    const queryWords = queryLower.split(/\s+/);
    const matchCount = queryWords.filter((word) =>
      textLower.includes(word),
    ).length;

    // Calculate relevance (0-1)
    const relevanceScore = Math.min(matchCount / queryWords.length, 1);

    return {
      text: doc.text,
      metadata: doc.metadata,
      relevanceScore,
      originalIndex: index,
    };
  });

  // Sort by relevance score (descending)
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  // Return top K
  return scored.slice(0, topK);
}

/**
 * Rerank Tool
 * Re-ranks retrieved documents based on relevance to the query
 * Improves precision for fact-finding queries
 */
export const rerankTool: ToolDefinition<RerankInput, RerankOutput> = {
  name: "rerank_documents",
  description:
    "Re-rank a list of retrieved documents based on their relevance to a query. " +
    "Use this tool after retrieving documents to improve result quality, especially for fact-finding queries. " +
    "Returns the most relevant documents ranked by relevance score.",

  inputSchema: rerankInputSchema,

  category: ToolCategory.RERANK,
  requiresApproval: false,
  timeout: 15000, // 15 seconds
  cost: 5, // Medium cost (re-ranking is more expensive)
  cacheable: true,
  cacheTTL: 300, // 5 minutes

  async execute(input: RerankInput, context: ToolExecutionContext) {
    const startTime = Date.now();

    try {
      logger.info("Executing re-ranking", {
        userId: context.userId,
        query: input.query,
        documentCount: input.documents.length,
        topK: input.topK,
      });

      if (input.documents.length === 0) {
        logger.warn("No documents to re-rank");
        return {
          rankedDocuments: [],
          query: input.query,
          method: "none",
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Re-rank documents
      const rankedDocuments = await rerankDocuments(
        input.query,
        input.documents,
        input.topK,
      );

      const executionTime = Date.now() - startTime;

      logger.info("Re-ranking completed", {
        userId: context.userId,
        originalCount: input.documents.length,
        rankedCount: rankedDocuments.length,
        topScore: rankedDocuments[0]?.relevanceScore.toFixed(3) || "N/A",
        executionTime,
      });

      return {
        rankedDocuments,
        query: input.query,
        method: "llm_based",
        executionTimeMs: executionTime,
      };
    } catch (error) {
      logger.error("Re-ranking failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: context.userId,
        query: input.query,
      });

      // Return original documents on failure
      const fallbackDocs = input.documents
        .slice(0, input.topK)
        .map((doc: any, i: number) => ({
          text: doc.text,
          metadata: doc.metadata,
          relevanceScore: 0,
          originalIndex: i,
        }));

      return {
        rankedDocuments: fallbackDocs,
        query: input.query,
        method: "fallback",
        executionTimeMs: Date.now() - startTime,
      };
    }
  },
};
