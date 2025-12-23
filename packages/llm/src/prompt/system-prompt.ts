// ** import types
import type { UserProfile } from "@repo/shared";

import { CORE_INSTRUCTIONS } from "./templates/core-instructions.js";

export interface PromptContext {
  knowledgeChunks: string[];
  userProfile: UserProfile;
  conversationHistory?: Array<{ role: string; content: string }>;
  mode?: "learn" | "chat" | "test";
  skillLevel?: "beginner" | "intermediate" | "pro";
}

/**
 * Build the system prompt for the Echo-Learn tutor
 * Combines persona, knowledge context, user profile, and behavior rules
 */
export function buildSystemPrompt(context: PromptContext): string {
  const { knowledgeChunks, userProfile, mode, skillLevel } = context;

  // Use override skill level if provided, otherwise fall back to profile level
  const effectiveLevel = skillLevel || userProfile.level;

  const knowledgeSection = formatKnowledgeSection(knowledgeChunks);
  const profileSection = formatProfileSection(userProfile, skillLevel);

  // Split core instructions to inject context in the middle
  const parts = CORE_INSTRUCTIONS.split("## Your Behavior Guidelines");
  const persona = parts[0] || "";
  const guidelinesTemplate = parts[1] || "";

  const guidelines = guidelinesTemplate.replace(
    "{{userLevel}}",
    effectiveLevel,
  );

  // Mode-specific instructions
  let modeInstructions = "";
  if (mode === "test") {
    modeInstructions = `
## Test Mode active
You are currently in Test Mode. Your primary goal is to assess the user's knowledge.
- Ask challenging but fair questions based on the materials.
- Evaluate the user's responses accurately.
- Provide constructive feedback.
- Use the available quiz tools to present questions when appropriate.
`;
  }

  return `
${persona.trim()}
${modeInstructions}

## Knowledge Context
The following excerpts are from the user's uploaded study materials. Use ONLY this information to answer questions:

${knowledgeSection}

## User's Learning Profile
${profileSection}

## Your Behavior Guidelines
${guidelines}
`.trim();
}

/**
 * Format knowledge chunks into a readable section
 */
function formatKnowledgeSection(chunks: string[]): string {
  if (chunks.length === 0) {
    return "No study materials have been uploaded yet. The user needs to upload content before you can help them study.";
  }

  return chunks
    .map((chunk, index) => `[Source ${index + 1}]\n${chunk}`)
    .join("\n\n---\n\n");
}

/**
 * Format user profile into a readable section
 */
function formatProfileSection(
  profile: UserProfile,
  skillLevelOverride?: string,
): string {
  const parts: string[] = [];

  parts.push(`- Experience Level: ${skillLevelOverride || profile.level}`);
  parts.push(`- Questions Answered: ${profile.questionsAnswered}`);

  if (profile.weakAreas.length > 0) {
    parts.push(`- Areas Needing Work: ${profile.weakAreas.join(", ")}`);
  }

  if (profile.strongAreas.length > 0) {
    parts.push(`- Strong Areas: ${profile.strongAreas.join(", ")}`);
  }

  if (profile.coveredTopics.length > 0) {
    parts.push(
      `- Topics Already Covered: ${profile.coveredTopics.slice(-10).join(", ")}${profile.coveredTopics.length > 10 ? "..." : ""}`,
    );
  }

  if (profile.lastInteraction) {
    parts.push(`- Last Active: ${formatRelativeTime(profile.lastInteraction)}`);
  }

  return parts.join("\n");
}

/**
 * Format a timestamp as relative time
 */
function formatRelativeTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  } catch {
    return "recently";
  }
}

/**
 * Build a quiz prompt for testing user knowledge
 */
export function buildQuizPrompt(
  topic: string,
  knowledgeChunks: string[],
  difficulty: "easy" | "medium" | "hard" = "medium",
): string {
  const difficultyGuidelines = {
    easy: "Ask basic recall questions. Accept partial answers.",
    medium: "Ask questions that require understanding, not just memorization.",
    hard: "Ask questions that require applying knowledge or making connections.",
  };

  return `
Generate a quiz question about "${topic}" based on the following material:

${knowledgeChunks.join("\n\n")}

Difficulty: ${difficulty}
${difficultyGuidelines[difficulty]}

Format your response as a conversational question. Don't use multiple choice format.
After asking, wait for the user's response before evaluating.
`.trim();
}

/**
 * Build a summary prompt for a study session
 */
export function buildSessionSummaryPrompt(
  topicsCovered: string[],
  questionsAsked: number,
  userProfile: UserProfile,
): string {
  return `
Provide a brief, encouraging summary of this study session.

Topics Covered: ${topicsCovered.join(", ") || "General review"}
Questions Discussed: ${questionsAsked}
User Level: ${userProfile.level}

Keep the summary to 2-3 sentences. Be encouraging and suggest what to focus on next time.
`.trim();
}
