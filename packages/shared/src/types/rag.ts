// ** RAG (Retrieval Augmented Generation) configuration types

/**
 * RAG retrieval configuration options
 */
export interface RagConfig {
  /** Number of chunks to retrieve from vector store */
  topK: number;
  /** Minimum similarity score threshold (0.0 - 1.0) */
  minScore: number;
}

/**
 * Default RAG configuration values
 */
export const DEFAULT_RAG_CONFIG: RagConfig = {
  topK: 15,
  minScore: 0.4,
};

/**
 * RAG retrieval options for context retrieval
 */
export interface RagRetrievalOptions {
  /** Number of chunks to retrieve */
  topK?: number;
  /** Minimum similarity score threshold */
  minScore?: number;
  /** User ID for filtering user-specific content */
  userId?: string;
}

/**
 * Retrieved context result from RAG pipeline
 */
export interface RetrievedContext {
  /** Array of content chunks */
  chunks: string[];
  /** Array of unique source file IDs */
  sources: string[];
  /** Similarity scores for each chunk */
  scores: number[];
}

/**
 * Extended context result with metadata for debugging/analytics
 */
export interface RetrievedContextWithMetadata {
  /** Basic context result */
  context: RetrievedContext;
  /** Query embedding used for retrieval */
  queryEmbedding: number[];
  /** Processing time in milliseconds */
  processingTimeMs?: number;
}

/**
 * RAG pipeline statistics for monitoring
 */
export interface RagStats {
  /** Total chunks retrieved */
  chunksRetrieved: number;
  /** Unique sources found */
  uniqueSources: number;
  /** Average similarity score */
  avgScore: number;
  /** Highest similarity score */
  maxScore: number;
  /** Lowest similarity score among retrieved */
  minScore: number;
}
