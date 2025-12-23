// ** Export all shared types

// Learning types (new Smart Memory system)
export type {
  ChatMode,
  LearningSignalType,
  LearningSignal,
  ConceptMastery,
  MasteryUpdate,
  MasterySummary,
  ConceptWithEffectiveMastery,
  QuestionDifficulty,
  QuestionType,
  AnswerEvaluation,
  ModePromptConfig,
  FollowUpSuggestion,
  LearningChatResponse,
} from "./learning.js";

export { DEFAULT_CONCEPT_MASTERY, MODE_PROMPTS } from "./learning.js";

// Test configuration types
export type {
  SkillLevel,
  QuestionStyle,
  QuestionFormat,
  TimingMode,
  ScenarioType,
  TestConfiguration,
  ScenarioContext,
  DetailedEvaluation,
} from "./test-config.js";

export {
  SKILL_LEVEL_DIFFICULTY_MAP,
  DIFFICULTY_SKILL_LEVEL_MAP,
  DEFAULT_TEST_CONFIGURATION,
  QUESTION_COUNT_OPTIONS,
  TIME_PER_QUESTION_OPTIONS,
  SKILL_LEVEL_INFO,
  QUESTION_STYLE_INFO,
  QUESTION_FORMAT_INFO,
  TIMING_MODE_INFO,
} from "./test-config.js";

// Test session types
export type {
  TestSessionStatus,
  TestQuestion,
  TestResult,
  TestSession,
  TestSessionSummary,
  CreateTestSessionInput,
  AnswerQuestionInput,
  GenerateQuestionRequest,
  GenerateQuestionResult,
  TestSessionHistoryEntry,
} from "./test-session.js";

export {
  DEFAULT_TEST_SESSION_CONFIG,
  TEST_MODE_MASTERY_CHANGES,
  SESSION_SCORE_THRESHOLDS,
} from "./test-session.js";

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
  // Hybrid search types
  FusionAlgorithm,
  QueryMode,
  HybridSearchOptions,
  HybridUpsertOptions,
} from "./chunk.js";

// Graph types
export type {
  LearningRelationType,
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
