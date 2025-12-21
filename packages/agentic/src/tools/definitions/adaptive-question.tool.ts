// ** Adaptive Question Generation Tool for Echo-Learn
// ** Generates questions optimized for user's current learning state

// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";
import type {
  QuestionDifficulty,
  QuestionType,
  TestQuestion,
} from "@repo/shared";

// ** import lib
import { z } from "zod";
import {
  getWeakestConcepts,
  getConceptsDueForReview,
  getEffectiveMastery,
  checkPrerequisites,
} from "@repo/storage";

// ** import session management
import {
  getActiveTestSession,
  createTestSession,
  addQuestionToSession,
  generateQuestionId,
} from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Adaptive question tool input schema
 */
const adaptiveQuestionInputSchema = z.object({
  topic: z
    .string()
    .optional()
    .describe(
      "Specific topic/concept to generate a question about. If not provided, auto-selects based on user's learning state.",
    ),
  difficulty: z
    .enum(["easy", "medium", "hard", "auto"])
    .optional()
    .default("auto")
    .describe(
      "Question difficulty. Use 'auto' to select based on user's mastery level.",
    ),
  questionType: z
    .enum(["definition", "application", "comparison", "analysis"])
    .optional()
    .describe(
      "Type of question to generate. If not provided, selects appropriate type based on difficulty.",
    ),
  avoidConceptIds: z
    .array(z.string())
    .optional()
    .describe("Concept IDs to avoid (e.g., recently asked questions)"),
});

type AdaptiveQuestionInput = z.output<typeof adaptiveQuestionInputSchema>;

/**
 * Question selection candidate
 */
interface QuestionCandidate {
  conceptId: string;
  conceptLabel: string;
  mastery: number;
  effectiveMastery: number;
  isDueForReview: boolean;
  priority: number;
  reason: string;
}

/**
 * Adaptive question tool output
 */
export interface AdaptiveQuestionOutput {
  success: boolean;
  question: GeneratedQuestion | null;
  selectionReason: string;
  alternativeConcepts?: string[];
  message: string;
}

/**
 * Generated question structure
 */
export interface GeneratedQuestion {
  conceptId: string;
  conceptLabel: string;
  difficulty: QuestionDifficulty;
  questionType: QuestionType;
  question: string;
  expectedAnswer: string;
  hints: string[];
  context: string;
}

/**
 * Determine difficulty based on mastery score
 */
function determineDifficulty(mastery: number): QuestionDifficulty {
  if (mastery < 0.3) {
    return "easy";
  } else if (mastery < 0.6) {
    return "medium";
  } else {
    return "hard";
  }
}

/**
 * Determine question type based on difficulty
 */
function determineQuestionType(
  difficulty: QuestionDifficulty,
  requestedType?: QuestionType,
): QuestionType {
  if (requestedType) return requestedType;

  switch (difficulty) {
    case "easy":
      // Easy: definition or recognition
      return Math.random() > 0.5 ? "definition" : "application";
    case "medium":
      // Medium: application or comparison
      return Math.random() > 0.5 ? "application" : "comparison";
    case "hard":
      // Hard: analysis or comparison
      return Math.random() > 0.5 ? "analysis" : "comparison";
    default:
      return "definition";
  }
}

/**
 * Calculate priority score for a concept
 * Higher priority = should be asked first
 */
function calculatePriority(
  mastery: number,
  isDueForReview: boolean,
  daysSinceInteraction: number,
): number {
  // Base priority: inverse of mastery (weaker = higher priority)
  let priority = 1 - mastery;

  // Boost for due reviews
  if (isDueForReview) {
    priority += 0.3;
  }

  // Boost for concepts not seen recently (but cap it)
  const recencyBoost = Math.min(0.2, daysSinceInteraction * 0.02);
  priority += recencyBoost;

  // Normalize to 0-1 range
  return Math.min(1, Math.max(0, priority));
}

/**
 * Select the best concept for questioning
 */
