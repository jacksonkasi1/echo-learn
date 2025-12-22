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

// ** import prompts
import {
  getTestModeSystemPrompt,
  getTestModeSystemPromptWithContext,
} from "../prompts";

// ** import types
import type { TestSessionProgress } from "../types";

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
