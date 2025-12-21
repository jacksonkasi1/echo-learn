// ** import types
import type { SSEStreamChunk } from "../types/index.js";

// ** import utils
import { createSSEChunk, formatSSEChunk } from "./transform.js";

/**
 * Buffer phrases for latency optimization
 * These phrases are spoken while the LLM processes the request
 * The trailing space and ellipsis ensure smooth TTS transition
 */
const BUFFER_PHRASES = [
  "Let me think about that... ",
  "Looking at your materials... ",
  "Checking my knowledge... ",
  "One moment... ",
  "Let me find that for you... ",
  "Searching through your notes... ",
  "Hmm, let me see... ",
] as const;

/**
 * Buffer phrases specifically for study-related queries
 */
const STUDY_BUFFER_PHRASES = [
  "Let me check your study materials... ",
  "Looking through your notes... ",
  "Searching your uploaded content... ",
  "Let me find the relevant information... ",
] as const;

/**
 * Buffer phrases for quiz/question scenarios
 */
const QUIZ_BUFFER_PHRASES = [
  "Interesting question... ",
  "Let me think about how to explain this... ",
  "Good question, let me elaborate... ",
] as const;

/**
 * Types of buffer phrases
 */
export type BufferPhraseType = "general" | "study" | "quiz";

/**
 * Get a random buffer phrase
 */
export function getRandomBufferPhrase(type: BufferPhraseType = "general"): string {
  let phrases: readonly string[];

  switch (type) {
    case "study":
      phrases = STUDY_BUFFER_PHRASES;
      break;
    case "quiz":
      phrases = QUIZ_BUFFER_PHRASES;
      break;
    default:
      phrases = BUFFER_PHRASES;
  }

  const index = Math.floor(Math.random() * phrases.length);
  return phrases[index] ?? BUFFER_PHRASES[0]!;
}

/**
 * Detect the appropriate buffer phrase type based on user message
 */
export function detectBufferPhraseType(userMessage: string): BufferPhraseType {
  const lowerMessage = userMessage.toLowerCase();

  // Quiz-related keywords
  const quizKeywords = [
    "quiz",
    "test",
    "question",
    "explain",
    "what is",
    "how does",
    "why",
    "define",
  ];

  // Study-related keywords
  const studyKeywords = [
    "study",
    "notes",
    "material",
    "upload",
    "document",
    "file",
    "content",
    "chapter",
    "topic",
  ];

  for (const keyword of quizKeywords) {
    if (lowerMessage.includes(keyword)) {
      return "quiz";
    }
  }

  for (const keyword of studyKeywords) {
    if (lowerMessage.includes(keyword)) {
      return "study";
    }
  }

  return "general";
}

/**
 * Create an SSE chunk containing a buffer phrase
 */
export function createBufferChunk(
  type: BufferPhraseType = "general",
  options?: {
    model?: string;
  },
): SSEStreamChunk {
  const phrase = getRandomBufferPhrase(type);
  return createSSEChunk(phrase, {
    isFirst: true,
    model: options?.model || "echo-learn-v1",
  });
}

/**
 * Format a buffer phrase as an SSE string
 */
export function formatBufferSSE(
  type: BufferPhraseType = "general",
  options?: {
    model?: string;
  },
): string {
  const chunk = createBufferChunk(type, options);
  return formatSSEChunk(chunk);
}

/**
 * Create an async generator that yields a buffer phrase first
 * then yields content from the source stream
 */
export async function* streamWithBuffer(
  sourceStream: ReadableStream<Uint8Array>,
  options?: {
    useBuffer?: boolean;
    bufferType?: BufferPhraseType;
    model?: string;
  },
): AsyncGenerator<string, void, unknown> {
  const { useBuffer = true, bufferType = "general", model } = options || {};

  // Yield buffer phrase first if enabled
  if (useBuffer) {
    yield formatBufferSSE(bufferType, { model });
  }

  // Then yield content from source stream
  const reader = sourceStream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      // Decode and yield the chunk
      const text = decoder.decode(value, { stream: true });
      if (text) {
        yield text;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Determine if buffer words should be used based on processing time estimate
 * Returns true if the expected processing time exceeds threshold
 */
export function shouldUseBufferWords(options: {
  messageLength: number;
  hasRagContext: boolean;
  hasToolCalls: boolean;
  thresholdMs?: number;
}): boolean {
  const {
    messageLength,
    hasRagContext,
    hasToolCalls,
    thresholdMs = 200,
  } = options;

  // Estimate processing time based on factors
  let estimatedMs = 100; // Base latency

  // Longer messages take more time
  if (messageLength > 100) {
    estimatedMs += 50;
  }
  if (messageLength > 500) {
    estimatedMs += 100;
  }

  // RAG retrieval adds latency
  if (hasRagContext) {
    estimatedMs += 150;
  }

  // Tool calls add significant latency
  if (hasToolCalls) {
    estimatedMs += 200;
  }

  return estimatedMs > thresholdMs;
}
