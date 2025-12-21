// Chat API module
// Handles all chat-related API calls to the backend

import { apiClient } from './client'
import { env } from '@/config/env'

// Types for chat messages
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface ChatCompletionRequest {
  messages: Array<ChatMessage>
  userId?: string
  maxTokens?: number
  temperature?: number
  stream?: boolean
  // RAG options
  useRag?: boolean
  ragTopK?: number
  ragMinScore?: number
  mode?: 'learn' | 'chat' | 'test'
}

export interface ChatCompletionChoice {
  index: number
  message: {
    role: 'assistant'
    content: string
  }
  finish_reason: string
}

export interface ChatCompletionResponse {
  id: string
  object: string
  created: number
  model: string
  choices: Array<ChatCompletionChoice>
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface StreamingChatOptions {
  onRagInfo?: (info: { chunks: number; sources: number }) => void
}

/**
 * Send a chat completion request (non-streaming)
 * Uses the backend's OpenAI-compatible endpoint
 */
export async function sendChatCompletion(
  request: ChatCompletionRequest,
): Promise<ChatCompletionResponse> {
  const response = await apiClient.post<ChatCompletionResponse>(
    '/v1/chat/completions',
    {
      messages: request.messages,
      user_id: request.userId,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      stream: false,
      use_rag: request.useRag ?? true,
      rag_top_k: request.ragTopK ?? 5,
      rag_min_score: request.ragMinScore ?? 0.01, // Lowered for Upstash hybrid RRF scoring
      mode: request.mode,
    },
  )

  return response.data
}

/**
 * Send a streaming chat completion request
 * Returns an async generator that yields content chunks
 */
export async function* streamChatCompletion(
  request: ChatCompletionRequest,
  options?: StreamingChatOptions,
): AsyncGenerator<string, void, unknown> {
  const response = await fetch(`${env.API_BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages: request.messages,
      user_id: request.userId,
      max_tokens: request.maxTokens || 1024,
      temperature: request.temperature || 0.7,
      stream: true,
      use_rag: request.useRag ?? true,
      rag_top_k: request.ragTopK ?? 5,
      rag_min_score: request.ragMinScore ?? 0.01, // Lowered for Upstash hybrid RRF scoring
      mode: request.mode,
    }),
  })

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Unknown error' }))
    throw new Error(error.message || error.error || 'Chat request failed')
  }

  // Extract RAG info from headers if callback provided
  if (options?.onRagInfo) {
    const ragChunks = response.headers.get('X-Echo-Learn-RAG-Chunks')
    const ragSources = response.headers.get('X-Echo-Learn-RAG-Sources')
    if (ragChunks || ragSources) {
      options.onRagInfo({
        chunks: parseInt(ragChunks || '0', 10),
        sources: parseInt(ragSources || '0', 10),
      })
    }
  }

  // Handle streaming response using Reader
  const reader = response.body?.getReader()
  const decoder = new TextDecoder()

  if (!reader) {
    throw new Error('Response body is not readable')
  }

  try {
    let done = false
    while (!done) {
      const result = await reader.read()
      done = result.done
      if (result.value) {
        const chunk = decoder.decode(result.value, { stream: true })
        if (chunk) {
          yield chunk
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Simple chat function that returns the assistant's response
 */
export async function chat(
  messages: Array<ChatMessage>,
  userId?: string,
): Promise<string> {
  const response = await sendChatCompletion({
    messages,
    userId,
  })

  return response.choices[0]?.message?.content || ''
}

// Export the chat API as a namespace for cleaner imports
export const chatApi = {
  sendCompletion: sendChatCompletion,
  streamCompletion: streamChatCompletion,
  chat,
}

export default chatApi
