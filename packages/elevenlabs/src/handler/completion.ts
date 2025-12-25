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

/**
 * Extract the latest user message from conversation
 */
function extractUserMessage(messages: ChatMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === "user");
  const lastUserMessage = userMessages[userMessages.length - 1];
  return lastUserMessage?.content || null;
}

/**
 * Markers that indicate we might be in the middle of a pattern to filter
 * If text ends with any of these, we should buffer more before emitting
 */
const PARTIAL_PATTERN_STARTS = [
  "[",
  "[Tool",
  "[Tool ",
  "[Tool Call",
  "[Tool Call:",
  "<!--",
  "<!--TOOL",
  "<!--TOOL_UI",
  "```",
];

/**
 * Check if text might be a partial pattern that needs more content
 */
function mightBePartialPattern(text: string): boolean {
  const trimmed = text.trimEnd();
  // Check if ends with opening bracket or partial marker
  for (const start of PARTIAL_PATTERN_STARTS) {
    if (trimmed.endsWith(start)) return true;
  }
  // Check for unclosed brackets at the end
  const lastOpenBracket = trimmed.lastIndexOf("[");
  const lastCloseBracket = trimmed.lastIndexOf("]");
  if (lastOpenBracket > lastCloseBracket) return true;

  // Check for unclosed HTML comment
  const lastCommentOpen = trimmed.lastIndexOf("<!--");
  const lastCommentClose = trimmed.lastIndexOf("-->");
  if (lastCommentOpen > lastCommentClose) return true;

  // Check for unclosed code block
  const codeBlockMatches = trimmed.match(/```/g);
  if (codeBlockMatches && codeBlockMatches.length % 2 !== 0) return true;

  return false;
}

/**
 * Filter out tool calls, markers, and code from text for voice output
 * This ensures clean, speakable text for TTS
 */
function filterVoiceText(text: string): string {
  let filtered = text;

  // Remove Tool UI markers injected by the agentic system
  filtered = filtered.replace(/<!--TOOL_UI_START:[\s\S]*?:TOOL_UI_END-->/g, "");

  // Remove LLM-generated tool call syntax (various formats)
  // Pattern: [Tool Call: function_name({...})]
  filtered = filtered.replace(/\[Tool Call:\s*\w+\([^)]*\)\]/g, "");
  filtered = filtered.replace(/\[Tool Call:[^\]]*\]/g, "");

  // Remove function call syntax that LLM might generate
  filtered = filtered.replace(/\[present_quiz_question\([^\]]*\)\]/g, "");
  filtered = filtered.replace(/\[save_learning_progress\([^\]]*\)\]/g, "");
  filtered = filtered.replace(/\[search_rag\([^\]]*\)\]/g, "");
  filtered = filtered.replace(/\[generate_adaptive_question\([^\]]*\)\]/g, "");

  // Generic tool/function patterns like [function_name({...})]
  filtered = filtered.replace(/\[\w+_\w+\([^\]]*\)\]/g, "");

  // Remove code blocks that shouldn't be spoken
  filtered = filtered.replace(/```[\s\S]*?```/g, "");

  // Clean up extra whitespace/newlines left behind
  filtered = filtered.replace(/\n{3,}/g, "\n\n").trim();

  return filtered;
}

/**
 * Smart streaming filter for voice output
 * Buffers content when partial patterns are detected to avoid speaking tool calls
 */
class VoiceStreamFilter {
  private buffer: string = "";
  private readonly maxBufferSize: number = 500; // Max chars to buffer before forcing emit

  /**
   * Process incoming text chunk and return filtered text to emit
   * May return empty string if buffering for pattern completion
   */
  processChunk(chunk: string): string {
    this.buffer += chunk;

    // If buffer might contain partial pattern, wait for more
    if (
      mightBePartialPattern(this.buffer) &&
      this.buffer.length < this.maxBufferSize
    ) {
      return "";
    }

    // Filter and emit the buffer
    const filtered = filterVoiceText(this.buffer);
    this.buffer = "";
    return filtered;
  }

  /**
   * Flush any remaining buffered content
   */
  flush(): string {
    if (this.buffer.length === 0) return "";
    const filtered = filterVoiceText(this.buffer);
    this.buffer = "";
    return filtered;
  }
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

        // Use smart streaming filter for voice output
        const filter = new VoiceStreamFilter();

        for await (const text of chunks) {
          if (text) {
            const filtered = filter.processChunk(text);
            if (filtered && filtered.length > 0) {
              const chunk = createSSEChunk(filtered, { isFirst, model });
              controller.enqueue(encoder.encode(formatSSEChunk(chunk)));
              isFirst = false;
            }
          }
        }

        // Flush any remaining buffered content
        const remaining = filter.flush();
        if (remaining && remaining.length > 0) {
          const chunk = createSSEChunk(remaining, { isFirst, model });
          controller.enqueue(encoder.encode(formatSSEChunk(chunk)));
          isFirst = false;
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

    // Note: Conversation control (end_call, skip_turn) is handled by the LLM
    // using ElevenLabs system tools, not by server-side keyword detection.
    // This allows the LLM to make intelligent decisions based on full context.

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
    // Pass isVoiceMode flag so test mode uses verbal questions instead of UI tools
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
      isVoiceMode: true, // Voice mode: don't use interactive UI tools
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
    const textStream = createTextStream(
      result.response || "I apologize, but I couldn't generate a response.",
    );

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
      const firstChunk = createSSEChunk(text, {
        isFirst: true,
        model: "echo-learn-v1",
      });
      controller.enqueue(encoder.encode(formatSSEChunk(firstChunk)));

      // Final chunk
      const finalChunk = createSSEChunk("", {
        isFinal: true,
        model: "echo-learn-v1",
      });
      controller.enqueue(encoder.encode(formatSSEChunk(finalChunk)));

      // Done signal
      controller.enqueue(encoder.encode(formatSSEDone()));

      controller.close();
    },
  });
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
  const extraBody = request.elevenlabs_extra_body as
    | Record<string, unknown>
    | undefined;
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
