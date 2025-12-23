// ** Mode Handler Index for Echo-Learn
// ** Unified mode routing and management

// ** export individual modes
export * from "./learn-mode.js";
export * from "./chat-mode.js";
export * from "./test-mode.js";

// ** import types
import type { ChatMode } from "@repo/shared";
import { MODE_PROMPTS } from "@repo/shared";

// ** import modes
import {
  initializeLearnMode,
  type LearnModeContext,
  type LearnModeResult,
  DEFAULT_LEARN_MODE_CONFIG,
} from "./learn-mode.js";

import {
  initializeChatMode,
  filterToolsForChatMode,
  type ChatModeContext,
  type ChatModeResult,
  DEFAULT_CHAT_MODE_CONFIG,
} from "./chat-mode.js";

import {
  initializeTestMode,
  getTestSessionState,
  type TestModeContext,
  type TestModeResult,
  DEFAULT_TEST_MODE_CONFIG,
} from "./test-mode.js";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Unified mode context
 */
export interface ModeContext {
  userId: string;
  mode: ChatMode;
  query: string;
  conversationHistory: Array<{ role: string; content: string }>;
  /** Whether this is a voice interaction (ElevenLabs) - disables interactive UI tools */
  isVoiceMode?: boolean;
  /** Skill level override for test mode (beginner/intermediate/pro) */
  skillLevel?: "beginner" | "intermediate" | "pro";
}

/**
 * Unified mode result
 */
export type ModeResult = LearnModeResult | ChatModeResult | TestModeResult;

/**
 * Mode handler configuration
 */
export interface ModeHandlerConfig {
  learn: typeof DEFAULT_LEARN_MODE_CONFIG;
  chat: typeof DEFAULT_CHAT_MODE_CONFIG;
  test: typeof DEFAULT_TEST_MODE_CONFIG;
}

/**
 * Default configuration for all modes
 */
export const DEFAULT_MODE_CONFIG: ModeHandlerConfig = {
  learn: DEFAULT_LEARN_MODE_CONFIG,
  chat: DEFAULT_CHAT_MODE_CONFIG,
  test: DEFAULT_TEST_MODE_CONFIG,
};

/**
 * Initialize the appropriate mode based on request
 */
export async function initializeMode(
  context: ModeContext,
  config: Partial<ModeHandlerConfig> = {},
): Promise<ModeResult> {
  const mergedConfig = {
    ...DEFAULT_MODE_CONFIG,
    ...config,
  };

  logger.info("Initializing mode", {
    userId: context.userId,
    mode: context.mode,
  });

  switch (context.mode) {
    case "learn": {
      const learnContext: LearnModeContext = {
        userId: context.userId,
        query: context.query,
        conversationHistory: context.conversationHistory,
        config: mergedConfig.learn,
      };
      return initializeLearnMode(learnContext);
    }

    case "chat": {
      const chatContext: ChatModeContext = {
        userId: context.userId,
        query: context.query,
        conversationHistory: context.conversationHistory,
        config: mergedConfig.chat,
      };
      return initializeChatMode(chatContext);
    }

    case "test": {
      // For test mode, we need to check for active session
      const testState = await getTestSessionState(context.userId);
      const testContext: TestModeContext = {
        userId: context.userId,
        query: context.query,
        conversationHistory: context.conversationHistory,
        config: mergedConfig.test,
        activeSession: testState.session ?? undefined,
        isVoiceMode: context.isVoiceMode,
        skillLevel: context.skillLevel,
      };
      return initializeTestMode(testContext);
    }

    default: {
      // Default to learn mode for unknown modes
      logger.warn("Unknown mode, defaulting to learn mode", {
        userId: context.userId,
        requestedMode: context.mode,
      });
      const fallbackContext: LearnModeContext = {
        userId: context.userId,
        query: context.query,
        conversationHistory: context.conversationHistory,
        config: mergedConfig.learn,
      };
      return initializeLearnMode(fallbackContext);
    }
  }
}

/**
 * Get the base system prompt for a mode
 */
export function getModeSystemPrompt(mode: ChatMode): string {
  return MODE_PROMPTS[mode] || MODE_PROMPTS.learn;
}

/**
 * Check if mode should track learning
 */
export function shouldTrackLearning(mode: ChatMode): boolean {
  return mode === "learn" || mode === "test";
}

/**
 * Check if mode should generate follow-ups
 */
export function shouldGenerateFollowUps(mode: ChatMode): boolean {
  return mode === "learn";
}

/**
 * Check if mode should run passive analysis
 */
export function shouldRunPassiveAnalysis(mode: ChatMode): boolean {
  return mode === "learn";
}

/**
 * Get filtered tools based on mode
 * Some tools are disabled in certain modes
 */
export function getToolsForMode<T extends Record<string, unknown>>(
  tools: T,
  mode: ChatMode,
): T {
  switch (mode) {
    case "chat":
      // Chat mode: filter out learning-related tools
      return filterToolsForChatMode(tools);

    case "learn":
    case "test":
      // Learn and Test modes: all tools available
      return tools;

    default:
      return tools;
  }
}

/**
 * Validate that a mode is valid
 */
export function isValidMode(mode: string): mode is ChatMode {
  return ["learn", "chat", "test"].includes(mode);
}

/**
 * Get default mode
 */
export function getDefaultMode(): ChatMode {
  return "learn";
}

/**
 * Mode descriptions for UI
 */
export const MODE_DESCRIPTIONS: Record<
  ChatMode,
  { name: string; icon: string; description: string }
> = {
  learn: {
    name: "Learn",
    icon: "🎓",
    description: "Learn with automatic progress tracking",
  },
  chat: {
    name: "Chat",
    icon: "💬",
    description: "Chat freely without tracking (off-record)",
  },
  test: {
    name: "Test",
    icon: "📝",
    description: "Quiz yourself to reinforce learning",
  },
};
