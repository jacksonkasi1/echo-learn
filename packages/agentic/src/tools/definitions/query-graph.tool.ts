// ** Query Knowledge Graph Tool for Echo-Learn
// ** Allows the agent to query user's knowledge graph for related concepts

// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";
import type { LearningRelationType } from "@repo/shared";

// ** import lib
import { z } from "zod";
import {
  getRelatedConcepts,
  checkPrerequisites,
  getLearningPath,
} from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Query knowledge graph tool input schema
 */
const queryGraphInputSchema = z.object({
  action: z
    .enum(["get_related", "check_prerequisites", "get_learning_path"])
    .describe(
      "The type of graph query to perform: " +
        "'get_related' finds concepts connected to a topic, " +
        "'check_prerequisites' checks if user knows prerequisites for a concept, " +
        "'get_learning_path' suggests optimal order to learn concepts"
    ),
  conceptId: z
    .string()
    .optional()
    .describe(
      "The concept ID to query (required for get_related and check_prerequisites)"
    ),
  conceptLabel: z
    .string()
    .optional()
    .describe(
      "The concept label/name to search for if conceptId is not known"
    ),
  relationTypes: z
    .array(
      z.enum([
        "prerequisite",
        "corequisite",
        "application",
        "example",
        "opposite",
        "related",
      ])
    )
    .optional()
    .describe("Filter by specific relationship types"),
  maxDepth: z
    .number()
    .min(1)
    .max(3)
    .optional()
    .default(2)
    .describe("Maximum depth to traverse in the graph (1-3)"),
  maxResults: z
    .number()
    .min(1)
    .max(20)
    .optional()
    .default(10)
    .describe("Maximum number of results to return"),
});

type QueryGraphInput = z.output<typeof queryGraphInputSchema>;

/**
 * Query knowledge graph tool output
 */
export interface QueryGraphOutput {
  success: boolean;
  action: string;
  results:
    | RelatedConceptsResult
    | PrerequisiteCheckResult
    | LearningPathResult
    | null;
  message: string;
}

interface RelatedConceptsResult {
  type: "related_concepts";
  sourceConcept: string;
  relatedConcepts: Array<{
    conceptId: string;
    conceptLabel: string;
    relation: string;
    mastery?: number;
    depth: number;
  }>;
  totalFound: number;
}

interface PrerequisiteCheckResult {
  type: "prerequisite_check";
  targetConcept: string;
  allPrerequisitesMet: boolean;
  prerequisites: Array<{
    conceptId: string;
    conceptLabel: string;
    mastery: number;
    isWeak: boolean;
    recommendation?: string;
  }>;
  weakPrerequisites: string[];
}

interface LearningPathResult {
  type: "learning_path";
  suggestions: Array<{
    conceptId: string;
    conceptLabel: string;
    currentMastery: number;
    reason: string;
    priority: number;
  }>;
}

/**
 * Query Knowledge Graph Tool
 *
 * Allows the agent to explore the user's knowledge graph to:
 * - Find related concepts for deeper learning
 * - Check if prerequisites are met before teaching something new
 * - Suggest optimal learning paths
 */
export const queryGraphTool: ToolDefinition<QueryGraphInput, QueryGraphOutput> =
  {
    name: "query_knowledge_graph",
    description:
      "Query the user's knowledge graph to explore concept relationships. Use this to:\n" +
      "- Find related concepts when user wants to explore a topic deeper\n" +
      "- Check prerequisites before teaching advanced topics\n" +
      "- Suggest a learning path for optimal knowledge building\n\n" +
      "This helps provide graph-aware, personalized learning recommendations.",

    inputSchema: queryGraphInputSchema,

    category: ToolCategory.DATA_RETRIEVAL,
    requiresApproval: false,
    timeout: 10000, // 10 seconds
    cost: 3, // Medium cost
    cacheable: true,
    cacheTTL: 300, // 5 minutes cache

    async execute(
      input: QueryGraphInput,
      context: ToolExecutionContext
    ): Promise<QueryGraphOutput> {
      const startTime = Date.now();

      try {
        logger.info("Querying knowledge graph", {
          userId: context.userId,
          action: input.action,
          conceptId: input.conceptId,
        });

        switch (input.action) {
          case "get_related": {
            if (!input.conceptId && !input.conceptLabel) {
              return {
                success: false,
                action: input.action,
                results: null,
                message:
                  "Either conceptId or conceptLabel is required for get_related action",
              };
            }

            const conceptId = input.conceptId || input.conceptLabel || "";
            const related = await getRelatedConcepts(
              context.userId,
              conceptId,
              input.maxDepth,
              input.relationTypes as LearningRelationType[] | undefined
            );

            const limitedResults = related.slice(0, input.maxResults);

            logger.info("Related concepts found", {
              userId: context.userId,
              conceptId,
              totalFound: related.length,
              returned: limitedResults.length,
              executionTime: Date.now() - startTime,
            });

            return {
              success: true,
              action: input.action,
              results: {
                type: "related_concepts",
                sourceConcept: conceptId,
                relatedConcepts: limitedResults,
                totalFound: related.length,
              },
              message: `Found ${limitedResults.length} related concepts`,
            };
          }

          case "check_prerequisites": {
            if (!input.conceptId && !input.conceptLabel) {
              return {
                success: false,
                action: input.action,
                results: null,
                message:
                  "Either conceptId or conceptLabel is required for check_prerequisites action",
              };
            }

            const conceptId = input.conceptId || input.conceptLabel || "";
            const prereqCheck = await checkPrerequisites(
              context.userId,
              conceptId
            );

            logger.info("Prerequisites checked", {
              userId: context.userId,
              conceptId,
              allMet: prereqCheck.allPrerequisitesMet,
              weakCount: prereqCheck.weakPrerequisites.length,
              executionTime: Date.now() - startTime,
            });

            return {
              success: true,
              action: input.action,
              results: {
                type: "prerequisite_check",
                targetConcept: prereqCheck.conceptLabel,
                allPrerequisitesMet: prereqCheck.allPrerequisitesMet,
                prerequisites: prereqCheck.prerequisites.map((p) => ({
                  conceptId: p.conceptId,
                  conceptLabel: p.conceptLabel,
                  mastery: p.effectiveMastery,
                  isWeak: p.isWeak,
                  recommendation: p.recommendation,
                })),
                weakPrerequisites: prereqCheck.weakPrerequisites,
              },
              message: prereqCheck.allPrerequisitesMet
                ? "All prerequisites are met"
                : `User should review ${prereqCheck.weakPrerequisites.length} prerequisite(s) first`,
            };
          }

          case "get_learning_path": {
            const targetConcept = input.conceptId || input.conceptLabel;
            const suggestions = await getLearningPath(
              context.userId,
              targetConcept,
              input.maxResults
            );

            logger.info("Learning path generated", {
              userId: context.userId,
              targetConcept,
              suggestionsCount: suggestions.length,
              executionTime: Date.now() - startTime,
            });

            return {
              success: true,
              action: input.action,
              results: {
                type: "learning_path",
                suggestions,
              },
              message:
                suggestions.length > 0
                  ? `Generated ${suggestions.length} learning suggestions`
                  : "No learning suggestions available - user may have good coverage",
            };
          }

          default:
            return {
              success: false,
              action: input.action,
              results: null,
              message: `Unknown action: ${input.action}`,
            };
        }
      } catch (error) {
        logger.error("Failed to query knowledge graph", {
          error: error instanceof Error ? error.message : "Unknown error",
          userId: context.userId,
          action: input.action,
        });

        return {
          success: false,
          action: input.action,
          results: null,
          message: `Query failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        };
      }
    },
  };
