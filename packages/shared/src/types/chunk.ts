// ** Chunk-related types for Echo-Learn

export interface TextChunk {
  id: string;
  content: string;
  fileId: string;
  chunkIndex: number;
  metadata?: ChunkMetadata;
}

export interface ChunkMetadata {
  startOffset?: number;
  endOffset?: number;
  section?: string;
  pageNumber?: number;
  headings?: Array<string>;
}

export interface ChunkWithEmbedding {
  chunk: TextChunk;
  embedding: Array<number>;
}

export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators: Array<string>;
  preserveHeaders?: boolean;
}

export interface ChunkingResult {
  chunks: Array<TextChunk>;
  totalChunks: number;
  averageChunkSize: number;
  fileId: string;
}

export interface VectorChunk {
  id: string;
  vector: Array<number>;
  metadata: VectorMetadata;
}

export interface VectorMetadata {
  content: string;
  fileId: string;
  chunkIndex: number;
  userId?: string;
  fileName?: string;
  section?: string;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: VectorMetadata;
}

/**
 * Fusion algorithm for hybrid search
 * - RRF: Reciprocal Rank Fusion - focuses on ranking order
 * - DBSF: Distribution-Based Score Fusion - considers score distribution
 */
export type FusionAlgorithm = "RRF" | "DBSF";

/**
 * Query mode for hybrid index
 * - HYBRID: Combines dense and sparse vectors (default)
 * - DENSE: Dense vectors only (semantic similarity)
 * - SPARSE: Sparse vectors only (BM25 keyword matching)
 */
export type QueryMode = "HYBRID" | "DENSE" | "SPARSE";

export interface VectorSearchOptions {
  topK?: number;
  /** Upstash Vector filter string, e.g., "userId = 'user123'" */
  filter?: string;
  includeMetadata?: boolean;
  minScore?: number;
}

/**
 * Extended search options for hybrid index support
 */
export interface HybridSearchOptions extends VectorSearchOptions {
  /** Query mode: HYBRID, DENSE, or SPARSE */
  queryMode?: QueryMode;
  /** Fusion algorithm for combining dense and sparse results */
  fusionAlgorithm?: FusionAlgorithm;
}

/**
 * Options for hybrid vector upsert
 */
export interface HybridUpsertOptions {
  /** Use text data for automatic sparse vector generation (BM25) */
  useTextData?: boolean;
}

export interface EmbeddingResult {
  text: string;
  embedding: Array<number>;
  tokenCount?: number;
}

export interface BatchEmbeddingResult {
  results: Array<EmbeddingResult>;
  totalTokens: number;
  processingTimeMs: number;
}
