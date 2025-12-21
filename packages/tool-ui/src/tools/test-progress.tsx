"use client";

import * as React from "react";
import {
  Plan,
  PlanErrorBoundary,
  type TodoItem,
  type TodoStatus,
} from "../plan";

/**
 * Test progress item - represents a question in the test
 */
export interface TestProgressItem {
  /** Question ID */
  id: string;
  /** Question label or concept name */
  label: string;
  /** Status of the question */
  status: TodoStatus;
  /** Optional description */
  description?: string;
}

/**
 * Props for TestProgress component
 */
export interface TestProgressProps {
  /** Unique identifier for this progress display */
  id?: string;
  /** Tool call ID from assistant-ui */
  toolCallId?: string;
  /** Title for the test session */
  title?: string;
  /** Description */
  description?: string;
  /** Session ID */
  sessionId?: string;
  /** Questions/items in the test */
  questions?: TestProgressItem[];
  /** Current question index (0-based) */
  currentIndex?: number;
  /** Total questions planned */
  totalQuestions?: number;
  /** Current score percentage */
  score?: number;
  /** Number of correct answers */
  correctCount?: number;
  /** Number of incorrect answers */
  incorrectCount?: number;
  /** Whether to show response actions */
  showActions?: boolean;
  /** Callback when user wants to continue */
  onContinue?: () => void;
  /** Callback when user wants to end test */
  onEndTest?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Convert test progress items to Plan todos
 */
function convertToTodos(
  questions: TestProgressItem[] | undefined,
  currentIndex: number | undefined,
  totalQuestions: number | undefined,
): TodoItem[] {
  if (questions && questions.length > 0) {
    return questions.map((q) => ({
      id: q.id,
      label: q.label,
      status: q.status,
      description: q.description,
    }));
  }

  // Generate placeholder todos if we only have counts
  if (totalQuestions !== undefined && totalQuestions > 0) {
    const todos: TodoItem[] = [];
    const current = currentIndex ?? 0;

    for (let i = 0; i < totalQuestions; i++) {
      let status: TodoStatus;
      if (i < current) {
        status = "completed";
      } else if (i === current) {
        status = "in_progress";
      } else {
        status = "pending";
      }

      todos.push({
        id: `question-${i + 1}`,
        label: `Question ${i + 1}`,
        status,
      });
    }

    return todos;
  }

  return [];
}

/**
 * TestProgress component - displays test session progress inline
 *
 * This component wraps the Plan component to show test/quiz progress
 * with question statuses and scores.
 */
export function TestProgress({
  id,
  toolCallId,
  title,
  description,
  sessionId,
  questions,
  currentIndex,
  totalQuestions,
  score,
  correctCount,
  incorrectCount,
  showActions = false,
  onContinue,
  onEndTest,
  className,
}: TestProgressProps) {
  // Generate stable ID
  const progressId =
    id ?? sessionId ?? `test-progress-${toolCallId ?? "unknown"}`;

  // Convert to Plan todos
  const todos = convertToTodos(questions, currentIndex, totalQuestions);

  // Build description with score info
  const fullDescription = React.useMemo(() => {
    const parts: string[] = [];

    if (description) {
      parts.push(description);
    }

    if (score !== undefined) {
      parts.push(`Score: ${score}%`);
    }

    if (correctCount !== undefined || incorrectCount !== undefined) {
      const correct = correctCount ?? 0;
      const incorrect = incorrectCount ?? 0;
      parts.push(`✓ ${correct} correct • ✗ ${incorrect} incorrect`);
    }

    return parts.length > 0 ? parts.join(" | ") : undefined;
  }, [description, score, correctCount, incorrectCount]);

  // Build response actions if needed
  const responseActions = showActions
    ? [
        { id: "end", label: "End Test", variant: "ghost" as const },
        { id: "continue", label: "Next Question", variant: "default" as const },
      ]
    : undefined;

  // Handle response actions
  const handleResponseAction = (actionId: string) => {
    if (actionId === "continue") {
      onContinue?.();
    } else if (actionId === "end") {
      onEndTest?.();
    }
  };

  if (todos.length === 0) {
    return null;
  }

  return (
    <PlanErrorBoundary>
      <Plan
        id={progressId}
        title={title ?? "Test Progress"}
        description={fullDescription}
        todos={todos}
        maxVisibleTodos={5}
        showProgress={true}
        responseActions={responseActions}
        onResponseAction={handleResponseAction}
        className={className}
      />
    </PlanErrorBoundary>
  );
}

/**
 * Props for creating test progress from session data
 */
export interface TestSessionData {
  sessionId: string;
  currentIndex: number;
  targetQuestionCount: number;
  score: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
  questions?: Array<{
    questionId: string;
    conceptLabel: string;
    answered?: boolean;
    evaluation?: "correct" | "partial" | "incorrect";
  }>;
}

/**
 * Create TestProgressProps from session data
 */
export function createTestProgressFromSession(
  session: TestSessionData,
): TestProgressProps {
  const questions: TestProgressItem[] | undefined = session.questions?.map(
    (q, idx) => {
      let status: TodoStatus;
      if (q.answered) {
        status = q.evaluation === "correct" ? "completed" : "completed";
      } else if (idx === session.currentIndex) {
        status = "in_progress";
      } else {
        status = "pending";
      }

      return {
        id: q.questionId,
        label: q.conceptLabel,
        status,
        description:
          q.evaluation === "correct"
            ? "✓ Correct"
            : q.evaluation === "partial"
              ? "◐ Partial"
              : q.evaluation === "incorrect"
                ? "✗ Incorrect"
                : undefined,
      };
    },
  );

  return {
    sessionId: session.sessionId,
    title: "Test Progress",
    currentIndex: session.currentIndex,
    totalQuestions: session.targetQuestionCount,
    score: session.score,
    correctCount: session.correctCount,
    incorrectCount: session.incorrectCount,
    questions,
  };
}

/**
 * Schema for test progress tool arguments (what the LLM/backend sends)
 */
export interface TestProgressToolArgs {
  id?: string;
  sessionId?: string;
  title?: string;
  description?: string;
  currentIndex?: number;
  totalQuestions?: number;
  score?: number;
  correctCount?: number;
  incorrectCount?: number;
  questions?: Array<{
    id: string;
    label: string;
    status: "pending" | "in_progress" | "completed" | "cancelled";
    description?: string;
  }>;
}

/**
 * Helper to check if args are complete enough to render
 */
export function isTestProgressArgsComplete(
  args: Partial<TestProgressToolArgs> | undefined,
): args is TestProgressToolArgs {
  return !!(
    args &&
    (args.totalQuestions !== undefined ||
      (args.questions && args.questions.length > 0))
  );
}

/**
 * Default export for convenience
 */
export default TestProgress;
