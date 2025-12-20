// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";

// ** import lib
import { z } from "zod";
import { retrieveContext } from "@repo/rag";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Search RAG tool input schema
 */
const searchRAGInputSchema = z.object({
  query: z.string().describe("The search query to find relevant information"),
  topK: z
    .number()
    .int()
    .positive()
    .default(50)
    .describe("Number of results to retrieve"),
  minScore: z
    .number()
    .min(0)
    .max(1)
    .default(0.01)
    .describe("Minimum relevance score threshold"),
});

type SearchRAGInput = z.output<typeof searchRAGInputSchema>;

/**
 * Search RAG tool output
 */
export interface SearchRAGOutput {
  chunks: string[];
  sources: string[];
  scores: number[];
  query: string;
  resultsCount: number;
  avgScore: number;
}

/**
 * Search RAG Tool
 * Retrieves relevant context from user's uploaded materials using hybrid search
 */
export const searchRAGTool: ToolDefinition<SearchRAGInput, SearchRAGOutput> = {
  name: "search_rag",
  description:
    "Search through the user's uploaded study materials to find relevant information. " +
    "Use this tool when you need to retrieve specific facts, concepts, or context from the user's knowledge base. " +
    "Returns relevant text chunks with their sources and relevance scores.",

  inputSchema: searchRAGInputSchema,

  category: ToolCategory.SEARCH,
  requiresApproval: false,
  timeout: 10000, // 10 seconds
  cost: 1, // Low cost
  cacheable: true,
  cacheTTL: 300, // 5 minutes

  async execute(input: SearchRAGInput, context: ToolExecutionContext) {
    const startTime = Date.now();

    try {
      logger.info("Executing RAG search", {
        userId: context.userId,
        query: input.query,
        topK: input.topK,
        minScore: input.minScore,
      });

      // Retrieve context using RAG
      const result = await retrieveContext(input.query, context.userId, {
        topK: input.topK,
        minScore: input.minScore,
      });

      const avgScore =
        result.scores.length > 0
          ? result.scores.reduce((a, b) => a + b, 0) / result.scores.length
          : 0;

      const executionTime = Date.now() - startTime;

      logger.info("RAG search completed", {
        userId: context.userId,
        resultsCount: result.chunks.length,
        avgScore: avgScore.toFixed(3),
        executionTime,
      });

      return {
        chunks: result.chunks,
        sources: result.sources,
        scores: result.scores,
        query: input.query,
        resultsCount: result.chunks.length,
        avgScore,
      };
    } catch (error) {
      logger.error("RAG search failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: context.userId,
        query: input.query,
      });

      // Return empty results on failure
      return {
        chunks: [],
        sources: [],
        scores: [],
        query: input.query,
        resultsCount: 0,
        avgScore: 0,
      };
    }
  },
};
