// ** Background Analyzer for Echo-Learn Passive Analysis Pipeline
// ** Orchestrates concept extraction, signal detection, and mastery updates
// ** Runs asynchronously to not block response streaming

// ** import types
import type { LearningSignal, MasteryUpdate, ChatMode } from "@repo/shared";

// ** import storage
import { updateMasteryFromSignal } from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

// ** import local
import {
  extractConceptsFromInteraction,
  mightContainConcepts,
  type ExtractedConcept,
} from "./concept-extractor.js";
import {
  detectSignals,
  filterSignalsByConfidence,
  aggregateSignals,
  type ConversationContext,
} from "./signal-detector.js";

/**
 * Analysis pipeline result
 */
export interface AnalysisPipelineResult {
  success: boolean;
  conceptsExtracted: number;
  signalsDetected: number;
  masteryUpdates: MasteryUpdate[];
  totalProcessingTimeMs: number;
  error?: string;
}

/**
 * Analysis configuration options
 */
export interface AnalysisOptions {
  /** Enable/disable the analysis pipeline */
  enabled: boolean;
  /** Minimum confidence for signals to be processed */
  minSignalConfidence: number;
  /** Maximum concepts to extract per interaction */
  maxConcepts: number;
  /** Whether to update mastery scores */
  updateMastery: boolean;
}

/**
 * Default analysis options
 */
export const DEFAULT_ANALYSIS_OPTIONS: AnalysisOptions = {
  enabled: true,
  minSignalConfidence: 0.5,
  maxConcepts: 15,
  updateMastery: true,
};

/**
 * Feature flag for enabling/disabling the analysis pipeline
 * Can be overridden via environment variable
 */
export function isAnalysisPipelineEnabled(): boolean {
  const envFlag = process.env.ECHO_LEARN_ANALYSIS_ENABLED;
  if (envFlag !== undefined) {
    return envFlag.toLowerCase() === "true" || envFlag === "1";
  }
  return true; // Enabled by default
}

/**
 * Run the complete analysis pipeline
 *
 * This is the main entry point for passive learning analysis.
 * It extracts concepts, detects signals, and updates mastery scores.
 */
export async function runAnalysisPipeline(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  conversationHistory: Array<{ role: string; content: string }>,
  options: Partial<AnalysisOptions> = {}
): Promise<AnalysisPipelineResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_ANALYSIS_OPTIONS, ...options };

  // Check if pipeline is enabled
  if (!opts.enabled || !isAnalysisPipelineEnabled()) {
    return {
      success: true,
      conceptsExtracted: 0,
      signalsDetected: 0,
      masteryUpdates: [],
      totalProcessingTimeMs: 0,
    };
  }

  try {
    logger.info("Starting analysis pipeline", {
      userId,
      userMessageLength: userMessage.length,
      responseLength: assistantResponse.length,
    });

    // Quick check - skip if unlikely to contain concepts
    const mightHaveConcepts = await mightContainConcepts(userMessage + " " + assistantResponse, userId);
    if (!mightHaveConcepts) {
      logger.info("Skipping analysis - no concepts likely", { userId });
      return {
        success: true,
        conceptsExtracted: 0,
        signalsDetected: 0,
        masteryUpdates: [],
        totalProcessingTimeMs: Date.now() - startTime,
      };
    }

    // Step 1: Extract concepts from the interaction
    const extractionResult = await extractConceptsFromInteraction(
      userId,
      userMessage,
      assistantResponse,
      { maxConcepts: opts.maxConcepts }
    );

    if (extractionResult.allConcepts.length === 0) {
      logger.info("No concepts extracted", { userId });
      return {
        success: true,
        conceptsExtracted: 0,
        signalsDetected: 0,
        masteryUpdates: [],
        totalProcessingTimeMs: Date.now() - startTime,
      };
    }

    // Step 2: Detect learning signals
    const context: ConversationContext = {
      userMessage,
      assistantResponse,
      conversationHistory,
      extractedConcepts: extractionResult.allConcepts,
    };

    const signalResult = await detectSignals(context);

    // Filter by confidence
    const filteredSignals = filterSignalsByConfidence(
      signalResult.signals,
      opts.minSignalConfidence
    );

    // Aggregate signals (one per concept)
    const aggregatedSignals = aggregateSignals(filteredSignals);

    // Step 3: Update mastery scores
    const masteryUpdates: MasteryUpdate[] = [];

    if (opts.updateMastery && aggregatedSignals.size > 0) {
      for (const [conceptId, signal] of aggregatedSignals) {
        try {
          const update = await updateMasteryFromSignal(userId, signal);
          masteryUpdates.push(update);

          logger.info("Mastery updated from signal", {
            userId,
            conceptId,
            signalType: signal.type,
            masteryDelta: signal.masteryDelta,
            newMastery: update.newMastery,
          });
        } catch (updateError) {
          logger.warn("Failed to update mastery for concept", {
            userId,
            conceptId,
            error: updateError instanceof Error ? updateError.message : "Unknown",
          });
        }
      }
    }

    const totalProcessingTimeMs = Date.now() - startTime;

    logger.info("Analysis pipeline completed", {
      userId,
      conceptsExtracted: extractionResult.allConcepts.length,
      signalsDetected: aggregatedSignals.size,
      masteryUpdatesApplied: masteryUpdates.length,
      totalProcessingTimeMs,
    });

    return {
      success: true,
      conceptsExtracted: extractionResult.allConcepts.length,
      signalsDetected: aggregatedSignals.size,
      masteryUpdates,
      totalProcessingTimeMs,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    logger.error("Analysis pipeline failed", {
      userId,
      error: errorMessage,
    });

    return {
      success: false,
      conceptsExtracted: 0,
      signalsDetected: 0,
      masteryUpdates: [],
      totalProcessingTimeMs: Date.now() - startTime,
      error: errorMessage,
    };
  }
}

/**
 * Analyze interaction asynchronously (fire and forget)
 *
 * This is the function called from strategies.ts after streaming completes.
 * It runs the analysis in the background without blocking the response.
 */
export function analyzeInteractionAsync(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  conversationHistory: Array<{ role: string; content: string }>,
  mode: ChatMode = "learn"
): void {
  // Only run analysis in learn mode
  if (mode !== "learn") {
    logger.info("Skipping analysis - not in learn mode", { userId, mode });
    return;
  }

  // Fire and forget - use setImmediate to not block
  setImmediate(async () => {
    try {
      await runAnalysisPipeline(
        userId,
        userMessage,
        assistantResponse,
        conversationHistory
      );
    } catch (error) {
      // Log but don't throw - this is background processing
      logger.warn("Background analysis failed (non-critical)", {
        userId,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });
}

/**
 * Analyze interaction and wait for result
 *
 * Use this when you need the analysis result (e.g., for testing)
 */
export async function analyzeInteractionSync(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  conversationHistory: Array<{ role: string; content: string }>,
  options: Partial<AnalysisOptions> = {}
): Promise<AnalysisPipelineResult> {
  return runAnalysisPipeline(
    userId,
    userMessage,
    assistantResponse,
    conversationHistory,
    options
  );
}
