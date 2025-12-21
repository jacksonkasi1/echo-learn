// ** Signal Detector for Echo-Learn Passive Analysis Pipeline
// ** Detects learning signals from conversation patterns

// ** import types
import type { LearningSignal, LearningSignalType } from "@repo/shared";

// ** import utils
import { logger } from "@repo/logs";

// ** import local
import type { ExtractedConcept } from "./concept-extractor.js";

/**
 * Signal detection result
 */
export interface SignalDetectionResult {
  signals: LearningSignal[];
  processingTimeMs: number;
}

/**
 * Conversation context for signal detection
 */
export interface ConversationContext {
  userMessage: string;
  assistantResponse: string;
  conversationHistory: Array<{ role: string; content: string }>;
  extractedConcepts: ExtractedConcept[];
}

/**
 * Pattern definition for signal detection
 */
interface SignalPattern {
  type: LearningSignalType;
  patterns: RegExp[];
  masteryDelta: number;
  confidence: number;
  description: string;
}

/**
 * Signal patterns for detecting learning behaviors
 */
const SIGNAL_PATTERNS: SignalPattern[] = [
  // Asking about concepts (neutral - beginning to learn)
  {
    type: "asking_about",
    patterns: [
      /what (?:is|are|does) (?:a |an |the )?(.+?)\??$/i,
      /can you explain (.+?)\??$/i,
      /tell me about (.+?)$/i,
      /how does (.+?) work\??$/i,
      /what's (.+?)\??$/i,
      /define (.+?)$/i,
    ],
    masteryDelta: 0.0, // Neutral - just starting to learn
    confidence: 0.7,
    description: "User is asking about a concept",
  },

  // Expressing confusion (negative signal)
  {
    type: "expresses_confusion",
    patterns: [
      /i (?:don't|do not|dont) understand/i,
      /(?:i'm|im|i am) confused/i,
      /this (?:is|seems) confusing/i,
      /what do you mean/i,
      /(?:i'm|im|i am) lost/i,
      /(?:i'm|im|i am) not sure (?:what|how|why)/i,
      /can you clarify/i,
      /that (?:doesn't|does not|doesnt) make sense/i,
    ],
    masteryDelta: -0.1,
    confidence: 0.8,
    description: "User expresses confusion",
  },

  // Asking the same thing again (retention issue)
  {
    type: "asks_again",
    patterns: [
      /(?:again|remind me),? what (?:is|are)/i,
      /(?:sorry|wait),? (?:what|how) (?:is|was|does)/i,
      /can you (?:repeat|say that again)/i,
      /i forgot,? (?:what|how)/i,
      /one more time,? (?:what|how)/i,
    ],
    masteryDelta: -0.1,
    confidence: 0.75,
    description: "User asks the same question again",
  },

  // Asking follow-up questions (positive - engaging)
  {
    type: "asks_followup",
    patterns: [
      /(?:and |but )?what about/i,
      /(?:and |but )?how about/i,
      /what if/i,
      /why (?:is that|does|do)/i,
      /can you (?:also|tell me more)/i,
      /what(?:'s| is) the (?:difference|relationship)/i,
      /how (?:does this|do these) (?:relate|connect|compare)/i,
    ],
    masteryDelta: 0.05,
    confidence: 0.6,
    description: "User asks a follow-up question",
  },

  // User explains something correctly (detected from context)
  {
    type: "explains_correctly",
    patterns: [
      /so,? (?:basically|essentially|in other words)/i,
      /(?:i think|i believe) (?:it|this|that) (?:is|means|works)/i,
      /my understanding is/i,
      /if i understand correctly/i,
      /so what you(?:'re| are) saying is/i,
    ],
    masteryDelta: 0.15, // Will be validated by response
    confidence: 0.5, // Lower confidence - needs response validation
    description: "User attempts to explain a concept",
  },

  // Making connections between concepts (deep understanding)
  {
    type: "makes_connection",
    patterns: [
      /(?:is this|this is) (?:similar|related) to/i,
      /this reminds me of/i,
      /(?:so|ah),? (?:it's|this is) like/i,
      /(?:the|a) connection (?:between|to)/i,
      /(?:this|it) (?:applies|relates) to/i,
    ],
    masteryDelta: 0.1,
    confidence: 0.65,
    description: "User makes a connection between concepts",
  },
];

/**
 * Detect if user explanation was validated as correct by assistant
 */
function detectExplanationValidation(
  userMessage: string,
  assistantResponse: string
): "correct" | "incorrect" | "unknown" {
  const responseLower = assistantResponse.toLowerCase();

  // Check for positive validation
  const positivePatterns = [
    /(?:yes|exactly|correct|right|precisely|that's right)/i,
    /(?:good|great|excellent) understanding/i,
    /you(?:'ve| have)? got it/i,
    /that(?:'s| is) (?:correct|right|accurate)/i,
  ];

  // Check for negative validation
  const negativePatterns = [
    /(?:not quite|not exactly|not really)/i,
    /(?:actually|however),? (?:it|that)(?:'s| is)/i,
    /(?:that's|that is) (?:not|incorrect|wrong)/i,
    /(?:let me clarify|to clarify)/i,
    /(?:common misconception|misunderstanding)/i,
  ];

  for (const pattern of positivePatterns) {
    if (pattern.test(responseLower)) return "correct";
  }

  for (const pattern of negativePatterns) {
    if (pattern.test(responseLower)) return "incorrect";
  }

  return "unknown";
}

/**
 * Check if similar question was asked recently in conversation history
 */
function detectRepeatedQuestion(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  conceptLabel: string
): boolean {
  const conceptLower = conceptLabel.toLowerCase();
  const userMessages = history.filter((m) => m.role === "user");

  // Look at last 5 user messages (excluding current)
  const recentMessages = userMessages.slice(-6, -1);

  for (const msg of recentMessages) {
    const msgLower = msg.content.toLowerCase();
    // Check if same concept was asked about
    if (msgLower.includes(conceptLower)) {
      // Check if it was a question
      if (
        msgLower.includes("what") ||
        msgLower.includes("how") ||
        msgLower.includes("explain")
      ) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Detect learning signals from a conversation
 */
export async function detectSignals(
  context: ConversationContext
): Promise<SignalDetectionResult> {
  const startTime = Date.now();
  const signals: LearningSignal[] = [];
  const processedConcepts = new Set<string>();

  try {
    const { userMessage, assistantResponse, conversationHistory, extractedConcepts } =
      context;

    // Process each extracted concept
    for (const concept of extractedConcepts) {
      // Skip if already processed
      if (processedConcepts.has(concept.conceptId)) continue;
      processedConcepts.add(concept.conceptId);

      // Check for repeated question first (stronger signal)
      if (
        detectRepeatedQuestion(userMessage, conversationHistory, concept.conceptLabel)
      ) {
        signals.push({
          type: "asks_again",
          conceptId: concept.conceptId,
          conceptLabel: concept.conceptLabel,
          confidence: 0.8,
          masteryDelta: -0.1,
          timestamp: new Date().toISOString(),
          context: "Repeated question detected",
        });
        continue;
      }

      // Try each signal pattern
      for (const pattern of SIGNAL_PATTERNS) {
        let matched = false;

        for (const regex of pattern.patterns) {
          if (regex.test(userMessage)) {
            matched = true;
            break;
          }
        }

        if (matched) {
          let finalMasteryDelta = pattern.masteryDelta;
          let finalConfidence = pattern.confidence * concept.confidence;
          let signalContext = pattern.description;

          // Special handling for explanation attempts
          if (pattern.type === "explains_correctly") {
            const validation = detectExplanationValidation(
              userMessage,
              assistantResponse
            );

            if (validation === "correct") {
              finalMasteryDelta = 0.15;
              finalConfidence = 0.8;
              signalContext = "User explanation validated as correct";
            } else if (validation === "incorrect") {
              finalMasteryDelta = -0.1;
              finalConfidence = 0.75;
              signalContext = "User explanation was incorrect";

              // Change signal type
              signals.push({
                type: "explains_incorrectly",
                conceptId: concept.conceptId,
                conceptLabel: concept.conceptLabel,
                confidence: finalConfidence,
                masteryDelta: finalMasteryDelta,
                timestamp: new Date().toISOString(),
                context: signalContext,
              });
              break;
            } else {
              // Unknown validation - skip or use weak signal
              finalMasteryDelta = 0.05;
              finalConfidence = 0.4;
              signalContext = "User attempted explanation (unvalidated)";
            }
          }

          signals.push({
            type: pattern.type,
            conceptId: concept.conceptId,
            conceptLabel: concept.conceptLabel,
            confidence: finalConfidence,
            masteryDelta: finalMasteryDelta,
            timestamp: new Date().toISOString(),
            context: signalContext,
          });
          break; // Only one signal per concept per pattern match
        }
      }
    }

    // If no specific patterns matched but concepts were discussed, add neutral signal
    for (const concept of extractedConcepts) {
      const hasSignal = signals.some((s) => s.conceptId === concept.conceptId);
      if (!hasSignal && concept.confidence >= 0.6) {
        signals.push({
          type: "asking_about",
          conceptId: concept.conceptId,
          conceptLabel: concept.conceptLabel,
          confidence: concept.confidence * 0.7,
          masteryDelta: 0.02, // Very small positive for engagement
          timestamp: new Date().toISOString(),
          context: "Concept discussed in conversation",
        });
      }
    }

    const processingTimeMs = Date.now() - startTime;

    logger.info("Signal detection completed", {
      signalsFound: signals.length,
      conceptsProcessed: extractedConcepts.length,
      processingTimeMs,
    });

    return {
      signals,
      processingTimeMs,
    };
  } catch (error) {
    logger.error("Signal detection failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      signals: [],
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Filter signals by minimum confidence threshold
 */
export function filterSignalsByConfidence(
  signals: LearningSignal[],
  minConfidence: number = 0.5
): LearningSignal[] {
  return signals.filter((s) => s.confidence >= minConfidence);
}

/**
 * Aggregate multiple signals for the same concept
 * If both positive and negative signals, use the strongest
 */
export function aggregateSignals(
  signals: LearningSignal[]
): Map<string, LearningSignal> {
  const conceptSignals = new Map<string, LearningSignal>();

  for (const signal of signals) {
    const existing = conceptSignals.get(signal.conceptId);

    if (!existing) {
      conceptSignals.set(signal.conceptId, signal);
    } else {
      // Keep the signal with higher absolute mastery delta
      const existingStrength = Math.abs(existing.masteryDelta);
      const newStrength = Math.abs(signal.masteryDelta);

      if (newStrength > existingStrength) {
        conceptSignals.set(signal.conceptId, signal);
      } else if (newStrength === existingStrength && signal.confidence > existing.confidence) {
        conceptSignals.set(signal.conceptId, signal);
      }
    }
  }

  return conceptSignals;
}
