import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import type {
  QuestionDifficulty,
  TestConfiguration,
  TestQuestion,
  TestResult,
  TestSession,
  TestSessionSummary,
} from '@repo/shared'

import type { QuickAction } from './AnswerFeedback'

/**
 * Answer feedback to display after submission
 */
export interface AnswerFeedback {
  isCorrect: boolean
  evaluation: 'correct' | 'partial' | 'incorrect'
  feedback: string
  conceptEvaluated: string
  conceptSummary: string
  correctApproach?: string
}

/**
 * Test session progress
 */
export interface TestSessionProgress {
  current: number
  total: number
  score: number
  remaining: number
  correctCount: number
  incorrectCount: number
  partialCount: number
}

/**
 * Quick action request from feedback buttons
 */
export interface QuickActionRequest {
  action: QuickAction
  timestamp: number
}

interface TestModeContextType {
  // Configuration
  config: TestConfiguration | null
  setConfig: (config: TestConfiguration) => void

  // Session State
  session: TestSession | null
  setSession: (session: TestSession | null) => void
  currentQuestion: TestQuestion | null
  questionIndex: number
  isTestActive: boolean

  // Timer State (when timed mode)
  timeRemaining: number | null
  isTimerRunning: boolean
  isTimerEnabled: boolean
  startTimer: () => void
  pauseTimer: () => void
  resetTimer: () => void

  // Results
  results: Array<TestResult>
  addResult: (result: TestResult) => void
  clearResults: () => void

  // Session Summary
  summary: TestSessionSummary | null
  setSummary: (summary: TestSessionSummary | null) => void

  // Feedback Display
  currentFeedback: AnswerFeedback | null
  showFeedback: (feedback: AnswerFeedback) => void
  clearFeedback: () => void

  // Quick Actions from feedback buttons
  pendingAction: QuickActionRequest | null
  handleQuickAction: (action: QuickAction) => void
  clearPendingAction: () => void

  // Difficulty preference (can be adjusted mid-test)
  difficultyPreference: QuestionDifficulty | 'adaptive'
  setDifficultyPreference: (difficulty: QuestionDifficulty | 'adaptive') => void

  // Topic preference (for "different topic" action)
  requestDifferentTopic: boolean
  clearDifferentTopicRequest: () => void

  // Actions
  startTest: (config: TestConfiguration) => void
  endTest: () => void
  resetTest: () => void

  // Config Modal
  isConfigModalOpen: boolean
  openConfigModal: () => void
  closeConfigModal: () => void

  // Summary Modal
  isSummaryModalOpen: boolean
  openSummaryModal: () => void
  closeSummaryModal: () => void
}

const TestModeContext = createContext<TestModeContextType | undefined>(
  undefined,
)

