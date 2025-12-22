import { MODE_PROMPTS } from "@repo/shared";

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
