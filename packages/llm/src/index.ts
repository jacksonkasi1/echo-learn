// ** Export generate functions
export {
  generateStreamingResponse,
  generateResponse,
  generateResponseWithContext,
  generateQuizQuestion,
  evaluateAnswer,
  extractTopicsFromConversation,
  type ChatMessage,
  type GenerateOptions,
  type StreamingResult,
} from "./generate.js";

// ** Export prompt functions
export {
  buildSystemPrompt,
  buildQuizPrompt,
  buildSessionSummaryPrompt,
  type PromptContext,
} from "./prompt/index.js";