export function TestModeProvider({ children }: { children: ReactNode }) {
  // Configuration state
  const [config, setConfig] = useState<TestConfiguration | null>(null)

  // Session state
  const [session, setSession] = useState<TestSession | null>(null)
  const [results, setResults] = useState<Array<TestResult>>([])
  const [summary, setSummary] = useState<TestSessionSummary | null>(null)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)

  // Feedback state
  const [currentFeedback, setCurrentFeedback] = useState<AnswerFeedback | null>(
    null,
  )

  // Quick action state
  const [pendingAction, setPendingAction] = useState<QuickActionRequest | null>(
    null,
  )
  const [difficultyPreference, setDifficultyPreference] = useState<
    QuestionDifficulty | 'adaptive'
  >('adaptive')
  const [requestDifferentTopic, setRequestDifferentTopic] = useState(false)

  // Modal state
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false)
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false)

  // Derived state
  const isTestActive = session !== null && session.status === 'active'
  const currentQuestion = session?.questions[session.currentIndex] ?? null
  const questionIndex = session?.currentIndex ?? 0
  const isTimerEnabled = config?.timingMode === 'timed'

  // Timer effect
  useEffect(() => {
    if (!isTimerRunning || timeRemaining === null || timeRemaining <= 0) {
      return
    }

    const interval = setInterval(() => {
      setTimeRemaining((t) => {
        if (t === null || t <= 1) {
          setIsTimerRunning(false)
          return 0
        }
        return t - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimerRunning, timeRemaining])

  // Timer controls
  const startTimer = useCallback(() => {
    if (config?.timingMode === 'timed' && config.timePerQuestion) {
      setTimeRemaining(config.timePerQuestion)
      setIsTimerRunning(true)
    }
  }, [config])

  const pauseTimer = useCallback(() => {
    setIsTimerRunning(false)
  }, [])

  const resetTimer = useCallback(() => {
    if (config?.timingMode === 'timed' && config.timePerQuestion) {
      setTimeRemaining(config.timePerQuestion)
      setIsTimerRunning(true)
    }
  }, [config])

  // Result management
  const addResult = useCallback((result: TestResult) => {
    setResults((prev) => [...prev, result])
  }, [])

  const clearResults = useCallback(() => {
    setResults([])
  }, [])

  // Feedback management
  const showFeedback = useCallback((feedback: AnswerFeedback) => {
    setCurrentFeedback(feedback)
    setIsTimerRunning(false) // Pause timer when showing feedback
  }, [])

  const clearFeedback = useCallback(() => {
    setCurrentFeedback(null)
  }, [])

  // Quick action handlers
  const handleQuickAction = useCallback((action: QuickAction) => {
    setPendingAction({ action, timestamp: Date.now() })
    setCurrentFeedback(null) // Clear feedback when action is taken

    switch (action) {
      case 'different-topic':
        setRequestDifferentTopic(true)
        break
      case 'easier':
        setDifficultyPreference('easy')
        break
      case 'harder':
        setDifficultyPreference('hard')
        break
      case 'end-test':
        // Will be handled by the component that consumes pendingAction
        break
      case 'next':
      default:
        // Just proceed to next question
        break
    }
  }, [])

  const clearPendingAction = useCallback(() => {
    setPendingAction(null)
  }, [])

  const clearDifferentTopicRequest = useCallback(() => {
    setRequestDifferentTopic(false)
  }, [])

  // Test lifecycle
  const startTest = useCallback((testConfig: TestConfiguration) => {
    setConfig(testConfig)
    setResults([])
    setSummary(null)
    setCurrentFeedback(null)
    setIsConfigModalOpen(false)

    // Timer setup for timed mode
    if (testConfig.timingMode === 'timed' && testConfig.timePerQuestion) {
      setTimeRemaining(testConfig.timePerQuestion)
    } else {
      setTimeRemaining(null)
    }
  }, [])

  const endTest = useCallback(() => {
    setIsTimerRunning(false)
    setTimeRemaining(null)
  }, [])

  const resetTest = useCallback(() => {
    setConfig(null)
    setSession(null)
    setResults([])
    setSummary(null)
    setCurrentFeedback(null)
    setTimeRemaining(null)
    setIsTimerRunning(false)
    setIsConfigModalOpen(false)
    setIsSummaryModalOpen(false)
    setPendingAction(null)
    setDifficultyPreference('adaptive')
    setRequestDifferentTopic(false)
  }, [])

  // Modal controls
  const openConfigModal = useCallback(() => {
    setIsConfigModalOpen(true)
  }, [])

  const closeConfigModal = useCallback(() => {
    setIsConfigModalOpen(false)
  }, [])

  const openSummaryModal = useCallback(() => {
    setIsSummaryModalOpen(true)
  }, [])

  const closeSummaryModal = useCallback(() => {
    setIsSummaryModalOpen(false)
  }, [])

  return (
    <TestModeContext.Provider
      value={{
        // Configuration
        config,
        setConfig,

        // Session State
        session,
        setSession,
        currentQuestion,
        questionIndex,
        isTestActive,

        // Timer State
        timeRemaining,
        isTimerRunning,
        isTimerEnabled,
        startTimer,
        pauseTimer,
        resetTimer,

        // Results
        results,
        addResult,
        clearResults,

        // Session Summary
        summary,
        setSummary,

        // Feedback Display
        currentFeedback,
        showFeedback,
        clearFeedback,

        // Quick Actions
        pendingAction,
        handleQuickAction,
        clearPendingAction,

        // Difficulty preference
        difficultyPreference,
        setDifficultyPreference,

        // Topic preference
        requestDifferentTopic,
        clearDifferentTopicRequest,

        // Actions
        startTest,
        endTest,
        resetTest,

        // Config Modal
        isConfigModalOpen,
        openConfigModal,
        closeConfigModal,

        // Summary Modal
        isSummaryModalOpen,
        openSummaryModal,
        closeSummaryModal,
      }}
    >
      {children}
    </TestModeContext.Provider>
  )
}

export function useTestMode() {
  const context = useContext(TestModeContext)
  if (context === undefined) {
    throw new Error('useTestMode must be used within TestModeProvider')
  }
  return context
}
