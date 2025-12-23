// ** Scenario-based Question Generation Prompts
// ** Templates for generating real-world scenario questions

import type { QuestionDifficulty } from "@repo/shared";
import type { ScenarioContext } from "@repo/shared";

/**
 * Scenario type for different question styles
 */
export type ScenarioQuestionType = "decision" | "debug" | "design";

/**
 * Difficulty guidelines for scenario generation
 */
const DIFFICULTY_GUIDELINES: Record<QuestionDifficulty, string> = {
  easy: "straightforward situation with clear best answer, minimal ambiguity",
  medium:
    "realistic situation with some complexity requiring reasoning and analysis",
  hard: "complex situation with multiple valid approaches, trade-offs, and edge cases to consider",
};

/**
 * Scenario type specific guidelines
 */
const SCENARIO_TYPE_GUIDELINES: Record<ScenarioQuestionType, string> = {
  decision: `Create a scenario where the user must make a decision.
The scenario should present a realistic workplace or project situation.
Include relevant context but don't give away the answer.
The user should demonstrate understanding by choosing the right approach.`,

  debug: `Create a scenario where something is not working correctly.
Present symptoms, error messages, or unexpected behavior the user would see.
The user must identify the root cause and explain how to fix the issue.
Focus on common mistakes and misconceptions.`,

  design: `Create a scenario where the user must design or plan a solution.
Provide requirements, constraints, and context.
The user should demonstrate understanding by proposing a well-reasoned approach.
Include trade-offs they should consider.`,
};

/**
 * Get the scenario generation prompt for a concept
 */
export function getScenarioGenerationPrompt(
  conceptLabel: string,
  conceptContext: string,
  difficulty: QuestionDifficulty,
  scenarioType: ScenarioQuestionType
): string {
  return `You are creating a scenario-based test question about: ${conceptLabel}

CONCEPT CONTEXT FROM USER'S MATERIALS:
${conceptContext}

DIFFICULTY: ${difficulty} - ${DIFFICULTY_GUIDELINES[difficulty]}

SCENARIO TYPE: ${scenarioType}
${SCENARIO_TYPE_GUIDELINES[scenarioType]}

REQUIREMENTS:
1. The scenario must be grounded in the user's uploaded materials
2. Make it feel like a real situation, not an academic exercise
3. The question should test practical understanding, not memorization
4. Include enough context for the user to reason through the problem

Generate a scenario-based question with the following structure:

1. SCENARIO SETUP (2-4 sentences):
   - Set the scene with relevant context
   - Define the user's role if applicable
   - Include realistic constraints

2. THE QUESTION (1-2 sentences):
   - Clear, actionable question
   - Should require understanding of ${conceptLabel}

3. EXPECTED ANSWER ELEMENTS:
   - Key points a correct answer must include
   - What demonstrates understanding vs. surface knowledge

OUTPUT FORMAT (JSON):
{
  "scenario": {
    "situation": "The scenario setup text...",
    "role": "Optional role the user plays (e.g., 'developer', 'team lead')",
    "constraints": ["constraint 1", "constraint 2"],
    "domain": "The industry or domain context"
  },
  "question": "The actual question to ask...",
  "expectedAnswerElements": ["key point 1", "key point 2", "key point 3"],
  "conceptBeingTested": "${conceptLabel}",
  "whyThisTests": "Brief explanation of what understanding this question evaluates"
}

Make the scenario feel real and practical, not academic. The user should feel like they're solving a real problem.`;
}

/**
 * Get the scenario evaluation prompt for assessing user answers
 */
