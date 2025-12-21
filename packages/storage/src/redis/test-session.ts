// ** Test Session storage functions for Echo-Learn Test Mode
// ** Manages active test sessions and session history

// ** import types
import type {
  TestSession,
  TestQuestion,
  TestResult,
  TestSessionStatus,
  TestSessionSummary,
  CreateTestSessionInput,
  TestSessionHistoryEntry,
} from "@repo/shared";
import { DEFAULT_TEST_SESSION_CONFIG, TEST_MODE_MASTERY_CHANGES } from "@repo/shared";

// ** import lib
import { redis } from "./client.js";

// ** import utils
import { logger } from "@repo/logs";

// ===========================================
// Redis Key Helpers
// ===========================================

/**
 * Get Redis key for active test session
 */
function getSessionKey(userId: string): string {
  return `user:${userId}:test-session`;
}

/**
 * Get Redis key for test session history
 */
function getSessionHistoryKey(userId: string): string {
  return `user:${userId}:test-history`;
}

/**
 * Get Redis key for a specific historical session
 */
function getHistoricalSessionKey(sessionId: string): string {
  return `test-session:${sessionId}`;
}

// ===========================================
// Session ID Generation
// ===========================================

/**
 * Generate a unique session ID
 */
function generateSessionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `test_${timestamp}_${random}`;
}

/**
 * Generate a unique question ID
 */
export function generateQuestionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `q_${timestamp}_${random}`;
}

// ===========================================
// Session CRUD Operations
// ===========================================

/**
 * Get active test session for a user
 * Returns null if no active session
 */
export async function getActiveTestSession(
  userId: string
): Promise<TestSession | null> {
  try {
    const key = getSessionKey(userId);
    const data = await redis.get<string>(key);

    if (!data) return null;

    const session = typeof data === "string" ? JSON.parse(data) : data;

    // Check if session is still active
    if (session.status !== "active" && session.status !== "paused") {
      return null;
    }

    return session;
  } catch (error) {
    logger.error("Failed to get active test session", { userId, error });
    throw error;
  }
}

/**
 * Create a new test session
 */
export async function createTestSession(
  input: CreateTestSessionInput
): Promise<TestSession> {
  try {
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    const session: TestSession = {
      sessionId,
      userId: input.userId,
      status: "active",
      startedAt: now,
      updatedAt: now,
      questions: [],
      currentIndex: 0,
      results: [],
      targetQuestionCount: input.targetQuestionCount ?? DEFAULT_TEST_SESSION_CONFIG.targetQuestionCount,
      focusConceptIds: input.focusConceptIds,
      difficulty: input.difficulty ?? DEFAULT_TEST_SESSION_CONFIG.difficulty,
      score: 0,
      correctCount: 0,
      partialCount: 0,
      incorrectCount: 0,
    };

    // Save to Redis
    const key = getSessionKey(input.userId);
    await redis.set(key, JSON.stringify(session));

    logger.info("Test session created", {
      userId: input.userId,
      sessionId,
      targetQuestionCount: session.targetQuestionCount,
    });

    return session;
  } catch (error) {
    logger.error("Failed to create test session", { userId: input.userId, error });
    throw error;
  }
}

/**
 * Update test session
 */
