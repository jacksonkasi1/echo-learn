// ** Rerank Provider Factory
// Manages provider selection and automatic fallback

// ** import types
import type {
  RerankDocument,
  RerankOptions,
  RerankResponse,
  RerankProvider,
  CohereRerankConfig,
  GeminiRerankConfig,
} from "./types.js";

// ** import providers
import { rerankWithCohere, isCohereAvailable } from "./cohere.js";
import { rerankWithGemini, isGeminiAvailable } from "./gemini.js";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Configuration for the rerank factory
 */
export interface RerankFactoryConfig {
  /** Preferred provider */
  preferredProvider?: RerankProvider;
  /** Enable automatic fallback to other providers */
  enableFallback?: boolean;
  /** Cohere-specific configuration */
  cohereConfig?: Partial<CohereRerankConfig>;
  /** Gemini-specific configuration */
  geminiConfig?: Partial<GeminiRerankConfig>;
}

/**
 * Default factory configuration
 */
const DEFAULT_FACTORY_CONFIG: Required<RerankFactoryConfig> = {
  preferredProvider: "cohere",
  enableFallback: true,
  cohereConfig: {},
  geminiConfig: {},
};

/**
 * Get the list of available providers
 */
export function getAvailableProviders(): Array<RerankProvider> {
  const providers: Array<RerankProvider> = [];

  if (isCohereAvailable()) {
    providers.push("cohere");
  }

  if (isGeminiAvailable()) {
    providers.push("gemini");
  }

  return providers;
}

/**
 * Check if any reranking provider is available
 */
export function isRerankingAvailable(): boolean {
  return getAvailableProviders().length > 0;
}

/**
 * Get the best available provider based on preference and availability
 */
export function getBestProvider(
  preferredProvider?: RerankProvider,
): RerankProvider | null {
  const preferred = preferredProvider || "cohere";

  // Check if preferred is available
  if (preferred === "cohere" && isCohereAvailable()) {
    return "cohere";
  }

  if (preferred === "gemini" && isGeminiAvailable()) {
    return "gemini";
  }

  // Fallback to any available provider
  const available = getAvailableProviders();
  if (available.length > 0) {
    const first = available[0];
    return first !== undefined ? first : null;
  }
  return null;
}

/**
 * Rerank documents using the best available provider
 * Automatically falls back to other providers if the preferred one fails
 *
 * @param query - The query to rank documents against
 * @param documents - Array of documents to rerank
 * @param options - Reranking options
 * @param factoryConfig - Factory configuration
 * @returns Reranked results
 */
export async function rerank(
  query: string,
  documents: Array<RerankDocument>,
  options: RerankOptions = {},
  factoryConfig: RerankFactoryConfig = {},
): Promise<RerankResponse> {
  const config = { ...DEFAULT_FACTORY_CONFIG, ...factoryConfig };

  // Get the best available provider
  const provider = getBestProvider(config.preferredProvider);

  if (!provider) {
    throw new Error(
      "No reranking provider available. Please configure COHERE_API_KEY or GEMINI_API_KEY.",
    );
  }

  logger.info("Reranking with provider", {
    provider,
    documentCount: documents.length,
  });

  try {
    if (provider === "cohere") {
      return await rerankWithCohere(
        query,
        documents,
        options,
        config.cohereConfig,
      );
    } else {
      return await rerankWithGemini(
        query,
        documents,
        options,
        config.geminiConfig,
      );
    }
  } catch (error) {
    // Try fallback if enabled
    if (config.enableFallback) {
      const fallbackProvider = provider === "cohere" ? "gemini" : "cohere";
      const isFallbackAvailable =
        fallbackProvider === "cohere"
          ? isCohereAvailable()
          : isGeminiAvailable();

      if (isFallbackAvailable) {
        logger.warn(
          `Primary provider ${provider} failed, falling back to ${fallbackProvider}`,
          {
            error: error instanceof Error ? error.message : "Unknown error",
          },
        );

        if (fallbackProvider === "cohere") {
          return await rerankWithCohere(
            query,
            documents,
            options,
            config.cohereConfig,
          );
        } else {
          return await rerankWithGemini(
            query,
            documents,
            options,
            config.geminiConfig,
          );
        }
      }
    }

    throw error;
  }
}

/**
 * Create a reranker function with preset configuration
 * Useful for creating a configured reranker instance
 */
export function createReranker(
  factoryConfig: RerankFactoryConfig = {},
): (
  query: string,
  documents: Array<RerankDocument>,
  options?: RerankOptions,
) => Promise<RerankResponse> {
  return (query, documents, options = {}) =>
    rerank(query, documents, options, factoryConfig);
}
