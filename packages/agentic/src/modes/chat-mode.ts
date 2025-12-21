// ** Chat Mode Handler for Echo-Learn
// ** Off-record mode with no learning tracking

// ** import types
import type { ChatMode } from "@repo/shared";
import { MODE_PROMPTS } from "@repo/shared";

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
 * Get system prompt for chat mode
 */
export function getChatModeSystemPrompt(): string {
  return MODE_PROMPTS.chat;
}

/**
 * Get extended system prompt with context for chat mode
 */
export function getChatModeSystemPromptWithContext(
  basePrompt: string,
  userLevel?: string
): string {
  return `${basePrompt}

## Mode: CHAT MODE (Off-Record)
This conversation is NOT being tracked for learning purposes.
The user wants to explore freely without affecting their learning profile.

Guidelines:
- Answer questions directly and helpfully
- Don't mention learning progress or suggest saving anything
- Be conversational and relaxed
- No need to structure responses for learning optimization
- Feel free to discuss tangential topics${userLevel ? `\n\nNote: User's general level is ${userLevel}, but this doesn't affect how you respond in chat mode.` : ""}`;
}

/**
 * Initialize chat mode processing
 */
export function initializeChatMode(
  context: ChatModeContext
): ChatModeResult {
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
    logger.warn("Chat mode invoked but offRecord is false - this is unexpected", {
      userId: context.userId,
    });
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
  tools: T
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
