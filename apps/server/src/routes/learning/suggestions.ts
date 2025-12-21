// ** Dynamic Learning Suggestions API for Echo-Learn
// ** Generates context-aware suggestions based on user's knowledge graph, mastery, and LLM

// ** import types
import type { Context } from "hono";
import type { ChatMode } from "@repo/shared";

// ** import lib
import { Hono } from "hono";

// ** import storage
import {
  getKnowledgeGraph,
  getWeakestConcepts,
  getStrongestConcepts,
  getConceptsDueForReview,
  getAllMastery,
} from "@repo/storage";

// ** import agentic - smart follow-up generator
import {
  generateSmartFollowUps,
  generateSmartInitialSuggestions,
} from "@repo/agentic";

// ** import utils
import { logger } from "@repo/logs";

const suggestionsRoute = new Hono();

/**
 * Suggestion types for different learning contexts
 */
type SuggestionType =
  | "explore"
  | "review"
  | "deepen"
  | "connect"
  | "quiz"
  | "chat"
  | "test";

interface Suggestion {
  text: string;
  title: string;
  conceptId?: string;
  type: SuggestionType;
  priority: number;
}

/**
 * Templates for generating natural language suggestions
 */
const SUGGESTION_TEMPLATES: Record<SuggestionType, string[]> = {
  explore: [
    "What is {concept}?",
    "Explain {concept}",
    "Tell me about {concept}",
  ],
  review: ["Review {concept}", "Help me practice {concept}"],
  deepen: ["More about {concept}", "Examples of {concept}"],
  connect: ["How does {concept} connect?", "Related to {concept}"],
  quiz: ["Quiz: {concept}", "Test: {concept}"],
  chat: ["About {concept}", "Discuss {concept}"],
  test: [
    "Ask me about {concept}",
    "Question me on {concept}",
    "Test me on {concept}",
  ],
};

/**
 * Mode-specific generic suggestions when no knowledge graph exists
 */
const MODE_GENERIC_SUGGESTIONS: Record<
  ChatMode,
  Array<{ title: string; text: string }>
> = {
  learn: [
    { title: "Get started", text: "How do I start learning?" },
    { title: "Study tips", text: "Best study techniques?" },
    { title: "Learning plan", text: "Create a learning plan" },
    { title: "Upload help", text: "How to upload materials?" },
  ],
  chat: [
    { title: "Ask anything", text: "What can you help with?" },
    { title: "Explore", text: "Tell me something interesting" },
    { title: "Get help", text: "I need help" },
    { title: "Topics", text: "What can we discuss?" },
  ],
  test: [
    { title: "Quick quiz", text: "Ask me a question" },
    { title: "Challenge me", text: "Give me a hard question" },
    { title: "Random topic", text: "Quiz me on anything" },
    { title: "Mixed quiz", text: "Ask me various questions" },
  ],
};

/**
 * Get a random template for a suggestion type
 */
function getTemplate(type: SuggestionType): string {
  const templates = SUGGESTION_TEMPLATES[type];
  return (
    templates[Math.floor(Math.random() * templates.length)] ?? templates[0]!
  );
}

/**
 * Create a suggestion from a concept
 */
function createSuggestion(
  conceptLabel: string,
  conceptId: string,
  type: SuggestionType,
  priority: number,
): Suggestion {
  const template = getTemplate(type);
  const text = template.replace("{concept}", conceptLabel);

  // Concise title (2-4 words max) for UI display
  // Truncate concept label if too long
  const shortLabel =
    conceptLabel.length > 20 ? conceptLabel.slice(0, 18) + "…" : conceptLabel;

  let title = shortLabel;
  if (type === "explore") {
    title = `Learn ${shortLabel}`;
  } else if (type === "review" || type === "quiz") {
    title = `Review ${shortLabel}`;
  } else if (type === "deepen") {
    title = `Deep dive`;
  } else if (type === "connect") {
    title = `Connections`;
  } else if (type === "test") {
    title = `Quiz: ${shortLabel}`;
  } else if (type === "chat") {
    title = `About ${shortLabel}`;
  }

  return {
    text,
    title,
    conceptId,
    type,
    priority,
  };
}

