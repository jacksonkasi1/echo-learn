// ** Follow-Up Suggestion Generator for Echo-Learn
// ** Generates Perplexity-style follow-up suggestions based on conversation context

// ** import types
import type { FollowUpSuggestion, ChatMode } from "@repo/shared";

// ** import storage
import {
  getKnowledgeGraph,
  getEffectiveMastery,
  getWeakestConcepts,
  getConceptsDueForReview,
  getRelatedConcepts,
} from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

// ** import local
import {
  extractConceptsFromGraph,
  type ExtractedConcept,
} from "../analysis/concept-extractor.js";

/**
 * Follow-up generation result
 */
export interface FollowUpGenerationResult {
  suggestions: FollowUpSuggestion[];
  conceptsDiscussed: string[];
  processingTimeMs: number;
}

/**
 * Follow-up generation options
 */
export interface FollowUpGenerationOptions {
  /** Maximum number of suggestions to generate */
  maxSuggestions?: number;
  /** Include quiz suggestions */
  includeQuiz?: boolean;
  /** Include example suggestions */
  includeExamples?: boolean;
  /** Minimum mastery to skip suggesting (already mastered) */
  masteryThreshold?: number;
}

/**
 * Default follow-up options
 */
const DEFAULT_OPTIONS: Required<FollowUpGenerationOptions> = {
  maxSuggestions: 4,
  includeQuiz: true,
  includeExamples: true,
  masteryThreshold: 0.8,
};

/**
 * Suggestion templates for different types
 */
const SUGGESTION_TEMPLATES = {
  explore: [
    "Tell me more about {concept}",
    "What is {concept} and how does it work?",
    "Explain {concept} in more detail",
    "I'd like to learn about {concept}",
  ],
  quiz: [
    "Quiz me on {concept}",
    "Test my understanding of {concept}",
    "Ask me a question about {concept}",
  ],
  example: [
    "Show me a practical example of {concept}",
    "Can you give me an example of {concept}?",
    "How would I use {concept} in practice?",
  ],
  deeper: [
    "What are the advanced aspects of {concept}?",
    "How does {concept} connect to other topics?",
    "What are common misconceptions about {concept}?",
  ],
  related: [
    "How does this relate to {concept}?",
    "What's the connection between this and {concept}?",
    "Tell me about {concept} next",
  ],
};

/**
 * Get a random template for a suggestion type
 */
function getTemplate(
  type: FollowUpSuggestion["type"],
  concept: string,
): string {
  const templates = SUGGESTION_TEMPLATES[type];
  const template =
    templates[Math.floor(Math.random() * templates.length)] ?? templates[0];
  return template
    ? template.replace("{concept}", concept)
    : `Tell me about ${concept}`;
}

/**
 * Generate follow-up suggestions based on response and user's learning state
 *
 * Algorithm:
 * 1. Extract concepts mentioned in the response
 * 2. Find related concepts in the graph
 * 3. Filter by mastery (suggest weak areas)
 * 4. Add variety (quiz, example, deeper)
 * 5. Rank by learning value
 * 6. Return top N suggestions
 */
