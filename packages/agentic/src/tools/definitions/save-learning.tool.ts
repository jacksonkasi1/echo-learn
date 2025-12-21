// ** import types
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";

// ** import lib
import { z } from "zod";
import {
  updateUserProfile,
  getUserProfile,
  markTopicCovered,
  logInteraction,
} from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Save learning progress tool input schema
 */
const saveLearningInputSchema = z.object({
  action: z
    .enum([
      "mark_topic_learned",
      "mark_topic_weak",
      "mark_topic_strong",
      "log_session_summary",
      "update_level",
    ])
    .describe(
      "The type of learning action to save. Use: " +
        "'mark_topic_learned' when user completes learning a topic, " +
        "'mark_topic_weak' when user struggles with a topic, " +
        "'mark_topic_strong' when user masters a topic, " +
        "'log_session_summary' after a long learning session, " +
        "'update_level' when user's skill level should be reassessed",
    ),
  topics: z
    .array(z.string())
    .optional()
    .describe(
      "List of topics related to the action (e.g., ['PatientLens AI', 'pricing', 'integrations'])",
    ),
  summary: z
    .string()
    .optional()
    .describe(
      "Summary of the learning session or key insights (for log_session_summary action)",
    ),
  isCorrect: z
    .boolean()
    .optional()
    .describe("Whether the user answered correctly (for quiz tracking)"),
});

type SaveLearningInput = z.output<typeof saveLearningInputSchema>;

/**
 * Save learning progress tool output
 */
export interface SaveLearningOutput {
  success: boolean;
  action: string;
  message: string;
  updatedProfile?: {
    level: string;
    questionsAnswered: number;
    topicsCovered: number;
    weakAreas: string[];
    strongAreas: string[];
  };
}

/**
 * Save Learning Progress Tool
 *
 * Agent calls this tool to save user's learning progress.
 * NOT called automatically - agent decides when it's appropriate:
 * - After teaching a new topic
 * - When user completes a quiz
 * - After a comprehensive training session
 * - When user struggles or masters a topic
 */
export const saveLearningTool: ToolDefinition<
  SaveLearningInput,
  SaveLearningOutput