export async function updateTestSession(
  userId: string,
  updates: Partial<TestSession>
): Promise<TestSession> {
  try {
    const session = await getActiveTestSession(userId);
    if (!session) {
      throw new Error("No active test session found");
    }

    const updatedSession: TestSession = {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    const key = getSessionKey(userId);
    await redis.set(key, JSON.stringify(updatedSession));

    logger.info("Test session updated", {
      userId,
      sessionId: session.sessionId,
      status: updatedSession.status,
    });

    return updatedSession;
  } catch (error) {
    logger.error("Failed to update test session", { userId, error });
    throw error;
  }
}

/**
 * Add a question to the session
 */
export async function addQuestionToSession(
  userId: string,
  question: TestQuestion
): Promise<TestSession> {
  try {
    const session = await getActiveTestSession(userId);
    if (!session) {
      throw new Error("No active test session found");
    }

    session.questions.push(question);
    session.updatedAt = new Date().toISOString();

    const key = getSessionKey(userId);
    await redis.set(key, JSON.stringify(session));

    logger.info("Question added to session", {
      userId,
      sessionId: session.sessionId,
      questionId: question.questionId,
      conceptId: question.conceptId,
    });

    return session;
  } catch (error) {
    logger.error("Failed to add question to session", { userId, error });
    throw error;
  }
}

/**
 * Record answer result for current question
 */
export async function recordAnswerResult(
  userId: string,
  result: TestResult
): Promise<TestSession> {
  try {
    const session = await getActiveTestSession(userId);
    if (!session) {
      throw new Error("No active test session found");
    }

    // Add result
    session.results.push(result);

    // Update counts
    switch (result.evaluation) {
      case "correct":
        session.correctCount++;
        break;
      case "partial":
        session.partialCount++;
        break;
      case "incorrect":
        session.incorrectCount++;
        break;
    }

    // Calculate score
    const totalAnswered = session.results.length;
    if (totalAnswered > 0) {
      // Partial answers count as 0.5
      const effectiveCorrect = session.correctCount + (session.partialCount * 0.5);
      session.score = Math.round((effectiveCorrect / totalAnswered) * 100);
    }

    // Move to next question
    session.currentIndex++;
    session.updatedAt = new Date().toISOString();

    const key = getSessionKey(userId);
    await redis.set(key, JSON.stringify(session));

    logger.info("Answer result recorded", {
      userId,
      sessionId: session.sessionId,
      evaluation: result.evaluation,
      score: session.score,
      questionsAnswered: totalAnswered,
    });

    return session;
  } catch (error) {
    logger.error("Failed to record answer result", { userId, error });
    throw error;
  }
}

/**
 * Complete a test session
 */
export async function completeTestSession(
  userId: string
): Promise<TestSessionSummary> {
  try {
    const session = await getActiveTestSession(userId);
    if (!session) {
      throw new Error("No active test session found");
    }

    const now = new Date().toISOString();
    session.status = "completed";
    session.completedAt = now;
    session.updatedAt = now;

    // Save final session state
    const key = getSessionKey(userId);
    await redis.set(key, JSON.stringify(session));

    // Archive to history
    await archiveSession(session);

    // Generate summary
    const summary = generateSessionSummary(session);

    logger.info("Test session completed", {
      userId,
      sessionId: session.sessionId,
      score: session.score,
      questionsAnswered: session.results.length,
    });

    return summary;
  } catch (error) {
    logger.error("Failed to complete test session", { userId, error });
    throw error;
  }
}

/**
 * Abandon a test session (user quit early)
 */
export async function abandonTestSession(
  userId: string
): Promise<void> {
  try {
    const session = await getActiveTestSession(userId);
    if (!session) {
      return; // No session to abandon
    }

    const now = new Date().toISOString();
    session.status = "abandoned";
    session.completedAt = now;
    session.updatedAt = now;

    // Save final state
    const key = getSessionKey(userId);
    await redis.set(key, JSON.stringify(session));

    // Archive to history
    await archiveSession(session);

    logger.info("Test session abandoned", {
      userId,
      sessionId: session.sessionId,
      questionsAnswered: session.results.length,
    });
  } catch (error) {
    logger.error("Failed to abandon test session", { userId, error });
    throw error;
  }
}

/**
 * Pause a test session
 */
export async function pauseTestSession(userId: string): Promise<TestSession> {
  return updateTestSession(userId, { status: "paused" });
}

/**
 * Resume a paused test session
 */
export async function resumeTestSession(userId: string): Promise<TestSession> {
  return updateTestSession(userId, { status: "active" });
}

/**
 * Delete active test session (clear without archiving)
 */
export async function deleteActiveSession(userId: string): Promise<void> {
  try {
    const key = getSessionKey(userId);
    await redis.del(key);

    logger.info("Active test session deleted", { userId });
  } catch (error) {
    logger.error("Failed to delete active session", { userId, error });
    throw error;
  }
}

// ===========================================
// Session History Operations
// ===========================================

/**
 * Archive completed/abandoned session to history
 */
async function archiveSession(session: TestSession): Promise<void> {
  try {
    // Save full session data
    const sessionKey = getHistoricalSessionKey(session.sessionId);
    await redis.set(sessionKey, JSON.stringify(session));

    // Add to user's history list (sorted by timestamp)
    const historyKey = getSessionHistoryKey(session.userId);
    const timestamp = new Date(session.startedAt).getTime();
    await redis.zadd(historyKey, {
      score: timestamp,
      member: session.sessionId,
    });

    // Keep only last 100 sessions
    await redis.zremrangebyrank(historyKey, 0, -101);

    logger.info("Session archived to history", {
      userId: session.userId,
      sessionId: session.sessionId,
    });
  } catch (error) {
    logger.error("Failed to archive session", {
      userId: session.userId,
      sessionId: session.sessionId,
      error,
    });
    // Don't throw - archiving failure shouldn't break the flow
  }
}

/**
 * Get test session history for a user
 */
export async function getTestSessionHistory(
  userId: string,
  limit: number = 20
): Promise<TestSessionHistoryEntry[]> {
  try {
    const historyKey = getSessionHistoryKey(userId);
    // Get most recent first
    const sessionIds = await redis.zrange(historyKey, -limit, -1);

    const entries: TestSessionHistoryEntry[] = [];

    for (const sessionId of sessionIds.reverse()) {
      const sessionKey = getHistoricalSessionKey(sessionId as string);
      const data = await redis.get<string>(sessionKey);

      if (data) {
        const session: TestSession = typeof data === "string" ? JSON.parse(data) : data;
        entries.push({
          sessionId: session.sessionId,
          startedAt: session.startedAt,
          completedAt: session.completedAt,
          status: session.status,
          questionsAnswered: session.results.length,
          score: session.score,
          conceptsTested: session.questions.map(q => q.conceptId),
        });
      }
    }

    return entries;
  } catch (error) {
    logger.error("Failed to get test session history", { userId, error });
    throw error;
  }
}

/**
 * Get a specific historical session by ID
 */
export async function getHistoricalSession(
  sessionId: string
): Promise<TestSession | null> {
  try {
    const sessionKey = getHistoricalSessionKey(sessionId);
    const data = await redis.get<string>(sessionKey);

    if (!data) return null;

    return typeof data === "string" ? JSON.parse(data) : data;
  } catch (error) {
    logger.error("Failed to get historical session", { sessionId, error });
    throw error;
  }
}

// ===========================================
// Summary Generation
// ===========================================

/**
 * Generate session summary from completed session
 */
export function generateSessionSummary(session: TestSession): TestSessionSummary {
  const startTime = new Date(session.startedAt).getTime();
  const endTime = session.completedAt
    ? new Date(session.completedAt).getTime()
    : Date.now();
  const durationMinutes = Math.round((endTime - startTime) / 60000);

  const correct: TestSessionSummary["correct"] = [];
  const incorrect: TestSessionSummary["incorrect"] = [];
  const partial: TestSessionSummary["partial"] = [];

  for (const result of session.results) {
    const question = session.questions.find(q => q.questionId === result.questionId);
    if (!question) continue;

    const entry = {
      conceptId: question.conceptId,
      conceptLabel: question.conceptLabel,
      masteryBefore: result.previousMastery,
      masteryAfter: result.newMastery,
      feedback: result.feedback,
    };

    switch (result.evaluation) {
      case "correct":
        correct.push({
          conceptId: entry.conceptId,
          conceptLabel: entry.conceptLabel,
          masteryBefore: entry.masteryBefore,
          masteryAfter: entry.masteryAfter,
        });
        break;
      case "incorrect":
        incorrect.push(entry);
        break;
      case "partial":
        partial.push(entry);
        break;
    }
  }

  // Generate recommendations
  const recommendations: string[] = [];
  const conceptsToReview: string[] = [];

  if (incorrect.length > 0) {
    conceptsToReview.push(...incorrect.map(i => i.conceptId));
    recommendations.push(
      `Review these concepts you struggled with: ${incorrect.map(i => i.conceptLabel).join(", ")}`
    );
  }

  if (partial.length > 0) {
    conceptsToReview.push(...partial.map(p => p.conceptId));
    recommendations.push(
      `Strengthen your understanding of: ${partial.map(p => p.conceptLabel).join(", ")}`
    );
  }

  if (session.score >= 90) {
    recommendations.push("Excellent work! Consider exploring more advanced topics.");
  } else if (session.score >= 70) {
    recommendations.push("Good progress! A few more review sessions will help solidify your knowledge.");
  } else if (session.score >= 50) {
    recommendations.push("Keep practicing! Focus on the weak areas identified above.");
  } else {
    recommendations.push("Consider reviewing the fundamentals before moving on to new topics.");
  }

  return {
    sessionId: session.sessionId,
    userId: session.userId,
    duration: durationMinutes,
    questionsAnswered: session.results.length,
    score: session.score,
    correct,
    incorrect,
    partial,
    recommendations,
    conceptsToReview: [...new Set(conceptsToReview)], // Dedupe
  };
}

// ===========================================
// Utility Functions
// ===========================================

/**
 * Check if user has an active test session
 */
export async function hasActiveTestSession(userId: string): Promise<boolean> {
  const session = await getActiveTestSession(userId);
  return session !== null;
}

/**
 * Get current question in session
 */
export async function getCurrentQuestion(
  userId: string
): Promise<TestQuestion | null> {
  const session = await getActiveTestSession(userId);
  if (!session) return null;

  if (session.currentIndex >= session.questions.length) {
    return null; // No more questions
  }

  return session.questions[session.currentIndex] || null;
}

/**
 * Get session progress information
 */
export async function getSessionProgress(userId: string): Promise<{
  current: number;
  total: number;
  score: number;
  remaining: number;
} | null> {
  const session = await getActiveTestSession(userId);
  if (!session) return null;

  return {
    current: session.currentIndex + 1,
    total: session.targetQuestionCount,
    score: session.score,
    remaining: session.targetQuestionCount - session.results.length,
  };
}

/**
 * Check if session is complete (all questions answered)
 */
export async function isSessionComplete(userId: string): Promise<boolean> {
  const session = await getActiveTestSession(userId);
  if (!session) return false;

  return session.results.length >= session.targetQuestionCount;
}
