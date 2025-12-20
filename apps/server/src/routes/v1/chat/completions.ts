// ** import types
import type { Context } from "hono";

// ** import lib
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// ** import utils
import {
  generateStreamingResponse,
  type ChatMessage,
} from "@/lib/llm/generate-response";
import { logger } from "@repo/logs";

const chatRoute = new Hono();

// OpenAI-compatible message schema
const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

// OpenAI-compatible request schema
const chatCompletionSchema = z.object({
  model: z.string().optional().default("echo-learn-v1"),
  messages: z.array(messageSchema).min(1),
  user: z.string().optional(),
  user_id: z.string().optional(),
  max_tokens: z.number().optional().default(1024),
  temperature: z.number().optional().default(0.7),
  stream: z.boolean().optional().default(true),
});

/**
 * POST /v1/chat/completions
 * Simple streaming chat completions endpoint
 */
chatRoute.post(
  "/completions",
  zValidator("json", chatCompletionSchema),
  async (c: Context) => {
    try {
      // 1. Parse request
      const body = c.req.valid("json" as never) as z.infer<
        typeof chatCompletionSchema
      >;
      const messages = body.messages as ChatMessage[];
      const userId = body.user_id || body.user || "default";
      const maxTokens = body.max_tokens || 1024;
      const temperature = body.temperature || 0.7;

      logger.info("Processing basic chat request", {
        userId,
        messageCount: messages.length,
      });

      // 2. Extract latest user message (validation only)
      const userMessage =
        messages.filter((m) => m.role === "user").pop()?.content || "";

      if (!userMessage) {
        return c.json({ error: "No user message provided" }, 400);
      }

      // 3. Build basic system prompt
      const systemPrompt = `
You are Echo, a helpful and encouraging study assistant.
Help the user learn by answering their questions clearly and concisely.
Adapt your explanations to be easy to understand.
`.trim();

      // 4. Filter messages
      const conversationMessages = messages.filter((m) => m.role !== "system");

      // 5. Stream Response using manual streaming for better control
      logger.info("Starting stream generation");

      const { textStream } = await generateStreamingResponse({
        systemPrompt,
        messages: conversationMessages,
        maxTokens,
        temperature,
      });

      // Create a ReadableStream from the text stream
      const stream = new ReadableStream({
        async start(controller) {
          try {
            let chunkCount = 0;
            let totalLength = 0;

            for await (const chunk of textStream) {
              chunkCount++;
              totalLength += chunk.length;

              if (chunkCount <= 3 || chunkCount % 10 === 0) {
                logger.info("Streaming chunk", {
                  chunkCount,
                  chunkLength: chunk.length,
                  preview: chunk.slice(0, 30),
                });
              }

              // Encode and enqueue the chunk
              controller.enqueue(new TextEncoder().encode(chunk));
            }

            logger.info("Stream completed", { chunkCount, totalLength });
            controller.close();
          } catch (error) {
            logger.error("Streaming failed", error);
            controller.enqueue(
              new TextEncoder().encode("Error generating response"),
            );
            controller.close();
          }
        },
      });

      // Return the streaming response with proper headers
      return new Response(stream, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Transfer-Encoding": "chunked",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    } catch (error) {
      logger.error("Chat completion failed", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

export { chatRoute };
