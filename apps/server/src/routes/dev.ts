// ** import types
import type { Context } from "hono";

// ** import lib
import { Hono } from "hono";

// ** import utils
import { flushRedis } from "@repo/storage";
import { logger } from "@repo/logs";

const devRoute = new Hono();

/**
 * GET /api/dev/flush-redis
 * Completely wipes the Redis database.
 * ONLY WORKS IN DEVELOPMENT MODE.
 */
devRoute.get("/flush-redis", async (c: Context) => {
  // Security check for development environment
  if (process.env.NODE_ENV !== "development") {
    logger.warn("Attempted to flush Redis in non-dev environment");
    return c.json({ error: "Forbidden: This endpoint is only available in development mode" }, 403);
  }

  try {
    logger.info("Dev request: Flushing Redis");

    await flushRedis();

    return c.json({
      success: true,
      message: "Redis database flushed successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Failed to flush Redis via dev endpoint", error);
    return c.json(
      {
        error: "Failed to flush Redis",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export { devRoute };
