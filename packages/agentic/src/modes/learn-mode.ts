// ** Learn Mode Handler for Echo-Learn
// ** Default mode with automatic learning observation

// ** import types
import type { ChatMode, LearningSignal, MasteryUpdate } from "@repo/shared";
// ** import prompts
import {
  getLearnModeSystemPrompt,
  getLearnModeSystemPromptWithTools,
} from "../prompts";

export { getLearnModeSystemPrompt, getLearnModeSystemPromptWithTools };

// ** import utils
import { logger } from "@repo/logs";

/**
 * Learn mode configuration
 */
export interface LearnModeConfig {
  /** Whether to enable background analysis */
  enableAnalysis: boolean;
  /** Whether to generate follow-up suggestions */
  enableFollowUps: boolean;
  /** Maximum follow-up suggestions to generate */
  maxFollowUps: number;
}

/**
 * Default learn mode configuration
 */
export const DEFAULT_LEARN_MODE_CONFIG: LearnModeConfig = {
  enableAnalysis: true,
  enableFollowUps: true,
  maxFollowUps: 4,
};

/**
 * Learn mode context passed during execution
 */
export interface LearnModeContext {
  userId: string;
  query: string;
  conversationHistory: Array<{ role: string; content: string }>;
  config: LearnModeConfig;
}

/**
 * Learn mode result after processing
 */
export interface LearnModeResult {
  mode: ChatMode;
  systemPrompt: string;
  shouldAnalyze: boolean;
  shouldGenerateFollowUps: boolean;
  masteryUpdates?: MasteryUpdate[];
  followUpSuggestions?: string[];
}

/**
 * Initialize learn mode processing
 */
export function initializeLearnMode(
  context: LearnModeContext,
): LearnModeResult {
  logger.info("Initializing learn mode", {
    userId: context.userId,
    enableAnalysis: context.config.enableAnalysis,
    enableFollowUps: context.config.enableFollowUps,
  });

  return {
    mode: "learn",
    systemPrompt: getLearnModeSystemPrompt(),
    shouldAnalyze: context.config.enableAnalysis,
    shouldGenerateFollowUps: context.config.enableFollowUps,
  };
}

/**
 * Signal weights for learn mode
 * These are weaker than test mode since observations are passive
 */
export const LEARN_MODE_SIGNAL_WEIGHTS: Record<string, number> = {
  asking_about: 0.0, // Neutral - just starting to learn
  explains_correctly: 0.15, // Moderate positive
  explains_incorrectly: -0.1, // Light negative
  expresses_confusion: -0.1, // Light negative
  asks_followup: 0.05, // Slight positive (curiosity)
  asks_again: -0.1, // Retention issue
  makes_connection: 0.1, // Understanding relationships
};

/**
 * Check if a signal should update mastery in learn mode
 */
export function shouldUpdateMasteryInLearnMode(
  signalType: string,
  confidence: number,
): boolean {
  // Only update if we're confident enough about the signal
  const minConfidence = 0.5;
  if (confidence < minConfidence) {
    return false;
  }

  // Always update for these clear signals
  const clearSignals = [
    "explains_correctly",
    "explains_incorrectly",
    "expresses_confusion",
  ];

  return clearSignals.includes(signalType) || confidence >= 0.7;
}

/**
 * Create a learning signal for learn mode
 */
export function createLearnModeSignal(
  conceptId: string,
  conceptLabel: string,
  signalType: keyof typeof LEARN_MODE_SIGNAL_WEIGHTS,
  confidence: number,
  context?: string,
): LearningSignal {
  const masteryDelta = LEARN_MODE_SIGNAL_WEIGHTS[signalType] ?? 0;

  return {
    type: signalType as LearningSignal["type"],
    conceptId,
    conceptLabel,
    confidence,
    masteryDelta,
    timestamp: new Date().toISOString(),
    context,
  };
}
