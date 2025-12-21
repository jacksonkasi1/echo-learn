// ** import lib
import { z } from "zod";

/**
 * Message schema for ElevenLabs chat completions
 * Made permissive to handle various ElevenLabs message formats
 */
export const messageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system", "tool", "function"]),
    content: z.union([z.string(), z.null()]).transform((val) => val ?? ""),
    name: z.string().optional(),
    tool_call_id: z.string().optional(),
    tool_calls: z.array(z.unknown()).optional(),
    function_call: z.unknown().optional(),
  })
  .passthrough();

/**
 * ElevenLabs extra body schema
 * Custom parameters passed from ElevenLabs conversation
 * Using passthrough to accept any additional fields ElevenLabs sends
 */
export const elevenlabsExtraBodySchema = z
  .object({
    user_id: z.string().optional(),
    conversation_id: z.string().optional(),
    session_data: z.record(z.unknown()).optional(),
  })
  .passthrough()
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
 * Made highly permissive with passthrough to accept any fields ElevenLabs sends
 */
export const elevenlabsCompletionSchema = z
  .object({
    model: z.string().optional().default("echo-learn-v1"),
    messages: z.array(messageSchema).min(1),
    temperature: z.number().optional(),
    max_tokens: z.number().optional(),
    stream: z.boolean().optional().default(true),
    user: z.string().optional(),
    user_id: z.string().optional(),
    elevenlabs_extra_body: elevenlabsExtraBodySchema,
    // tools can be array, null, or undefined - ElevenLabs sends null when no tools
    tools: z
      .union([z.array(toolSchema), z.null()])
      .optional()
      .transform((val) => val ?? undefined),
    // Additional OpenAI-compatible fields that ElevenLabs may send
    top_p: z.number().optional(),
    n: z.number().optional(),
    stop: z.union([z.string(), z.array(z.string()), z.null()]).optional(),
    presence_penalty: z.number().optional(),
    frequency_penalty: z.number().optional(),
    logit_bias: z.record(z.number()).optional(),
    response_format: z.object({ type: z.string() }).passthrough().optional(),
    seed: z.number().optional(),
    tool_choice: z.unknown().optional(),
    parallel_tool_calls: z.boolean().optional(),
    // ElevenLabs specific fields
    reasoning_effort: z.string().optional(),
    stream_options: z
      .object({
        include_usage: z.boolean().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

// ** Inferred types
export type ElevenLabsCompletionRequest = z.infer<
  typeof elevenlabsCompletionSchema
>;
export type ElevenLabsMessage = z.infer<typeof messageSchema>;
export type ElevenLabsExtraBody = z.infer<typeof elevenlabsExtraBodySchema>;
export type ElevenLabsTool = z.infer<typeof toolSchema>;
