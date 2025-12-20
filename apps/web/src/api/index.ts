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
} from './chat'
