// ** import types
import type { Context } from "hono";
import type { ElevenLabsCompletionRequest } from "@/schema/elevenlabs";
import type { ChatMessage } from "@repo/llm";

// ** import lib
import { Hono } from "hono";

// ** import schema
import { elevenlabsCompletionSchema } from "@/schema/elevenlabs";

// ** import utils
import { processElevenLabsCompletion, extractUserId } from "@repo/elevenlabs";
import { logger } from "@repo/logs";

const completionsRoute = new Hono();

// TODO: Remove this hardcoded user ID after testing
// This is for testing ElevenLabs integration with agentic RAG
const DEFAULT_TEST_USER_ID = "user_1766225500960_0hanw9e";

/**
 * POST /elevenlabs/v1/chat/completions
 *
 * ElevenLabs Custom LLM endpoint
 * Optimized for voice conversation with:
 * - Buffer words for perceived latency reduction
 * - SSE streaming format (OpenAI-compatible)
 * - System tool handling (end_call, skip_turn, etc.)
 * - elevenlabs_extra_body support for user context
 *
 * This endpoint is called by ElevenLabs when using Custom LLM configuration
 */
completionsRoute.post("/completions", async (c: Context) => {
  const startTime = Date.now();

  // Log raw request body for debugging
  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
    logger.info("ElevenLabs raw request body", {
      body: JSON.stringify(rawBody, null, 2),
    });
  } catch (parseError) {
    logger.error("Failed to parse request body", {
      error:
        parseError instanceof Error
          ? parseError.message
          : "Unknown parse error",
    });
    return c.json(
      {
        error: {
          message: "Invalid JSON in request body",
          type: "invalid_request_error",
          code: "invalid_json",
        },
      },
      400,
    );
  }

  // Validate with Zod
  const parseResult = elevenlabsCompletionSchema.safeParse(rawBody);
  if (!parseResult.success) {
    logger.error("ElevenLabs request validation failed", {
      errors: parseResult.error.errors,
      rawBody: JSON.stringify(rawBody, null, 2),
    });
    return c.json(
      {
        error: {
          message: `Validation failed: ${parseResult.error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ")}`,
          type: "invalid_request_error",
          code: "validation_error",
          details: parseResult.error.errors,
        },
      },
      400,
    );
  }

  try {
    const body = parseResult.data as ElevenLabsCompletionRequest;

    // Extract user ID from various sources
    // Fall back to hardcoded test user for ElevenLabs testing
    let userId = extractUserId(body as Record<string, unknown>);
    if (userId === "anonymous") {
      userId = DEFAULT_TEST_USER_ID;
      logger.info("Using default test user ID for ElevenLabs", { userId });
    }

    // Extract conversation ID if provided
    const conversationId = body.elevenlabs_extra_body?.conversation_id;

    logger.info("ElevenLabs completion request received", {
      userId,
      conversationId,
      messageCount: body.messages.length,
      hasTools: !!body.tools?.length,
    });

    // Convert messages to ChatMessage format
    const messages: ChatMessage[] = body.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // Process through ElevenLabs handler
    const result = await processElevenLabsCompletion({
      userId,
      messages,
      maxTokens: body.max_tokens,
      temperature: body.temperature,
      useBufferWords: true,
      systemTools: body.tools,
      conversationId,
    });

    const processingTimeMs = Date.now() - startTime;

    logger.info("ElevenLabs completion completed", {
      userId,
      conversationId,
      processingTimeMs,
      chunksRetrieved: result.knowledgeChunks.length,
      sourcesFound: result.retrievedSources.length,
    });

    // Return SSE stream response
    return new Response(result.stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Echo-Learn-RAG-Chunks": String(result.knowledgeChunks.length),
        "X-Echo-Learn-RAG-Sources": String(result.retrievedSources.length),
        "X-Echo-Learn-Processing-Time": String(processingTimeMs),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";

    logger.error("ElevenLabs completion failed", {
      error: errorMessage,
      processingTimeMs: Date.now() - startTime,
    });

    // Return error in a format ElevenLabs can handle
    return c.json(
      {
        error: {
          message: errorMessage,
          type: "server_error",
          code: "internal_error",
        },
      },
      500,
    );
  }
});

/**
 * GET /elevenlabs/v1/chat/completions/health
 *
 * Health check endpoint for ElevenLabs integration
 */
completionsRoute.get("/completions/health", (c: Context) => {
  return c.json({
    status: "healthy",
    endpoint: "/elevenlabs/v1/chat/completions",
    features: {
      rag: true,
      streaming: true,
      sseFormat: true,
      bufferWords: true,
      systemTools: true,
      agenticProcessing: true,
    },
    timestamp: new Date().toISOString(),
  });
});

export { completionsRoute };
