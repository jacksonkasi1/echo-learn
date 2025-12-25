// ** export types
export type {
  // Request types
  ElevenLabsExtraBody,
  ElevenLabsToolFunction,
  ElevenLabsTool,
  ElevenLabsChatRequest,
  ElevenLabsProcessingOptions,
  // Response types
  SSEChunkDelta,
  SSEChunkChoice,
  SSEStreamChunk,
  SystemToolCall,
  SystemToolResult,
  ElevenLabsCompletionResult,
  ElevenLabsConversationMetadata,
} from "./types/index.js";

// ** export handler
export {
  processElevenLabsCompletion,
  validateElevenLabsRequest,
  extractUserId,
  handleSystemTool,
  isSystemTool,
  hasSystemTools,
  extractSystemTools,
  SYSTEM_TOOL_NAMES,
} from "./handler/index.js";

// ** export handler types
export type { SystemToolName } from "./handler/index.js";

// ** export SSE utilities
export {
  createSSEChunk,
  formatSSEChunk,
  formatSSEDone,
  transformToSSE,
  createSSEStream,
  textIterableToSSEStream,
  getRandomBufferPhrase,
  detectBufferPhraseType,
  createBufferChunk,
  formatBufferSSE,
  streamWithBuffer,
  shouldUseBufferWords,
} from "./sse/index.js";

// ** export SSE types
export type { BufferPhraseType } from "./sse/index.js";