async function selectConcept(
  userId: string,
  requestedTopic?: string,
  avoidConceptIds: string[] = [],
): Promise<QuestionCandidate | null> {
  const candidates: QuestionCandidate[] = [];

  // If specific topic requested, try to use it
  if (requestedTopic) {
    const mastery = await getEffectiveMastery(userId, requestedTopic);
    if (mastery) {
      return {
        conceptId: mastery.conceptId,
        conceptLabel: mastery.conceptLabel,
        mastery: mastery.masteryScore,
        effectiveMastery: mastery.effectiveMastery,
        isDueForReview: mastery.isDueForReview,
        priority: 1.0,
        reason: "User requested topic",
      };
    }
  }

  // Get concepts due for review (highest priority)
  const dueForReview = await getConceptsDueForReview(userId, 5);
  for (const concept of dueForReview) {
    if (avoidConceptIds.includes(concept.conceptId)) continue;

    candidates.push({
      conceptId: concept.conceptId,
      conceptLabel: concept.conceptLabel,
      mastery: concept.masteryScore,
      effectiveMastery: concept.effectiveMastery,
      isDueForReview: true,
      priority: calculatePriority(
        concept.effectiveMastery,
        true,
        concept.daysSinceInteraction,
      ),
      reason: "Due for spaced repetition review",
    });
  }

  // Get weakest concepts
  const weakest = await getWeakestConcepts(userId, 5);
  for (const concept of weakest) {
    if (avoidConceptIds.includes(concept.conceptId)) continue;
    // Avoid duplicates
    if (candidates.some((c) => c.conceptId === concept.conceptId)) continue;

    candidates.push({
      conceptId: concept.conceptId,
      conceptLabel: concept.conceptLabel,
      mastery: concept.masteryScore,
      effectiveMastery: concept.effectiveMastery,
      isDueForReview: concept.isDueForReview,
      priority: calculatePriority(
        concept.effectiveMastery,
        concept.isDueForReview,
        concept.daysSinceInteraction,
      ),
      reason: "Weak mastery - needs reinforcement",
    });
  }

  if (candidates.length === 0) {
    return null;
  }

  // Sort by priority (highest first)
  candidates.sort((a, b) => b.priority - a.priority);

  return candidates[0] ?? null;
}

/**
 * Generate question prompts based on type
 */
function getQuestionPrompt(
  conceptLabel: string,
  questionType: QuestionType,
  difficulty: QuestionDifficulty,
): { questionTemplate: string; hintTemplate: string } {
  const templates: Record<
    QuestionType,
    Record<QuestionDifficulty, { question: string; hint: string }>
  > = {
    definition: {
      easy: {
        question: `What is ${conceptLabel}?`,
        hint: `Think about the basic meaning or purpose of ${conceptLabel}.`,
      },
      medium: {
        question: `Explain ${conceptLabel} in your own words.`,
        hint: `Consider the key characteristics and how it's used.`,
      },
      hard: {
        question: `Define ${conceptLabel} and explain its significance in context.`,
        hint: `Think about why this concept matters and how it connects to other ideas.`,
      },
    },
    application: {
      easy: {
        question: `Give a simple example of ${conceptLabel}.`,
        hint: `Think of a basic scenario where ${conceptLabel} would be used.`,
      },
      medium: {
        question: `How would you apply ${conceptLabel} in a practical situation?`,
        hint: `Consider real-world scenarios or problems that ${conceptLabel} helps solve.`,
      },
      hard: {
        question: `Describe a complex scenario where ${conceptLabel} would be critical and explain why.`,
        hint: `Think about edge cases or challenging situations.`,
      },
    },
    comparison: {
      easy: {
        question: `What is ${conceptLabel} similar to?`,
        hint: `Think of related concepts or analogies.`,
      },
      medium: {
        question: `Compare and contrast ${conceptLabel} with a related concept.`,
        hint: `Consider both similarities and differences.`,
      },
      hard: {
        question: `Analyze the relationship between ${conceptLabel} and its related concepts. What are the trade-offs?`,
        hint: `Think about when you would choose one approach over another.`,
      },
    },
    analysis: {
      easy: {
        question: `Why is ${conceptLabel} important?`,
        hint: `Think about the benefits or problems it solves.`,
      },
      medium: {
        question: `What are the key components or aspects of ${conceptLabel}?`,
        hint: `Break it down into its main parts.`,
      },
      hard: {
        question: `Critically analyze ${conceptLabel}. What are its strengths, limitations, and alternatives?`,
        hint: `Consider multiple perspectives and potential drawbacks.`,
      },
    },
  };

  const template = templates[questionType][difficulty];
  return {
    questionTemplate: template.question,
    hintTemplate: template.hint,
  };
}

/**
 * Adaptive Question Generation Tool
 *
 * Generates questions optimized for the user's current learning state.
 * Uses mastery scores, spaced repetition, and difficulty adjustment.
 */
export const adaptiveQuestionTool: ToolDefinition<
  AdaptiveQuestionInput,
  AdaptiveQuestionOutput
