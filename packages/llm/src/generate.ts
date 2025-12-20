// ** import types
import type { UserProfile } from "@repo/shared";

// ** import lib
import { google } from "@ai-sdk/google";
import { generateText, streamText } from "ai";

// ** import utils
import { logger } from "@repo/logs";

// Default model - can be overridden via environment
const DEFAULT_MODEL = "gemini-2.0-flash";

/**
 * Get the configured Gemini model
 */
function getModel() {
  const modelName = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  return google(modelName);
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface GenerateOptions {
  systemPrompt: string;
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface StreamingResult {
  textStream: AsyncIterable<string>;
  fullText: Promise<string>;
}

/**
 * Generate a streaming response using Gemini
 * Preferred for voice applications to minimize latency
 */
export async function generateStreamingResponse(
  options: GenerateOptions,
): Promise<StreamingResult> {
  const {
    systemPrompt,
    messages,
    maxTokens = 1024,
    temperature = 0.7,
  } = options;

  try {
    logger.info("Generating streaming response", {
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length,
    });

    const result = await streamText({
      model: getModel(),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      maxTokens,
      temperature,
    });

    return {
      textStream: result.textStream,
      fullText: result.text,
    };
  } catch (error) {
    logger.error("Failed to generate streaming response", error);
    throw error;
  }
}

/**
 * Generate a non-streaming response using Gemini
 * Simpler to use when latency is not critical
 */
export async function generateResponse(
  options: GenerateOptions,
): Promise<string> {
  const {
    systemPrompt,
    messages,
    maxTokens = 1024,
    temperature = 0.7,
  } = options;

  try {
    logger.info("Generating response", {
      messageCount: messages.length,
      systemPromptLength: systemPrompt.length,
    });

    const result = await generateText({
      model: getModel(),
      system: systemPrompt,
      messages: messages.map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      })),
      maxTokens,
      temperature,
    });

    logger.info("Response generated successfully", {
      responseLength: result.text.length,
      finishReason: result.finishReason,
    });

    return result.text;
  } catch (error) {
    logger.error("Failed to generate response", error);
    throw error;
  }
}

/**
 * Generate a response with conversation context
 * Automatically includes recent history for context
 */
export async function generateResponseWithContext(options: {
  systemPrompt: string;
  userMessage: string;
  conversationHistory: ChatMessage[];
  maxHistoryMessages?: number;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const {
    systemPrompt,
    userMessage,
    conversationHistory,
    maxHistoryMessages = 10,
    maxTokens = 1024,
    temperature = 0.7,
  } = options;

  // Trim history to avoid token overflow
  const recentHistory = conversationHistory.slice(-maxHistoryMessages);

  // Add the current user message
  const messages: ChatMessage[] = [
    ...recentHistory,
    { role: "user", content: userMessage },
  ];

  return generateResponse({
    systemPrompt,
    messages,
    maxTokens,
    temperature,
  });
}

/**
 * Generate a quiz question based on content
 */
export async function generateQuizQuestion(
  content: string,
  topic: string,
  difficulty: "easy" | "medium" | "hard" = "medium",
): Promise<string> {
  const difficultyInstructions = {
    easy: "Ask a simple, direct question that tests basic recall.",
    medium: "Ask a question that requires understanding the concept.",
    hard: "Ask a challenging question that requires applying or analyzing the concept.",
  };

  const prompt = `
Based on this study material, generate ONE quiz question about "${topic}".

Material:
${content}

${difficultyInstructions[difficulty]}

Important:
- Make it conversational (this will be spoken)
- Don't use multiple choice format
- The question should be answerable from the material provided
- Keep it concise

Just output the question, nothing else.
`.trim();

  try {
    const result = await generateText({
      model: getModel(),
      prompt,
      maxTokens: 256,
      temperature: 0.8,
    });

    return result.text.trim();
  } catch (error) {
    logger.error("Failed to generate quiz question", error);
    throw error;
  }
}

/**
 * Evaluate a quiz answer
 */
export async function evaluateAnswer(
  question: string,
  userAnswer: string,
  correctContent: string,
): Promise<{
  isCorrect: boolean;
  feedback: string;
}> {
  const prompt = `
Question: ${question}
User's Answer: ${userAnswer}
Reference Material: ${correctContent}

Evaluate if the user's answer is correct or mostly correct based on the reference material.
Be generous - partial credit for partial understanding.

Respond in JSON format:
{
  "isCorrect": true/false,
  "feedback": "Brief, encouraging feedback (1-2 sentences)"
}

Keep feedback conversational - this will be spoken aloud.
`.trim();

  try {
    const result = await generateText({
      model: getModel(),
      prompt,
      maxTokens: 256,
      temperature: 0.3,
    });

    // Parse JSON response
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        isCorrect: Boolean(parsed.isCorrect),
        feedback: parsed.feedback || "Thanks for your answer!",
      };
    }

    // Fallback if JSON parsing fails
    return {
      isCorrect: result.text.toLowerCase().includes("correct"),
      feedback: result.text,
    };
  } catch (error) {
    logger.error("Failed to evaluate answer", error);
    return {
      isCorrect: false,
      feedback: "I couldn't evaluate your answer. Let's try another question!",
    };
  }
}

/**
 * Extract topics discussed from a conversation
 */
export async function extractTopicsFromConversation(
  messages: ChatMessage[],
): Promise<string[]> {
  if (messages.length === 0) return [];

  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n")
    .slice(-4000); // Limit context

  const prompt = `
Analyze this study conversation and extract the main topics discussed.
Return a JSON array of topic strings (lowercase, concise).
Maximum 5 topics.

Conversation:
${conversationText}

Response format: ["topic1", "topic2", "topic3"]
`.trim();

  try {
    const result = await generateText({
      model: getModel(),
      prompt,
      maxTokens: 128,
      temperature: 0.3,
    });

    const arrayMatch = result.text.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      return JSON.parse(arrayMatch[0]);
    }

    return [];
  } catch (error) {
    logger.error("Failed to extract topics", error);
    return [];
  }
}
