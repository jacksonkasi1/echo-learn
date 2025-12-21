// ** export request types
export type {
  ElevenLabsExtraBody,
  ElevenLabsToolFunction,
  ElevenLabsTool,
  ElevenLabsChatRequest,
  ElevenLabsProcessingOptions,
} from "./request.js";

// ** export response types
export type {
  SSEChunkDelta,
  SSEChunkChoice,
  SSEStreamChunk,
  SystemToolCall,
  SystemToolResult,
  ElevenLabsCompletionResult,
  ElevenLabsConversationMetadata,
} from "./response.js";
