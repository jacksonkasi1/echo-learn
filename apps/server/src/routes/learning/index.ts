// ** Learning Analytics API Routes for Echo-Learn
// ** Provides endpoints for mastery visualization and learning insights

// ** import types
import type { Context } from "hono";

// ** import lib
import { Hono } from "hono";

// ** import storage
import {
  getMasterySummary,
  getAllMastery,
  getWeakestConcepts,
  getStrongestConcepts,
  getConceptsDueForReview,
  getLearningPath,
  getKnowledgeGraph,
} from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

const learningRoute = new Hono();

/**
 * GET /learning/mastery-map
 * Returns mastery data formatted for graph visualization
 */
learningRoute.get("/mastery-map", async (c: Context) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    // Get knowledge graph and mastery data
    const [graph, masteryData] = await Promise.all([
      getKnowledgeGraph(userId),
      getAllMastery(userId),
    ]);

    // Create mastery lookup map
    const masteryMap = new Map(
      masteryData.map((m) => [m.conceptId, m])
    );

    // Transform nodes with mastery data for visualization
    const nodes = graph.nodes.map((node) => {
      const mastery = masteryMap.get(node.id);
      const effectiveMastery = mastery?.effectiveMastery ?? 0;

      // Determine color based on mastery
      let color: string;
      if (effectiveMastery >= 0.8) {
        color = "#22c55e"; // green
      } else if (effectiveMastery >= 0.5) {
        color = "#eab308"; // yellow
      } else if (effectiveMastery >= 0.3) {
        color = "#f97316"; // orange
      } else {
        color = "#ef4444"; // red
      }

      return {
        id: node.id,
        label: node.label,
        type: node.type,
        mastery: effectiveMastery,
        rawMastery: mastery?.masteryScore ?? 0,
        isDueForReview: mastery?.isDueForReview ?? false,
        daysSinceInteraction: mastery?.daysSinceInteraction ?? null,
        color,
        size: (mastery?.confidence ?? 0.3) * 30 + 10, // Size based on confidence
      };
    });

    // Transform edges
    const edges = graph.edges.map((edge) => ({
      id: `${edge.source}-${edge.target}`,
      source: edge.source,
      target: edge.target,
      relation: edge.relation,
      learningRelation: edge.learningRelation,
    }));

    logger.info("Mastery map retrieved", {
      userId,
      nodeCount: nodes.length,
      edgeCount: edges.length,
    });

    return c.json({
      nodes,
      edges,
      stats: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        averageMastery:
          nodes.length > 0
            ? nodes.reduce((sum, n) => sum + n.mastery, 0) / nodes.length
            : 0,
      },
    });
  } catch (error) {
    logger.error("Failed to get mastery map", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to retrieve mastery map" }, 500);
  }
});

/**
 * GET /learning/due-reviews
 * Returns concepts due for review (spaced repetition)
 */
