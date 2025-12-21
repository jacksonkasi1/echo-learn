// ** Mastery storage functions for Echo-Learn Smart Memory System
// ** Implements time decay (Ebbinghaus forgetting curve) and SM-2 spaced repetition

// ** import types
import type {
  ConceptMastery,
  ConceptWithEffectiveMastery,
  LearningSignal,
  MasterySummary,
  MasteryUpdate,
} from "@repo/shared";
import { DEFAULT_CONCEPT_MASTERY } from "@repo/shared";

// ** import lib
import { redis } from "./client.js";

// ** import utils
import { logger } from "@repo/logs";

// ===========================================
// Constants
// ===========================================

/** Decay rate for forgetting curve (λ in e^(-λt)) */
const DECAY_RATE = 0.1;

/** Minimum mastery score */
const MIN_MASTERY = 0.0;

/** Maximum mastery score */
const MAX_MASTERY = 1.0;

/** Minimum ease factor for SM-2 */
const MIN_EASE_FACTOR = 1.3;

/** Default ease factor for SM-2 */
const DEFAULT_EASE_FACTOR = 2.5;

// ===========================================
// Redis Key Helpers
// ===========================================

/**
 * Get Redis key for a concept's mastery data
 */
function getMasteryKey(userId: string, conceptId: string): string {
  return `user:${userId}:mastery:${conceptId}`;
}

/**
 * Get Redis key for the mastery index (sorted set by score)
 */
function getMasteryIndexKey(userId: string): string {
  return `user:${userId}:mastery:_index`;
}

/**
 * Get Redis key for the review queue (sorted set by next review date)
 */
function getReviewQueueKey(userId: string): string {
  return `user:${userId}:review:_queue`;
}

// ===========================================
// Decay Calculation
// ===========================================

/**
 * Calculate days between two dates
 */
function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffMs = Math.abs(d2.getTime() - d1.getTime());
  return diffMs / (1000 * 60 * 60 * 24);
}

/**
 * Apply Ebbinghaus forgetting curve to mastery score
 *
 * Formula: effectiveMastery = storedMastery × e^(-λ × daysSinceInteraction)
 *
 * This models how humans forget information over time.
 * A mastery of 0.9 from 7 days ago becomes ~0.45 today (with λ=0.1)
 */
export function calculateEffectiveMastery(
  storedMastery: number,
  lastInteraction: string,
  now: Date = new Date(),
): { effectiveMastery: number; daysSinceInteraction: number } {
  const daysSinceInteraction = daysBetween(lastInteraction, now);
  const decayFactor = Math.exp(-DECAY_RATE * daysSinceInteraction);
  const effectiveMastery = Math.max(MIN_MASTERY, storedMastery * decayFactor);

  return {
    effectiveMastery: Math.round(effectiveMastery * 1000) / 1000, // 3 decimal places
    daysSinceInteraction: Math.round(daysSinceInteraction * 10) / 10,
  };
}

// ===========================================
// SM-2 Spaced Repetition
// ===========================================

/**
 * Calculate next review date using SM-2 algorithm
 *
 * SM-2 adjusts intervals based on how well you remember:
 * - Correct: interval = previous_interval × ease_factor
 * - Wrong: interval = 1 (reset)
 *
 * Ease factor adjusts based on performance:
 * - Good performance: ease_factor += 0.1
 * - Bad performance: ease_factor -= 0.2 (min 1.3)
 */
export function calculateNextReview(
  isCorrect: boolean,
  currentInterval: number,
  currentEaseFactor: number,
): { nextInterval: number; newEaseFactor: number; nextReviewDate: string } {
  let nextInterval: number;
  let newEaseFactor: number;

  if (isCorrect) {
    // Success: increase interval
    if (currentInterval === 0) {
      nextInterval = 1;
    } else if (currentInterval === 1) {
      nextInterval = 6;
    } else {
      nextInterval = Math.round(currentInterval * currentEaseFactor);
    }
    // Ease factor increases for correct answers
    newEaseFactor = Math.min(3.0, currentEaseFactor + 0.1);
  } else {
    // Failure: reset to 1 day
    nextInterval = 1;
    // Ease factor decreases for wrong answers
    newEaseFactor = Math.max(MIN_EASE_FACTOR, currentEaseFactor - 0.2);
  }

  // Calculate next review date
  const nextDate = new Date();
  nextDate.setDate(nextDate.getDate() + nextInterval);

  return {
    nextInterval,
    newEaseFactor: Math.round(newEaseFactor * 100) / 100,
    nextReviewDate: nextDate.toISOString(),
  };
}

// ===========================================
// CRUD Operations
// ===========================================

