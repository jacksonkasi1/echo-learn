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
import { retrieveContext } from "@/lib/rag/retrieve-context";
import { buildSystemPrompt } from "@/lib/prompt/system-prompt";
import { getUserProfile, updateUserProfile } from "@/lib/upstash/redis";
import { updateAnalytics } from "@/lib/analytics/update-analytics";
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
  // Echo-Learn specific options
  use_rag: z.boolean().optional().default(true),
  rag_top_k: z.number().optional().default(5),
  rag_min_score: z.number().optional().default(0.6),
});

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
    let fullResponse = "";

    try {
      // 1. Parse request
      const body = c.req.valid("json" as never) as z.infer<
        typeof chatCompletionSchema
      >;
      const messages = body.messages as ChatMessage[];
      const userId = body.user_id || body.user || "default";
      const maxTokens = body.max_tokens || 1024;
      const temperature = body.temperature || 0.7;
      const useRag = body.use_rag !== false;
      const ragTopK = body.rag_top_k || 5;
      const ragMinScore = body.rag_min_score || 0.6;

      logger.info("Processing RAG-enhanced chat request", {
        userId,
        messageCount: messages.length,
        useRag,
        ragTopK,
      });

      // 2. Extract latest user message
      const userMessage =
        messages.filter((m) => m.role === "user").pop()?.content || "";

      if (!userMessage) {
        return c.json({ error: "No user message provided" }, 400);
      }

      // 3. Get user profile for personalization
      const userProfile = await getUserProfile(userId);

      logger.info("User profile loaded", {
        userId,
        level: userProfile.level,
        questionsAnswered: userProfile.questionsAnswered,
      });

      // 4. Retrieve relevant context from vector DB (if RAG enabled)
      let knowledgeChunks: string[] = [];
      let retrievedSources: string[] = [];

      if (useRag) {
        try {
          const contextResult = await retrieveContext(userMessage, userId, {
            topK: ragTopK,
            minScore: ragMinScore,
          });

          knowledgeChunks = contextResult.chunks;
          retrievedSources = contextResult.sources;

          logger.info("RAG context retrieved", {
            userId,
            chunksFound: knowledgeChunks.length,
            sourcesFound: retrievedSources.length,
            avgScore:
              contextResult.scores.length > 0
                ? (
                    contextResult.scores.reduce((a, b) => a + b, 0) /
                    contextResult.scores.length
                  ).toFixed(3)
                : "N/A",
          });
        } catch (ragError) {
          // Log but don't fail - continue without RAG context
          logger.warn("RAG retrieval failed, continuing without context", {
            error:
              ragError instanceof Error ? ragError.message : "Unknown error",
          });
        }
      }

      // 5. Build system prompt with knowledge context and user profile
      const systemPrompt = buildSystemPrompt({
        knowledgeChunks,
        userProfile,
      });

      // 6. Filter and prepare conversation messages
      const conversationMessages = messages.filter((m) => m.role !== "system");

      // 7. Stream Response
      logger.info("Starting stream generation", {
        systemPromptLength: systemPrompt.length,
        contextChunks: knowledgeChunks.length,
      });

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
              fullResponse += chunk;

              if (chunkCount <= 3 || chunkCount % 20 === 0) {
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

            // 8. Update analytics asynchronously (don't block response)
            updateAnalytics({
              userId,
              query: userMessage,
              response: fullResponse,
              retrievedChunks: knowledgeChunks,
              processingTimeMs: Date.now() - startTime,
            }).catch((err) => {
              logger.error("Failed to update analytics", err);
            });

            // 9. Update user's last interaction
            updateUserProfile(userId, {
              lastInteraction: new Date().toISOString(),
            }).catch((err) => {
              logger.error("Failed to update user profile", err);
            });
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
          // Custom headers for debugging
          "X-Echo-Learn-RAG-Chunks": String(knowledgeChunks.length),
          "X-Echo-Learn-RAG-Sources": String(retrievedSources.length),
        },
      });
    } catch (error) {
      logger.error("Chat completion failed", error);
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