export function getScenarioEvaluationPrompt(
  question: string,
  scenario: ScenarioContext,
  expectedElements: string[],
  userAnswer: string,
  conceptLabel: string
): string {
  const constraintsText =
    scenario.constraints && scenario.constraints.length > 0
      ? `Constraints: ${scenario.constraints.join(", ")}`
      : "";

  return `You are evaluating a user's answer to a scenario-based question.

SCENARIO:
${scenario.situation}
${scenario.role ? `Role: ${scenario.role}` : ""}
${constraintsText}
${scenario.domain ? `Domain: ${scenario.domain}` : ""}

QUESTION:
${question}

CONCEPT BEING TESTED: ${conceptLabel}

EXPECTED ANSWER ELEMENTS:
${expectedElements.map((e, i) => `${i + 1}. ${e}`).join("\n")}

USER'S ANSWER:
${userAnswer}

Evaluate the answer and provide:

1. EVALUATION: "correct" | "partial" | "incorrect"
   - correct: Addresses most expected elements with clear understanding
   - partial: Shows some understanding but misses key points
   - incorrect: Misunderstands the concept or scenario

2. FEEDBACK (2-3 sentences):
   - What they got right (be encouraging)
   - What was missing or incorrect (be constructive)
   - Brief explanation of the correct approach

3. CONCEPT SUMMARY (1 sentence):
   - What this question was testing about ${conceptLabel}

OUTPUT FORMAT (JSON):
{
  "evaluation": "correct|partial|incorrect",
  "feedback": "Constructive feedback text...",
  "conceptSummary": "This question tested your understanding of...",
  "correctApproach": "The ideal answer would... (only include if not fully correct)",
  "keyPointsHit": ["points the user got right"],
  "keyPointsMissed": ["points the user missed"],
  "confidence": 0.9
}`;
}

/**
 * Get prompt for concept-based (non-scenario) question evaluation
 */
export function getConceptEvaluationPrompt(
  question: string,
  expectedAnswer: string,
  userAnswer: string,
  conceptLabel: string
): string {
  return `You are evaluating a user's answer to a knowledge question.

QUESTION:
${question}

CONCEPT BEING TESTED: ${conceptLabel}

EXPECTED ANSWER:
${expectedAnswer}

USER'S ANSWER:
${userAnswer}

Evaluate the answer:

1. EVALUATION: "correct" | "partial" | "incorrect"
   - correct: Demonstrates clear understanding of the concept
   - partial: Shows some understanding but incomplete or imprecise
   - incorrect: Wrong or shows fundamental misunderstanding

2. FEEDBACK (2-3 sentences):
   - Acknowledge what's correct
   - Explain what's missing or wrong
   - Provide the correct understanding briefly

OUTPUT FORMAT (JSON):
{
  "evaluation": "correct|partial|incorrect",
  "feedback": "Constructive feedback text...",
  "conceptSummary": "This tested your understanding of ${conceptLabel}",
  "correctApproach": "The correct answer is... (only if not fully correct)",
  "keyPointsHit": ["points correct"],
  "keyPointsMissed": ["points missed"],
  "confidence": 0.85
}`;
}

/**
 * Get prompt for generating multiple scenario questions for a test session
 */
export function getBatchScenarioPrompt(
  concepts: Array<{ id: string; label: string }>,
  count: number,
  difficulty: QuestionDifficulty,
  context: string
): string {
  const conceptList = concepts.map((c) => `- ${c.label} (${c.id})`).join("\n");

  return `Generate ${count} scenario-based test questions for the following concepts:

CONCEPTS TO TEST:
${conceptList}

DIFFICULTY LEVEL: ${difficulty}
${DIFFICULTY_GUIDELINES[difficulty]}

AVAILABLE CONTEXT FROM USER'S MATERIALS:
${context}

REQUIREMENTS:
1. Distribute questions across the concepts
2. Mix scenario types (decision, debug, design) for variety
3. Each question should test practical understanding
4. Questions should be self-contained but interconnected in theme

OUTPUT FORMAT (JSON array):
[
  {
    "conceptId": "concept_id",
    "conceptLabel": "Concept Name",
    "scenarioType": "decision|debug|design",
    "scenario": {
      "situation": "...",
      "role": "...",
      "constraints": ["..."],
      "domain": "..."
    },
    "question": "...",
    "expectedAnswerElements": ["...", "..."],
    "difficulty": "${difficulty}"
  }
]

Generate exactly ${count} questions.`;
}
