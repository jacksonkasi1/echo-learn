// ** import lib
import { z } from "zod";

/**
 * Message schema for ElevenLabs chat completions
 */
export const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
});

/**
 * ElevenLabs extra body schema
 * Custom parameters passed from ElevenLabs conversation
 */
export const elevenlabsExtraBodySchema = z
  .object({
    user_id: z.string().optional(),
    conversation_id: z.string().optional(),
    session_data: z.record(z.unknown()).optional(),
  })
  .optional();

/**
 * ElevenLabs tool function schema
 */
export const toolFunctionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()).optional(),
});

/**
 * ElevenLabs tool schema
 */
export const toolSchema = z.object({
  type: z.literal("function"),
  function: toolFunctionSchema,
});

/**
 * ElevenLabs chat completion request schema
 * OpenAI-compatible with ElevenLabs extensions
 */
export const elevenlabsCompletionSchema = z.object({
  model: z.string().optional().default("echo-learn-v1"),
  messages: z.array(messageSchema).min(1),
  temperature: z.number().optional().default(0.7),
  max_tokens: z.number().optional().default(500),
  stream: z.boolean().optional().default(true),
  user: z.string().optional(),
  user_id: z.string().optional(),
  elevenlabs_extra_body: elevenlabsExtraBodySchema,
  tools: z.array(toolSchema).optional(),
});

// ** Inferred types
export type ElevenLabsCompletionRequest = z.infer<
  typeof elevenlabsCompletionSchema
>;
export type ElevenLabsMessage = z.infer<typeof messageSchema>;
export type ElevenLabsExtraBody = z.infer<typeof elevenlabsExtraBodySchema>;
export type ElevenLabsTool = z.infer<typeof toolSchema>;
