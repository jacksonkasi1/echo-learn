// ** export completions schema
export {
  messageSchema,
  elevenlabsExtraBodySchema,
  toolFunctionSchema,
  toolSchema,
  elevenlabsCompletionSchema,
} from "./completions.schema.js";

// ** export types
export type {
  ElevenLabsCompletionRequest,
  ElevenLabsMessage,
  ElevenLabsExtraBody,
  ElevenLabsTool,
} from "./completions.schema.js";
