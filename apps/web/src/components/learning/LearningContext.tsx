import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type { Suggestion } from '@/api/suggestions'
import {
  getFollowUpSuggestions,
  getInitialSuggestions,
} from '@/api/suggestions'
import { useUserId } from '@/lib/user-context'

export type ChatMode = 'learn' | 'chat' | 'test'

interface LearningContextType {
  // Mode state
  mode: ChatMode
  setMode: (mode: ChatMode) => void

  // Suggestions state
  suggestions: Array<Suggestion>
  suggestionsLoading: boolean
  hasContent: boolean
  suggestionsError: string | null

  // Suggestion actions
  fetchInitialSuggestions: () => Promise<void>
  fetchFollowUpSuggestions: (options: {
    conceptIds?: Array<string>
    assistantResponse?: string
    userMessage?: string
  }) => Promise<void>
  clearSuggestions: () => void

  // Track discussed concepts for follow-ups
  discussedConcepts: Array<string>
  addDiscussedConcept: (conceptId: string) => void
  clearDiscussedConcepts: () => void

  // Last response tracking for smart suggestions
  lastAssistantResponse: string
  lastUserMessage: string
  setLastMessages: (assistantResponse: string, userMessage: string) => void
}

const LearningContext = createContext<LearningContextType | undefined>(
  undefined,
)

export function LearningProvider({ children }: { children: ReactNode }) {
  const userId = useUserId()

  // Mode state
  const [mode, setMode] = useState<ChatMode>('learn')

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Array<Suggestion>>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)

  // Track discussed concepts for follow-up suggestions
  const [discussedConcepts, setDiscussedConcepts] = useState<Array<string>>([])

  // Track last messages for smart follow-up suggestions
  const [lastAssistantResponse, setLastAssistantResponse] = useState('')
  const [lastUserMessage, setLastUserMessage] = useState('')

  // Fetch initial suggestions on mount and when userId/mode changes
  const fetchInitialSuggestions = useCallback(async () => {
    if (!userId) return

    setSuggestionsLoading(true)
    setSuggestionsError(null)

    try {
      const response = await getInitialSuggestions(userId, mode, 4)
      setSuggestions(response.suggestions)
      setHasContent(response.hasContent)
    } catch (error) {
      console.error('Failed to fetch initial suggestions:', error)
      setSuggestionsError(
        error instanceof Error ? error.message : 'Failed to load suggestions',
      )
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }, [userId, mode])

  // Fetch follow-up suggestions based on conversation context
  // Uses smart LLM-powered suggestions when response content is provided
  const fetchFollowUpSuggestions = useCallback(
    async (options: {
      conceptIds?: Array<string>
      assistantResponse?: string
      userMessage?: string
    }) => {
      if (!userId) return

      const {
        conceptIds = discussedConcepts,
        assistantResponse = lastAssistantResponse,
        userMessage = lastUserMessage,
      } = options

      setSuggestionsLoading(true)
      setSuggestionsError(null)

      try {
        const response = await getFollowUpSuggestions(userId, {
          conceptIds,
          mode,
          limit: 4,
          assistantResponse,
          userMessage,
          smart: true, // Use smart LLM-powered suggestions
        })
        setSuggestions(response.suggestions)

        // Add any new concepts discussed
        if (response.conceptsDiscussed) {
          setDiscussedConcepts((prev) => {
            const newConcepts = response.conceptsDiscussed!.filter(
              (c) => !prev.includes(c),
            )
            return [...prev, ...newConcepts]
          })
        }
      } catch (error) {
        console.error('Failed to fetch follow-up suggestions:', error)
        // Don't set error for follow-ups, just keep existing suggestions
      } finally {
        setSuggestionsLoading(false)
      }
    },
    [userId, mode, discussedConcepts, lastAssistantResponse, lastUserMessage],
  )

  // Set last messages (called after assistant response completes)
  const setLastMessages = useCallback(
    (assistantResponse: string, userMessage: string) => {
      setLastAssistantResponse(assistantResponse)
      setLastUserMessage(userMessage)

      // Automatically fetch follow-up suggestions with the new response
      if (assistantResponse) {
        // Set loading immediately to show skeleton (prevents old suggestions flash)
        setSuggestionsLoading(true)
        fetchFollowUpSuggestions({
          assistantResponse,
          userMessage,
        })
      }
    },
    [fetchFollowUpSuggestions],
  )

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setSuggestionsError(null)
  }, [])

  // Add a discussed concept
  const addDiscussedConcept = useCallback((conceptId: string) => {
    setDiscussedConcepts((prev) => {
      if (prev.includes(conceptId)) return prev
      return [...prev, conceptId]
    })
  }, [])

  // Clear discussed concepts (e.g., when starting a new conversation)
  const clearDiscussedConcepts = useCallback(() => {
    setDiscussedConcepts([])
    setLastAssistantResponse('')
    setLastUserMessage('')
  }, [])

  // Fetch initial suggestions on mount
  useEffect(() => {
    if (userId) {
      fetchInitialSuggestions()
    }
  }, [userId, mode, fetchInitialSuggestions])

  // Clear conversation state when mode changes
  useEffect(() => {
    clearDiscussedConcepts()
  }, [mode, clearDiscussedConcepts])

  return (
    <LearningContext.Provider
      value={{
        mode,
        setMode,
        suggestions,
        suggestionsLoading,
        hasContent,
        suggestionsError,
        fetchInitialSuggestions,
        fetchFollowUpSuggestions,
        clearSuggestions,
        discussedConcepts,
        addDiscussedConcept,
        clearDiscussedConcepts,
        lastAssistantResponse,
        lastUserMessage,
        setLastMessages,
      }}
    >
      {children}
    </LearningContext.Provider>
  )
}

export function useLearningContext() {
  const context = useContext(LearningContext)
  if (context === undefined) {
    throw new Error('useLearningContext must be used within a LearningProvider')
  }
  return context
}
