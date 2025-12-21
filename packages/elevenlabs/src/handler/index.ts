// ** export completion handler
export {
  processElevenLabsCompletion,
  validateElevenLabsRequest,
  extractUserId,
} from "./completion.js";

// ** export system tools handler
export {
  handleSystemTool,
  isSystemTool,
  hasSystemTools,
  extractSystemTools,
  shouldEndConversation,
  shouldSkipTurn,
  SYSTEM_TOOL_NAMES,
} from "./system-tools.js";

// ** export system tool types
export type { SystemToolName } from "./system-tools.js";
