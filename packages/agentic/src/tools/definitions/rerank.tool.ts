// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";

// ** import lib
import { z } from "zod";
import { rerank } from "ai";
import { cohere } from "@ai-sdk/cohere";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Rerank tool input schema
 */
const rerankInputSchema = z.object({
  query: z.string().describe("The query to use for re-ranking"),
  documents: z.array(z.string()).describe("Array of document texts to re-rank"),
  topN: z
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
    document: string;
    score: number;
    originalIndex: number;
  }>;
  query: string;
  model: string;
  executionTimeMs: number;
}

/**
 * Rerank Tool
 *
 * Uses AI SDK 6's native rerank function with Cohere's rerank-v3.5 model.
 * Re-ranks retrieved documents based on their semantic relevance to the query.
 *
 * Best for:
 * - Fact-finding queries ("Who is the CEO?")
 * - Specific questions that need precise answers
 * - Improving precision after broad retrieval
 *
 * Skip for:
 * - Summary queries (need broad coverage)
 * - List queries (need all relevant docs)
 */
export const rerankTool: ToolDefinition<RerankInput, RerankOutput> = {
  name: "rerank_documents",
  description:
    "Re-rank a list of retrieved documents based on their semantic relevance to a query. " +
    "Use this tool after search_rag when you need to find the most relevant documents for fact-finding queries. " +
    "Returns documents sorted by relevance score from Cohere's rerank model.",

  inputSchema: rerankInputSchema,

  category: ToolCategory.RERANK,
  requiresApproval: false,
  timeout: 15000,
  cost: 5,
  cacheable: true,
  cacheTTL: 300,

  async execute(input: RerankInput, context: ToolExecutionContext) {
    const startTime = Date.now();
    const modelName = "rerank-v3.5";

    try {
      logger.info("Executing Cohere re-ranking", {
        userId: context.userId,
        query: input.query.slice(0, 50),
        documentCount: input.documents.length,
        topN: input.topN,
        model: modelName,
      });

      if (input.documents.length === 0) {
        logger.warn("No documents to re-rank");
        return {
          rankedDocuments: [],
          query: input.query,
          model: modelName,
          executionTimeMs: Date.now() - startTime,
        };
      }

      // Use AI SDK 6 native rerank with Cohere
      const result = await rerank({
        model: cohere.reranking(modelName),
        query: input.query,
        documents: input.documents,
        topN: Math.min(input.topN, input.documents.length),
      });

      // Map ranking results to output format
      const rankedDocuments = result.ranking.map((item) => ({
        document: item.document,
        score: item.score,
        originalIndex: item.originalIndex,
      }));

      const executionTime = Date.now() - startTime;

      logger.info("Cohere re-ranking completed", {
        userId: context.userId,
        originalCount: input.documents.length,
        rankedCount: rankedDocuments.length,
        topScore: rankedDocuments[0]?.score.toFixed(4) || "N/A",
        executionTimeMs: executionTime,
      });

      return {
        rankedDocuments,
        query: input.query,
        model: modelName,
        executionTimeMs: executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;

      logger.error("Cohere re-ranking failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: context.userId,
        query: input.query.slice(0, 50),
        executionTimeMs: executionTime,
      });

      // Fallback: return documents in original order
      const fallbackDocs = input.documents
        .slice(0, input.topN)
        .map((doc, index) => ({
          document: doc,
          score: 0,
          originalIndex: index,
        }));

      logger.warn("Using fallback: returning documents in original order", {
        fallbackCount: fallbackDocs.length,
      });

      return {
        rankedDocuments: fallbackDocs,
        query: input.query,
        model: "fallback",
        executionTimeMs: executionTime,
      };
    }
  },
};
