// ** Smart Follow-Up Suggestion Generator for Echo-Learn
// ** Uses LLM + RAG to generate contextually relevant follow-up questions like Perplexity
// ** Works for all modes: learn, chat, test

// ** import types
import type { FollowUpSuggestion, ChatMode } from "@repo/shared";

// ** import lib
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ** import storage
import { getKnowledgeGraph } from "@repo/storage";

// ** import rag
import { retrieveContext } from "@repo/rag";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Smart follow-up generation result
 */
export interface SmartFollowUpResult {
  suggestions: FollowUpSuggestion[];
  conceptsDiscussed: string[];
  relatedChunksUsed: number;
  processingTimeMs: number;
}

/**
 * Smart follow-up generation options
 */
export interface SmartFollowUpOptions {
  /** Maximum number of suggestions to generate */
  maxSuggestions?: number;
  /** Number of RAG chunks to retrieve for context */
  ragTopK?: number;
  /** Minimum RAG score threshold */
  ragMinScore?: number;
  /** Whether to include quiz-type suggestions */
  includeQuiz?: boolean;
}

/**
 * Default smart follow-up options
 */
const DEFAULT_OPTIONS: Required<SmartFollowUpOptions> = {
  maxSuggestions: 4,
  ragTopK: 10,
  ragMinScore: 0.3,
  includeQuiz: true,
};

/**
 * Schema for LLM-generated follow-up suggestions
 */
const followUpSchema = z.object({
  suggestions: z.array(
    z.object({
      text: z
        .string()
        .describe(
          "A concise follow-up prompt (max 8-10 words). Keep it short and actionable.",
        ),
      title: z
        .string()
        .describe(
          "Very short title (2-4 words max) for the button. Examples: 'Learn more', 'Quiz: Basics', 'Deep dive'",
        ),
      type: z
        .enum(["explore", "deeper", "example", "quiz", "related", "clarify"])
        .describe("Type of follow-up question"),
      relevance: z
        .number()
        .min(0)
        .max(1)
        .describe("How relevant this question is (0-1)"),
      conceptId: z
        .string()
        .optional()
        .describe("Related concept ID from knowledge graph if applicable"),
    }),
  ),
  extractedTopics: z
    .array(z.string())
    .describe("Key topics/concepts mentioned in the response"),
});

type GeneratedFollowUp = z.infer<typeof followUpSchema>;

/**
 * Get the configured Gemini model
 */
function getModel() {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  return google(modelName);
}

/**
 * Build mode-specific prompt for generating follow-ups
 */
function buildModePrompt(mode: ChatMode): string {
  switch (mode) {
    case "learn":
      return `You are helping a student learn. Generate SHORT follow-up prompts that:
- Help deepen understanding of the topic
- Connect to related concepts they should learn
- Suggest prerequisites if the topic seems advanced

IMPORTANT: Keep prompts SHORT (max 8-10 words). Examples:
- "Explain X in simple terms"
- "Examples of X in practice"
- "How does X relate to Y?"`;

    case "test":
      return `You are a quiz master. The user wants to be TESTED on topics.
Generate prompts that TRIGGER YOU to ask the user questions. These are NOT questions for the user to answer directly.
Instead, they tell you what topic to quiz the user on.

IMPORTANT: These prompts instruct YOU to ask questions, not questions themselves.
Keep prompts SHORT (max 8-10 words). Examples:
- "Ask me about X"
- "Quiz me on Y"
- "Test my knowledge of Z"
- "Question me on the basics"

The prompts should invite you to generate quiz questions for the user to answer.`;

    case "chat":
      return `You are having a casual conversation. Generate SHORT follow-up prompts that:
- Explore interesting tangents from the discussion
- Encourage deeper exploration of interesting points
- Suggest related interesting topics

IMPORTANT: Keep prompts SHORT (max 8-10 words). Examples:
- "Tell me more about X"
- "What about Y?"
- "How does this apply to Z?"`;

    default:
      return `Generate SHORT, helpful follow-up prompts (max 8-10 words).`;
  }
}

/**
 * Generate smart follow-up suggestions using LLM + RAG
 *
 * Algorithm:
 * 1. Use the assistant's response to find related content via RAG
 * 2. Get knowledge graph nodes for concept matching
 * 3. Use LLM to generate contextually relevant follow-up questions
 * 4. Match suggestions to graph concepts where possible
 * 5. Return prioritized suggestions
 */