export async function generateFollowUpSuggestions(
  userId: string,
  assistantResponse: string,
  userMessage: string,
  mode: ChatMode,
  options: FollowUpGenerationOptions = {},
): Promise<FollowUpGenerationResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Only generate follow-ups in learn mode
  if (mode !== "learn") {
    return {
      suggestions: [],
      conceptsDiscussed: [],
      processingTimeMs: Date.now() - startTime,
    };
  }

  try {
    logger.info("Generating follow-up suggestions", {
      userId,
      responseLength: assistantResponse.length,
    });

    // Step 1: Extract concepts from the response
    const extractionResult = await extractConceptsFromGraph(
      assistantResponse,
      userId,
      { maxConcepts: 10 },
    );

    const discussedConcepts = extractionResult.concepts;
    const conceptsDiscussed = discussedConcepts.map((c) => c.conceptLabel);

    if (discussedConcepts.length === 0) {
      // No concepts found, try to suggest from weak/due concepts
      return await generateGenericSuggestions(userId, opts, startTime);
    }

    // Step 2: Generate suggestions for discussed concepts
    const suggestions: FollowUpSuggestion[] = [];

    // Primary concept (most confident match)
    const primaryConcept = discussedConcepts[0]!;

    // Step 3: Add related concepts from graph
    const relatedConcepts = await getRelatedConcepts(
      userId,
      primaryConcept.conceptId,
      2, // max depth
      ["prerequisite", "corequisite", "application", "related"],
    );

    // Step 4: Filter by mastery and add suggestions
    for (const related of relatedConcepts) {
      if (suggestions.length >= opts.maxSuggestions) break;

      // Skip if already mastered
      if (related.mastery && related.mastery > opts.masteryThreshold) continue;

      // Determine suggestion type based on relationship and mastery
      let type: FollowUpSuggestion["type"] = "related";
      let priority = 0.5;

      if (related.relation === "prerequisite" && (related.mastery ?? 0) < 0.5) {
        // Weak prerequisite - high priority
        type = "explore";
        priority = 0.9;
      } else if (related.relation === "application") {
        type = "example";
        priority = 0.7;
      } else if ((related.mastery ?? 0) < 0.3) {
        // Very weak - suggest exploring
        type = "explore";
        priority = 0.8;
      }

      suggestions.push({
        text: getTemplate(type, related.conceptLabel),
        conceptId: related.conceptId,
        type,
        priority,
      });
    }

    // Step 5: Add quiz suggestion for primary concept
    if (opts.includeQuiz && suggestions.length < opts.maxSuggestions) {
      const primaryMastery = await getEffectiveMastery(
        userId,
        primaryConcept.conceptId,
      );

      if (primaryMastery && primaryMastery.effectiveMastery < 0.8) {
        suggestions.push({
          text: getTemplate("quiz", primaryConcept.conceptLabel),
          conceptId: primaryConcept.conceptId,
          type: "quiz",
          priority: 0.75,
        });
      }
    }

    // Step 6: Add deeper dive suggestion
    if (suggestions.length < opts.maxSuggestions) {
      suggestions.push({
        text: getTemplate("deeper", primaryConcept.conceptLabel),
        conceptId: primaryConcept.conceptId,
        type: "deeper",
        priority: 0.6,
      });
    }

    // Step 7: Fill remaining slots with weak/due concepts
    if (suggestions.length < opts.maxSuggestions) {
      const additionalSuggestions = await generateFromWeakConcepts(
        userId,
        opts.maxSuggestions - suggestions.length,
        suggestions.map((s) => s.conceptId).filter(Boolean) as string[],
      );
      suggestions.push(...additionalSuggestions);
    }

    // Sort by priority and limit
    suggestions.sort((a, b) => b.priority - a.priority);
    const finalSuggestions = suggestions.slice(0, opts.maxSuggestions);

    const processingTimeMs = Date.now() - startTime;

    logger.info("Follow-up suggestions generated", {
      userId,
      conceptsDiscussed: conceptsDiscussed.length,
      suggestionsGenerated: finalSuggestions.length,
      processingTimeMs,
    });

    return {
      suggestions: finalSuggestions,
      conceptsDiscussed,
      processingTimeMs,
    };
  } catch (error) {
    logger.error("Failed to generate follow-up suggestions", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      suggestions: [],
      conceptsDiscussed: [],
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Generate generic suggestions when no specific concepts found
 */
async function generateGenericSuggestions(
  userId: string,
  opts: Required<FollowUpGenerationOptions>,
  startTime: number,
): Promise<FollowUpGenerationResult> {
  const suggestions: FollowUpSuggestion[] = [];

  // Get concepts due for review
  const dueForReview = await getConceptsDueForReview(userId, 2);
  for (const concept of dueForReview) {
    if (suggestions.length >= opts.maxSuggestions) break;

    suggestions.push({
      text: `Review ${concept.conceptLabel} - it's due for practice`,
      conceptId: concept.conceptId,
      type: "quiz",
      priority: 0.85,
    });
  }

  // Get weakest concepts
  const weakest = await getWeakestConcepts(userId, 2);
  for (const concept of weakest) {
    if (suggestions.length >= opts.maxSuggestions) break;
    if (suggestions.some((s) => s.conceptId === concept.conceptId)) continue;

    suggestions.push({
      text: getTemplate("explore", concept.conceptLabel),
      conceptId: concept.conceptId,
      type: "explore",
      priority: 0.7,
    });
  }

  return {
    suggestions,
    conceptsDiscussed: [],
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Generate suggestions from weak/due concepts
 */
async function generateFromWeakConcepts(
  userId: string,
  count: number,
  excludeConceptIds: string[],
): Promise<FollowUpSuggestion[]> {
  const suggestions: FollowUpSuggestion[] = [];

  // Get concepts due for review
  const dueForReview = await getConceptsDueForReview(userId, count);
  for (const concept of dueForReview) {
    if (suggestions.length >= count) break;
    if (excludeConceptIds.includes(concept.conceptId)) continue;

    suggestions.push({
      text: getTemplate("quiz", concept.conceptLabel),
      conceptId: concept.conceptId,
      type: "quiz",
      priority: 0.65,
    });
  }

  // Get weakest concepts if more needed
  if (suggestions.length < count) {
    const weakest = await getWeakestConcepts(userId, count);
    for (const concept of weakest) {
      if (suggestions.length >= count) break;
      if (excludeConceptIds.includes(concept.conceptId)) continue;
      if (suggestions.some((s) => s.conceptId === concept.conceptId)) continue;

      suggestions.push({
        text: getTemplate("explore", concept.conceptLabel),
        conceptId: concept.conceptId,
        type: "explore",
        priority: 0.55,
      });
    }
  }

  return suggestions;
}

/**
 * Async wrapper for generating follow-ups (fire and forget)
 * Used when we don't need to wait for results
 */
export function generateFollowUpSuggestionsAsync(
  userId: string,
  assistantResponse: string,
  userMessage: string,
  mode: ChatMode,
  callback?: (result: FollowUpGenerationResult) => void,
): void {
  setImmediate(async () => {
    try {
      const result = await generateFollowUpSuggestions(
        userId,
        assistantResponse,
        userMessage,
        mode,
      );
      if (callback) {
        callback(result);
      }
    } catch (error) {
      logger.warn("Async follow-up generation failed", {
        userId,
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  });
}
