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
  headings?: string[];
}

export interface ChunkWithEmbedding {
  chunk: TextChunk;
  embedding: number[];
}

export interface ChunkerOptions {
  chunkSize: number;
  chunkOverlap: number;
  separators: string[];
  preserveHeaders?: boolean;
}

export interface ChunkingResult {
  chunks: TextChunk[];
  totalChunks: number;
  averageChunkSize: number;
  fileId: string;
}

export interface VectorChunk {
  id: string;
  vector: number[];
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

export interface VectorSearchOptions {
  topK?: number;
  /** Upstash Vector filter string, e.g., "userId = 'user123'" */
  filter?: string;
  includeMetadata?: boolean;
  minScore?: number;
}

export interface EmbeddingResult {
  text: string;
  embedding: number[];
  tokenCount?: number;
}

export interface BatchEmbeddingResult {
  results: EmbeddingResult[];
  totalTokens: number;
  processingTimeMs: number;
}