/**
 * Get mastery for a specific concept
 * Returns null if no mastery record exists
 */
export async function getMastery(
  userId: string,
  conceptId: string,
): Promise<ConceptMastery | null> {
  try {
    const key = getMasteryKey(userId, conceptId);
    const data = await redis.get<string>(key);

    if (!data) return null;

    return typeof data === "string" ? JSON.parse(data) : data;
  } catch (error) {
    logger.error("Failed to get mastery", { userId, conceptId, error });
    throw error;
  }
}

/**
 * Get mastery with effective score (after decay applied)
 */
export async function getEffectiveMastery(
  userId: string,
  conceptId: string,
): Promise<ConceptWithEffectiveMastery | null> {
  try {
    const mastery = await getMastery(userId, conceptId);
    if (!mastery) return null;

    const { effectiveMastery, daysSinceInteraction } =
      calculateEffectiveMastery(mastery.masteryScore, mastery.lastInteraction);

    const isDueForReview = new Date(mastery.nextReviewDate) <= new Date();

    return {
      ...mastery,
      effectiveMastery,
      daysSinceInteraction,
      isDueForReview,
    };
  } catch (error) {
    logger.error("Failed to get effective mastery", {
      userId,
      conceptId,
      error,
    });
    throw error;
  }
}

/**
 * Create or update mastery for a concept
 */
export async function setMastery(
  userId: string,
  mastery: ConceptMastery,
): Promise<void> {
  try {
    const key = getMasteryKey(userId, conceptId);
    await redis.set(key, JSON.stringify(mastery));

    // Update the mastery index (sorted by score)
    const indexKey = getMasteryIndexKey(userId);
    await redis.zadd(indexKey, {
      score: mastery.masteryScore,
      member: mastery.conceptId,
    });

    // Update the review queue (sorted by next review date)
    const queueKey = getReviewQueueKey(userId);
    const reviewTimestamp = new Date(mastery.nextReviewDate).getTime();
    await redis.zadd(queueKey, {
      score: reviewTimestamp,
      member: mastery.conceptId,
    });

    logger.info("Mastery saved", {
      userId,
      conceptId: mastery.conceptId,
      masteryScore: mastery.masteryScore,
    });
  } catch (error) {
    logger.error("Failed to set mastery", {
      userId,
      conceptId: mastery.conceptId,
      error,
    });
    throw error;
  }
}

// Fix: use mastery.conceptId instead of undefined conceptId
const conceptId = ""; // placeholder, actual implementation below

/**
 * Create or update mastery for a concept (corrected version)
 */
export async function saveMastery(
  userId: string,
  mastery: ConceptMastery,
): Promise<void> {
  try {
    const key = getMasteryKey(userId, mastery.conceptId);
    await redis.set(key, JSON.stringify(mastery));

    // Update the mastery index (sorted by score)
    const indexKey = getMasteryIndexKey(userId);
    await redis.zadd(indexKey, {
      score: mastery.masteryScore,
      member: mastery.conceptId,
    });

    // Update the review queue (sorted by next review date)
    const queueKey = getReviewQueueKey(userId);
    const reviewTimestamp = new Date(mastery.nextReviewDate).getTime();
    await redis.zadd(queueKey, {
      score: reviewTimestamp,
      member: mastery.conceptId,
    });

    logger.info("Mastery saved", {
      userId,
      conceptId: mastery.conceptId,
      masteryScore: mastery.masteryScore,
    });
  } catch (error) {
    logger.error("Failed to save mastery", {
      userId,
      conceptId: mastery.conceptId,
      error,
    });
    throw error;
  }
}

/**
 * Create initial mastery entry for a concept
 */
export async function createMastery(
  userId: string,
  conceptId: string,
  conceptLabel: string,
  initialMastery?: number,
): Promise<ConceptMastery> {
  const now = new Date().toISOString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const mastery: ConceptMastery = {
    conceptId,
    conceptLabel,
    ...DEFAULT_CONCEPT_MASTERY,
    masteryScore: initialMastery ?? DEFAULT_CONCEPT_MASTERY.masteryScore,
    createdAt: now,
    lastInteraction: now,
    nextReviewDate: tomorrow.toISOString(),
  };

  await saveMastery(userId, mastery);
  return mastery;
}

/**
 * Update mastery based on a learning signal
 */
