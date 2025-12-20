// API module exports
// Import and use these throughout the application

// Export the API client instance
export { apiClient } from './client'
export type { ApiResponse, ApiError } from './client'

// Export chat API
export { chatApi, sendChatCompletion, streamChatCompletion, chat } from './chat'
export type {
  ChatMessage,
  ChatCompletionRequest,
  ChatCompletionChoice,
  ChatCompletionResponse,
  StreamingChatOptions,
} from './chat'

// Export files API
export {
  filesApi,
  getSignedUploadUrl,
  uploadFile,
  deleteFile,
  getUserFiles,
  getFileDetails,
} from './files'
export type {
  FileMetadata,
  SignedUrlRequest,
  SignedUrlResponse,
  UploadConfirmRequest,
  UploadConfirmResponse,
  FileListResponse,
  FileDeleteRequest,
  FileDeleteResponse,
} from './files'

// Export ingest API
export {
  ingestApi,
  ingestFile,
  getIngestStatus,
  waitForIngestion,
  uploadAndIngest,
} from './ingest'
export type {
  IngestRequest,
  IngestResponse,
  IngestStatusResponse,
} from './ingest'

// Export user API
export {
  userApi,
  getUserProfile,
  getUserAnalytics,
  getKnowledgeGraph,
  getKnowledgeGraphStats,
  updateUserProfile,
} from './user'
export type {
  UserProfile,
  UserAnalytics,
  KnowledgeGraph,
  KnowledgeGraphStats,
} from './user'
