import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'

import type { Suggestion } from '@/api/suggestions'
import type { TestConfiguration } from '@repo/shared'
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

  // Context reset for test mode
  shouldResetRuntime: boolean
  onRuntimeReset: () => void
  runtimeKey: number

  // Manual conversation clear
  clearConversation: () => void

  // Test configuration
  testConfig: TestConfiguration | null
  startTestWithConfig: (config: TestConfiguration) => void

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
  const [mode, setModeInternal] = useState<ChatMode>('learn')

  // Context reset state for test mode
  const [shouldResetRuntime, setShouldResetRuntime] = useState(false)
  const [runtimeKey, setRuntimeKey] = useState(0)
  const [testConfig, setTestConfig] = useState<TestConfiguration | null>(null)

  // Suggestions state
  const [suggestions, setSuggestions] = useState<Array<Suggestion>>([])
  const [suggestionsLoading, setSuggestionsLoading] = useState(false)
  const [hasContent, setHasContent] = useState(false)
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null)

  // Cache suggestions by mode to prevent blinking on mode switch
  const [suggestionsCache, setSuggestionsCache] = useState<
    Record<ChatMode, { suggestions: Array<Suggestion>; hasContent: boolean }>
  >({
    learn: { suggestions: [], hasContent: false },
    chat: { suggestions: [], hasContent: false },
    test: { suggestions: [], hasContent: false },
  })

  // Track discussed concepts for follow-up suggestions
  const [discussedConcepts, setDiscussedConcepts] = useState<Array<string>>([])

  // Track last messages for smart follow-up suggestions
  const [lastAssistantResponse, setLastAssistantResponse] = useState('')
  const [lastUserMessage, setLastUserMessage] = useState('')

  // Clear discussed concepts (e.g., when starting a new conversation)
  const clearDiscussedConcepts = useCallback(() => {
    setDiscussedConcepts([])
    setLastAssistantResponse('')
    setLastUserMessage('')
  }, [])

  // Clear suggestions
  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    setSuggestionsError(null)
    // Also clear cache for current mode
    setSuggestionsCache((prev) => ({
      ...prev,
      [mode]: { suggestions: [], hasContent: false },
    }))
  }, [mode])

  // Enhanced mode setter that triggers reset for test mode
  const setMode = useCallback(
    (newMode: ChatMode) => {
      const previousMode = mode

      // If switching TO test mode from another mode, we need a clean slate
      if (newMode === 'test' && previousMode !== 'test') {
        setShouldResetRuntime(true)
        setRuntimeKey((k) => k + 1) // Force re-mount of runtime
        clearDiscussedConcepts()
        clearSuggestions()
      }

      // If switching FROM test mode, clear test config
      if (previousMode === 'test' && newMode !== 'test') {
        setTestConfig(null)
      }

      setModeInternal(newMode)
    },
    [mode, clearDiscussedConcepts, clearSuggestions],
  )

  // Callback after runtime has been reset
  const onRuntimeReset = useCallback(() => {
    setShouldResetRuntime(false)
  }, [])

  // Manual conversation clear (for clear button)
  const clearConversation = useCallback(() => {
    setShouldResetRuntime(true)
    setRuntimeKey((k) => k + 1)
    clearDiscussedConcepts()
    clearSuggestions()
  }, [clearDiscussedConcepts, clearSuggestions])

  // Start test with configuration
  const startTestWithConfig = useCallback(
    (config: TestConfiguration) => {
      const previousConfig = testConfig
      setTestConfig(config)

      // If not already in test mode, switch to it
      if (mode !== 'test') {
        setMode('test')
        return
      }

      // Already in test mode - only reset if it's a different test
      // If we don't have a previous config, it's the first test in this session
      if (!previousConfig) {
        setShouldResetRuntime(true)
        setRuntimeKey((k) => k + 1)
        clearDiscussedConcepts()
        clearSuggestions()
        return
      }

      // Check if this is just a skill level change (same other config)
      const isOnlySkillLevelChange =
        previousConfig.questionCount === config.questionCount &&
        previousConfig.questionStyle === config.questionStyle &&
        previousConfig.questionFormat === config.questionFormat &&
        previousConfig.timingMode === config.timingMode &&
        previousConfig.skillLevel !== config.skillLevel

      // Only reset conversation if it's not just a skill level change
      if (!isOnlySkillLevelChange) {
        setShouldResetRuntime(true)
        setRuntimeKey((k) => k + 1)
        clearDiscussedConcepts()
        clearSuggestions()
      }
    },
    [mode, setMode, testConfig, clearDiscussedConcepts, clearSuggestions],
  )

  // Fetch initial suggestions on mount and when userId/mode changes
  const fetchInitialSuggestions = useCallback(async () => {
    if (!userId) return

    // Check cache first
    const cached = suggestionsCache[mode]
    if (cached.suggestions.length > 0) {
      setSuggestions(cached.suggestions)
      setHasContent(cached.hasContent)
      return
    }

    setSuggestionsLoading(true)
    setSuggestionsError(null)

    try {
      const response = await getInitialSuggestions(userId, mode, 4)
      setSuggestions(response.suggestions)
      setHasContent(response.hasContent)

      // Cache the result
      setSuggestionsCache((prev) => ({
        ...prev,
        [mode]: {
          suggestions: response.suggestions,
          hasContent: response.hasContent,
        },
      }))
    } catch (error) {
      console.error('Failed to fetch initial suggestions:', error)
      setSuggestionsError(
        error instanceof Error ? error.message : 'Failed to load suggestions',
      )
      setSuggestions([])
    } finally {
      setSuggestionsLoading(false)
    }
  }, [userId, mode, suggestionsCache])

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

        // Update cache
        setSuggestionsCache((prev) => ({
          ...prev,
          [mode]: {
            suggestions: response.suggestions,
            hasContent: prev[mode].hasContent,
          },
        }))

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

  // Add a discussed concept
  const addDiscussedConcept = useCallback((conceptId: string) => {
    setDiscussedConcepts((prev) => {
      if (prev.includes(conceptId)) return prev
      return [...prev, conceptId]
    })
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
        shouldResetRuntime,
        onRuntimeReset,
        runtimeKey,
        clearConversation,
        testConfig,
        startTestWithConfig,
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

/**
 * Optional version of useLearningContext that returns null if not within a provider
 * Useful for components that may be rendered outside of LearningProvider
 */
export function useLearningContextOptional() {
  const context = useContext(LearningContext)
  return context ?? null
}
