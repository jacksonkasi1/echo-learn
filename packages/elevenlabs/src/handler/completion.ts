// ** import types
import type { ChatMessage } from "@repo/llm";
import type {
  ElevenLabsProcessingOptions,
  ElevenLabsCompletionResult,
} from "../types/index.js";

// ** import lib
import { getAgenticRouter } from "@repo/agentic";
import { buildSystemPrompt } from "@repo/llm";
import { getUserProfile } from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";
import {
  createSSEChunk,
  formatSSEChunk,
  formatSSEDone,
  detectBufferPhraseType,
  formatBufferSSE,
  shouldUseBufferWords,
} from "../sse/index.js";
import { shouldEndConversation, shouldSkipTurn } from "./system-tools.js";

/**
 * Extract the latest user message from conversation
 */
function extractUserMessage(messages: ChatMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  return lastUserMessage?.content || null;
}

/**
 * Convert ReadableStream to AsyncIterable
 */
async function* streamToAsyncIterable(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        // Flush any remaining bytes
        const remaining = decoder.decode(undefined, { stream: false });
        if (remaining) {
          yield remaining;
        }
        break;
      }
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Create an SSE stream from text chunks
 */
function createSSEStreamFromChunks(
  chunks: AsyncIterable<string>,
  options?: {
    model?: string;
    prependBuffer?: string;
  },
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const { model = "echo-learn-v1", prependBuffer } = options || {};

  let isFirst = true;
  let hasSentBuffer = false;

  return new ReadableStream({
    async start(controller) {
      try {
        // Send buffer phrase first if provided
        if (prependBuffer) {
          controller.enqueue(encoder.encode(prependBuffer));
          hasSentBuffer = true;
          isFirst = false;
        }

        // Stream the actual content
        for await (const text of chunks) {
          if (text) {
            const chunk = createSSEChunk(text, { isFirst, model });
            controller.enqueue(encoder.encode(formatSSEChunk(chunk)));
            isFirst = false;
          }
        }

        // Send final chunk with finish_reason
        const finalChunk = createSSEChunk("", { isFinal: true, model });
        controller.enqueue(encoder.encode(formatSSEChunk(finalChunk)));

        // Send done signal
        controller.enqueue(encoder.encode(formatSSEDone()));

        controller.close();
      } catch (error) {
        logger.error("SSE stream error", { error });
        controller.error(error);
      }
    },
  });
}

/**
 * Process an ElevenLabs chat completion request
 * This is the main handler that integrates with the agentic RAG system
 */
