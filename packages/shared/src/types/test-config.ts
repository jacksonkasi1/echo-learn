// ** Test Configuration types for Echo-Learn Test Mode
// ** User-facing configuration options before starting a test

import type { QuestionDifficulty } from "./learning.js";

/**
 * Skill level - user-friendly names that map to technical difficulty
 */
export type SkillLevel = "beginner" | "intermediate" | "pro";

/**
 * Question style preference
 */
export type QuestionStyle = "scenario" | "concept" | "mixed";

/**
 * Question format preference
 */
export type QuestionFormat = "multiple-choice" | "open-ended" | "mixed";

/**
 * Test timing mode
 */
export type TimingMode = "timed" | "untimed";

/**
 * Scenario type for scenario-based questions
 */
export type ScenarioType = "decision" | "debug" | "design";

/**
 * Complete test configuration from user input
 */
export interface TestConfiguration {
  // Skill & Difficulty
  skillLevel: SkillLevel;

  // Question Preferences
  questionStyle: QuestionStyle;
  questionFormat: QuestionFormat;
  questionCount: number;

  // Timing
  timingMode: TimingMode;
  timePerQuestion?: number; // seconds (30, 60, 90, 120)
  totalTimeLimit?: number; // minutes (optional hard cap)

  // Focus Areas (optional)
  focusConceptIds?: string[];
}

/**
 * Scenario context for scenario-based questions
 */
export interface ScenarioContext {
  /** Brief setup of the scenario */
  situation: string;

  /** Role the user plays in this scenario */
  role?: string;

  /** Constraints or requirements */
  constraints?: string[];

  /** Background information */
  background?: string;

  /** Domain/industry context */
  domain?: string;
}

/**
 * Detailed evaluation result with feedback
 */
export interface DetailedEvaluation {
  /** Overall evaluation */
  evaluation: "correct" | "partial" | "incorrect";

  /** Human-readable feedback */
  feedback: string;

  /** Summary of what concept was tested */
  conceptSummary: string;

  /** Correct approach (only shown if not correct) */
  correctApproach?: string;

  /** Key points the user got right */
  keyPointsHit: string[];

  /** Key points the user missed */
  keyPointsMissed: string[];

  /** Confidence in the evaluation (0-1) */
  confidence: number;
}

/**
 * Skill level to difficulty mapping
 */
export const SKILL_LEVEL_DIFFICULTY_MAP: Record<
  SkillLevel,
  QuestionDifficulty
> = {
  beginner: "easy",
  intermediate: "medium",
  pro: "hard",
};

/**
 * Difficulty to skill level mapping (reverse)
 */
export const DIFFICULTY_SKILL_LEVEL_MAP: Record<
  QuestionDifficulty,
  SkillLevel
> = {
  easy: "beginner",
  medium: "intermediate",
  hard: "pro",
};

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIGURATION: TestConfiguration = {
  skillLevel: "intermediate",
  questionStyle: "mixed",
  questionFormat: "mixed",
  questionCount: 10,
  timingMode: "untimed",
  timePerQuestion: 60,
};

/**
 * Available question counts
 */
export const QUESTION_COUNT_OPTIONS = [5, 10, 15, 20] as const;

/**
 * Available time per question options (in seconds)
 */
export const TIME_PER_QUESTION_OPTIONS = [30, 60, 90, 120] as const;

/**
 * Skill level display information
 */
export const SKILL_LEVEL_INFO: Record<
  SkillLevel,
  { label: string; description: string }
> = {
  beginner: {
    label: "Beginner",
    description: "Basic definitions and simple applications",
  },
  intermediate: {
    label: "Intermediate",
    description: "Practical scenarios and comparisons",
  },
  pro: {
    label: "Pro",
    description: "Complex analysis and edge cases",
  },
};

/**
 * Question style display information
 */
export const QUESTION_STYLE_INFO: Record<
  QuestionStyle,
  { label: string; description: string }
> = {
  scenario: {
    label: "Scenario-Based",
    description: "Real-world situations and decision-making",
  },
  concept: {
    label: "Concept-Based",
    description: "Definitions, explanations, and theory",
  },
  mixed: {
    label: "Mixed",
    description: "Combination of both styles",
  },
};

/**
 * Question format display information
 */
export const QUESTION_FORMAT_INFO: Record<
  QuestionFormat,
  { label: string; description: string }
> = {
  "multiple-choice": {
    label: "Multiple Choice",
    description: "Select from options - good for quick recall",
  },
  "open-ended": {
    label: "Open-Ended",
    description: "Type your answer - tests deeper understanding",
  },
  mixed: {
    label: "Mixed",
    description: "Combination of both formats",
  },
};

/**
 * Timing mode display information
 */
export const TIMING_MODE_INFO: Record<
  TimingMode,
  { label: string; description: string }
> = {
  untimed: {
    label: "Untimed",
    description: "Take your time, no pressure",
  },
  timed: {
    label: "Timed",
    description: "Time limit per question",
  },
};
