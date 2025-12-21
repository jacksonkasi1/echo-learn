// ** Test Mode Handler for Echo-Learn
// ** Active testing mode with explicit evaluation and strong signals

// ** import types
import type {
  ChatMode,
  LearningSignal,
  TestSession,
  TestQuestion,
  TestResult,
  QuestionDifficulty,
  AnswerEvaluation,
  TestSessionSummary,
  CreateTestSessionInput,
} from "@repo/shared";
import {
  MODE_PROMPTS,
  TEST_MODE_MASTERY_CHANGES,
  DEFAULT_TEST_SESSION_CONFIG,
} from "@repo/shared";

// ** import storage
import {
  createTestSession,
  getActiveTestSession,
  addQuestionToSession,
  recordAnswerResult,
  completeTestSession,
  abandonTestSession,
  getCurrentQuestion,
  getSessionProgress,
  isSessionComplete,
  generateQuestionId,
} from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Test mode configuration
 */
export interface TestModeConfig {
  /** Number of questions in the session */
  targetQuestionCount: number;
  /** Difficulty setting */
  difficulty: QuestionDifficulty | "adaptive";
  /** Specific concepts to focus on (optional) */
  focusConceptIds?: string[];
  /** Whether to auto-generate questions */
  autoGenerateQuestions: boolean;
}

/**
 * Default test mode configuration
 */
export const DEFAULT_TEST_MODE_CONFIG: TestModeConfig = {
  targetQuestionCount: DEFAULT_TEST_SESSION_CONFIG.targetQuestionCount,
  difficulty: "adaptive",
  autoGenerateQuestions: true,
};

/**
 * Test mode context passed during execution
 */
export interface TestModeContext {
  userId: string;
  query: string;
  conversationHistory: Array<{ role: string; content: string }>;
  config: TestModeConfig;
  activeSession?: TestSession;
  /** Whether this is a voice interaction (ElevenLabs) - uses verbal questions instead of UI tools */
  isVoiceMode?: boolean;
}

/**
 * Test mode result after processing
 */
export interface TestModeResult {
  mode: ChatMode;
  systemPrompt: string;
  shouldAnalyze: false; // Test mode has explicit evaluation, not passive analysis
  shouldGenerateFollowUps: false; // Test mode generates next question instead
  session: TestSession | null;
  currentQuestion: TestQuestion | null;
  progress: TestSessionProgress | null;
}

/**
 * Test session progress info
 */
export interface TestSessionProgress {
  current: number;
  total: number;
  score: number;
  remaining: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
}