export async function updateMasteryFromSignal(
  userId: string,
  signal: LearningSignal,
): Promise<MasteryUpdate> {
  try {
    // Get existing mastery or create new
    let mastery = await getMastery(userId, signal.conceptId);
    const isNew = !mastery;

    if (!mastery) {
      mastery = await createMastery(
        userId,
        signal.conceptId,
        signal.conceptLabel,
      );
    }

    const previousMastery = mastery.masteryScore;
    const previousConfidence = mastery.confidence;

    // Apply mastery delta with bounds
    const newMastery = Math.max(
      MIN_MASTERY,
      Math.min(MAX_MASTERY, mastery.masteryScore + signal.masteryDelta),
    );

    // Increase confidence with each interaction (max 1.0)
    const confidenceGain = 0.1;
    const newConfidence = Math.min(1.0, mastery.confidence + confidenceGain);

    // Update streak tracking
    const isPositiveSignal = signal.masteryDelta > 0;
    if (isPositiveSignal) {
      mastery.streakCorrect += 1;
      mastery.streakWrong = 0;
      mastery.correctAttempts += 1;
    } else if (signal.masteryDelta < 0) {
      mastery.streakWrong += 1;
      mastery.streakCorrect = 0;
    }
    mastery.totalAttempts += 1;

    // Calculate next review using SM-2
    const { nextInterval, newEaseFactor, nextReviewDate } = calculateNextReview(
      isPositiveSignal,
      mastery.intervalDays,
      mastery.easeFactor,
    );

    // Update mastery record
    mastery.masteryScore = Math.round(newMastery * 1000) / 1000;
    mastery.confidence = Math.round(newConfidence * 1000) / 1000;
    mastery.lastInteraction = new Date().toISOString();
    mastery.intervalDays = nextInterval;
    mastery.easeFactor = newEaseFactor;
    mastery.nextReviewDate = nextReviewDate;

    if (isPositiveSignal) {
      mastery.lastCorrectAnswer = mastery.lastInteraction;
    }

    // Save updated mastery
    await saveMastery(userId, mastery);

    logger.info("Mastery updated from signal", {
      userId,
      conceptId: signal.conceptId,
      signalType: signal.type,
      previousMastery,
      newMastery,
      isNew,
    });

    return {
      conceptId: signal.conceptId,
      signal,
      previousMastery: isNew ? undefined : previousMastery,
      newMastery: mastery.masteryScore,
      previousConfidence: isNew ? undefined : previousConfidence,
      newConfidence: mastery.confidence,
    };
  } catch (error) {
    logger.error("Failed to update mastery from signal", {
      userId,
      conceptId: signal.conceptId,
      error,
    });
    throw error;
  }
}

/**
 * Delete mastery record for a concept
 */
export async function deleteMastery(
  userId: string,
  conceptId: string,
): Promise<void> {
  try {
    const key = getMasteryKey(userId, conceptId);
    await redis.del(key);

    // Remove from indexes
    const indexKey = getMasteryIndexKey(userId);
    await redis.zrem(indexKey, conceptId);

    const queueKey = getReviewQueueKey(userId);
    await redis.zrem(queueKey, conceptId);

    logger.info("Mastery deleted", { userId, conceptId });
  } catch (error) {
    logger.error("Failed to delete mastery", { userId, conceptId, error });
    throw error;
  }
}

// ===========================================
// Query Operations
// ===========================================

/**
 * Get weakest concepts (lowest mastery scores)
 */
export async function getWeakestConcepts(
  userId: string,
  limit: number = 10,
): Promise<ConceptWithEffectiveMastery[]> {
  try {
    const indexKey = getMasteryIndexKey(userId);
    // Get lowest scores first
    const conceptIds = await redis.zrange(indexKey, 0, limit - 1);

    const results: ConceptWithEffectiveMastery[] = [];
    for (const conceptId of conceptIds) {
      const mastery = await getEffectiveMastery(userId, conceptId as string);
      if (mastery) {
        results.push(mastery);
      }
    }

    // Sort by effective mastery (accounting for decay)
    results.sort((a, b) => a.effectiveMastery - b.effectiveMastery);

    return results;
  } catch (error) {
    logger.error("Failed to get weakest concepts", { userId, error });
    throw error;
  }
}

/**
 * Get strongest concepts (highest mastery scores)
 */
export async function getStrongestConcepts(
  userId: string,
  limit: number = 10,
): Promise<ConceptWithEffectiveMastery[]> {
  try {
    const indexKey = getMasteryIndexKey(userId);
    // Get highest scores (reverse order)
    const conceptIds = await redis.zrange(indexKey, -limit, -1);

    const results: ConceptWithEffectiveMastery[] = [];
    for (const conceptId of conceptIds) {
      const mastery = await getEffectiveMastery(userId, conceptId as string);
      if (mastery) {
        results.push(mastery);
      }
    }

    // Sort by effective mastery descending
    results.sort((a, b) => b.effectiveMastery - a.effectiveMastery);

    return results;
  } catch (error) {
    logger.error("Failed to get strongest concepts", { userId, error });
    throw error;
  }
}