export async function generateSmartFollowUps(
  userId: string,
  assistantResponse: string,
  userMessage: string,
  mode: ChatMode,
  options: SmartFollowUpOptions = {},
): Promise<SmartFollowUpResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    logger.info("Generating smart follow-up suggestions", {
      userId,
      mode,
      responseLength: assistantResponse.length,
    });

    // Step 1: Retrieve related content from RAG using the response as query
    // This finds related notes/chunks from the user's uploaded materials
    const ragContext = await retrieveContext(assistantResponse, userId, {
      topK: opts.ragTopK,
      minScore: opts.ragMinScore,
    });

    // Step 2: Get knowledge graph for concept matching
    const graph = await getKnowledgeGraph(userId);
    const conceptLabels = graph.nodes.map((n) => n.label).slice(0, 50); // Limit for prompt size

    // Step 3: Build the LLM prompt
    const modePrompt = buildModePrompt(mode);

    const relatedContent =
      ragContext.chunks.length > 0
        ? `\n\nRELATED CONTENT FROM USER'S NOTES:\n${ragContext.chunks.slice(0, 5).join("\n---\n")}`
        : "";

    const knownConcepts =
      conceptLabels.length > 0
        ? `\n\nKNOWN CONCEPTS IN USER'S KNOWLEDGE BASE:\n${conceptLabels.join(", ")}`
        : "";

    const prompt = `${modePrompt}

USER'S QUESTION:
${userMessage}

ASSISTANT'S RESPONSE:
${assistantResponse}
${relatedContent}
${knownConcepts}

Generate ${opts.maxSuggestions} follow-up prompts that would be most helpful for the user.

CRITICAL REQUIREMENTS:
1. Keep each prompt VERY SHORT: max 8-10 words
2. Title must be 2-4 words only (e.g., "Learn more", "Quiz: Basics", "Deep dive")
3. Prompts should be directly relevant to what was just discussed
4. Make prompts specific and actionable, not generic
5. Vary the types (explore, deeper, example, quiz, related, clarify)
${!opts.includeQuiz ? "6. Do NOT include quiz-type prompts" : ""}

BAD examples (too long):
- "Can you explain the fundamental principles of machine learning algorithms?"
- "What are the key differences between supervised and unsupervised learning?"

GOOD examples (concise):
- "Explain ML basics"
- "Examples of supervised learning"
- "Quiz me on algorithms"`;

    // Step 4: Generate suggestions with LLM
    // @ts-ignore - Type mismatch between ai-sdk versions
    const result = await generateObject({
      model: getModel() as any,
      schema: followUpSchema,
      output: "object",
      prompt,
    });

    const generated: GeneratedFollowUp = result.object;

    // Step 5: Map suggestions to FollowUpSuggestion format and match concepts
    const suggestions: FollowUpSuggestion[] = generated.suggestions.map((s) => {
      // Try to match to a graph concept
      let conceptId = s.conceptId;
      if (!conceptId && graph.nodes.length > 0) {
        // Try to find a matching concept by checking if any concept label is in the text
        const matchedNode = graph.nodes.find(
          (n) =>
            s.text.toLowerCase().includes(n.label.toLowerCase()) ||
            s.title.toLowerCase().includes(n.label.toLowerCase()),
        );
        if (matchedNode) {
          conceptId = matchedNode.id;
        }
      }

      // Map type to FollowUpSuggestion type
      const typeMap: Record<string, FollowUpSuggestion["type"]> = {
        explore: "explore",
        deeper: "deeper",
        example: "example",
        quiz: "quiz",
        related: "related",
        clarify: "explore",
      };

      return {
        text: s.text,
        title: s.title, // Include the short title from LLM
        conceptId,
        type: typeMap[s.type] || "explore",
        priority: s.relevance,
      };
    });

    // Sort by priority and limit
    suggestions.sort((a, b) => b.priority - a.priority);
    const finalSuggestions = suggestions.slice(0, opts.maxSuggestions);

    const processingTimeMs = Date.now() - startTime;

    logger.info("Smart follow-up suggestions generated", {
      userId,
      mode,
      suggestionsGenerated: finalSuggestions.length,
      relatedChunksUsed: ragContext.chunks.length,
      topicsExtracted: generated.extractedTopics.length,
      processingTimeMs,
    });

    return {
      suggestions: finalSuggestions,
      conceptsDiscussed: generated.extractedTopics,
      relatedChunksUsed: ragContext.chunks.length,
      processingTimeMs,
    };
  } catch (error) {
    logger.error("Failed to generate smart follow-up suggestions", {
      userId,
      mode,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Return empty result on error
    return {
      suggestions: [],
      conceptsDiscussed: [],
      relatedChunksUsed: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Generate initial suggestions for the welcome screen using LLM
 * Based on user's knowledge graph and mastery data
 */
export async function generateSmartInitialSuggestions(
  userId: string,
  mode: ChatMode,
  options: SmartFollowUpOptions = {},
): Promise<SmartFollowUpResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    logger.info("Generating smart initial suggestions", {
      userId,
      mode,
    });

    // Get knowledge graph
    const graph = await getKnowledgeGraph(userId);

    // If no graph, return empty (let frontend show generic suggestions)
    if (!graph || graph.nodes.length === 0) {
      return {
        suggestions: [],
        conceptsDiscussed: [],
        relatedChunksUsed: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Get a sample of content to understand what the user has uploaded
    const sampleConcepts = graph.nodes
      .filter((n) => n.type === "concept")
      .slice(0, 20)
      .map((n) => n.label);

    const allTopics = graph.nodes.map((n) => n.label).slice(0, 50);

    // Build mode-specific initial prompt
    let modeContext = "";
    switch (mode) {
      case "learn":
        modeContext = `The user wants to LEARN. Suggest SHORT prompts for topics they should study or explore.`;
        break;
      case "test":
        modeContext = `The user wants to be TESTED. Generate prompts that tell the AI to quiz them on topics.
These are NOT questions for the user - they are instructions like "Ask me about X" or "Quiz me on Y".`;
        break;
      case "chat":
        modeContext = `The user wants to CHAT casually. Suggest SHORT, interesting topics to discuss.`;
        break;
    }

    const prompt = `${modeContext}

USER'S KNOWLEDGE BASE CONTAINS THESE TOPICS:
${allTopics.join(", ")}

KEY CONCEPTS:
${sampleConcepts.join(", ")}

Generate ${opts.maxSuggestions} personalized suggestions.

CRITICAL REQUIREMENTS:
1. Keep each prompt VERY SHORT: max 8-10 words
2. Title must be 2-4 words only (e.g., "Learn basics", "Quiz: Topic", "About X")
3. Suggestions should be based on actual topics in their knowledge base
4. Make suggestions specific and actionable
${mode === "test" ? "5. Prompts should trigger the AI to ask questions, e.g., 'Ask me about X', 'Quiz me on Y'" : ""}
${mode === "chat" ? "5. Make suggestions conversational, e.g., 'Tell me about X'" : ""}

GOOD examples:
- Title: "Quiz: Basics" | Text: "Ask me about the fundamentals"
- Title: "Learn more" | Text: "Explain how X works"
- Title: "Deep dive" | Text: "More details on Y"`;

    // Generate with LLM
    // @ts-ignore - Type mismatch between ai-sdk versions
    const result = await generateObject({
      model: getModel() as any,
      schema: followUpSchema,
      output: "object",
      prompt,
    });

    const generated: GeneratedFollowUp = result.object;

    // Map to FollowUpSuggestion format
    const suggestions: FollowUpSuggestion[] = generated.suggestions.map((s) => {
      // Match to graph concept
      const matchedNode = graph.nodes.find(
        (n) =>
          s.text.toLowerCase().includes(n.label.toLowerCase()) ||
          s.title.toLowerCase().includes(n.label.toLowerCase()),
      );

      const typeMap: Record<string, FollowUpSuggestion["type"]> = {
        explore: "explore",
        deeper: "deeper",
        example: "example",
        quiz: "quiz",
        related: "related",
        clarify: "explore",
      };

      return {
        text: s.text,
        title: s.title, // Include the short title from LLM
        conceptId: s.conceptId || matchedNode?.id,
        type: typeMap[s.type] || "explore",
        priority: s.relevance,
      };
    });

    suggestions.sort((a, b) => b.priority - a.priority);
    const finalSuggestions = suggestions.slice(0, opts.maxSuggestions);

    const processingTimeMs = Date.now() - startTime;

    logger.info("Smart initial suggestions generated", {
      userId,
      mode,
      suggestionsGenerated: finalSuggestions.length,
      processingTimeMs,
    });

    return {
      suggestions: finalSuggestions,
      conceptsDiscussed: generated.extractedTopics,
      relatedChunksUsed: 0,
      processingTimeMs,
    };
  } catch (error) {
    logger.error("Failed to generate smart initial suggestions", {
      userId,
      mode,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      suggestions: [],
      conceptsDiscussed: [],
      relatedChunksUsed: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Async wrapper for smart follow-up generation (fire and forget)
 */
export function generateSmartFollowUpsAsync(
  userId: string,
  assistantResponse: string,
  userMessage: string,
  mode: ChatMode,
  callback?: (result: SmartFollowUpResult) => void,
): void {
  setImmediate(async () => {
    try {
      const result = await generateSmartFollowUps(
        userId,
        assistantResponse,
        userMessage,
        mode,
      );
      if (callback) {
        callback(result);
      }
    } catch (error) {
      logger.warn("Async smart follow-up generation failed", {
        userId,
        error: error instanceof Error ? error.message : "Unknown",
      });
    }
  });
}
