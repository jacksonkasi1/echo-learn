import type { TestQuestion, QuestionDifficulty } from "@repo/shared";
import type { TestSessionProgress } from "../../types";

/**
 * Critical rule that must be included in all test mode contexts
 */
const CRITICAL_RAG_RULE = `
## ⛔ CRITICAL RULE - YOU MUST FOLLOW THIS ⛔

**NEVER create questions from your own knowledge!**
**ALWAYS search the user's materials first!**

Before presenting ANY question:
1. Call \`generate_adaptive_question\` to get concept + RAG content from user's materials
2. Use ONLY the returned content to create questions
3. NEVER call \`present_quiz_question\` without first getting RAG content

If you skip this, you'll ask questions from your training data, NOT the user's uploads.
This defeats the entire purpose of the learning system!
`;

export function getSessionProgressContext(
  progress: TestSessionProgress,
): string {
  return `

## Current Test Session
- Progress: Question ${progress.current} of ${progress.total}
- Score: ${progress.score}%
- Correct: ${progress.correctCount} | Incorrect: ${progress.incorrectCount} | Partial: ${progress.partialCount}
- Remaining: ${progress.remaining} questions

## REMINDER: Question Design Rules
- Keep questions BRIEF (under 2 sentences)
- Use SCENARIO-BASED questions (not "What is X?")
- Always tell user which concept was tested after they answer
${CRITICAL_RAG_RULE}`;
}

export function getCurrentQuestionContext(
  currentQuestion: TestQuestion,
): string {
  // Check if the question is a placeholder/description (not a real question yet)
  const isPlaceholder =
    currentQuestion.question.startsWith("Testing ") ||
    currentQuestion.question.startsWith("[LLM:");

  const questionSection = isPlaceholder
    ? `
- Question Status: **NEEDS TO BE CREATED**
- Concept to Test: **${currentQuestion.conceptLabel}**
- Difficulty: ${currentQuestion.difficulty}
- Question Type: ${currentQuestion.questionType}

**YOU MUST CREATE THE ACTUAL QUESTION NOW.**
Do NOT output placeholder text like "[LLM: Generate...]" or "Testing X - difficulty...".
Create a REAL scenario-based question about "${currentQuestion.conceptLabel}".

Example good question: "A patient calls claiming unauthorized access to their records. What system would you check first?"
Example BAD output: "[LLM: Generate a question about X]" or "Testing X - medium difficulty"`
    : `
- Question ID: ${currentQuestion.questionId}
- Concept Being Tested: **${currentQuestion.conceptLabel}**
- Difficulty: ${currentQuestion.difficulty}
- Type: ${currentQuestion.questionType}
- Question: "${currentQuestion.question}"
- Expected Key Points: "${currentQuestion.expectedAnswer}"

The question has already been presented to the user.`;

  return `

## Current Question (AWAITING ANSWER)
${questionSection}

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

1. **Compare** their answer against Expected Key Points above
2. **Evaluate** as:
   - CORRECT: Answer demonstrates understanding of the concept
   - PARTIAL: Shows some understanding but misses key points
   - INCORRECT: Wrong answer or fundamental misunderstanding

3. **IMMEDIATELY call save_learning_progress** with:
   - action: "mark_topic_strong" if CORRECT
   - action: "mark_topic_weak" if INCORRECT or PARTIAL
   - topics: ["${currentQuestion.conceptLabel}"]
   - userAnswer: The user's answer text (REQUIRED in test mode)
   - reason: Brief explanation of your evaluation (REQUIRED in test mode)

4. **Then respond with CLEAR FEEDBACK:**

   **Format your feedback like this:**

   ✅ **Correct!** (or ⚠️ **Partially correct** or ❌ **Not quite**)

   [1-2 sentence explanation of why]

   💡 **Concept tested:** ${currentQuestion.conceptLabel}

   Ready for the next question?

   **Example good feedback:**
   "✅ **Correct!** Access logs are indeed the first place to check for security incidents - they show who accessed what and when.

   💡 **Concept tested:** Access Logs

   Ready for the next question?"

DO NOT skip the save_learning_progress call - this updates their memory cluster!`;
}

