// ** import types
import type { Context } from "hono";

// ** import lib
import { Hono } from "hono";

// ** import utils
import {
  getUserProfile,
  updateUserProfile,
  getKnowledgeGraph,
} from "@/lib/upstash/redis";
import {
  getGraphStats,
  searchNodes,
} from "@/lib/graph/graph-merger";
import { getAnalyticsSummary } from "@/lib/analytics/update-analytics";
import { logger } from "@repo/logs";

const usersRoute = new Hono();

/**
 * GET /api/users/:userId/profile
 * Get user profile
 */
usersRoute.get("/:userId/profile", async (c: Context) => {
  try {
    const userId = c.req.param("userId");

    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    logger.info("Getting user profile", { userId });

    const profile = await getUserProfile(userId);

    return c.json(profile);
  } catch (error) {
    logger.error("Failed to get user profile", error);
    return c.json(
      {
        error: "Failed to get user profile",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * PATCH /api/users/:userId/profile
 * Update user profile
 */
usersRoute.patch("/:userId/profile", async (c: Context) => {
  try {
    const userId = c.req.param("userId");
    const updates = await c.req.json();

    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    logger.info("Updating user profile", { userId });

    const profile = await updateUserProfile(userId, updates);

    return c.json(profile);
  } catch (error) {
    logger.error("Failed to update user profile", error);
    return c.json(
      {
        error: "Failed to update user profile",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * GET /api/users/:userId/analytics
 * Get user analytics summary
 */
usersRoute.get("/:userId/analytics", async (c: Context) => {
  try {
    const userId = c.req.param("userId");

    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    logger.info("Getting user analytics", { userId });

    const analytics = await getAnalyticsSummary(userId);

    return c.json(analytics);
  } catch (error) {
    logger.error("Failed to get user analytics", error);
    return c.json(
      {
        error: "Failed to get user analytics",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * GET /api/users/:userId/graph
 * Get user's knowledge graph
 */
usersRoute.get("/:userId/graph", async (c: Context) => {
  try {
    const userId = c.req.param("userId");

    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    logger.info("Getting user knowledge graph", { userId });

    const graph = await getKnowledgeGraph(userId);

    return c.json(graph);
  } catch (error) {
    logger.error("Failed to get user knowledge graph", error);
    return c.json(
      {
        error: "Failed to get user knowledge graph",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * GET /api/users/:userId/graph/stats
 * Get user's knowledge graph statistics
 */
usersRoute.get("/:userId/graph/stats", async (c: Context) => {
  try {
    const userId = c.req.param("userId");

    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    logger.info("Getting user graph stats", { userId });

    const stats = await getGraphStats(userId);

    return c.json(stats);
  } catch (error) {
    logger.error("Failed to get user graph stats", error);
    return c.json(
      {
        error: "Failed to get user graph stats",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

/**
 * GET /api/users/:userId/graph/search
 * Search nodes in user's knowledge graph
 */
usersRoute.get("/:userId/graph/search", async (c: Context) => {
  try {
    const userId = c.req.param("userId");
    const query = c.req.query("q");
    const limit = parseInt(c.req.query("limit") || "10", 10);

    if (!userId) {
      return c.json({ error: "User ID is required" }, 400);
    }

    if (!query) {
      return c.json({ error: "Search query (q) is required" }, 400);
    }

    logger.info("Searching user graph", { userId, query, limit });

    const results = await searchNodes(userId, query, limit);

    return c.json({ results });
  } catch (error) {
    logger.error("Failed to search user graph", error);
    return c.json(
      {
        error: "Failed to search graph",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});

export { usersRoute };
