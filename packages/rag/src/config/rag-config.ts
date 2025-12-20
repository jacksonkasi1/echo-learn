// ** import types
import type { RagConfig } from "@repo/shared";

// ** import lib
import { DEFAULT_RAG_CONFIG } from "@repo/shared";

/**
 * Get RAG configuration from environment variables with defaults
 * Uses centralized defaults from shared package
 */
export function getRagConfig(): RagConfig {
  const topK = process.env.RAG_TOP_K
    ? parseInt(process.env.RAG_TOP_K, 10)
    : DEFAULT_RAG_CONFIG.topK;

  const minScore = process.env.RAG_MIN_SCORE
    ? parseFloat(process.env.RAG_MIN_SCORE)
    : DEFAULT_RAG_CONFIG.minScore;

  return {
    topK,
    minScore,
  };
}

/**
 * Merge user-provided options with default RAG config
 */
export function mergeRagConfig(options?: Partial<RagConfig>): RagConfig {
  const defaults = getRagConfig();

  return {
    topK: options?.topK ?? defaults.topK,
    minScore: options?.minScore ?? defaults.minScore,
  };
}
