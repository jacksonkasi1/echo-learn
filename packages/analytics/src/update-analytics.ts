// ** import types
import type { InteractionLog } from "@repo/shared";

// ** import lib
import {
  getUserProfile,
  updateUserProfile,
  markTopicCovered,
  logInteraction,
} from "@repo/storage";
import { extractTopicsFromConversation, type ChatMessage } from "@repo/llm";

// ** import utils
import { logger } from "@repo/logs";

export interface AnalyticsData {
  userId: string;
  query: string;
  response: string;
  retrievedChunks: string[];
  topicsDiscussed?: string[];
  processingTimeMs?: number;
}

export interface SessionAnalytics {
  sessionId: string;
  userId: string;
  startTime: Date;
  messagesCount: number;
  topicsCovered: string[];
  questionsAnswered: number;
}

/**
 * Update user analytics after a conversation turn
 * This includes updating profile, logging interactions, and tracking progress
 */
export async function updateAnalytics(data: AnalyticsData): Promise<void> {
  const {
    userId,
    query,
    response,
    retrievedChunks,
    topicsDiscussed = [],
    processingTimeMs,
  } = data;

  try {
    logger.info("Updating analytics", {
      userId,
      queryLength: query.length,
      responseLength: response.length,
      topicsCount: topicsDiscussed.length,
    });

    // 1. Mark topics as covered
    if (topicsDiscussed.length > 0) {
      for (const topic of topicsDiscussed) {
        await markTopicCovered(userId, topic);
      }
      logger.info("Topics marked as covered", {
        userId,
        topics: topicsDiscussed,
      });
    }

    // 2. Update user profile with interaction count
    const profile = await getUserProfile(userId);
    await updateUserProfile(userId, {
      questionsAnswered: profile.questionsAnswered + 1,
      lastInteraction: new Date().toISOString(),
    });

    // 3. Log the interaction for history
    const interactionLog: InteractionLog = {
      userId,
      timestamp: new Date().toISOString(),
      query,
      response,
      topicsDiscussed,
      retrievedChunks: retrievedChunks.map(
        (chunk) => chunk.slice(0, 200) + (chunk.length > 200 ? "..." : "")
      ),
      responseLength: response.length,
      processingTimeMs,
    };

    await logInteraction(interactionLog);

    logger.info("Analytics updated successfully", {
      userId,
      newQuestionCount: profile.questionsAnswered + 1,
    });
  } catch (error) {
    // Don't throw - analytics should not break the main flow
    logger.error("Failed to update analytics", error);
  }
}

/**
 * Track quiz performance and update weak/strong areas
 */
export async function trackQuizPerformance(
  userId: string,
  topic: string,
  isCorrect: boolean
): Promise<void> {
  try {
    const profile = await getUserProfile(userId);

    if (isCorrect) {
      // Move topic to strong areas if answered correctly multiple times
      const weakIndex = profile.weakAreas.indexOf(topic);
      if (weakIndex > -1) {
        // Remove from weak areas
        profile.weakAreas.splice(weakIndex, 1);
      }

      // Add to strong areas if not already there
      if (!profile.strongAreas.includes(topic)) {
        profile.strongAreas.push(topic);
      }
    } else {
      // Add to weak areas for incorrect answers
      if (!profile.weakAreas.includes(topic)) {
        profile.weakAreas.push(topic);
      }

      // Remove from strong areas if there
      const strongIndex = profile.strongAreas.indexOf(topic);
      if (strongIndex > -1) {
        profile.strongAreas.splice(strongIndex, 1);
      }
    }

    // Keep arrays manageable
    if (profile.weakAreas.length > 20) {
      profile.weakAreas = profile.weakAreas.slice(-20);
    }
    if (profile.strongAreas.length > 20) {
      profile.strongAreas = profile.strongAreas.slice(-20);
    }

    await updateUserProfile(userId, {
      weakAreas: profile.weakAreas,
      strongAreas: profile.strongAreas,
    });

    logger.info("Quiz performance tracked", {
      userId,
      topic,
      isCorrect,
      weakAreasCount: profile.weakAreas.length,
      strongAreasCount: profile.strongAreas.length,
    });
  } catch (error) {
    logger.error("Failed to track quiz performance", error);
  }
}

/**
 * Update user's learning level based on performance
 */
export async function updateLearningLevel(userId: string): Promise<void> {
  try {
    const profile = await getUserProfile(userId);

    // Calculate performance metrics
    const totalTopics = profile.coveredTopics.length;
    const strongCount = profile.strongAreas.length;
    const weakCount = profile.weakAreas.length;
    const questionsAnswered = profile.questionsAnswered;

    // Determine level based on metrics
    let newLevel = profile.level;

    if (
      questionsAnswered >= 100 &&
      strongCount > weakCount * 2 &&
      totalTopics >= 20
    ) {
      newLevel = "expert";
    } else if (
      questionsAnswered >= 50 &&
      strongCount > weakCount &&
      totalTopics >= 10
    ) {
      newLevel = "advanced";
    } else if (questionsAnswered >= 20 && totalTopics >= 5) {
      newLevel = "intermediate";
    } else {
      newLevel = "beginner";
    }

    if (newLevel !== profile.level) {
      await updateUserProfile(userId, { level: newLevel });
      logger.info("User level updated", {
        userId,
        oldLevel: profile.level,
        newLevel,
      });
    }
  } catch (error) {
    logger.error("Failed to update learning level", error);
  }
}

/**
 * Get analytics summary for a user
 */
export async function getAnalyticsSummary(userId: string): Promise<{
  totalQuestions: number;
  topicsCovered: number;
  strongAreas: string[];
  weakAreas: string[];
  level: string;
  lastActive: string | null;
}> {
  try {
    const profile = await getUserProfile(userId);

    return {
      totalQuestions: profile.questionsAnswered,
      topicsCovered: profile.coveredTopics.length,
      strongAreas: profile.strongAreas,
      weakAreas: profile.weakAreas,
      level: profile.level,
      lastActive: profile.lastInteraction || null,
    };
  } catch (error) {
    logger.error("Failed to get analytics summary", error);
    throw error;
  }
}

/**
 * Extract and record topics from conversation messages
 * Used to automatically track what topics were discussed
 */
export async function extractAndRecordTopics(
  userId: string,
  messages: Array<{ role: string; content: string }>
): Promise<string[]> {
  try {
    // Use LLM to extract topics
    const topics = await extractTopicsFromConversation(
      messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }))
    );

    // Record the topics
    for (const topic of topics) {
      await markTopicCovered(userId, topic);
    }

    return topics;
  } catch (error) {
    logger.error("Failed to extract and record topics", error);
    return [];
  }
}
