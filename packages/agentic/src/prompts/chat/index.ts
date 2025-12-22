import { MODE_PROMPTS } from "@repo/shared";

/**
 * Get system prompt for chat mode
 */
export function getChatModeSystemPrompt(): string {
  return MODE_PROMPTS.chat;
}

/**
 * Get extended system prompt with context for chat mode
 */
export function getChatModeSystemPromptWithContext(
  basePrompt: string,
  userLevel?: string
): string {
  return `${basePrompt}

## Mode: CHAT MODE (Off-Record)
This conversation is NOT being tracked for learning purposes.
The user wants to explore freely without affecting their learning profile.

Guidelines:
- Answer questions directly and helpfully
- Don't mention learning progress or suggest saving anything
- Be conversational and relaxed
- No need to structure responses for learning optimization
- Feel free to discuss tangential topics${
    userLevel
      ? `\n\nNote: User's general level is ${userLevel}, but this doesn't affect how you respond in chat mode.`
      : ""
  }`;
}
