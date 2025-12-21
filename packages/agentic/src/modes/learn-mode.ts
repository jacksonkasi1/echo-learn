// ** Learn Mode Handler for Echo-Learn
// ** Default mode with automatic learning observation

// ** import types
import type { ChatMode, LearningSignal, MasteryUpdate } from "@repo/shared";
import { MODE_PROMPTS } from "@repo/shared";

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
 * Get system prompt for learn mode
 */
export function getLearnModeSystemPrompt(): string {
  return MODE_PROMPTS.learn;
}

/**
 * Get extended system prompt with tool guidance for learn mode
 */
export function getLearnModeSystemPromptWithTools(
  basePrompt: string,
  userLevel: string,
  questionsAnswered: number
): string {
  return `${basePrompt}

## User Profile
- Level: ${userLevel}
- Questions answered: ${questionsAnswered}

## Mode: LEARN MODE (Active)
The system is automatically tracking this user's learning progress.
- Concepts discussed will be extracted and mastery updated in the background
- Focus on clear explanations that help build understanding
- Encourage deeper exploration with follow-up questions

## When to Save Learning Progress (save_learning_progress tool)

**ONLY call save_learning_progress when meaningful learning occurred:**

| Situation | Action | Example |
|-----------|--------|---------|
| Completed training on a topic | mark_topic_learned | After "Train me on pricing" → topics=["pricing", "plans"] |
| User struggles/gets confused | mark_topic_weak | User asks same thing 3 times → topics=["integrations"] |
| User demonstrates mastery | mark_topic_strong | Correct quiz answer → topics=["product features"] |
| Long learning session ends | log_session_summary | After 10+ exchanges on a topic |
| Major milestone reached | update_level | After completing full product training |

**DO NOT call save_learning_progress for:**
- Simple Q&A ("Who is X?" → no need to save)
- Quick lookups ("What's the price?" → no need to save)
- Single questions about a topic`;
}

/**
 * Initialize learn mode processing
 */
export function initializeLearnMode(
  context: LearnModeContext
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
  asking_about: 0.0,           // Neutral - just starting to learn
  explains_correctly: 0.15,    // Moderate positive
  explains_incorrectly: -0.1,  // Light negative
  expresses_confusion: -0.1,   // Light negative
  asks_followup: 0.05,         // Slight positive (curiosity)
  asks_again: -0.1,            // Retention issue
  makes_connection: 0.1,       // Understanding relationships
};

/**
 * Check if a signal should update mastery in learn mode
 */
export function shouldUpdateMasteryInLearnMode(
  signalType: string,
  confidence: number
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
  context?: string
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
