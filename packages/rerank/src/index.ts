// ** @repo/rerank - Re-ranking utilities for Echo-Learn
// Provides re-ranking capabilities using Cohere and Gemini as fallback

// ** Export types
export type {
  RerankProvider,
  RerankDocument,
  RerankResult,
  RerankOptions,
  RerankResponse,
  CohereRerankConfig,
  CohereRerankModel,
  GeminiRerankConfig,
} from "./types.js";

export { DEFAULT_RERANK_CONFIG, DEFAULT_COHERE_CONFIG, DEFAULT_GEMINI_RERANK_CONFIG } from "./types.js";

// ** Export Cohere reranking
export { rerankWithCohere, isCohereAvailable, getCohereModels, resetCohereClient } from "./cohere.js";

// ** Export Gemini reranking (fallback)
export { rerankWithGemini, isGeminiAvailable } from "./gemini.js";

// ** Export factory (main entry point)
export {
  rerank,
  createReranker,
  getAvailableProviders,
  isRerankingAvailable,
  getBestProvider,
} from "./factory.js";

export type { RerankFactoryConfig } from "./factory.js";
