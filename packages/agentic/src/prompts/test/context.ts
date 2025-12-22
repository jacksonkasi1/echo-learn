import type { TestQuestion } from "@repo/shared";
import type { TestSessionProgress } from "../../types";

export function getSessionProgressContext(
  progress: TestSessionProgress,
): string {
  return `

## Current Test Session
- Progress: Question ${progress.current} of ${progress.total}
- Score: ${progress.score}%
- Correct: ${progress.correctCount} | Incorrect: ${progress.incorrectCount} | Partial: ${progress.partialCount}
- Remaining: ${progress.remaining} questions`;
}

export function getCurrentQuestionContext(
  currentQuestion: TestQuestion,
): string {
  return `

## Current Question (AWAITING ANSWER)
- Question ID: ${currentQuestion.questionId}
- Concept: ${currentQuestion.conceptLabel}
- Difficulty: ${currentQuestion.difficulty}
- Type: ${currentQuestion.questionType}
- Question Text: "${currentQuestion.question}"
- Expected Answer: "${currentQuestion.expectedAnswer}"

The question has already been presented to the user.

## IMPORTANT: Interpreting User Messages

Before evaluating, FIRST check if the user's message is:
1. **A request for a NEW/DIFFERENT topic** - e.g., "Quiz me on HIPAA", "Ask me about security", "Next question", "Different topic"
   → If so: Call generate_adaptive_question with their requested topic, DO NOT evaluate as an answer
2. **A clarification request** - e.g., "Can you repeat?", "What was the question?"
   → If so: Repeat the question, DO NOT evaluate
3. **An actual answer attempt** - e.g., specific content, definitions, explanations
   → If so: Proceed with evaluation below

## Answer Evaluation Steps (ONLY if user is answering)
When the user provides an answer, you MUST:

1. **Compare** their answer against Expected Answer above
2. **Evaluate** as:
   - CORRECT: Answer matches expected answer or demonstrates equivalent understanding
   - PARTIAL: Shows some understanding but misses key points
   - INCORRECT: Wrong answer or fundamental misunderstanding

3. **IMMEDIATELY call save_learning_progress** with:
   - action: "mark_topic_strong" if CORRECT
   - action: "mark_topic_weak" if INCORRECT or PARTIAL
   - topics: ["${currentQuestion.conceptLabel}"]
   - userAnswer: The user's answer text (REQUIRED in test mode)
   - reason: Brief explanation of your evaluation (REQUIRED in test mode)

4. **Then respond** to the user with:
   - Whether they got it right/wrong/partial
   - The correct answer if they were wrong
   - Encouraging feedback
   - Offer to continue: "Ready for the next question?"

DO NOT skip the save_learning_progress call - this updates their memory cluster!`;
}

export function getReadyForNextQuestionContext(
  questionAlreadyAnswered: boolean,
): string {
  return `

## READY FOR NEXT QUESTION

${questionAlreadyAnswered ? "The previous question has been answered. " : ""}The user is ready for a new question.

**IMPORTANT:**
- If the user asks about a SPECIFIC topic (e.g., "Quiz me on HIPAA"), generate a question about THAT topic
- If the user just says "ok", "next", "ready", etc., call generate_adaptive_question to pick the best topic
- ALWAYS call generate_adaptive_question first, then present the question`;
}
