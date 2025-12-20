// ** Export config
export { getRagConfig, mergeRagConfig } from "./config/index.js";

// ** Export embedding
export {
  generateEmbedding,
  generateEmbeddingWithMetadata,
  generateEmbeddingsForChunks,
  generateBatchEmbeddings,
  generateQueryEmbedding,
  getEmbeddingDimension,
  validateEmbedding,
  cosineSimilarity,
} from "./embedding/index.js";

// ** Export retrieval
export {
  retrieveContext,
  retrieveContextWithMetadata,
  formatContextForPrompt,
  isQueryRelevantToContent,
} from "./retrieve-context.js";

// ** Export retrieval types
export type { ExtendedRagRetrievalOptions } from "./retrieve-context.js";

// ** Export context manager
export {
  selectChunksWithBudget,
  estimateTokens,
  calculateOptimalTopK,
  reorderChunksForContext,
  DEFAULT_CONTEXT_BUDGET,
} from "./context-manager.js";

// ** Export context manager types
export type {
  ContextBudgetConfig,
  ContextSelectionResult,
} from "./context-manager.js";
