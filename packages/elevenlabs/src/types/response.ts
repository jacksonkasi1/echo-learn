// ** import types
import type { ChatMessage } from "@repo/llm";

/**
 * SSE chunk delta content
 */
export interface SSEChunkDelta {
  /** Role of the message (only in first chunk) */
  role?: "assistant";
  /** Content chunk */
  content?: string;
}

/**
 * SSE chunk choice
 */
export interface SSEChunkChoice {
  /** Choice index */
  index: number;
  /** Delta content */
  delta: SSEChunkDelta;
  /** Finish reason (null until complete) */
  finish_reason: "stop" | "length" | "tool_calls" | null;
}

/**
 * OpenAI-compatible SSE streaming chunk
 * ElevenLabs expects this exact format
 */
export interface SSEStreamChunk {
  /** Unique chunk ID */
  id: string;
  /** Object type identifier */
  object: "chat.completion.chunk";
  /** Unix timestamp of creation */
  created: number;
  /** Model identifier */
  model: string;
  /** Array of choices (usually single element) */
  choices: SSEChunkChoice[];
}

/**
 * System tool call response from LLM
 */
export interface SystemToolCall {
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * Result of processing a system tool
 */
export interface SystemToolResult {
  /** Tool name that was called */
  name: string;
  /** Whether to end the call */
  shouldEndCall: boolean;
  /** Optional message to speak before action */
  message?: string;
  /** Reason for the action */
  reason?: string;
}

/**
 * Result of ElevenLabs completion processing
 */
export interface ElevenLabsCompletionResult {
  /** SSE stream for response */
  stream: ReadableStream<Uint8Array>;
  /** Retrieved knowledge chunks */
  knowledgeChunks: string[];
  /** Source file IDs */
  retrievedSources: string[];
  /** Conversation ID */
  conversationId?: string;
}

/**
 * ElevenLabs conversation metadata
 */
export interface ElevenLabsConversationMetadata {
  /** Conversation ID */
  conversationId: string;
  /** User ID */
  userId: string;
  /** Start timestamp */
  startedAt: Date;
  /** Turn count */
  turnCount: number;
  /** Average response latency in ms */
  avgLatencyMs: number;
  /** RAG chunks used in session */
  ragChunksUsed: number;
  /** Tool calls made */
  toolCallsMade: number;
}