/**
 * Get system prompt for test mode
 */
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

  // No active session - instruct LLM to start testing
  if (!session) {
    if (isVoiceMode) {
      // Voice mode: ask questions verbally, no UI tools
      contextSection = `

## NO ACTIVE TEST SESSION - VOICE MODE

The user has entered Test Mode via VOICE conversation.

**VOICE MODE RULES:**
- Ask ALL questions VERBALLY as plain text
- DO NOT use present_quiz_question tool - it won't work in voice
- DO NOT mention "clicking" or "buttons" - there are none
- Keep questions SHORT and easy to answer verbally
- For multiple choice, read options aloud: "Is it A, B, C, or D?"
- Wait for the user to speak their answer

**YOUR FIRST ACTION:**
1. Call generate_adaptive_question to get a question based on user's knowledge graph
2. Ask the question OUT LOUD in a conversational way
3. For multiple choice, say the options verbally

**Example verbal question:**
"Here's a question about [topic]. [Question text].
Is the answer A: [option], B: [option], C: [option], or D: [option]?"

If generate_adaptive_question returns no question (no concepts in knowledge graph),
tell the user they need to learn some topics first before testing.`;
    } else {
      // Text/UI mode: use interactive quiz tools
      contextSection = `

## NO ACTIVE TEST SESSION

The user has entered Test Mode but no test session is active yet.

**YOUR FIRST ACTION:**
1. First, call generate_adaptive_question to get a question based on user's knowledge graph
2. Then decide HOW to present the question (see options below)

If generate_adaptive_question returns no question (no concepts in knowledge graph),
inform the user they need to learn some topics first before testing.

## QUESTION PRESENTATION OPTIONS

You have TWO ways to present questions:

### Option 1: Plain Text
Simply ask the question as text and let the user type their answer.
Best for: open-ended questions, explanations, "explain in your own words", definitions.

### Option 2: Interactive Multiple Choice (present_quiz_question tool) ⭐ REQUIRED FOR MULTIPLE CHOICE
**YOU MUST CALL the present_quiz_question tool** to render clickable options.
DO NOT write multiple choice questions as text - they will not be interactive!

⚠️ IMPORTANT: If you want to show options like "a) X  b) Y  c) Z", you MUST use the tool.
Writing them as text does NOT create clickable buttons - only the tool does that.

**To use present_quiz_question, call it with:**
- questionId: unique identifier
- questionText: the question to ask
- options: array of {id, label, description?} - 2 to 6 choices
- correctOptionId: which option is correct (for evaluation)
- conceptLabel: topic being tested
- difficulty: "easy", "medium", or "hard"

**Example call:**
\`\`\`
present_quiz_question({
  questionId: "q1",
  questionText: "What is the capital of France?",
  options: [
    { id: "a", label: "London" },
    { id: "b", label: "Paris" },
    { id: "c", label: "Berlin" },
    { id: "d", label: "Madrid" }
  ],
  correctOptionId: "b",
  conceptLabel: "European Geography",
  difficulty: "easy"
})
\`\`\`

**When the user selects an answer and clicks Submit:**
- You will receive their selection (e.g., { selectedIds: ["b"], selectedLabels: ["Paris"] })
- Compare against correctOptionId to evaluate
- Call save_learning_progress with the result
- Provide feedback and offer the next question

⚠️ **CRITICAL:** If the user asks for "multiple choice", "quiz with options", "clickable options",
or any question with distinct choices, you MUST call present_quiz_question tool.
DO NOT just write "a) X  b) Y  c) Z" as text - that is NOT interactive!

**The tool renders a beautiful interactive UI. Plain text does not.**`;
    }
  } else if (session && progress) {
    contextSection = `

## Current Test Session
- Progress: Question ${progress.current} of ${progress.total}
- Score: ${progress.score}%
- Correct: ${progress.correctCount} | Incorrect: ${progress.incorrectCount} | Partial: ${progress.partialCount}
- Remaining: ${progress.remaining} questions`;
  }

  if (currentQuestion) {
    contextSection += `

## Current Question (AWAITING ANSWER)
- Question ID: ${currentQuestion.questionId}
- Concept: ${currentQuestion.conceptLabel}
- Difficulty: ${currentQuestion.difficulty}
- Type: ${currentQuestion.questionType}
- Question Text: "${currentQuestion.question}"
- Expected Answer: "${currentQuestion.expectedAnswer}"

The question has already been presented to the user. The user's next message is their ANSWER.

## CRITICAL: Answer Evaluation Steps
When the user responds, you MUST:

1. **Compare** their answer against Expected Answer above
2. **Evaluate** as:
   - CORRECT: Answer matches expected answer or demonstrates equivalent understanding
   - PARTIAL: Shows some understanding but misses key points
   - INCORRECT: Wrong answer or fundamental misunderstanding

3. **IMMEDIATELY call save_learning_progress** with:
   - action: "mark_topic_strong" if CORRECT
   - action: "mark_topic_weak" if INCORRECT or PARTIAL
   - topics: ["${currentQuestion.conceptLabel}"]
   - reason: Brief explanation of your evaluation

4. **Then respond** to the user with:
   - Whether they got it right/wrong/partial
   - The correct answer if they were wrong
   - Encouraging feedback
   - Offer to continue with next question

DO NOT skip the save_learning_progress call - this updates their memory cluster!`;
  } else if (session && !currentQuestion) {
    // Session exists but no current question - need to generate one
    contextSection += `

## SESSION ACTIVE - NEED NEXT QUESTION

A test session is active but no current question is set.
Call generate_adaptive_question to get the next question for the user.`;
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
${
  isVoiceMode
    ? `
**VOICE MODE - ALL QUESTIONS ARE VERBAL**
| Question Type | Format |
|---------------|--------|
| All questions | Speak them aloud |
| Multiple choice | Say "Is it A, B, C, or D?" |
| True/False | Ask verbally |

DO NOT use present_quiz_question tool in voice mode.`
    : `
| Question Type | Format | Rule |
|---------------|--------|------|
| Definition/explanation | Plain text | OK |
| Multiple choice with options | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| True/False | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| Short answer | Plain text | OK |
| "Which of these..." | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| Open-ended analysis | Plain text | OK |
| User asks for "options" or "choices" | **MUST use present_quiz_question** | ⚠️ REQUIRED |
| Factual recall with choices | **MUST use present_quiz_question** | ⚠️ REQUIRED |

**NEVER write "a) X  b) Y  c) Z" as plain text. ALWAYS use the tool for choices.**`
}

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

/**
 * Initialize test mode processing
 */
export async function initializeTestMode(
  context: TestModeContext,
): Promise<TestModeResult> {
  logger.info("Initializing test mode", {
    userId: context.userId,
    hasActiveSession: !!context.activeSession,
  });

  // Check for existing session
  let session =
    context.activeSession || (await getActiveTestSession(context.userId));
  let currentQuestion: TestQuestion | null = null;
  let progress: TestSessionProgress | null = null;

  if (session) {
    currentQuestion = session.questions[session.currentIndex] || null;
    progress = {
      current: session.currentIndex + 1,
      total: session.targetQuestionCount,
      score: session.score,
      remaining: session.targetQuestionCount - session.results.length,
      correctCount: session.correctCount,
      incorrectCount: session.incorrectCount,
      partialCount: session.partialCount,
    };
  }

  const basePrompt = getTestModeSystemPrompt();
  const systemPrompt = getTestModeSystemPromptWithContext(
    basePrompt,
    session,
    currentQuestion,
    progress,
    context.isVoiceMode ?? false,
  );

  return {
    mode: "test",
    systemPrompt,
    shouldAnalyze: false,
    shouldGenerateFollowUps: false,
    session,
    currentQuestion,
    progress,
  };
}

/**
 * Start a new test session
 */
export async function startTestSession(
  userId: string,
  config: Partial<TestModeConfig> = {},
): Promise<TestSession> {
  logger.info("Starting new test session", { userId, config });

  // Check for existing active session
  const existingSession = await getActiveTestSession(userId);
  if (existingSession) {
    logger.info("Abandoning existing session before starting new one", {
      userId,
      existingSessionId: existingSession.sessionId,
    });
    await abandonTestSession(userId);
  }

  const input: CreateTestSessionInput = {
    userId,
    targetQuestionCount:
      config.targetQuestionCount ??
      DEFAULT_TEST_MODE_CONFIG.targetQuestionCount,
    focusConceptIds: config.focusConceptIds,
    difficulty: config.difficulty ?? DEFAULT_TEST_MODE_CONFIG.difficulty,
  };

  const session = await createTestSession(input);

  logger.info("Test session started", {
    userId,
    sessionId: session.sessionId,
    targetQuestionCount: session.targetQuestionCount,
  });

  return session;
}

/**
 * Add a question to the active test session
 */
export async function addQuestion(
  userId: string,
  conceptId: string,
  conceptLabel: string,
  question: string,
  expectedAnswer: string,
  difficulty: QuestionDifficulty,
  questionType: TestQuestion["questionType"],
): Promise<TestQuestion> {
  const testQuestion: TestQuestion = {
    questionId: generateQuestionId(),
    conceptId,
    conceptLabel,
    difficulty,
    questionType,
    question,
    expectedAnswer,
    createdAt: new Date().toISOString(),
  };

  await addQuestionToSession(userId, testQuestion);

  logger.info("Question added to test session", {
    userId,
    questionId: testQuestion.questionId,
    conceptId,
  });

  return testQuestion;
}

/**
 * Signal weights for test mode
 * These are stronger than learn mode since evaluation is explicit
 */
export const TEST_MODE_SIGNAL_WEIGHTS: Record<AnswerEvaluation, number> = {
  correct: TEST_MODE_MASTERY_CHANGES.correct, // +0.3
  partial: TEST_MODE_MASTERY_CHANGES.partial, // +0.1
  incorrect: TEST_MODE_MASTERY_CHANGES.incorrect, // -0.2
};

/**
 * Create a learning signal from test answer evaluation
 */
export function createTestModeSignal(
  conceptId: string,
  conceptLabel: string,
  evaluation: AnswerEvaluation,
  context?: string,
): LearningSignal {
  const signalTypeMap: Record<AnswerEvaluation, LearningSignal["type"]> = {
    correct: "quiz_correct",
    partial: "quiz_partial",
    incorrect: "quiz_incorrect",
  };

  return {
    type: signalTypeMap[evaluation],
    conceptId,
    conceptLabel,
    confidence: 1.0, // Test mode has high confidence (explicit evaluation)
    masteryDelta: TEST_MODE_SIGNAL_WEIGHTS[evaluation],
    timestamp: new Date().toISOString(),
    context,
  };
}

/**
 * Record an answer and update mastery
 */
export async function processAnswer(
  userId: string,
  questionId: string,
  userAnswer: string,
  evaluation: AnswerEvaluation,
  feedback: string,
  previousMastery: number,
  newMastery: number,
): Promise<TestResult> {
  const session = await getActiveTestSession(userId);
  if (!session) {
    throw new Error("No active test session found");
  }

  const questionIndex = session.questions.findIndex(
    (q) => q.questionId === questionId,
  );
  if (questionIndex === -1) {
    throw new Error(`Question ${questionId} not found in session`);
  }

  const result: TestResult = {
    questionId,
    questionIndex,
    userAnswer,
    evaluation,
    feedback,
    masteryChange: newMastery - previousMastery,
    previousMastery,
    newMastery,
    answeredAt: new Date().toISOString(),
  };

  await recordAnswerResult(userId, result);

  logger.info("Answer processed in test mode", {
    userId,
    questionId,
    evaluation,
    masteryChange: result.masteryChange,
  });

  return result;
}

/**
 * End the test session and get summary
 */
export async function endTestSession(
  userId: string,
): Promise<TestSessionSummary> {
  logger.info("Ending test session", { userId });

  const summary = await completeTestSession(userId);

  logger.info("Test session completed", {
    userId,
    sessionId: summary.sessionId,
    score: summary.score,
    questionsAnswered: summary.questionsAnswered,
  });

  return summary;
}

/**
 * Abandon test session without completing
 */
export async function cancelTestSession(userId: string): Promise<void> {
  logger.info("Canceling test session", { userId });
  await abandonTestSession(userId);
}

/**
 * Get current test session state
 */
export async function getTestSessionState(userId: string): Promise<{
  hasActiveSession: boolean;
  session: TestSession | null;
  currentQuestion: TestQuestion | null;
  progress: TestSessionProgress | null;
  isComplete: boolean;
}> {
  const session = await getActiveTestSession(userId);

  if (!session) {
    return {
      hasActiveSession: false,
      session: null,
      currentQuestion: null,
      progress: null,
      isComplete: false,
    };
  }

  const currentQuestion = await getCurrentQuestion(userId);
  const progressData = await getSessionProgress(userId);
  const complete = await isSessionComplete(userId);

  const progress: TestSessionProgress | null = progressData
    ? {
        ...progressData,
        correctCount: session.correctCount,
        incorrectCount: session.incorrectCount,
        partialCount: session.partialCount,
      }
    : null;

  return {
    hasActiveSession: true,
    session,
    currentQuestion,
    progress,
    isComplete: complete,
  };
}

/**
 * Determine difficulty for next question based on performance
 */
export function getAdaptiveDifficulty(
  session: TestSession,
): QuestionDifficulty {
  if (session.results.length === 0) {
    return "medium"; // Start with medium
  }

  const recentResults = session.results.slice(-3); // Look at last 3 answers
  const recentScore =
    recentResults.filter((r) => r.evaluation === "correct").length /
    recentResults.length;

  if (recentScore >= 0.8) {
    return "hard"; // Doing well, increase difficulty
  } else if (recentScore <= 0.3) {
    return "easy"; // Struggling, decrease difficulty
  }

  return "medium";
}

/**
 * Get tools that should be enhanced in test mode
 */
export function getTestModeToolEnhancements(): string[] {
  return ["generate_adaptive_question", "evaluate_answer", "get_test_progress"];
}
