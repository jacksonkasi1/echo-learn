"use client";

import * as React from "react";
import {
  OptionList,
  OptionListErrorBoundary,
  type OptionListSelection,
  type SerializableOptionList,
} from "../option-list";

/**
 * Quiz question props - extends SerializableOptionList with quiz-specific fields
 */
export interface QuizQuestionProps extends Omit<
  SerializableOptionList,
  "id" | "selectionMode"
> {
  /** Question ID */
  id?: string;
  /** Tool call ID from assistant-ui */
  toolCallId?: string;
  /** Question text to display */
  questionText?: string;
  /** Concept being tested */
  conceptLabel?: string;
  /** Difficulty level */
  difficulty?: "easy" | "medium" | "hard";
  /** Already submitted result */
  result?: OptionListSelection;
  /** Callback when user submits answer */
  onSubmit?: (selection: OptionListSelection) => void;
  /** Callback for other response actions */
  onResponseAction?: (actionId: string) => void;
}

/**
 * QuizQuestion component - wraps OptionList for quiz/test scenarios
 *
 * This component is designed to be used with assistant-ui's makeAssistantTool
 * or makeAssistantToolUI to render interactive quiz questions inline.
 */
export function QuizQuestion({
  id,
  toolCallId,
  questionText,
  conceptLabel,
  difficulty,
  result,
  onSubmit,
  onResponseAction,
  options,
  responseActions,
  ...rest
}: QuizQuestionProps) {
  // Generate stable ID
  const questionId = id ?? `quiz-${toolCallId ?? "unknown"}`;

  // Default response actions for quiz
  const defaultActions = responseActions ?? [
    { id: "confirm", label: "Submit Answer", variant: "default" as const },
    { id: "skip", label: "Skip", variant: "ghost" as const },
  ];

  // Build title with optional metadata
  const title = questionText ?? rest.title;
  const description = React.useMemo(() => {
    const parts: string[] = [];
    if (conceptLabel) parts.push(`Topic: ${conceptLabel}`);
    if (difficulty) parts.push(`Difficulty: ${difficulty}`);
    if (rest.description) parts.push(rest.description);
    return parts.length > 0 ? parts.join(" • ") : undefined;
  }, [conceptLabel, difficulty, rest.description]);

  // Handle confirm action
  const handleConfirm = (selection: OptionListSelection) => {
    onSubmit?.(selection);
  };

  // If we have a result, show receipt state
  const confirmedValue = result
    ? result.selectedIds.length === 1
      ? result.selectedIds[0]
      : result.selectedIds
    : undefined;

  return (
    <OptionListErrorBoundary>
      <OptionList
        id={questionId}
        title={title}
        description={description}
        options={options}
        selectionMode="single"
        confirmed={confirmedValue}
        responseActions={defaultActions}
        onConfirm={handleConfirm}
        onResponseAction={onResponseAction}
      />
    </OptionListErrorBoundary>
  );
}

/**
 * Props for creating a quiz question tool with makeAssistantTool
 */
export interface CreateQuizQuestionToolProps {
  /** Tool name to register */
  toolName?: string;
  /** Description for the tool */
  description?: string;
}

/**
 * Schema for quiz question tool arguments (what the LLM sends)
 */
export interface QuizQuestionToolArgs {
  id?: string;
  questionText: string;
  conceptId?: string;
  conceptLabel?: string;
  difficulty?: "easy" | "medium" | "hard";
  options: Array<{
    id: string;
    label: string;
    description?: string;
  }>;
  correctOptionId?: string; // This should NOT be sent to client in real impl
}

/**
 * Helper to check if args are complete enough to render
 */
export function isQuizQuestionArgsComplete(
  args: Partial<QuizQuestionToolArgs> | undefined,
): args is QuizQuestionToolArgs {
  return !!(
    args &&
    args.questionText &&
    Array.isArray(args.options) &&
    args.options.length > 0
  );
}

/**
 * Default export for convenience
 */
export default QuizQuestion;