> = {
  name: "generate_adaptive_question",
  description:
    "Generate a question optimized for the user's current learning state. " +
    "Automatically selects concepts that need review or reinforcement. " +
    "Adjusts difficulty based on mastery level. " +
    "Use this when testing user knowledge or during quiz/test sessions.",

  inputSchema: adaptiveQuestionInputSchema,

  category: ToolCategory.DATA_RETRIEVAL,
  requiresApproval: false,
  timeout: 15000, // 15 seconds
  cost: 5, // Higher cost due to multiple queries
  cacheable: false, // Questions should be fresh
  cacheTTL: 0,

  async execute(
    input: AdaptiveQuestionInput,
    context: ToolExecutionContext,
  ): Promise<AdaptiveQuestionOutput> {
    const startTime = Date.now();

    try {
      logger.info("Generating adaptive question", {
        userId: context.userId,
        requestedTopic: input.topic,
        requestedDifficulty: input.difficulty,
      });

      // Ensure there's an active test session (create one if needed)
      let session = await getActiveTestSession(context.userId);
      if (!session) {
        logger.info("No active test session, creating one", {
          userId: context.userId,
        });
        session = await createTestSession({
          userId: context.userId,
          targetQuestionCount: 10,
          difficulty: "adaptive",
        });
      }

      // Select the best concept to ask about
      const selectedConcept = await selectConcept(
        context.userId,
        input.topic,
        input.avoidConceptIds,
      );

      if (!selectedConcept) {
        return {
          success: false,
          question: null,
          selectionReason: "No suitable concepts found for questioning",
          message:
            "Unable to generate a question. The user may not have any concepts in their knowledge graph, or all concepts have been recently covered.",
        };
      }

      // Check prerequisites
      const prereqCheck = await checkPrerequisites(
        context.userId,
        selectedConcept.conceptId,
      );

      // If prerequisites aren't met, consider asking about them instead
      if (
        !prereqCheck.allPrerequisitesMet &&
        prereqCheck.weakPrerequisites.length > 0
      ) {
        logger.info("Weak prerequisites found, may want to review first", {
          userId: context.userId,
          conceptId: selectedConcept.conceptId,
          weakPrerequisites: prereqCheck.weakPrerequisites,
        });
      }

      // Determine difficulty
      const difficulty: QuestionDifficulty =
        input.difficulty === "auto"
          ? determineDifficulty(selectedConcept.effectiveMastery)
          : input.difficulty;

      // Determine question type
      const questionType = determineQuestionType(
        difficulty,
        input.questionType,
      );

      // Generate question
      const { questionTemplate, hintTemplate } = getQuestionPrompt(
        selectedConcept.conceptLabel,
        questionType,
        difficulty,
      );

      const question: GeneratedQuestion = {
        conceptId: selectedConcept.conceptId,
        conceptLabel: selectedConcept.conceptLabel,
        difficulty,
        questionType,
        question: questionTemplate,
        expectedAnswer: `A complete answer should demonstrate understanding of ${selectedConcept.conceptLabel}.`,
        hints: [hintTemplate],
        context: selectedConcept.reason,
      };

      // Add question to the test session so it persists for answer evaluation
      const testQuestion = {
        questionId: generateQuestionId(),
        conceptId: selectedConcept.conceptId,
        conceptLabel: selectedConcept.conceptLabel,
        difficulty,
        questionType,
        question: questionTemplate,
        expectedAnswer: question.expectedAnswer,
        hints: [hintTemplate],
        createdAt: new Date().toISOString(),
      };

      await addQuestionToSession(context.userId, testQuestion);

      logger.info("Question added to test session", {
        userId: context.userId,
        questionId: testQuestion.questionId,
        sessionId: session.sessionId,
      });

      // Get alternative concepts for variety
      const alternatives = await getWeakestConcepts(context.userId, 3);
      const alternativeConcepts = alternatives
        .filter((c) => c.conceptId !== selectedConcept.conceptId)
        .map((c) => c.conceptLabel);

      logger.info("Adaptive question generated", {
        userId: context.userId,
        conceptId: selectedConcept.conceptId,
        difficulty,
        questionType,
        priority: selectedConcept.priority,
        executionTime: Date.now() - startTime,
      });

      return {
        success: true,
        question,
        selectionReason: selectedConcept.reason,
        alternativeConcepts,
        message: `Generated ${difficulty} ${questionType} question about "${selectedConcept.conceptLabel}"`,
      };
    } catch (error) {
      logger.error("Failed to generate adaptive question", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: context.userId,
      });

      return {
        success: false,
        question: null,
        selectionReason: "Error during question generation",
        message: `Failed to generate question: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
};
