// ** Reranking types for Echo-Learn

/**
 * Supported reranking providers
 */
export type RerankProvider = "cohere" | "gemini";

/**
 * Document to be reranked
 */
export interface RerankDocument {
  /** Unique identifier for the document */
  id: string;
  /** Text content to be reranked */
  text: string;
  /** Optional metadata associated with the document */
  metadata?: Record<string, unknown>;
  /** Original score from vector search (if available) */
  originalScore?: number;
}

/**
 * Result of reranking a single document
 */
export interface RerankResult {
  /** Document ID */
  id: string;
  /** Original index in the input array */
  originalIndex: number;
  /** Relevance score from reranking (0-1, higher is more relevant) */
  relevanceScore: number;
  /** Original text content */
  text: string;
  /** Optional metadata */
  metadata?: Record<string, unknown>;
  /** Original score from vector search (if available) */
  originalScore?: number;
}

/**
 * Options for reranking operation
 */
export interface RerankOptions {
  /** Number of top results to return after reranking */
  topN?: number;
  /** Provider to use for reranking */
  provider?: RerankProvider;
  /** Model to use (provider-specific) */
  model?: string;
  /** Minimum relevance score threshold (0-1) */
  minRelevanceScore?: number;
  /** Whether to return the document text in results */
  returnDocuments?: boolean;
  /** Maximum documents to send for reranking (for cost control) */
  maxDocuments?: number;
}

/**
 * Configuration for Cohere reranking
 */
export interface CohereRerankConfig {
  /** Cohere API key */
  apiKey: string;
  /** Model to use for reranking */
  model?: CohereRerankModel;
  /** Request timeout in milliseconds */
  timeoutMs?: number;
  /** Number of retries on failure */
  maxRetries?: number;
}

/**
 * Cohere rerank model options
 * - rerank-v3.5: Multilingual, 4K context, good balance of quality and cost
 * - rerank-english-v3.0: English only, 4K context
 * - rerank-v4.0-fast: Light version, low latency
 * - rerank-v4.0-pro: State-of-the-art, 32K context
 */
export type CohereRerankModel =
  | "rerank-v3.5"
  | "rerank-english-v3.0"
  | "rerank-v4.0-fast"
  | "rerank-v4.0-pro";

/**
 * Configuration for Gemini-based reranking (fallback)
 */
export interface GeminiRerankConfig {
  /** Model to use for LLM-based reranking */
  model?: string;
  /** Temperature for generation */
  temperature?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
}

/**
 * Full rerank response with metadata
 */
export interface RerankResponse {
  /** Reranked results sorted by relevance */
  results: Array<RerankResult>;
  /** Provider used for reranking */
  provider: RerankProvider;
  /** Model used */
  model: string;
  /** Processing time in milliseconds */
  processingTimeMs: number;
  /** Total documents processed */
  documentsProcessed: number;
  /** Documents filtered by score threshold */
  documentsFiltered: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_RERANK_CONFIG: Required<RerankOptions> = {
  topN: 10,
  provider: "cohere",
  model: "rerank-v3.5",
  minRelevanceScore: 0,
  returnDocuments: true,
  maxDocuments: 100,
};

/**
 * Default Cohere configuration
 */
export const DEFAULT_COHERE_CONFIG: Omit<
  Required<CohereRerankConfig>,
  "apiKey"
> = {
  model: "rerank-v3.5",
  timeoutMs: 30000,
  maxRetries: 3,
};

/**
 * Default Gemini rerank configuration
 */
export const DEFAULT_GEMINI_RERANK_CONFIG: Required<GeminiRerankConfig> = {
  model: "gemini-2.0-flash",
  temperature: 0.1,
  maxTokens: 1024,
};