learningRoute.get("/due-reviews", async (c: Context) => {
  const userId = c.req.query("userId");
  const limit = parseInt(c.req.query("limit") || "10", 10);

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const dueForReview = await getConceptsDueForReview(userId, limit);

    // Categorize by urgency
    const today: typeof dueForReview = [];
    const thisWeek: typeof dueForReview = [];
    const overdue: typeof dueForReview = [];

    const now = new Date();

    for (const concept of dueForReview) {
      const reviewDate = new Date(concept.nextReviewDate);
      const daysOverdue = Math.floor(
        (now.getTime() - reviewDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysOverdue > 7) {
        overdue.push(concept);
      } else if (daysOverdue > 0) {
        thisWeek.push(concept);
      } else {
        today.push(concept);
      }
    }

    logger.info("Due reviews retrieved", {
      userId,
      total: dueForReview.length,
      overdue: overdue.length,
      thisWeek: thisWeek.length,
      today: today.length,
    });

    return c.json({
      total: dueForReview.length,
      overdue: overdue.map((c) => ({
        conceptId: c.conceptId,
        conceptLabel: c.conceptLabel,
        mastery: c.effectiveMastery,
        daysSinceInteraction: c.daysSinceInteraction,
        nextReviewDate: c.nextReviewDate,
      })),
      thisWeek: thisWeek.map((c) => ({
        conceptId: c.conceptId,
        conceptLabel: c.conceptLabel,
        mastery: c.effectiveMastery,
        daysSinceInteraction: c.daysSinceInteraction,
        nextReviewDate: c.nextReviewDate,
      })),
      today: today.map((c) => ({
        conceptId: c.conceptId,
        conceptLabel: c.conceptLabel,
        mastery: c.effectiveMastery,
        daysSinceInteraction: c.daysSinceInteraction,
        nextReviewDate: c.nextReviewDate,
      })),
    });
  } catch (error) {
    logger.error("Failed to get due reviews", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to retrieve due reviews" }, 500);
  }
});

/**
 * GET /learning/analytics
 * Returns comprehensive learning analytics
 */
learningRoute.get("/analytics", async (c: Context) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const [summary, weakest, strongest, dueForReview] = await Promise.all([
      getMasterySummary(userId),
      getWeakestConcepts(userId, 5),
      getStrongestConcepts(userId, 5),
      getConceptsDueForReview(userId, 10),
    ]);

    logger.info("Learning analytics retrieved", {
      userId,
      totalConcepts: summary.totalConcepts,
      averageMastery: summary.averageMastery,
    });

    return c.json({
      summary: {
        totalConcepts: summary.totalConcepts,
        masteredConcepts: summary.masteredConcepts,
        learningConcepts: summary.learningConcepts,
        weakConcepts: summary.weakConcepts,
        averageMastery: summary.averageMastery,
        conceptsDueForReview: summary.conceptsDueForReview,
      },
      strengths: strongest.map((c) => ({
        conceptId: c.conceptId,
        conceptLabel: c.conceptLabel,
        mastery: c.effectiveMastery,
        streak: c.streakCorrect,
      })),
      weaknesses: weakest.map((c) => ({
        conceptId: c.conceptId,
        conceptLabel: c.conceptLabel,
        mastery: c.effectiveMastery,
        totalAttempts: c.totalAttempts,
      })),
      upcomingReviews: dueForReview.slice(0, 5).map((c) => ({
        conceptId: c.conceptId,
        conceptLabel: c.conceptLabel,
        mastery: c.effectiveMastery,
        nextReviewDate: c.nextReviewDate,
      })),
      lastUpdated: summary.lastUpdated,
    });
  } catch (error) {
    logger.error("Failed to get learning analytics", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to retrieve analytics" }, 500);
  }
});

/**
 * GET /learning/recommendations
 * Returns personalized learning recommendations
 */
learningRoute.get("/recommendations", async (c: Context) => {
  const userId = c.req.query("userId");
  const targetConcept = c.req.query("target");
  const limit = parseInt(c.req.query("limit") || "5", 10);

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const learningPath = await getLearningPath(
      userId,
      targetConcept,
      limit
    );

    logger.info("Learning recommendations generated", {
      userId,
      targetConcept,
      recommendationsCount: learningPath.length,
    });

    return c.json({
      recommendations: learningPath.map((suggestion) => ({
        conceptId: suggestion.conceptId,
        conceptLabel: suggestion.conceptLabel,
        currentMastery: suggestion.currentMastery,
        reason: suggestion.reason,
        priority: suggestion.priority,
        action:
          suggestion.currentMastery < 0.3
            ? "learn"
            : suggestion.currentMastery < 0.6
              ? "practice"
              : "review",
      })),
      target: targetConcept || null,
    });
  } catch (error) {
    logger.error("Failed to get recommendations", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to retrieve recommendations" }, 500);
  }
});

/**
 * GET /learning/summary
 * Returns a quick summary of user's learning state
 */
learningRoute.get("/summary", async (c: Context) => {
  const userId = c.req.query("userId");

  if (!userId) {
    return c.json({ error: "userId is required" }, 400);
  }

  try {
    const summary = await getMasterySummary(userId);

    return c.json({
      totalConcepts: summary.totalConcepts,
      masteredConcepts: summary.masteredConcepts,
      learningConcepts: summary.learningConcepts,
      weakConcepts: summary.weakConcepts,
      averageMastery: Math.round(summary.averageMastery * 100),
      conceptsDueForReview: summary.conceptsDueForReview,
      lastUpdated: summary.lastUpdated,
    });
  } catch (error) {
    logger.error("Failed to get learning summary", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return c.json({ error: "Failed to retrieve summary" }, 500);
  }
});

export { learningRoute };
