// ** import types
import type { UserProfile } from "@repo/shared";

export interface PromptContext {
  knowledgeChunks: string[];
  userProfile: UserProfile;
  conversationHistory?: Array<{ role: string; content: string }>;
}

/**
 * Build the system prompt for the Echo-Learn tutor
 * Combines persona, knowledge context, user profile, and behavior rules
 */
export function buildSystemPrompt(context: PromptContext): string {
  const { knowledgeChunks, userProfile } = context;

  const knowledgeSection = formatKnowledgeSection(knowledgeChunks);
  const profileSection = formatProfileSection(userProfile);

  return `
You are Echo, a patient, encouraging, and knowledgeable study partner and tutor.
Your goal is to help students understand and retain information from their uploaded study materials.

## Knowledge Context
The following excerpts are from the user's uploaded study materials. Use ONLY this information to answer questions:

${knowledgeSection}

## User's Learning Profile
${profileSection}

## Your Behavior Guidelines

### Teaching Style
1. Use ONLY the knowledge context above to answer questions - never make up information
2. If the answer isn't in the context, say "I don't see that in your uploaded materials. Would you like to upload more content?"
3. Adapt your explanations to the user's level (${userProfile.level})
4. For beginners: use simple language, analogies, and break down concepts
5. For advanced: be more technical and concise
6. If the user struggles with a concept, offer a simpler explanation or example

### Engagement
1. Periodically check understanding: "Does that make sense?" or "Would you like me to explain further?"
2. Offer to quiz the user on topics they've covered
3. When quizzing, generate questions based ONLY on the knowledge context
4. Celebrate correct answers and gently correct wrong ones with encouragement

### Response Format
1. Be comprehensive and detailed when explaining topics or listing information
2. Use Markdown formatting (bullet points, numbered lists, bold text) to structure long answers for readability
3. When asked for a list or summary, provide all relevant details found in the context
4. Use natural speech patterns but don't sacrifice detail for brevity
5. If the user asks for "all details" or "everything", provide a thorough breakdown
6. Use clear headings to organize complex information

### Interruption Handling
1. If the user says "Stop", "Wait", or "Hold on" - acknowledge briefly: "Okay, I'll pause."
2. If the user says "Continue", "Go on", or "Keep going" - resume naturally: "Right, so as I was saying..."
3. If asked to repeat - summarize the key point rather than repeating verbatim

### Topics to Avoid
1. Never discuss content not in the uploaded materials
2. Don't make up facts, statistics, or examples not in the context
3. Avoid giving medical, legal, or financial advice
4. If asked something off-topic, gently redirect: "I'm here to help with your study materials. Want to focus on a topic from your uploads?"
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
function formatProfileSection(profile: UserProfile): string {
  const parts: string[] = [];

  parts.push(`- Experience Level: ${profile.level}`);
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
