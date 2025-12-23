// ** Test Mode API Routes for Echo-Learn
// ** Manages test sessions, configuration, and results

// ** import types
import type { Context } from "hono";
import type { CreateTestSessionInput } from "@repo/shared";
import { SKILL_LEVEL_DIFFICULTY_MAP } from "@repo/shared";

// ** import lib
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// ** import storage
import {
  createTestSession,
  getActiveTestSession,
  completeTestSession,
  abandonTestSession,
  getTestSessionHistory,
  getSessionProgress,
} from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

const testRoute = new Hono();

// ===========================================
// Validation Schemas
// ===========================================

const startTestSchema = z.object({
  userId: z.string().min(1),
  config: z.object({
    skillLevel: z.enum(["beginner", "intermediate", "pro"]),
    questionStyle: z.enum(["scenario", "concept", "mixed"]),
    questionCount: z.number().int().min(1).max(50),
    timingMode: z.enum(["timed", "untimed"]),
    timePerQuestion: z.number().int().min(10).max(300).optional(),
    totalTimeLimit: z.number().int().min(1).max(180).optional(),
    focusConceptIds: z.array(z.string()).optional(),
  }),
});

const userIdSchema = z.object({
  userId: z.string().min(1),
});

// ===========================================
// Routes
// ===========================================

/**
 * POST /learning/test/start
 * Start a new test session with configuration
 */
testRoute.post(
  "/start",
  zValidator("json", startTestSchema),
  async (c: Context) => {
    try {
      const body = c.req.valid("json" as never) as z.infer<
        typeof startTestSchema
      >;
      const { userId, config } = body;

      logger.info("Starting test session", {
        userId,
        skillLevel: config.skillLevel,
        questionStyle: config.questionStyle,
        questionCount: config.questionCount,
      });

      // Map skill level to difficulty
      const difficulty = SKILL_LEVEL_DIFFICULTY_MAP[config.skillLevel];

      // Create session input
      const sessionInput: CreateTestSessionInput = {
        userId,
        targetQuestionCount: config.questionCount,
        difficulty: difficulty,
        focusConceptIds: config.focusConceptIds,
      };

      // Create the session
      const session = await createTestSession(sessionInput);

      // Enhance session with full config for frontend
      const enhancedSession = {
        ...session,
        config,
      };

      logger.info("Test session created", {
        userId,
        sessionId: session.sessionId,
        targetQuestionCount: session.targetQuestionCount,
      });

      return c.json({
        success: true,
        session: enhancedSession,
      });
    } catch (error) {
      logger.error("Failed to start test session", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to start test session",
        },
        500,
      );
    }
  },
);

/**
 * GET /learning/test/session
 * Get active test session for a user
 */
testRoute.get("/session", async (c: Context) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const session = await getActiveTestSession(userId);

    if (!session) {
      return c.json({
        success: true,
        hasActiveSession: false,
        session: null,
      });
    }

    const progress = await getSessionProgress(userId);

    return c.json({
      success: true,
      hasActiveSession: true,
      session,
      progress,
    });
  } catch (error) {
    logger.error("Failed to get test session", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get test session",
      },
      500,
    );
  }
});

/**
 * POST /learning/test/complete
 * Complete the active test session and get summary
 */
testRoute.post(
  "/complete",
  zValidator("json", userIdSchema),
  async (c: Context) => {
    try {
      const { userId } = c.req.valid("json" as never) as z.infer<
        typeof userIdSchema
      >;

      logger.info("Completing test session", { userId });

      const summary = await completeTestSession(userId);

      logger.info("Test session completed", {
        userId,
        sessionId: summary.sessionId,
        score: summary.score,
        questionsAnswered: summary.questionsAnswered,
      });

      return c.json({
        success: true,
        summary,
      });
    } catch (error) {
      logger.error("Failed to complete test session", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to complete test session",
        },
        500,
      );
    }
  },
);

/**
 * POST /learning/test/abandon
 * Abandon the active test session without completing
 */
testRoute.post(
  "/abandon",
  zValidator("json", userIdSchema),
  async (c: Context) => {
    try {
      const { userId } = c.req.valid("json" as never) as z.infer<
        typeof userIdSchema
      >;

      logger.info("Abandoning test session", { userId });

      await abandonTestSession(userId);

      return c.json({
        success: true,
        message: "Test session abandoned",
      });
    } catch (error) {
      logger.error("Failed to abandon test session", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      return c.json(
        {
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Failed to abandon test session",
        },
        500,
      );
    }
  },
);

/**
 * GET /learning/test/history
 * Get test session history for a user
 */
testRoute.get("/history", async (c: Context) => {
  const userId = c.req.query("userId");
  const limit = parseInt(c.req.query("limit") || "20", 10);

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const history = await getTestSessionHistory(userId, limit);

    return c.json({
      success: true,
      history,
      total: history.length,
    });
  } catch (error) {
    logger.error("Failed to get test history", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to get test history",
      },
      500,
    );
  }
});

/**
 * GET /learning/test/progress
 * Get progress of active test session
 */
testRoute.get("/progress", async (c: Context) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const session = await getActiveTestSession(userId);

    if (!session) {
      return c.json({
        success: true,
        hasActiveSession: false,
        progress: null,
      });
    }

    const progress = await getSessionProgress(userId);

    return c.json({
      success: true,
      hasActiveSession: true,
      progress: {
        ...progress,
        correctCount: session.correctCount,
        incorrectCount: session.incorrectCount,
        partialCount: session.partialCount,
      },
    });
  } catch (error) {
    logger.error("Failed to get test progress", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to get test progress",
      },
      500,
    );
  }
});

export { testRoute };
