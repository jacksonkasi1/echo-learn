// ** Test Session types for Echo-Learn Test Mode

import type { ChatMode, QuestionDifficulty, QuestionType, AnswerEvaluation } from './learning.js'

/**
 * Test session status
 */
export type TestSessionStatus = 'active' | 'paused' | 'completed' | 'abandoned'

/**
 * Test question in a session
 */
export interface TestQuestion {
  questionId: string
  conceptId: string
  conceptLabel: string
  difficulty: QuestionDifficulty
  questionType: QuestionType
  question: string
  expectedAnswer: string       // For evaluation reference
  hints?: string[]             // Optional hints if user struggles
  createdAt: string            // ISO timestamp
}

/**
 * Result of answering a test question
 */
export interface TestResult {
  questionId: string
  questionIndex: number
  userAnswer: string
  evaluation: AnswerEvaluation
  feedback: string
  masteryChange: number        // How much mastery changed
  previousMastery: number
  newMastery: number
  answeredAt: string           // ISO timestamp
  timeToAnswerMs?: number      // How long user took to answer
}

/**
 * Active test session state
 */
export interface TestSession {
  sessionId: string
  userId: string
  status: TestSessionStatus
  startedAt: string            // ISO timestamp
  updatedAt: string            // ISO timestamp
  completedAt?: string         // ISO timestamp when finished

  // Question management
  questions: TestQuestion[]
  currentIndex: number
  results: TestResult[]

  // Session configuration
  targetQuestionCount: number  // How many questions planned
  focusConceptIds?: string[]   // Specific concepts to test (optional)
  difficulty: QuestionDifficulty | 'adaptive'  // Fixed or adaptive difficulty

  // Computed statistics
  score: number                // Percentage correct (0-100)
  correctCount: number
  partialCount: number
  incorrectCount: number
}

/**
 * Test session summary shown at end
 */
export interface TestSessionSummary {
  sessionId: string
  userId: string
  duration: number             // Minutes
  questionsAnswered: number
  score: number                // Percentage

  // Breakdown by result
  correct: Array<{
    conceptId: string
    conceptLabel: string
    masteryBefore: number
    masteryAfter: number
  }>

  incorrect: Array<{
    conceptId: string
    conceptLabel: string
    masteryBefore: number
    masteryAfter: number
    feedback: string
  }>

  partial: Array<{
    conceptId: string
    conceptLabel: string
    masteryBefore: number
    masteryAfter: number
    feedback: string
  }>

  // Recommendations
  recommendations: string[]
  conceptsToReview: string[]   // Concept IDs that need more work
}

/**
 * Input for creating a new test session
 */
export interface CreateTestSessionInput {
  userId: string
  targetQuestionCount?: number  // Default: 10
  focusConceptIds?: string[]    // If empty, auto-select based on mastery
  difficulty?: QuestionDifficulty | 'adaptive'  // Default: adaptive
}

/**
 * Input for answering a question
 */
export interface AnswerQuestionInput {
  sessionId: string
  userId: string
  questionId: string
  answer: string
}

/**
 * Question generation request
 */
export interface GenerateQuestionRequest {
  userId: string
  conceptId?: string           // Specific concept or auto-select
  difficulty?: QuestionDifficulty | 'auto'
  questionType?: QuestionType
  avoidQuestionIds?: string[]  // Don't repeat these
}

/**
 * Question generation result
 */
export interface GenerateQuestionResult {
  question: TestQuestion
  context: string              // RAG context used for generation
  reasoning: string            // Why this question was chosen
}

/**
 * Test session history entry (for listing past sessions)
 */
export interface TestSessionHistoryEntry {
  sessionId: string
  startedAt: string
  completedAt?: string
  status: TestSessionStatus
  questionsAnswered: number
  score: number
  conceptsTested: string[]
}

/**
 * Default values for test session
 */
export const DEFAULT_TEST_SESSION_CONFIG = {
  targetQuestionCount: 10,
  difficulty: 'adaptive' as const,
  maxSessionDurationMinutes: 60,
}

/**
 * Mastery change values for test mode (stronger signals)
 */
export const TEST_MODE_MASTERY_CHANGES = {
  correct: 0.3,      // Strong positive signal
  partial: 0.1,      // Slight positive
  incorrect: -0.2,   // Negative but not devastating
}

/**
 * Score thresholds for session ratings
 */
export const SESSION_SCORE_THRESHOLDS = {
  excellent: 90,     // 90%+ = Excellent
  good: 70,          // 70-89% = Good
  needsWork: 50,     // 50-69% = Needs Work
  struggling: 0,     // <50% = Struggling
}
