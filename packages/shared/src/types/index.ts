// ** Export all shared types

// File types
export type {
  FileStatus,
  SupportedFileType,
  FileMetadata,
  FileUploadRequest,
  SignedUrlResponse,
  UploadConfirmRequest,
  FileProcessingResult,
  FileListResponse,
  FileDeleteRequest,
  FileDeleteResponse,
} from "./file.js";

// OCR types
export type {
  OcrResult,
  TokenUsage,
  OcrImage,
  OcrOptions,
  OcrProcessingStatus,
  OcrBatchRequest,
  OcrBatchResult,
} from "./ocr.js";

// Chunk types
export type {
  TextChunk,
  ChunkMetadata,
  ChunkWithEmbedding,
  ChunkerOptions,
  ChunkingResult,
  VectorChunk,
  VectorMetadata,
  VectorSearchResult,
  VectorSearchOptions,
  EmbeddingResult,
  BatchEmbeddingResult,
} from "./chunk.js";

// Graph types
export type {
  GraphNodeType,
  GraphNode,
  GraphEdge,
  KnowledgeGraph,
  GraphGenerationResult,
  GraphMergeResult,
  GraphSearchOptions,
  GraphSearchResult,
  GraphVisualizationNode,
  GraphVisualizationEdge,
  GraphVisualizationData,
  GraphStats,
} from "./graph.js";

// User types
export type {
  UserLevel,
  UserProfile,
  UserLearningState,
  UserProfileUpdate,
  UserAnalytics,
  TopicProgress,
  InteractionLog,
  SessionSummary,
  UserPreferences,
  AuthenticatedUser,
} from "./user.js";

// RAG types
export type {
  RagConfig,
  RagRetrievalOptions,
  RetrievedContext,
  RetrievedContextWithMetadata,
  RagStats,
} from "./rag.js";

export { DEFAULT_RAG_CONFIG } from "./rag.js";
