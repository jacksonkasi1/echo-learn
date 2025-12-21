// ** Follow-Up Suggestion Module Index for Echo-Learn
// ** Exports follow-up generation functionality

// ** Original graph-based follow-up generator
export {
  generateFollowUpSuggestions,
  generateFollowUpSuggestionsAsync,
  type FollowUpGenerationResult,
  type FollowUpGenerationOptions,
} from "./generator.js";

// ** Smart LLM-powered follow-up generator (uses RAG + LLM)
export {
  generateSmartFollowUps,
  generateSmartFollowUpsAsync,
  generateSmartInitialSuggestions,
  type SmartFollowUpResult,
  type SmartFollowUpOptions,
} from "./smart-generator.js";