export async function processElevenLabsCompletion(
  options: ElevenLabsProcessingOptions,
): Promise<ElevenLabsCompletionResult> {
  const {
    userId,
    messages,
    maxTokens,
    temperature,
    useBufferWords,
    conversationId,
  } = options;

  const startTime = Date.now();

  logger.info("Processing ElevenLabs completion", {
    userId,
    messageCount: messages.length,
    maxTokens,
    useBufferWords,
    conversationId,
  });

  try {
    // Extract user message
    const userMessage = extractUserMessage(messages);

    if (!userMessage) {
      throw new Error("No user message provided");
    }

    // Check for conversation control scenarios
    if (shouldEndConversation(userMessage)) {
      logger.info("User requested end of conversation", { userId });
      // Return a farewell message
      const farewellStream = createFarewellStream();
      return {
        stream: farewellStream,
        knowledgeChunks: [],
        retrievedSources: [],
        conversationId,
      };
    }

    if (shouldSkipTurn(userMessage)) {
      logger.info("User needs time, skipping turn", { userId });
      // Return empty/minimal response
      const skipStream = createSkipTurnStream();
      return {
        stream: skipStream,
        knowledgeChunks: [],
        retrievedSources: [],
        conversationId,
      };
    }

    // Determine if we should use buffer words
    const shouldBuffer =
      useBufferWords &&
      shouldUseBufferWords({
        messageLength: userMessage.length,
        hasRagContext: true,
        hasToolCalls: true,
      });

    // Determine buffer phrase type based on user message
    const bufferType = detectBufferPhraseType(userMessage);

    // Get agentic router
    const router = getAgenticRouter();

    // Process query through agentic router
    const result = await router.processQuery(userMessage, {
      userId,
      messages,
      useRag: true,
      ragTopK: 10,
      ragMinScore: 0.01,
      maxTokens,
      temperature,
      enableReranking: false, // Keep low latency for voice
      enableMultiStep: true,
      maxIterations: 3, // Limit iterations for voice latency
    });

    const processingTimeMs = Date.now() - startTime;

    logger.info("ElevenLabs completion processed", {
      userId,
      processingTimeMs,
      chunksRetrieved: result.retrievedChunks.length,
      sourcesFound: result.retrievedSources.length,
      toolCalls: result.toolCalls.length,
    });

    // Prepare buffer phrase if needed
    const bufferSSE = shouldBuffer
      ? formatBufferSSE(bufferType, { model: "echo-learn-v1" })
      : undefined;

    // Convert the stream to SSE format
    if (result.stream) {
      const sseStream = createSSEStreamFromChunks(
        streamToAsyncIterable(result.stream),
        {
          model: "echo-learn-v1",
          prependBuffer: bufferSSE,
        },
      );

      return {
        stream: sseStream,
        knowledgeChunks: result.retrievedChunks,
        retrievedSources: result.retrievedSources,
        conversationId,
      };
    }

    // Fallback: create stream from response text
    const textStream = createTextStream(result.response || "I apologize, but I couldn't generate a response.");

    return {
      stream: textStream,
      knowledgeChunks: result.retrievedChunks,
      retrievedSources: result.retrievedSources,
      conversationId,
    };
  } catch (error) {
    logger.error("ElevenLabs completion failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      userId,
    });

    // Return error stream instead of throwing
    const errorStream = createErrorStream(
      "I'm sorry, I encountered an issue processing your request. Could you try again?",
    );

    return {
      stream: errorStream,
      knowledgeChunks: [],
      retrievedSources: [],
      conversationId,
    };
  }
}

/**
 * Create a simple text stream for a single message
 */
function createTextStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();

  return new ReadableStream({
    start(controller) {
      // First chunk with role
      const firstChunk = createSSEChunk(text, { isFirst: true, model: "echo-learn-v1" });
      controller.enqueue(encoder.encode(formatSSEChunk(firstChunk)));

      // Final chunk
      const finalChunk = createSSEChunk("", { isFinal: true, model: "echo-learn-v1" });
      controller.enqueue(encoder.encode(formatSSEChunk(finalChunk)));

      // Done signal
      controller.enqueue(encoder.encode(formatSSEDone()));

      controller.close();
    },
  });
}

/**
 * Create a farewell stream for ending conversations
 */
function createFarewellStream(): ReadableStream<Uint8Array> {
  return createTextStream(
    "It was great studying with you! Feel free to come back anytime. Goodbye!",
  );
}

/**
 * Create a minimal stream for skip turn scenarios
 */
function createSkipTurnStream(): ReadableStream<Uint8Array> {
  return createTextStream("Take your time. I'm here when you're ready.");
}

/**
 * Create an error stream with a friendly message
 */
function createErrorStream(message: string): ReadableStream<Uint8Array> {
  return createTextStream(message);
}

/**
 * Validate ElevenLabs request parameters
 */
export function validateElevenLabsRequest(request: unknown): {
  valid: boolean;
  error?: string;
} {
  if (!request || typeof request !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const req = request as Record<string, unknown>;

  if (!req.messages || !Array.isArray(req.messages)) {
    return { valid: false, error: "Messages array is required" };
  }

  if (req.messages.length === 0) {
    return { valid: false, error: "At least one message is required" };
  }

  return { valid: true };
}

/**
 * Extract user ID from ElevenLabs request
 * Checks multiple possible sources
 */
export function extractUserId(request: Record<string, unknown>): string {
  // Check elevenlabs_extra_body first
  const extraBody = request.elevenlabs_extra_body as Record<string, unknown> | undefined;
  if (extraBody?.user_id && typeof extraBody.user_id === "string") {
    return extraBody.user_id;
  }

  // Check standard fields
  if (request.user_id && typeof request.user_id === "string") {
    return request.user_id;
  }

  if (request.user && typeof request.user === "string") {
    return request.user;
  }

  // Default fallback
  return "anonymous";
}
