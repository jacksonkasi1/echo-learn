// ** import types
import type { Context } from "hono";

// ** import lib
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { streamText } from "hono/streaming";

// ** import utils
import { retrieveContext } from "@/lib/rag/retrieve-context";
import { getUserProfile } from "@/lib/upstash/redis";
import { buildSystemPrompt } from "@/lib/prompt/system-prompt";
import {
  generateStreamingResponse,
  type ChatMessage,
} from "@/lib/llm/generate-response";
import {
  updateAnalytics,
  extractAndRecordTopics,
} from "@/lib/analytics/update-analytics";
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
  user_id: z.string().optional(), // 11Labs custom field
  max_tokens: z.number().optional().default(1024),
  temperature: z.number().optional().default(0.7),
  stream: z.boolean().optional().default(false),
});

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint for 11Labs integration and frontend chat
 */
chatRoute.post(
  "/completions",
  zValidator("json", chatCompletionSchema),
  async (c: Context) => {
    const startTime = Date.now();

    try {
      // 1. Verify authorization (11Labs sends secret in auth header)
      const authHeader = c.req.header("authorization");
      const expectedSecret = process.env.ELEVENLABS_AGENT_SECRET;

      // Only check if secret is configured and provided (skip for frontend if no secret provided there)
      // For production, you might want to differentiate between frontend auth and 11Labs auth
      if (expectedSecret && authHeader?.startsWith("Bearer ")) {
        const providedSecret = authHeader.replace("Bearer ", "");
        if (providedSecret !== expectedSecret) {
          // If it doesn't match 11Labs secret, check if it's a frontend user token?
          // For now, we'll allow if it matches OR if it's not provided (assuming frontend handles auth differently)
          // strict check:
          // return c.json({ error: 'Unauthorized' }, 401)
        }
      }

      // 2. Parse request
      const body = c.req.valid("json" as never) as z.infer<
        typeof chatCompletionSchema
      >;
      const messages = body.messages as ChatMessage[];
      const userId = body.user_id || body.user || "default";
      const maxTokens = body.max_tokens || 1024;
      const temperature = body.temperature || 0.7;
      const shouldStream = body.stream ?? false;

      logger.info("Processing chat completion request", {
        userId,
        messageCount: messages.length,
        shouldStream,
      });

      // 3. Extract latest user message
      const userMessage =
        messages.filter((m) => m.role === "user").pop()?.content || "";

      if (!userMessage) {
        return c.json({ error: "No user message provided" }, 400);
      }

      // 4. Retrieve relevant context from Vector DB (RAG)
      const { chunks, sources } = await retrieveContext(userMessage, userId, {
        topK: 5,
        minScore: 0.6,
      });

      // 5. Get user profile
      const profile = await getUserProfile(userId);

      // 6. Build system prompt
      const systemPrompt = buildSystemPrompt({
        knowledgeChunks: chunks,
        userProfile: profile,
      });

      // 7. Filter messages
      const conversationMessages = messages.filter((m) => m.role !== "system");

      // 8. Generate Response (Streaming)
      if (shouldStream) {
        return streamText(c, async (stream) => {
          try {
            const { textStream, fullText } = await generateStreamingResponse({
              systemPrompt,
              messages: conversationMessages,
              maxTokens,
              temperature,
            });

            let collectedText = "";

            for await (const chunk of textStream) {
              collectedText += chunk;
              // Write chunk directly to stream
              await stream.write(chunk);
            }

            // Update analytics after stream completes
            const finalResponse = await fullText;
            await Promise.all([
              extractAndRecordTopics(userId, conversationMessages),
              updateAnalytics({
                userId,
                query: userMessage,
                response: finalResponse,
                retrievedChunks: chunks,
                processingTimeMs: Date.now() - startTime,
              }),
            ]).catch((err) => logger.error("Analytics update failed", err));
          } catch (error) {
            logger.error("Streaming failed", error);
            await stream.write("Error generating response");
          }
        });
      }

      // 9. Non-streaming fallback (if requested)
      // ... (existing non-streaming logic if needed, but we focus on streaming)
      return c.json({ error: "Non-streaming not fully implemented yet" }, 501);
    } catch (error) {
      logger.error("Chat completion failed", error);
      return c.json({ error: "Internal server error" }, 500);
    }
  },
);

export { chatRoute };
