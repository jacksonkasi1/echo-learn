// ** Learning types for Echo-Learn Smart Memory System

/**
 * Chat mode determines how the system processes interactions
 * - learn: Default mode, automatic learning observation
 * - chat: Off-record mode, no learning tracking
 * - test: Active testing mode with explicit evaluation
 */
export type ChatMode = "learn" | "chat" | "test";

/**
 * Learning signal types detected from conversations
 */
export type LearningSignalType =
  | "asking_about" // User asks "What is X?"
  | "explains_correctly" // User explains concept correctly
  | "explains_incorrectly" // User explains concept incorrectly
  | "expresses_confusion" // User says "I don't understand"
  | "asks_followup" // User asks deeper question
  | "asks_again" // User asks same thing again
  | "quiz_correct" // Correct quiz answer
  | "quiz_incorrect" // Incorrect quiz answer
  | "quiz_partial" // Partially correct answer
  | "makes_connection"; // User connects concepts

/**
 * Learning signal detected from interaction
 */
export interface LearningSignal {
  type: LearningSignalType;
  conceptId: string;
  conceptLabel: string;
  confidence: number; // 0.0 - 1.0 how sure we are about this signal
  masteryDelta: number; // How much to adjust mastery (-1.0 to 1.0)
  timestamp: string; // ISO timestamp
  context?: string; // Optional context for the signal
}

/**
 * Concept mastery tracking with time decay
 * Links to GraphNode.id from knowledge graph
 */
export interface ConceptMastery {
  conceptId: string; // Links to GraphNode.id
  conceptLabel: string; // Human-readable label

  // Core Mastery
  masteryScore: number; // 0.0 - 1.0
  confidence: number; // 0.0 - 1.0 (how sure are we?)

  // Time Tracking (for decay)
  lastInteraction: string; // ISO timestamp
  lastCorrectAnswer?: string; // ISO timestamp
  createdAt: string; // ISO timestamp

  // Attempt History
  totalAttempts: number;
  correctAttempts: number;
  streakCorrect: number; // Consecutive correct
  streakWrong: number; // Consecutive wrong

  // Spaced Repetition (SM-2)
  nextReviewDate: string; // When to quiz again (ISO)
  easeFactor: number; // SM-2 ease factor (default 2.5)
  intervalDays: number; // Current interval

  // Pattern Detection
  commonMistakes: string[]; // What they get wrong
  confusedWith: string[]; // Concepts they confuse this with
}

/**
 * Default values for new concept mastery
 */
export const DEFAULT_CONCEPT_MASTERY: Omit<
  ConceptMastery,
  | "conceptId"
  | "conceptLabel"
  | "createdAt"
  | "lastInteraction"
  | "nextReviewDate"
> = {
  masteryScore: 0.2, // Start low - user is just learning
  confidence: 0.3, // Low confidence initially
  totalAttempts: 0,
  correctAttempts: 0,
  streakCorrect: 0,
  streakWrong: 0,
  easeFactor: 2.5, // SM-2 default
  intervalDays: 1, // Review tomorrow
  commonMistakes: [],
  confusedWith: [],
};

/**
 * Mastery update input - what changed
 */
export interface MasteryUpdate {
  conceptId: string;
  signal: LearningSignal;
  previousMastery?: number;
  newMastery: number;
  previousConfidence?: number;
  newConfidence: number;
}

// Note: LearningRelationType is defined in graph.ts and exported from there
// GraphEdge now includes learningRelation and propagationWeight fields

/**
 * Mastery summary for a user
 */
export interface MasterySummary {
  userId: string;
  totalConcepts: number;
  masteredConcepts: number; // mastery > 0.8
  learningConcepts: number; // 0.3 < mastery <= 0.8
  weakConcepts: number; // mastery <= 0.3
  averageMastery: number;
  conceptsDueForReview: number;
  lastUpdated: string;
}

/**
 * Concept with effective mastery (after decay applied)
 */
export interface ConceptWithEffectiveMastery extends ConceptMastery {
  effectiveMastery: number; // Mastery after decay
  daysSinceInteraction: number;
  isDueForReview: boolean;
}

/**
 * Question difficulty levels
 */
export type QuestionDifficulty = "easy" | "medium" | "hard";

/**
 * Question types for adaptive testing
 */
export type QuestionType =
  | "definition"
  | "application"
  | "comparison"
  | "analysis";

/**
 * Answer evaluation result
 */
export type AnswerEvaluation = "correct" | "partial" | "incorrect";

/**
 * Mode-specific system prompts configuration
 */
export interface ModePromptConfig {
  learn: string;
  chat: string;
  test: string;
}

/**
 * Default mode prompts
 */
export const MODE_PROMPTS: ModePromptConfig = {
  learn: `You are Echo, a knowledgeable learning assistant helping users understand concepts from their uploaded materials.
The system automatically tracks their learning progress in the background.
Focus on explaining concepts clearly and helping users build understanding.
After explaining something, you may suggest related topics to explore.`,

  chat: `You are Echo, a helpful assistant answering questions directly.
This conversation is OFF THE RECORD - no learning progress is being tracked.
Feel free to ask anything without it affecting your learning profile.
Answer questions directly and conversationally.`,

  test: `You are Echo, a quiz master testing the user's knowledge.
Ask questions about concepts they've learned from their materials.
After each answer:
1. Evaluate if it's correct, partially correct, or incorrect
2. Provide clear, constructive feedback
3. Explain the right answer briefly if needed
4. Ask if they're ready for the next question

Keep the tone encouraging but honest about correctness.`,
};

/**
 * Follow-up suggestion for Perplexity-style UX
 */
export interface FollowUpSuggestion {
  text: string; // Natural language question
  conceptId?: string; // Related concept if any
  type: "explore" | "quiz" | "example" | "deeper" | "related";
  priority: number; // Higher = more relevant (0-1)
}

/**
 * Extended chat response with learning features
 */
export interface LearningChatResponse {
  message: string;
  followUpSuggestions: FollowUpSuggestion[];
  conceptsDiscussed: string[];
  masteryUpdates?: MasteryUpdate[];
  mode: ChatMode;
}