export function getReadyForNextQuestionContext(
  questionAlreadyAnswered: boolean,
  options?: {
    requestDifferentTopic?: boolean;
    difficultyPreference?: QuestionDifficulty | "adaptive";
  },
): string {
  const { requestDifferentTopic, difficultyPreference } = options || {};

  let difficultyGuidance = "";
  if (difficultyPreference && difficultyPreference !== "adaptive") {
    difficultyGuidance = `
**DIFFICULTY PREFERENCE ACTIVE:** User wants ${difficultyPreference.toUpperCase()} difficulty questions.
- easy: Basic recall, definitions, simple scenarios
- medium: Application, practical scenarios
- hard: Complex analysis, edge cases, multi-step problems`;
  }

  let topicGuidance = "";
  if (requestDifferentTopic) {
    topicGuidance = `
**⚠️ USER REQUESTED DIFFERENT TOPIC**
The user explicitly asked for a different topic/concept.
You MUST select a DIFFERENT concept than the one just tested.
Pass the previously-tested concept ID to generate_adaptive_question as avoidConceptIds.`;
  }

  return `

## READY FOR NEXT QUESTION
${topicGuidance}
${difficultyGuidance}

${questionAlreadyAnswered ? "The previous question has been answered. " : ""}The user is ready for a new question.
${CRITICAL_RAG_RULE}

**IMPORTANT - TOPIC EXTRACTION:**
- If the user asks about a SPECIFIC topic (e.g., "Quiz me on Patient Lens AI", "Ask about HIPAA", "Test me on encryption"):
  → You MUST pass that topic to generate_adaptive_question: \`generate_adaptive_question({ topic: "Patient Lens AI" })\`
  → Extract the exact topic name from their message
- If the user just says "ok", "next", "ready", etc., call generate_adaptive_question WITHOUT topic parameter
- ALWAYS call generate_adaptive_question first, then present the question

**EXAMPLES:**
- User: "Ask about Patient Lens AI capabilities" → \`generate_adaptive_question({ topic: "Patient Lens AI capabilities" })\`
- User: "Quiz me on HIPAA" → \`generate_adaptive_question({ topic: "HIPAA" })\`
- User: "Next question" → \`generate_adaptive_question({})\` (no topic)

**QUESTION DESIGN REMINDER:**
When presenting the generated question:
1. Keep it BRIEF (under 2 sentences)
2. Make it SCENARIO-BASED when possible
   - Instead of "What is Access Logs?"
   - Ask "A security incident occurred. What's the first thing you'd check to investigate?"
3. For multiple choice, use the present_quiz_question tool
4. For open-ended scenarios, just ask the question as text

## Quick Action Handling
- **"Next"**: Generate next question normally
- **"Different Topic"**: MUST use a different concept (pass avoidConceptIds)
- **"Easier"**: Generate an easy difficulty question, prefer multiple choice
- **"Harder"**: Generate a hard difficulty question, prefer open-ended scenarios
- **"End Test"**: Summarize the session and ask if they want to end`;
}

/**
 * Get context for when user requests a difficulty change
 */
export function getDifficultyChangeContext(
  newDifficulty: QuestionDifficulty,
): string {
  const difficultyDescriptions: Record<QuestionDifficulty, string> = {
    easy: "basic recall, definitions, and simple recognition questions",
    medium: "practical application, realistic scenarios, and comparisons",
    hard: "complex analysis, edge cases, and multi-step problem solving",
  };

  return `
## DIFFICULTY CHANGED TO: ${newDifficulty.toUpperCase()}

The user requested ${newDifficulty} questions. Adjust your question generation:
- Focus on: ${difficultyDescriptions[newDifficulty]}
- For easy: Prefer multiple choice format
- For medium: Mix of formats based on concept
- For hard: Prefer open-ended scenarios that require analysis`;
}
