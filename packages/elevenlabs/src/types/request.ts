// ** import types
import type { ChatMessage } from "@repo/llm";

/**
 * ElevenLabs extra body parameters sent with custom LLM requests
 * These are custom parameters passed from the ElevenLabs conversation
 */
export interface ElevenLabsExtraBody {
  /** User ID for RAG context retrieval */
  user_id?: string;
  /** Conversation ID for session tracking */
  conversation_id?: string;
  /** Custom session data */
  session_data?: Record<string, unknown>;
}

/**
 * ElevenLabs system tool function definition
 */
export interface ElevenLabsToolFunction {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
}

/**
 * ElevenLabs system tool definition
 */
export interface ElevenLabsTool {
  type: "function";
  function: ElevenLabsToolFunction;
}

/**
 * ElevenLabs chat completion request
 * Follows OpenAI format with ElevenLabs-specific extensions
 */
export interface ElevenLabsChatRequest {
  /** Chat messages in OpenAI format */
  messages: ChatMessage[];
  /** Model identifier */
  model?: string;
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum tokens in response */
  max_tokens?: number;
  /** Whether to stream the response */
  stream?: boolean;
  /** User ID (standard OpenAI field) */
  user_id?: string;
  /** Alternative user field */
  user?: string;
  /** ElevenLabs-specific extra body parameters */
  elevenlabs_extra_body?: ElevenLabsExtraBody;
  /** System tools for conversation control */
  tools?: ElevenLabsTool[];
}

/**
 * Options for processing ElevenLabs requests
 */
export interface ElevenLabsProcessingOptions {
  /** User ID for RAG retrieval */
  userId: string;
  /** Chat messages */
  messages: ChatMessage[];
  /** Maximum tokens in response */
  maxTokens: number;
  /** Temperature for generation */
  temperature: number;
  /** Whether to use buffer words for latency optimization */
  useBufferWords: boolean;
  /** System tools from ElevenLabs */
  systemTools?: ElevenLabsTool[];
  /** Conversation ID for tracking */
  conversationId?: string;
}