> = {
  name: "save_learning_progress",
  description:
    "Save user's learning progress to memory. Call this tool when:\n" +
    "- User completes learning about a topic → action='mark_topic_learned'\n" +
    "- User struggles with a topic (wrong answers, confusion) → action='mark_topic_weak'\n" +
    "- User demonstrates mastery (correct answers, deep understanding) → action='mark_topic_strong'\n" +
    "- After a long learning/training session → action='log_session_summary'\n" +
    "- User's overall skill level should change → action='update_level'\n\n" +
    "DO NOT call for simple Q&A. Only call when there's meaningful learning progress to save.",

  inputSchema: saveLearningInputSchema,

  category: ToolCategory.MEMORY,
  requiresApproval: false,
  timeout: 5000, // 5 seconds
  cost: 2, // Medium cost
  cacheable: false, // Never cache - always execute
  cacheTTL: 0,

  async execute(
    input: SaveLearningInput,
    context: ToolExecutionContext,
  ): Promise<SaveLearningOutput> {
    const startTime = Date.now();

    try {
      logger.info("Saving learning progress", {
        userId: context.userId,
        action: input.action,
        topics: input.topics,
      });

      const profile = await getUserProfile(context.userId);

      switch (input.action) {
        case "mark_topic_learned": {
          // Mark topics as covered
          if (input.topics && input.topics.length > 0) {
            await Promise.all(
              input.topics.map((topic) =>
                markTopicCovered(context.userId, topic),
              ),
            );
          }

          logger.info("Topics marked as learned", {
            userId: context.userId,
            topics: input.topics,
            executionTime: Date.now() - startTime,
          });

          return {
            success: true,
            action: input.action,
            message: `Marked ${input.topics?.length || 0} topic(s) as learned`,
            updatedProfile: {
              level: profile.level,
              questionsAnswered: profile.questionsAnswered,
              topicsCovered: profile.coveredTopics.length + (input.topics?.length || 0),
              weakAreas: profile.weakAreas,
              strongAreas: profile.strongAreas,
            },
          };
        }

        case "mark_topic_weak": {
          // Add topics to weak areas
          if (input.topics && input.topics.length > 0) {
            const newWeakAreas = [...profile.weakAreas];

            for (const topic of input.topics) {
              // Add to weak if not already there
              if (!newWeakAreas.includes(topic)) {
                newWeakAreas.push(topic);
              }
              // Remove from strong if there
              const strongIndex = profile.strongAreas.indexOf(topic);
              if (strongIndex > -1) {
                profile.strongAreas.splice(strongIndex, 1);
              }
            }

            // Keep arrays manageable (max 20)
            const trimmedWeakAreas = newWeakAreas.slice(-20);

            await updateUserProfile(context.userId, {
              weakAreas: trimmedWeakAreas,
              strongAreas: profile.strongAreas,
            });
          }

          logger.info("Topics marked as weak", {
            userId: context.userId,
            topics: input.topics,
            executionTime: Date.now() - startTime,
          });

          return {
            success: true,
            action: input.action,
            message: `Marked ${input.topics?.length || 0} topic(s) as needing work`,
            updatedProfile: {
              level: profile.level,
              questionsAnswered: profile.questionsAnswered,
              topicsCovered: profile.coveredTopics.length,
              weakAreas: [...profile.weakAreas, ...(input.topics || [])].slice(
                -20,
              ),
              strongAreas: profile.strongAreas,
            },
          };
        }

        case "mark_topic_strong": {
          // Add topics to strong areas
          if (input.topics && input.topics.length > 0) {
            const newStrongAreas = [...profile.strongAreas];

            for (const topic of input.topics) {
              // Add to strong if not already there
              if (!newStrongAreas.includes(topic)) {
                newStrongAreas.push(topic);
              }
              // Remove from weak if there
              const weakIndex = profile.weakAreas.indexOf(topic);
              if (weakIndex > -1) {
                profile.weakAreas.splice(weakIndex, 1);
              }
            }

            // Keep arrays manageable (max 20)
            const trimmedStrongAreas = newStrongAreas.slice(-20);

            await updateUserProfile(context.userId, {
              strongAreas: trimmedStrongAreas,
              weakAreas: profile.weakAreas,
            });
          }

          logger.info("Topics marked as strong", {
            userId: context.userId,
            topics: input.topics,
            executionTime: Date.now() - startTime,
          });

          return {
            success: true,
            action: input.action,
            message: `Marked ${input.topics?.length || 0} topic(s) as mastered`,
            updatedProfile: {
              level: profile.level,
              questionsAnswered: profile.questionsAnswered,
              topicsCovered: profile.coveredTopics.length,
              weakAreas: profile.weakAreas,
              strongAreas: [
                ...profile.strongAreas,
                ...(input.topics || []),
              ].slice(-20),
            },
          };
        }

        case "log_session_summary": {
          // Log a summary of the learning session
          await logInteraction({
            userId: context.userId,
            timestamp: new Date().toISOString(),
            query: "Learning Session Summary",
            response: input.summary || "Session completed",
            topicsDiscussed: input.topics || [],
            retrievedChunks: [],
            responseLength: input.summary?.length || 0,
          });

          // Mark topics as covered if provided
          if (input.topics && input.topics.length > 0) {
            await Promise.all(
              input.topics.map((topic) =>
                markTopicCovered(context.userId, topic),
              ),
            );
          }

          logger.info("Session summary logged", {
            userId: context.userId,
            topics: input.topics,
            summaryLength: input.summary?.length || 0,
            executionTime: Date.now() - startTime,
          });

          return {
            success: true,
            action: input.action,
            message: "Learning session summary saved",
            updatedProfile: {
              level: profile.level,
              questionsAnswered: profile.questionsAnswered,
              topicsCovered:
                profile.coveredTopics.length + (input.topics?.length || 0),
              weakAreas: profile.weakAreas,
              strongAreas: profile.strongAreas,
            },
          };
        }

        case "update_level": {
          // Reassess and update user's skill level
          const totalTopics = profile.coveredTopics.length;
          const strongCount = profile.strongAreas.length;
          const weakCount = profile.weakAreas.length;
          const questionsAnswered = profile.questionsAnswered;

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
            await updateUserProfile(context.userId, { level: newLevel });

            logger.info("User level updated", {
              userId: context.userId,
              oldLevel: profile.level,
              newLevel,
              executionTime: Date.now() - startTime,
            });

            return {
              success: true,
              action: input.action,
              message: `Level updated from ${profile.level} to ${newLevel}!`,
              updatedProfile: {
                level: newLevel,
                questionsAnswered: profile.questionsAnswered,
                topicsCovered: profile.coveredTopics.length,
                weakAreas: profile.weakAreas,
                strongAreas: profile.strongAreas,
              },
            };
          }

          return {
            success: true,
            action: input.action,
            message: `Level remains at ${profile.level}`,
            updatedProfile: {
              level: profile.level,
              questionsAnswered: profile.questionsAnswered,
              topicsCovered: profile.coveredTopics.length,
              weakAreas: profile.weakAreas,
              strongAreas: profile.strongAreas,
            },
          };
        }

        default:
          return {
            success: false,
            action: input.action,
            message: `Unknown action: ${input.action}`,
          };
      }
    } catch (error) {
      logger.error("Failed to save learning progress", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: context.userId,
        action: input.action,
      });

      return {
        success: false,
        action: input.action,
        message: `Failed to save: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
};
