// Suggestions API module
// Handles fetching dynamic learning suggestions from the backend

import { apiClient } from './client'

export type SuggestionType =
  | 'explore'
  | 'review'
  | 'deepen'
  | 'connect'
  | 'quiz'
  | 'chat'
  | 'test'

export type ChatMode = 'learn' | 'chat' | 'test'

export interface Suggestion {
  text: string
  title: string
  conceptId?: string
  type: SuggestionType
}

export interface InitialSuggestionsResponse {
  suggestions: Suggestion[]
  hasContent: boolean
  message?: string
  processingTimeMs: number
  /** Whether smart LLM-powered suggestions were used */
  smart?: boolean
  /** Concepts/topics discussed */
  conceptsDiscussed?: Array<string>
}

export interface FollowUpSuggestionsResponse {
  suggestions: Suggestion[]
  processingTimeMs: number
  /** Whether smart LLM-powered suggestions were used */
  smart?: boolean
  /** Concepts/topics discussed in the response */
  conceptsDiscussed?: Array<string>
  /** Number of related RAG chunks used for context */
  relatedChunksUsed?: number
}

export interface TopicsResponse {
  topics: Array<{
    id: string
    label: string
    type: string
    description?: string
    mastery: number
    isDueForReview: boolean
  }>
  total: number
  offset: number
  limit: number
}

/**
 * Fetch initial suggestions for the welcome screen
 * These are personalized based on user's knowledge graph, mastery, and mode
 */
export async function getInitialSuggestions(
  userId: string,
  mode: ChatMode = 'learn',
  limit = 4,
): Promise<InitialSuggestionsResponse> {
  const response = await apiClient.get<InitialSuggestionsResponse>(
    '/api/learning/suggestions/initial',
    {
      params: { userId, mode, limit: String(limit) },
    },
  )
  return response.data
}

/**
 * Fetch follow-up suggestions based on discussed concepts, mode, and response content
 * Called after each assistant response
 * Uses smart LLM-powered generator with RAG for contextual suggestions
 */
export async function getFollowUpSuggestions(
  userId: string,
  options: {
    conceptIds?: Array<string>
    mode?: ChatMode
    limit?: number
    /** The assistant's response - used for smart contextual suggestions */
    assistantResponse?: string
    /** The user's message - used for smart contextual suggestions */
    userMessage?: string
    /** Whether to use smart LLM-powered suggestions (default: true) */
    smart?: boolean
  } = {},
): Promise<FollowUpSuggestionsResponse> {
  const {
    conceptIds = [],
    mode = 'learn',
    limit = 4,
    assistantResponse = '',
    userMessage = '',
    smart = true,
  } = options

  const response = await apiClient.get<FollowUpSuggestionsResponse>(
    '/api/learning/suggestions/followup',
    {
      params: {
        userId,
        mode,
        conceptIds: conceptIds.join(','),
        response: assistantResponse,
        message: userMessage,
        limit: String(limit),
        smart: String(smart),
      },
    },
  )
  return response.data
}

/**
 * Fetch available topics from the knowledge graph
 */
export async function getTopics(
  userId: string,
  options: {
    type?: 'all' | 'concept' | 'process' | 'term'
    limit?: number
    offset?: number
  } = {},
): Promise<TopicsResponse> {
  const { type = 'all', limit = 20, offset = 0 } = options
  const response = await apiClient.get<TopicsResponse>(
    '/api/learning/suggestions/topics',
    {
      params: {
        userId,
        type,
        limit: String(limit),
        offset: String(offset),
      },
    },
  )
  return response.data
}

// Export as namespace for cleaner imports
export const suggestionsApi = {
  getInitial: getInitialSuggestions,
  getFollowUp: getFollowUpSuggestions,
  getTopics,
}

export default suggestionsApi
