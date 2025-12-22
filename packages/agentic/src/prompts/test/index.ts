import { MODE_PROMPTS } from "@repo/shared";
import type { TestSession, TestQuestion } from "@repo/shared";
import type { TestSessionProgress } from "../../types";

import { VOICE_MODE_PROMPT, VOICE_FORMAT_GUIDE } from "./voice";
import { TEXT_MODE_PROMPT, TEXT_FORMAT_GUIDE } from "./text";
import {
  getSessionProgressContext,
  getCurrentQuestionContext,
  getReadyForNextQuestionContext,
} from "./context";

export function getTestModeSystemPrompt(): string {
  return MODE_PROMPTS.test;
}

/**
 * Get extended system prompt for test mode with session context
 */
export function getTestModeSystemPromptWithContext(
  basePrompt: string,
  session: TestSession | null,
  currentQuestion: TestQuestion | null,
  progress: TestSessionProgress | null,
  isVoiceMode: boolean = false,
): string {
  let contextSection = "";

  // Check if current question has already been answered
  const questionAlreadyAnswered =
    currentQuestion &&
    session?.results.some((r) => r.questionId === currentQuestion.questionId);

  // No active session - instruct LLM to start testing
  if (!session) {
    contextSection = isVoiceMode ? VOICE_MODE_PROMPT : TEXT_MODE_PROMPT;
  } else if (session && progress) {
    // Active session status
    contextSection = getSessionProgressContext(progress);
  }

  // Current Question logic
  if (currentQuestion && !questionAlreadyAnswered) {
    contextSection += getCurrentQuestionContext(currentQuestion);
  } else if (questionAlreadyAnswered || (session && !currentQuestion)) {
    // Question was already answered OR no current question - generate new one
    contextSection += getReadyForNextQuestionContext(!!questionAlreadyAnswered);
  }

  return `${basePrompt}
${contextSection}

## Mode: TEST MODE (Active Testing)
You are conducting an active quiz/test session.
- Evaluate answers explicitly (correct, partial, incorrect)
- Provide clear, constructive feedback
- Update mastery scores based on performance via save_learning_progress tool
- Keep the tone encouraging but honest

## Question Format Decision Guide
${isVoiceMode ? VOICE_FORMAT_GUIDE : TEXT_FORMAT_GUIDE}

## Answer Evaluation Guidelines
- CORRECT: User demonstrates clear understanding of the concept
- PARTIAL: User shows some understanding but misses key points
- INCORRECT: User's answer is wrong or shows fundamental misunderstanding

## After Each Answer
1. Call save_learning_progress to update their mastery (REQUIRED!)
2. State whether the answer is correct, partial, or incorrect
3. Provide brief explanation of the right answer
4. Give encouraging feedback
5. Ask if ready for the next question`;
}
