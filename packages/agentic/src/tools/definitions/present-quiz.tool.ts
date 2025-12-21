// ** Present Quiz Tool for Echo-Learn
// ** Renders interactive multiple choice questions using Tool UI OptionList

// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";

// ** import lib
import { z } from "zod";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Option schema for quiz choices
 */
const QuizOptionSchema = z.object({
  id: z
    .string()
    .describe("Unique identifier for this option (e.g., 'a', 'b', 'c', 'd')"),
  label: z.string().describe("The answer text to display"),
  description: z
    .string()
    .optional()
    .describe("Optional additional context for this option"),
});

/**
 * Present quiz tool input schema
 */
const presentQuizInputSchema = z.object({
  questionId: z.string().describe("Unique identifier for this question"),
  questionText: z.string().describe("The question text to display to the user"),
  conceptId: z.string().optional().describe("ID of the concept being tested"),
  conceptLabel: z
    .string()
    .optional()
    .describe("Label of the concept being tested"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .optional()
    .describe("Difficulty level of the question"),
  options: z
    .array(QuizOptionSchema)
    .min(2)
    .max(6)
    .describe("Array of answer options (2-6 choices)"),
  correctOptionId: z
    .string()
    .describe("ID of the correct answer option (used for evaluation)"),
  hint: z.string().optional().describe("Optional hint to help the user"),
});

type PresentQuizInput = z.output<typeof presentQuizInputSchema>;

/**
 * Present quiz tool output - returns schema for Tool UI OptionList
 */
export interface PresentQuizOutput {
  /** Unique ID for this quiz question UI */
  id: string;
  /** Title to display (the question text) */
  title: string;
  /** Description with metadata */
  description?: string;
  /** Options formatted for OptionList component */
  options: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  /** Selection mode - always single for quiz */
  selectionMode: "single";
  /** Response actions */
  responseActions: Array<{
    id: string;
    label: string;
    variant: "default" | "secondary" | "ghost";
  }>;
  /** Metadata for evaluation (not displayed to user) */
  _meta: {
    questionId: string;
    conceptId?: string;
    conceptLabel?: string;
    difficulty?: string;
    correctOptionId: string;
    hint?: string;
  };
}

/**
 * Present Quiz Tool
 *
 * This tool renders an interactive multiple choice question using the Tool UI
 * OptionList component. The LLM calls this tool to present a quiz question,
 * and the user can select an answer by clicking on options.
 *
 * The tool output contains:
 * - Formatted options for the OptionList component
 * - Metadata for answer evaluation (correctOptionId)
 * - Response actions (Submit, Skip)
 *
 * After the user selects and submits an answer:
 * 1. The frontend captures the selection via addResult()
 * 2. The LLM receives the selection and evaluates it
 * 3. The LLM calls save_learning_progress based on correctness
 */
export const presentQuizTool: ToolDefinition<
  PresentQuizInput,
  PresentQuizOutput
> = {
  name: "present_quiz_question",
  description:
    "⚠️ REQUIRED FOR MULTIPLE CHOICE: Present an interactive multiple choice question. " +
    "This tool renders CLICKABLE BUTTONS that the user can select. " +
    "You MUST use this tool whenever you want to show options like 'a) X  b) Y  c) Z'. " +
    "DO NOT write multiple choice as plain text - it will NOT be interactive!\n\n" +
    "WHEN TO USE THIS TOOL (REQUIRED):\n" +
    "- Any question with 2-6 answer choices\n" +
    "- True/False questions\n" +
    "- 'Which of these...' questions\n" +
    "- When user asks for 'multiple choice' or 'options'\n\n" +
    "The tool renders a beautiful UI with clickable options. Plain text does NOT.",

  inputSchema: presentQuizInputSchema,

  category: ToolCategory.DATA_RETRIEVAL,
  requiresApproval: false,
  timeout: 5000,
  cost: 1,
  cacheable: false,
  cacheTTL: 0,

  async execute(
    input: PresentQuizInput,
    context: ToolExecutionContext,
  ): Promise<PresentQuizOutput> {
    const startTime = Date.now();

    try {
      logger.info("Presenting quiz question", {
        userId: context.userId,
        questionId: input.questionId,
        conceptLabel: input.conceptLabel,
        optionCount: input.options.length,
      });

      // Build description with metadata
      const descriptionParts: string[] = [];
      if (input.conceptLabel) {
        descriptionParts.push(`Topic: ${input.conceptLabel}`);
      }
      if (input.difficulty) {
        descriptionParts.push(`Difficulty: ${input.difficulty}`);
      }

      // Format options for OptionList
      const formattedOptions = input.options.map((opt) => ({
        id: opt.id,
        label: opt.label,
        description: opt.description,
      }));

      const output: PresentQuizOutput = {
        id: `quiz-${input.questionId}`,
        title: input.questionText,
        description:
          descriptionParts.length > 0
            ? descriptionParts.join(" • ")
            : undefined,
        options: formattedOptions,
        selectionMode: "single",
        responseActions: [
          { id: "skip", label: "Skip", variant: "ghost" },
          { id: "submit", label: "Submit Answer", variant: "default" },
        ],
        _meta: {
          questionId: input.questionId,
          conceptId: input.conceptId,
          conceptLabel: input.conceptLabel,
          difficulty: input.difficulty,
          correctOptionId: input.correctOptionId,
          hint: input.hint,
        },
      };

      logger.info("Quiz question presented", {
        userId: context.userId,
        questionId: input.questionId,
        executionTime: Date.now() - startTime,
      });

      return output;
    } catch (error) {
      logger.error("Failed to present quiz question", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: context.userId,
        questionId: input.questionId,
      });

      throw error;
    }
  },
};

/**
 * Helper to evaluate a user's selection against the correct answer
 */
export function evaluateQuizAnswer(
  selectedOptionId: string,
  correctOptionId: string,
): {
  isCorrect: boolean;
  evaluation: "correct" | "incorrect";
} {
  const isCorrect = selectedOptionId === correctOptionId;
  return {
    isCorrect,
    evaluation: isCorrect ? "correct" : "incorrect",
  };
}