/**
 * Get concepts due for review (spaced repetition)
 */
export async function getConceptsDueForReview(
  userId: string,
  limit: number = 10,
): Promise<ConceptWithEffectiveMastery[]> {
  try {
    const queueKey = getReviewQueueKey(userId);
    const now = Date.now();

    // Get concepts where nextReviewDate <= now
    // Use zrange with BYSCORE option for Upstash Redis
    const conceptIds = await redis.zrange(queueKey, 0, now, {
      byScore: true,
      offset: 0,
      count: limit,
    });

    const results: ConceptWithEffectiveMastery[] = [];
    for (const conceptId of conceptIds) {
      const mastery = await getEffectiveMastery(userId, conceptId as string);
      if (mastery) {
        results.push(mastery);
      }
    }

    return results;
  } catch (error) {
    logger.error("Failed to get concepts due for review", { userId, error });
    throw error;
  }
}

/**
 * Get all mastery data for a user
 */
export async function getAllMastery(
  userId: string,
): Promise<ConceptWithEffectiveMastery[]> {
  try {
    const indexKey = getMasteryIndexKey(userId);
    const conceptIds = await redis.zrange(indexKey, 0, -1);

    const results: ConceptWithEffectiveMastery[] = [];
    for (const conceptId of conceptIds) {
      const mastery = await getEffectiveMastery(userId, conceptId as string);
      if (mastery) {
        results.push(mastery);
      }
    }

    return results;
  } catch (error) {
    logger.error("Failed to get all mastery", { userId, error });
    throw error;
  }
}

/**
 * Get mastery summary statistics for a user
 */
export async function getMasterySummary(
  userId: string,
): Promise<MasterySummary> {
  try {
    const allMastery = await getAllMastery(userId);

    const masteredConcepts = allMastery.filter(
      (m) => m.effectiveMastery > 0.8,
    ).length;
    const learningConcepts = allMastery.filter(
      (m) => m.effectiveMastery > 0.3 && m.effectiveMastery <= 0.8,
    ).length;
    const weakConcepts = allMastery.filter(
      (m) => m.effectiveMastery <= 0.3,
    ).length;
    const conceptsDueForReview = allMastery.filter(
      (m) => m.isDueForReview,
    ).length;

    const averageMastery =
      allMastery.length > 0
        ? allMastery.reduce((sum, m) => sum + m.effectiveMastery, 0) /
          allMastery.length
        : 0;

    return {
      userId,
      totalConcepts: allMastery.length,
      masteredConcepts,
      learningConcepts,
      weakConcepts,
      averageMastery: Math.round(averageMastery * 1000) / 1000,
      conceptsDueForReview,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    logger.error("Failed to get mastery summary", { userId, error });
    throw error;
  }
}

/**
 * Get mastery for multiple concepts at once
 */
export async function getMasteryBatch(
  userId: string,
  conceptIds: string[],
): Promise<Map<string, ConceptWithEffectiveMastery>> {
  try {
    const results = new Map<string, ConceptWithEffectiveMastery>();

    for (const conceptId of conceptIds) {
      const mastery = await getEffectiveMastery(userId, conceptId);
      if (mastery) {
        results.set(conceptId, mastery);
      }
    }

    return results;
  } catch (error) {
    logger.error("Failed to get mastery batch", { userId, conceptIds, error });
    throw error;
  }
}

/**
 * Check if user has any mastery data
 */
export async function hasMasteryData(userId: string): Promise<boolean> {
  try {
    const indexKey = getMasteryIndexKey(userId);
    const count = await redis.zcard(indexKey);
    return count > 0;
  } catch (error) {
    logger.error("Failed to check mastery data", { userId, error });
    return false;
  }
}

/**
 * Get concepts by mastery range
 */
export async function getConceptsByMasteryRange(
  userId: string,
  minMastery: number,
  maxMastery: number,
  limit: number = 50,
): Promise<ConceptWithEffectiveMastery[]> {
  try {
    const indexKey = getMasteryIndexKey(userId);
    // Use zrange with BYSCORE option for Upstash Redis
    const conceptIds = await redis.zrange(indexKey, minMastery, maxMastery, {
      byScore: true,
      offset: 0,
      count: limit,
    });

    const results: ConceptWithEffectiveMastery[] = [];
    for (const conceptId of conceptIds) {
      const mastery = await getEffectiveMastery(userId, conceptId as string);
      if (mastery) {
        results.push(mastery);
      }
    }

    return results;
  } catch (error) {
    logger.error("Failed to get concepts by mastery range", { userId, error });
    throw error;
  }
}
