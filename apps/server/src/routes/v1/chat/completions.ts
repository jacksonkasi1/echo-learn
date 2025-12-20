// ** import types
import type { Context } from "hono";
import type { ChatCompletionRequest } from "@/schema/chat";

// ** import lib
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

// ** import schema
import { chatCompletionSchema } from "@/schema/chat";

// ** import utils
import { processCompletion } from "@/lib/chat";
import { logger } from "@repo/logs";

const chatRoute = new Hono();

/**
 * POST /v1/chat/completions
 * RAG-enhanced streaming chat completions endpoint
 * Retrieves relevant context from user's uploaded materials
 */
chatRoute.post(
  "/completions",
  zValidator("json", chatCompletionSchema),
  async (c: Context) => {
    const startTime = Date.now();

    try {
      const body = c.req.valid("json" as never) as ChatCompletionRequest;

      const result = await processCompletion(body, startTime);

      return new Response(result.stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Echo-Learn-RAG-Chunks": String(result.knowledgeChunks.length),
          "X-Echo-Learn-RAG-Sources": String(result.retrievedSources.length),
        },
      });
    } catch (error) {
      logger.error("Chat completion failed", error);

      if (
        error instanceof Error &&
        error.message === "No user message provided"
      ) {
        return c.json({ error: error.message }, 400);
      }

      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

/**
 * GET /v1/chat/completions/health
 * Health check for the chat endpoint
 */
chatRoute.get("/completions/health", (c: Context) => {
  return c.json({
    status: "healthy",
    endpoint: "/v1/chat/completions",
    features: {
      rag: true,
      streaming: true,
      userProfiles: true,
      analytics: true,
    },
    timestamp: new Date().toISOString(),
  });
});

export { chatRoute };