/**
 * GET /learning/suggestions/initial
 * Returns initial suggestions for the welcome screen based on user's learning state and mode
 * Uses smart LLM-powered generator for personalized suggestions
 * These replace the hardcoded suggestions in ThreadSuggestions component
 */
suggestionsRoute.get("/initial", async (c: Context) => {
  const userId = c.req.query("userId");
  const mode = (c.req.query("mode") || "learn") as ChatMode;
  const limit = parseInt(c.req.query("limit") || "4", 10);
  const useSmart = c.req.query("smart") !== "false"; // Default to smart mode

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const startTime = Date.now();

    // Try smart LLM-powered suggestions first
    if (useSmart) {
      try {
        const smartResult = await generateSmartInitialSuggestions(
          userId,
          mode,
          { maxSuggestions: limit },
        );

        if (smartResult.suggestions.length > 0) {
          logger.info("Smart initial suggestions generated", {
            userId,
            mode,
            suggestionsCount: smartResult.suggestions.length,
            processingTimeMs: smartResult.processingTimeMs,
          });

          return c.json({
            suggestions: smartResult.suggestions.map((s) => ({
              text: s.text,
              title: s.title || s.text.split(" ").slice(0, 3).join(" ") + "…",
              conceptId: s.conceptId,
              type: s.type,
            })),
            hasContent: true,
            smart: true,
            conceptsDiscussed: smartResult.conceptsDiscussed,
            processingTimeMs: smartResult.processingTimeMs,
          });
        }
      } catch (smartError) {
        logger.warn("Smart suggestions failed, falling back to rule-based", {
          userId,
          error: smartError instanceof Error ? smartError.message : "Unknown",
        });
      }
    }

    // Fallback to rule-based suggestions
    const suggestions: Suggestion[] = [];

    // Get user's knowledge graph and mastery data in parallel
    const [graph, dueForReview, weakConcepts, strongConcepts] =
      await Promise.all([
        getKnowledgeGraph(userId),
        getConceptsDueForReview(userId, 3),
        getWeakestConcepts(userId, 3),
        getStrongestConcepts(userId, 2),
      ]);

    // Mode-specific suggestion generation
    if (mode === "learn") {
      // Priority 1: Concepts due for review (highest priority)
      for (const concept of dueForReview) {
        if (suggestions.length >= limit) break;

        suggestions.push(
          createSuggestion(
            concept.conceptLabel,
            concept.conceptId,
            "review",
            0.95 - suggestions.length * 0.05,
          ),
        );
      }

      // Priority 2: Weak concepts that need more practice
      for (const concept of weakConcepts) {
        if (suggestions.length >= limit) break;
        if (suggestions.some((s) => s.conceptId === concept.conceptId))
          continue;

        suggestions.push(
          createSuggestion(
            concept.conceptLabel,
            concept.conceptId,
            "explore",
            0.85 - suggestions.length * 0.05,
          ),
        );
      }

      // Priority 3: Strong concepts to deepen
      for (const concept of strongConcepts) {
        if (suggestions.length >= limit) break;
        if (suggestions.some((s) => s.conceptId === concept.conceptId))
          continue;

        suggestions.push(
          createSuggestion(
            concept.conceptLabel,
            concept.conceptId,
            "deepen",
            0.7 - suggestions.length * 0.05,
          ),
        );
      }
    } else if (mode === "test") {
      // Test mode: prioritize concepts for quizzing
      // Priority 1: Concepts with medium mastery (good for testing)
      const allMastery = await getAllMastery(userId);
      const testableConcepts = allMastery
        .filter((m) => m.effectiveMastery > 0.3 && m.effectiveMastery < 0.9)
        .sort((a, b) => b.effectiveMastery - a.effectiveMastery);

      for (const concept of testableConcepts) {
        if (suggestions.length >= limit) break;

        suggestions.push(
          createSuggestion(
            concept.conceptLabel,
            concept.conceptId,
            "test",
            0.9 - suggestions.length * 0.05,
          ),
        );
      }

      // Priority 2: Concepts due for review (quiz them)
      for (const concept of dueForReview) {
        if (suggestions.length >= limit) break;
        if (suggestions.some((s) => s.conceptId === concept.conceptId))
          continue;

        suggestions.push(
          createSuggestion(
            concept.conceptLabel,
            concept.conceptId,
            "quiz",
            0.8 - suggestions.length * 0.05,
          ),
        );
      }
    } else if (mode === "chat") {
      // Chat mode: suggest interesting topics from graph
      // Mix of strong and weak concepts for casual exploration
      const shuffledNodes = [...graph.nodes]
        .filter((n) => n.type === "concept")
        .sort(() => Math.random() - 0.5);

      for (const node of shuffledNodes) {
        if (suggestions.length >= limit) break;

        suggestions.push(
          createSuggestion(
            node.label,
            node.id,
            "chat",
            0.8 - suggestions.length * 0.05,
          ),
        );
      }
    }

    // Fill remaining slots with unexplored concepts from graph (all modes)
    if (suggestions.length < limit && graph.nodes.length > 0) {
      const allMastery = await getAllMastery(userId);
      const masteredIds = new Set(allMastery.map((m) => m.conceptId));

      const unexplored = graph.nodes.filter(
        (node) => !masteredIds.has(node.id) && node.type === "concept",
      );

      const shuffled = unexplored.sort(() => Math.random() - 0.5);

      for (const node of shuffled) {
        if (suggestions.length >= limit) break;
        if (suggestions.some((s) => s.conceptId === node.id)) continue;

        const suggestionType =
          mode === "test" ? "test" : mode === "chat" ? "chat" : "explore";
        suggestions.push(
          createSuggestion(
            node.label,
            node.id,
            suggestionType,
            0.5 - suggestions.length * 0.05,
          ),
        );
      }
    }

    // If still no suggestions (new user with empty graph), provide mode-specific generic ones
    if (suggestions.length === 0) {
      const genericSuggestions = MODE_GENERIC_SUGGESTIONS[mode];
      return c.json({
        suggestions: genericSuggestions.slice(0, limit).map((s, index) => ({
          text: s.text,
          title: s.title,
          conceptId: undefined,
          type: mode === "test" ? "test" : mode === "chat" ? "chat" : "explore",
        })),
        hasContent: false,
        message:
          mode === "learn"
            ? "Upload study materials to get personalized suggestions"
            : undefined,
        processingTimeMs: Date.now() - startTime,
      });
    }

    // Sort by priority and limit
    suggestions.sort((a, b) => b.priority - a.priority);
    const finalSuggestions = suggestions.slice(0, limit);

    logger.info("Initial suggestions generated", {
      userId,
      mode,
      suggestionsCount: finalSuggestions.length,
      hasGraph: graph.nodes.length > 0,
      processingTimeMs: Date.now() - startTime,
    });

    return c.json({
      suggestions: finalSuggestions.map((s) => ({
        text: s.text,
        title: s.title,
        conceptId: s.conceptId,
        type: s.type,
      })),
      hasContent: true,
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("Failed to generate initial suggestions", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to generate suggestions" }, 500);
  }
});

/**
 * GET /learning/suggestions/followup
 * Returns follow-up suggestions based on current conversation context and mode
 * Uses smart LLM-powered generator with RAG for contextual suggestions
 * Called after each assistant response to suggest next questions
 */
suggestionsRoute.get("/followup", async (c: Context) => {
  const userId = c.req.query("userId");
  const mode = (c.req.query("mode") || "learn") as ChatMode;
  const conceptIds =
    c.req.query("conceptIds")?.split(",").filter(Boolean) || [];
  const assistantResponse = c.req.query("response") || "";
  const userMessage = c.req.query("message") || "";
  const limit = parseInt(c.req.query("limit") || "4", 10);
  const useSmart = c.req.query("smart") !== "false"; // Default to smart mode

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const startTime = Date.now();

    // Try smart LLM-powered suggestions if we have the response content
    if (useSmart && assistantResponse) {
      try {
        const smartResult = await generateSmartFollowUps(
          userId,
          assistantResponse,
          userMessage,
          mode,
          {
            maxSuggestions: limit,
            ragTopK: 10,
            ragMinScore: 0.3,
            includeQuiz: mode === "test" || mode === "learn",
          },
        );

        if (smartResult.suggestions.length > 0) {
          logger.info("Smart follow-up suggestions generated", {
            userId,
            mode,
            suggestionsCount: smartResult.suggestions.length,
            relatedChunksUsed: smartResult.relatedChunksUsed,
            processingTimeMs: smartResult.processingTimeMs,
          });

          return c.json({
            suggestions: smartResult.suggestions.map((s) => ({
              text: s.text,
              title: s.title || s.text.split(" ").slice(0, 3).join(" ") + "…",
              conceptId: s.conceptId,
              type: s.type,
            })),
            smart: true,
            conceptsDiscussed: smartResult.conceptsDiscussed,
            relatedChunksUsed: smartResult.relatedChunksUsed,
            processingTimeMs: smartResult.processingTimeMs,
          });
        }
      } catch (smartError) {
        logger.warn("Smart follow-up failed, falling back to rule-based", {
          userId,
          error: smartError instanceof Error ? smartError.message : "Unknown",
        });
      }
    }

    // Fallback to rule-based suggestions
    const suggestions: Suggestion[] = [];

    // Get knowledge graph for relationship traversal
    const graph = await getKnowledgeGraph(userId);

    // If we have concept IDs from the conversation, find related concepts
    if (conceptIds.length > 0 && graph.edges.length > 0) {
      const relatedConceptIds = new Set<string>();

      // Find concepts connected to discussed concepts
      for (const conceptId of conceptIds) {
        for (const edge of graph.edges) {
          if (edge.source === conceptId) {
            relatedConceptIds.add(edge.target);
          } else if (edge.target === conceptId) {
            relatedConceptIds.add(edge.source);
          }
        }
      }

      // Remove already discussed concepts
      for (const id of conceptIds) {
        relatedConceptIds.delete(id);
      }

      // Get mastery data for related concepts
      const allMastery = await getAllMastery(userId);
      const masteryMap = new Map(allMastery.map((m) => [m.conceptId, m]));

      // Score and sort related concepts
      const relatedWithScores = Array.from(relatedConceptIds).map((id) => {
        const node = graph.nodes.find((n) => n.id === id);
        const mastery = masteryMap.get(id);

        // Priority: low mastery = higher priority
        const masteryScore = mastery?.effectiveMastery ?? 0;
        const priority = 1 - masteryScore;

        return {
          id,
          label: node?.label || id,
          priority,
          mastery: masteryScore,
        };
      });

      relatedWithScores.sort((a, b) => b.priority - a.priority);

      // Add related concept suggestions based on mode
      for (const related of relatedWithScores.slice(0, limit - 1)) {
        let type: SuggestionType;
        if (mode === "test") {
          type = "test";
        } else if (mode === "chat") {
          type = "chat";
        } else {
          type = related.mastery < 0.3 ? "explore" : "deepen";
        }
        suggestions.push(
          createSuggestion(related.label, related.id, type, related.priority),
        );
      }
    }

    // Add mode-specific option for discussed concepts
    if (conceptIds.length > 0) {
      const primaryConceptId = conceptIds[0];
      const primaryNode = graph.nodes.find((n) => n.id === primaryConceptId);

      if (primaryNode) {
        const type: SuggestionType =
          mode === "test" ? "quiz" : mode === "chat" ? "deepen" : "quiz";
        suggestions.push(
          createSuggestion(primaryNode.label, primaryConceptId!, type, 0.6),
        );
      }
    }

    // Fill remaining slots based on mode
    if (suggestions.length < limit) {
      const [dueForReview, weakConcepts] = await Promise.all([
        getConceptsDueForReview(userId, 2),
        getWeakestConcepts(userId, 2),
      ]);

      const existingIds = new Set([
        ...suggestions.map((s) => s.conceptId),
        ...conceptIds,
      ]);

      if (mode === "test") {
        // Test mode: suggest more quizzes
        for (const concept of dueForReview) {
          if (suggestions.length >= limit) break;
          if (existingIds.has(concept.conceptId)) continue;

          suggestions.push(
            createSuggestion(
              concept.conceptLabel,
              concept.conceptId,
              "test",
              0.5,
            ),
          );
          existingIds.add(concept.conceptId);
        }
      } else if (mode === "chat") {
        // Chat mode: suggest interesting topics
        const shuffledNodes = graph.nodes
          .filter((n) => n.type === "concept" && !existingIds.has(n.id))
          .sort(() => Math.random() - 0.5);

        for (const node of shuffledNodes) {
          if (suggestions.length >= limit) break;

          suggestions.push(createSuggestion(node.label, node.id, "chat", 0.5));
          existingIds.add(node.id);
        }
      } else {
        // Learn mode: prioritize reviews and weak concepts
        for (const concept of dueForReview) {
          if (suggestions.length >= limit) break;
          if (existingIds.has(concept.conceptId)) continue;

          suggestions.push(
            createSuggestion(
              concept.conceptLabel,
              concept.conceptId,
              "review",
              0.5,
            ),
          );
          existingIds.add(concept.conceptId);
        }

        for (const concept of weakConcepts) {
          if (suggestions.length >= limit) break;
          if (existingIds.has(concept.conceptId)) continue;

          suggestions.push(
            createSuggestion(
              concept.conceptLabel,
              concept.conceptId,
              "explore",
              0.4,
            ),
          );
        }
      }
    }

    // If still empty, provide generic suggestions
    if (suggestions.length === 0) {
      const genericSuggestions = MODE_GENERIC_SUGGESTIONS[mode];
      return c.json({
        suggestions: genericSuggestions.slice(0, limit).map((s) => ({
          text: s.text,
          title: s.title,
          conceptId: undefined,
          type: mode === "test" ? "test" : mode === "chat" ? "chat" : "explore",
        })),
        processingTimeMs: Date.now() - startTime,
      });
    }

    // Sort and limit
    suggestions.sort((a, b) => b.priority - a.priority);
    const finalSuggestions = suggestions.slice(0, limit);

    logger.info("Follow-up suggestions generated", {
      userId,
      mode,
      discussedConcepts: conceptIds.length,
      suggestionsCount: finalSuggestions.length,
      processingTimeMs: Date.now() - startTime,
    });

    return c.json({
      suggestions: finalSuggestions.map((s) => ({
        text: s.text,
        title: s.title,
        conceptId: s.conceptId,
        type: s.type,
      })),
      processingTimeMs: Date.now() - startTime,
    });
  } catch (error) {
    logger.error("Failed to generate follow-up suggestions", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to generate suggestions" }, 500);
  }
});

/**
 * GET /learning/suggestions/topics
 * Returns available topics from the knowledge graph for browsing
 */
suggestionsRoute.get("/topics", async (c: Context) => {
  const userId = c.req.query("userId");
  const type = c.req.query("type") || "all"; // all, concept, process, term
  const limit = parseInt(c.req.query("limit") || "20", 10);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const graph = await getKnowledgeGraph(userId);
    const allMastery = await getAllMastery(userId);
    const masteryMap = new Map(allMastery.map((m) => [m.conceptId, m]));

    // Filter by type if specified
    let nodes = graph.nodes;
    if (type !== "all") {
      nodes = nodes.filter((n) => n.type === type);
    }

    // Enrich with mastery data
    const enrichedNodes = nodes.map((node) => {
      const mastery = masteryMap.get(node.id);
      return {
        id: node.id,
        label: node.label,
        type: node.type,
        description: node.description,
        mastery: mastery?.effectiveMastery ?? 0,
        isDueForReview: mastery?.isDueForReview ?? false,
      };
    });

    // Sort by mastery (show weak concepts first)
    enrichedNodes.sort((a, b) => a.mastery - b.mastery);

    // Paginate
    const paginated = enrichedNodes.slice(offset, offset + limit);

    return c.json({
      topics: paginated,
      total: enrichedNodes.length,
      offset,
      limit,
    });
  } catch (error) {
    logger.error("Failed to get topics", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to retrieve topics" }, 500);
  }
});

export { suggestionsRoute };
