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
  searchConceptsByKeywords,
} from "@repo/storage";

// ** import session management
import {
  getActiveTestSession,
  createTestSession,
  addQuestionToSession,
  generateQuestionId,
} from "@repo/storage";

// ** import RAG for fallback
import { retrieveContext, formatContextForPrompt } from "@repo/rag";

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
      "IMPORTANT: The specific topic/concept the user wants to be quizzed on. " +
        "Extract this from the user's message (e.g., 'Quiz me on Patient Lens AI' → topic='Patient Lens AI'). " +
        "If the user doesn't specify a topic, leave empty to auto-select based on learning state.",
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
  ragContent?: string; // RAG fallback content when knowledge graph is empty
}

/**
 * Adaptive question tool output
 */
export interface AdaptiveQuestionOutput {
  success: boolean;
  question: GeneratedQuestion | null;
  selectionReason: string;
  alternativeConcepts?: string[];
  questionId?: string;
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
 * Now includes RAG fallback when knowledge graph is empty
 */
async function selectConcept(
  userId: string,
  requestedTopic?: string,
  avoidConceptIds: string[] = [],
): Promise<QuestionCandidate | null> {
  const candidates: QuestionCandidate[] = [];

  // If specific topic requested, try to use it
  if (requestedTopic) {
    // First: Try exact match with conceptId/label
    const exactMastery = await getEffectiveMastery(userId, requestedTopic);
    if (exactMastery) {
      // Also fetch RAG content so questions are based on actual materials
      let ragContent: string | undefined;
      try {
        // Use a broader search query to improve results
        const searchQuery = `${exactMastery.conceptLabel} features capabilities how it works`;
        logger.info("Fetching RAG content for exact match concept", {
          userId,
          conceptLabel: exactMastery.conceptLabel,
          searchQuery,
        });
        const ragContext = await retrieveContext(searchQuery, userId, {
          topK: 15,
          minScore: 0.01, // Very low threshold to catch any relevant content
          useContextBudget: true,
        });

        logger.info("RAG search results for exact match", {
          userId,
          conceptLabel: exactMastery.conceptLabel,
          chunksFound: ragContext.chunks.length,
          sourcesFound: ragContext.sources.length,
        });

        if (ragContext.chunks.length > 0) {
          ragContent = formatContextForPrompt(ragContext.chunks, {
            maxLength: 2000,
          });
          logger.info("RAG content formatted for exact match concept", {
            userId,
            conceptLabel: exactMastery.conceptLabel,
            chunksUsed: ragContext.chunks.length,
            contentLength: ragContent.length,
          });
        } else {
          logger.warn("No RAG content found for exact match concept", {
            userId,
            conceptLabel: exactMastery.conceptLabel,
            searchQuery,
          });
        }
      } catch (error) {
        logger.warn("Failed to fetch RAG content for exact match", {
          userId,
          conceptLabel: exactMastery.conceptLabel,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return {
        conceptId: exactMastery.conceptId,
        conceptLabel: exactMastery.conceptLabel,
        mastery: exactMastery.masteryScore,
        effectiveMastery: exactMastery.effectiveMastery,
        isDueForReview: exactMastery.isDueForReview,
        priority: 1.0,
        reason: "User requested topic (exact match)",
        ragContent,
      };
    }

    // Second: Try fuzzy keyword search in knowledge graph
    logger.info(
      "Exact match not found, trying fuzzy search in knowledge graph",
      {
        userId,
        requestedTopic,
      },
    );

    const fuzzyMatches = await searchConceptsByKeywords(
      userId,
      requestedTopic,
      3,
    );
    if (fuzzyMatches.length > 0) {
      const bestMatch = fuzzyMatches[0];
      logger.info("Fuzzy match found in knowledge graph", {
        userId,
        requestedTopic,
        matchedConcept: bestMatch?.conceptLabel,
        totalMatches: fuzzyMatches.length,
      });

      // Also fetch RAG content so questions are based on actual materials
      let ragContent: string | undefined;
      try {
        // Use a broader search query to improve results
        const searchQuery = `${bestMatch!.conceptLabel} features capabilities how it works`;
        logger.info("Fetching RAG content for fuzzy match concept", {
          userId,
          conceptLabel: bestMatch!.conceptLabel,
          searchQuery,
        });
        const ragContext = await retrieveContext(searchQuery, userId, {
          topK: 15,
          minScore: 0.01, // Very low threshold to catch any relevant content
          useContextBudget: true,
        });

        logger.info("RAG search results for fuzzy match", {
          userId,
          conceptLabel: bestMatch!.conceptLabel,
          chunksFound: ragContext.chunks.length,
          sourcesFound: ragContext.sources.length,
        });

        if (ragContext.chunks.length > 0) {
          ragContent = formatContextForPrompt(ragContext.chunks, {
            maxLength: 2000,
          });
          logger.info("RAG content formatted for fuzzy match concept", {
            userId,
            conceptLabel: bestMatch!.conceptLabel,
            chunksUsed: ragContext.chunks.length,
            contentLength: ragContent.length,
          });
        } else {
          logger.warn("No RAG content found for fuzzy match concept", {
            userId,
            conceptLabel: bestMatch!.conceptLabel,
            searchQuery,
          });
        }
      } catch (error) {
        logger.warn("Failed to fetch RAG content for concept", {
          userId,
          conceptLabel: bestMatch!.conceptLabel,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return {
        conceptId: bestMatch!.conceptId,
        conceptLabel: bestMatch!.conceptLabel,
        mastery: bestMatch!.masteryScore,
        effectiveMastery: bestMatch!.effectiveMastery,
        isDueForReview: bestMatch!.isDueForReview,
        priority: 1.0,
        reason: `User requested topic (matched: "${bestMatch!.conceptLabel}")`,
        ragContent,
      };
    }

    // Third: RAG FALLBACK - If topic not in knowledge graph, search vector store
    logger.info("Topic not found in knowledge graph, trying RAG fallback", {
      userId,
      requestedTopic,
    });

    try {
      // Use broader search query and very low threshold to catch any relevant content
      const searchQuery = `${requestedTopic} features capabilities how it works`;
      const ragContext = await retrieveContext(searchQuery, userId, {
        topK: 15,
        minScore: 0.01, // Very low threshold - we want any potentially relevant content
        useContextBudget: true,
      });

      if (ragContext.chunks.length > 0) {
        const formattedContent = formatContextForPrompt(ragContext.chunks, {
          maxLength: 2000,
        });

        logger.info("RAG fallback successful", {
          userId,
          requestedTopic,
          chunksFound: ragContext.chunks.length,
        });

        return {
          conceptId: `rag_${requestedTopic.toLowerCase().replace(/\s+/g, "_")}`,
          conceptLabel: requestedTopic,
          mastery: 0.5, // Default middle mastery for RAG-based concepts
          effectiveMastery: 0.5,
          isDueForReview: false,
          priority: 1.0,
          reason: "Generated from uploaded materials (RAG fallback)",
          ragContent: formattedContent,
        };
      }
    } catch (error) {
      logger.warn("RAG fallback failed", {
        userId,
        requestedTopic,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    // If we reach here, user requested a topic but we couldn't find it
    // Log this important case and return null to trigger a helpful message
    logger.warn("Requested topic not found in knowledge graph or RAG", {
      userId,
      requestedTopic,
      suggestion: "User may need to upload materials about this topic",
    });

    // Return a special candidate that tells the LLM to inform the user
    return {
      conceptId: `requested_${requestedTopic.toLowerCase().replace(/\s+/g, "_")}`,
      conceptLabel: requestedTopic,
      mastery: 0,
      effectiveMastery: 0,
      isDueForReview: false,
      priority: 1.0,
      reason: `TOPIC NOT FOUND: "${requestedTopic}" was not found in your knowledge graph or uploaded materials. Please ask the user if they want to: 1) Upload materials about this topic, or 2) Choose a different topic from their existing content.`,
      ragContent: undefined,
    };
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
 * Generate instructions for the LLM to create a REAL scenario-based question
 * Now supports RAG content for concepts not in knowledge graph
 */
function getQuestionInstructions(
  conceptLabel: string,
  questionType: QuestionType,
  difficulty: QuestionDifficulty,
  ragContent?: string,
): {
  instructions: string;
  exampleQuestion: string;
  expectedAnswerGuidance: string;
} {
  const difficultyGuidance: Record<QuestionDifficulty, string> = {
    easy: "Ask a straightforward question with a clear answer. Test basic recognition or recall.",
    medium:
      "Create a realistic workplace scenario. Test practical application.",
    hard: "Present a complex situation with trade-offs. Test analysis and judgment.",
  };

  const typeGuidance: Record<
    QuestionType,
    { instruction: string; example: string }
  > = {
    definition: {
      instruction: `Create a question that tests if the user understands what "${conceptLabel}" means and why it matters.`,
      example: `Example for "Access Logs": "A patient calls claiming someone unauthorized viewed their medical records. What system would you check first to verify this claim, and what information would it show you?"`,
    },
    application: {
      instruction: `Create a scenario where the user must apply "${conceptLabel}" to solve a real problem.`,
      example: `Example for "Access Logs": "Your hospital's compliance officer asks you to prove that only authorized staff accessed a VIP patient's records last week. How would you gather this evidence?"`,
    },
    comparison: {
      instruction: `Create a question that tests if the user can distinguish "${conceptLabel}" from related concepts.`,
      example: `Example for "Access Logs": "A colleague suggests using firewall logs to track who viewed patient data. Why would access logs be more appropriate for this task?"`,
    },
    analysis: {
      instruction: `Create a troubleshooting or investigation scenario involving "${conceptLabel}".`,
      example: `Example for "Access Logs": "An audit reveals that access logs show 500 record views by one employee in a single hour. What does this suggest, and what should you do next?"`,
    },
  };

  const guidance = typeGuidance[questionType];

  // If RAG content is provided, include it in the instructions
  const ragContextSection = ragContent
    ? `

**REFERENCE MATERIAL FROM USER'S UPLOADS:**
${ragContent}

Use the above material to create a question that tests understanding of "${conceptLabel}" based on what's actually in their uploaded content.
`
    : "";

  return {
    instructions: `
## CREATE A SCENARIO-BASED QUESTION

**Concept to test:** ${conceptLabel}
**Difficulty:** ${difficulty} - ${difficultyGuidance[difficulty]}
**Question type:** ${questionType}

${guidance.instruction}

**RULES:**
1. Keep the question under 2 sentences
2. Use a SPECIFIC, realistic scenario (not generic templates)
3. The question should have a clear, testable answer
4. Do NOT just ask "What is ${conceptLabel}?"

${guidance.example}
${ragContextSection}

**NOW:** Create YOUR OWN scenario question about "${conceptLabel}" based on what you know from the user's uploaded materials. Make it specific to their domain/context.
`,
    exampleQuestion: guidance.example,
    expectedAnswerGuidance: `The answer should demonstrate understanding of ${conceptLabel} - specifically its purpose, when to use it, and how it applies to the scenario.`,
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
    "IMPORTANT: If the user asks about a SPECIFIC topic (e.g., 'Quiz me on Patient Lens AI', 'Ask about HIPAA'), " +
    "you MUST pass that topic in the 'topic' parameter. " +
    "If no topic is specified, auto-selects concepts that need review or reinforcement. " +
    "Adjusts difficulty based on mastery level.",

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

      // Get concepts already asked in this session to avoid repeating
      const alreadyAskedConceptIds = session.questions.map((q) => q.conceptId);
      const avoidIds = [
        ...(input.avoidConceptIds || []),
        ...alreadyAskedConceptIds,
      ];

      logger.info("Avoiding already-asked concepts", {
        userId: context.userId,
        alreadyAskedCount: alreadyAskedConceptIds.length,
        avoidIds,
      });

      // Select the best concept to ask about (avoiding already-asked ones)
      const selectedConcept = await selectConcept(
        context.userId,
        input.topic,
        avoidIds,
      );

      if (!selectedConcept) {
        return {
          success: false,
          question: null,
          selectionReason: "No suitable concepts found for questioning",
          message:
            "I don't have any study materials to quiz you on yet.\n\n" +
            "**To start testing:**\n" +
            "1. Switch to Learn mode (dropdown at bottom)\n" +
            "2. Upload your study materials (PDFs, images, notes)\n" +
            "3. Wait for processing (usually 30 seconds)\n" +
            "4. Come back to Test mode and ask to be quizzed!\n\n" +
            "Or try: 'Show available topics' to see what concepts are ready for testing.",
        };
      }

      // Check if the topic was requested but not found
      if (
        input.topic &&
        selectedConcept.reason.startsWith("TOPIC NOT FOUND:")
      ) {
        logger.info("User requested topic not found, informing user", {
          userId: context.userId,
          requestedTopic: input.topic,
        });

        return {
          success: false,
          question: null,
          selectionReason: `Requested topic "${input.topic}" not found`,
          message:
            `I couldn't find "${input.topic}" in your uploaded materials or knowledge graph.\n\n` +
            "**Would you like to:**\n" +
            "1. **Upload materials** about this topic (switch to Learn mode)\n" +
            "2. **Try a different topic** - ask me to quiz you on something else\n" +
            "3. **See available topics** - say 'Show available topics' to see what I can quiz you on\n\n" +
            "What would you prefer?",
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

      // Get instructions for generating a contextual question
      // Pass RAG content if this is a RAG-based concept
      const { instructions, expectedAnswerGuidance } = getQuestionInstructions(
        selectedConcept.conceptLabel,
        questionType,
        difficulty,
        selectedConcept.ragContent,
      );

      // Instead of a static template, we return instructions for the LLM
      // The LLM will use these + RAG context to create a real scenario
      const question: GeneratedQuestion = {
        conceptId: selectedConcept.conceptId,
        conceptLabel: selectedConcept.conceptLabel,
        difficulty,
        questionType,
        question: instructions, // LLM will use this to generate the actual question
        expectedAnswer: expectedAnswerGuidance,
        hints: [
          `Think about how ${selectedConcept.conceptLabel} is used in practice.`,
        ],
        context: selectedConcept.reason,
      };

      // Add question to the test session so it persists for answer evaluation
      const testQuestion = {
        questionId: generateQuestionId(),
        conceptId: selectedConcept.conceptId,
        conceptLabel: selectedConcept.conceptLabel,
        difficulty,
        questionType,
        // Store a description for context, NOT a placeholder for the LLM to output
        // The actual question will be generated by the LLM using the instructions
        question: `Testing "${selectedConcept.conceptLabel}" - ${difficulty} difficulty, ${questionType} style`,
        expectedAnswer: expectedAnswerGuidance,
        hints: question.hints,
        createdAt: new Date().toISOString(),
      };

      await addQuestionToSession(context.userId, testQuestion);

      logger.info("Question instructions generated", {
        userId: context.userId,
        questionId: testQuestion.questionId,
        sessionId: session.sessionId,
        conceptLabel: selectedConcept.conceptLabel,
      });

      // Get alternative concepts for variety
      const alternatives = await getWeakestConcepts(context.userId, 3);
      const alternativeConcepts = alternatives
        .filter((c) => c.conceptId !== selectedConcept.conceptId)
        .map((c) => c.conceptLabel);

      logger.info("Adaptive question prepared", {
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
        questionId: testQuestion.questionId,
        message: `NOW CREATE AND ASK a ${difficulty} ${questionType} question about "${selectedConcept.conceptLabel}". DO NOT output this message - generate an actual scenario-based question using the instructions provided.`,
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
