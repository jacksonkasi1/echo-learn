// ** import lib
import { z } from "zod";

// ** import constants
import { DEFAULT_RAG_CONFIG } from "@repo/shared";

/**
 * Chat mode determines how the system processes interactions
 */
export const chatModeSchema = z
  .enum(["learn", "chat", "test"])
  .default("learn");

/**
 * Message schema for chat completions
 */
export const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

/**
 * RAG options schema with centralized defaults
 */
export const ragOptionsSchema = z.object({
  use_rag: z.boolean().optional().default(true),
  rag_top_k: z.number().optional().default(DEFAULT_RAG_CONFIG.topK),
  rag_min_score: z.number().optional().default(DEFAULT_RAG_CONFIG.minScore),
});

/**
 * Chat completion request schema (OpenAI-compatible)
 */
export const chatCompletionSchema = z
  .object({
    model: z.string().optional().default("echo-learn-v1"),
    messages: z.array(messageSchema).min(1),
    user: z.string().optional(),
    user_id: z.string().optional(),
    max_tokens: z.number().optional().default(1024),
    temperature: z.number().optional().default(0.7),
    stream: z.boolean().optional().default(true),
    mode: chatModeSchema.optional(), // NEW: Chat mode (learn/chat/test)
    skill_level: z.enum(["beginner", "intermediate", "pro"]).optional(),
  })
  .merge(ragOptionsSchema);

// ** Inferred types
export type ChatCompletionRequest = z.infer<typeof chatCompletionSchema>;
export type Message = z.infer<typeof messageSchema>;
export type RagOptions = z.infer<typeof ragOptionsSchema>;
export type ChatModeType = z.infer<typeof chatModeSchema>;
