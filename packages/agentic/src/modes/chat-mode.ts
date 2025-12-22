// ** Chat Mode Handler for Echo-Learn
// ** Off-record mode with no learning tracking

// ** import types
import type { ChatMode } from "@repo/shared";
import {
  getChatModeSystemPrompt,
  getChatModeSystemPromptWithContext,
} from "../prompts";

export { getChatModeSystemPrompt, getChatModeSystemPromptWithContext };

// ** import utils
import { logger } from "@repo/logs";

/**
 * Chat mode configuration
 */
export interface ChatModeConfig {
  /** Whether this is truly off-record (should always be true) */
  offRecord: boolean;
}

/**
 * Default chat mode configuration
 */
export const DEFAULT_CHAT_MODE_CONFIG: ChatModeConfig = {
  offRecord: true,
};

/**
 * Chat mode context passed during execution
 */
export interface ChatModeContext {
  userId: string;
  query: string;
  conversationHistory: Array<{ role: string; content: string }>;
  config: ChatModeConfig;
}

/**
 * Chat mode result after processing
 */
export interface ChatModeResult {
  mode: ChatMode;
  systemPrompt: string;
  shouldAnalyze: false;
  shouldGenerateFollowUps: false;
  shouldUpdateMastery: false;
}

/**
 * Initialize chat mode processing
 */
export function initializeChatMode(context: ChatModeContext): ChatModeResult {
  logger.info("Initializing chat mode (off-record)", {
    userId: context.userId,
    offRecord: context.config.offRecord,
  });

  return {
    mode: "chat",
    systemPrompt: getChatModeSystemPrompt(),
    shouldAnalyze: false,
    shouldGenerateFollowUps: false,
    shouldUpdateMastery: false,
  };
}

/**
 * Verify that chat mode is truly off-record
 * This is a safety check to ensure no learning is accidentally tracked
 */
export function verifyChatModeOffRecord(context: ChatModeContext): boolean {
  if (!context.config.offRecord) {
    logger.warn(
      "Chat mode invoked but offRecord is false - this is unexpected",
      {
        userId: context.userId,
      },
    );
    return false;
  }
  return true;
}

/**
 * Get tools that should be disabled in chat mode
 * These tools affect learning state and should not be available
 */
export function getDisabledToolsForChatMode(): string[] {
  return [
    "save_learning_progress",
    // Future tools that affect learning:
    // "update_mastery",
    // "log_learning_signal",
  ];
}

/**
 * Check if a tool is allowed in chat mode
 */
export function isToolAllowedInChatMode(toolName: string): boolean {
  const disabledTools = getDisabledToolsForChatMode();
  return !disabledTools.includes(toolName);
}

/**
 * Filter tools for chat mode - removes learning-related tools
 */
export function filterToolsForChatMode<T extends Record<string, unknown>>(
  tools: T,
): T {
  const disabledTools = getDisabledToolsForChatMode();
  const filteredTools = { ...tools };

  for (const toolName of disabledTools) {
    if (toolName in filteredTools) {
      delete filteredTools[toolName];
    }
  }

  return filteredTools;
}
