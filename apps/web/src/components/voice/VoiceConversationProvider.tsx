'use client'

// ** import lib
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useConversation } from '@elevenlabs/react'

// ** import types
import type { ReactNode } from 'react'

// ** import config
import { env } from '@/config/env'

/**
 * Message in the voice conversation
 */
export interface VoiceMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  isComplete: boolean
}

/**
 * Voice conversation status type
 */
export type VoiceStatus = 'connected' | 'connecting' | 'disconnected'

/**
 * Voice conversation context type
 */
interface VoiceConversationContextType {
  /** Current connection status */
  status: VoiceStatus
  /** Whether the agent is currently speaking */
  isSpeaking: boolean
  /** Whether the agent is currently listening */
  isListening: boolean
  /** Whether the agent is thinking (processing but no text yet) */
  isThinking: boolean
  /** Current streaming text (live as it's being generated) */
  currentStreamingText: string
  /** Conversation messages (completed messages) */
  messages: Array<VoiceMessage>
  /** Start the voice conversation */
  startConversation: () => Promise<string | undefined>
  /** End the voice conversation */
  endConversation: () => Promise<void>
  /** Send a text message (for hybrid mode) */
  sendTextMessage: (text: string) => void
  /** Current conversation ID */
  conversationId: string | null
}

const VoiceConversationContext =
  createContext<VoiceConversationContextType | null>(null)

/**
 * Props for VoiceConversationProvider
 */
interface VoiceConversationProviderProps {
  children: ReactNode
  /** User ID for RAG context */
  userId: string
  /** Callback when a message is received */
  onMessage?: (message: VoiceMessage) => void
  /** Callback when an error occurs */
  onError?: (error: Error) => void
  /** Callback when connection status changes */
  onStatusChange?: (status: VoiceStatus) => void
}

/**
 * Map SDK status to our simplified status type
 */
function mapStatus(sdkStatus: string): VoiceStatus {
  switch (sdkStatus) {
    case 'connected':
      return 'connected'
    case 'connecting':
      return 'connecting'
    case 'disconnected':
    case 'disconnecting':
    default:
      return 'disconnected'
  }
}

/**
 * Voice Conversation Provider
 *
 * Provides voice conversation functionality using ElevenLabs React SDK.
 * Integrates with the Echo-Learn backend via Custom LLM configuration.
 */
export function VoiceConversationProvider({
  children,
  userId,
  onMessage,
  onError,
  onStatusChange,
}: VoiceConversationProviderProps) {
  const [messages, setMessages] = useState<Array<VoiceMessage>>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [currentStreamingText, setCurrentStreamingText] = useState<string>('')
  const [isThinking, setIsThinking] = useState<boolean>(false)

  // Refs to prevent React StrictMode double-mounting issues
  const isStartingRef = useRef(false)
  const isEndingRef = useRef(false)
  const sessionActiveRef = useRef(false)
  const mountedRef = useRef(true)
  const conversationRef = useRef<ReturnType<typeof useConversation> | null>(
    null,
  )
  // Track if this is a real unmount vs StrictMode remount
  const hasEverConnectedRef = useRef(false)
  const unmountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track current streaming message ID
  const currentStreamingIdRef = useRef<string | null>(null)

  // Initialize the conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('[VoiceConversation] Connected')
      sessionActiveRef.current = true
      hasEverConnectedRef.current = true
      // Cancel any pending cleanup from StrictMode remount
      if (unmountTimeoutRef.current) {
        clearTimeout(unmountTimeoutRef.current)
        unmountTimeoutRef.current = null
      }
      if (mountedRef.current) {
        onStatusChange?.('connected')
      }
    },
    onDisconnect: () => {
      console.log('[VoiceConversation] Disconnected')
      sessionActiveRef.current = false
      isStartingRef.current = false
      isEndingRef.current = false
      if (mountedRef.current) {
        onStatusChange?.('disconnected')
        setConversationId(null)
        setCurrentStreamingText('')
        setIsThinking(false)
      }
    },
    onMessage: (message) => {
      console.log('[VoiceConversation] Message received:', message)

      // Handle different message types based on the event structure
      const messageEvent = message as {
        source?: string
        message?: string
        type?: string
      }

      if (messageEvent.source === 'user' && messageEvent.message) {
        // User message - add as complete
        const userMessage: VoiceMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'user',
          content: messageEvent.message,
          timestamp: new Date(),
          isComplete: true,
        }
        setMessages((prev) => [...prev, userMessage])
        onMessage?.(userMessage)

        // After user speaks, agent will start thinking
        setIsThinking(true)
        setCurrentStreamingText('')
      } else if (messageEvent.source === 'ai' && messageEvent.message) {
        // AI message - add as complete (ElevenLabs sends full messages, not streaming chunks)
        const finalText = messageEvent.message
        console.log('[VoiceConversation] AI message:', finalText)

        // Stop thinking state
        setIsThinking(false)

        // Create a new complete message
        const newMsg: VoiceMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          role: 'assistant',
          content: finalText,
          timestamp: new Date(),
          isComplete: true,
        }
        setMessages((prev) => [...prev, newMsg])
        onMessage?.(newMsg)

        // Clear streaming state
        setCurrentStreamingText('')
        currentStreamingIdRef.current = null
      }
    },
    // Handle streaming AI response chunks (if available)
    // Note: This callback may not fire for all agent configurations
    onAgentChatResponsePart: (chunk: unknown) => {
      console.log('[VoiceConversation] Chunk received:', chunk)
      // Agent is responding, no longer thinking
      setIsThinking(false)
    },
    onError: (error) => {
      console.error('[VoiceConversation] Error:', error)
      // Reset state on error
      sessionActiveRef.current = false
      isStartingRef.current = false
      setIsThinking(false)
      setCurrentStreamingText('')
      if (mountedRef.current) {
        onError?.(new Error(String(error)))
      }
    },
    onModeChange: (mode) => {
      console.log('[VoiceConversation] Mode changed:', mode)
      // When mode changes to speaking, agent is no longer thinking
      if (mode.mode === 'speaking') {
        setIsThinking(false)
      }
    },
  })

  // Keep conversation ref updated
  conversationRef.current = conversation

  // Cleanup on unmount - end session if active
  useEffect(() => {
    mountedRef.current = true
    // Clear any pending cleanup from previous StrictMode unmount
    if (unmountTimeoutRef.current) {
      clearTimeout(unmountTimeoutRef.current)
      unmountTimeoutRef.current = null
    }
    return () => {
      mountedRef.current = false
      // Delay cleanup to allow StrictMode remount to cancel it
      if (
        sessionActiveRef.current &&
        conversationRef.current &&
        hasEverConnectedRef.current
      ) {
        unmountTimeoutRef.current = setTimeout(() => {
          if (
            !mountedRef.current &&
            sessionActiveRef.current &&
            conversationRef.current
          ) {
            console.log('[VoiceConversation] Cleaning up on unmount (delayed)')
            sessionActiveRef.current = false
            conversationRef.current.endSession().catch((err) => {
              console.error('[VoiceConversation] Cleanup error:', err)
            })
          }
        }, 100)
      }
    }
  }, [])

  // Request microphone permission
  const requestMicrophonePermission =
    useCallback(async (): Promise<boolean> => {
      try {
        console.log('[VoiceConversation] Requesting microphone permission')
        await navigator.mediaDevices.getUserMedia({ audio: true })
        console.log('[VoiceConversation] Microphone permission granted')
        return true
      } catch (error) {
        console.error(
          '[VoiceConversation] Microphone permission denied:',
          error,
        )
        onError?.(new Error('Microphone access is required for voice chat'))
        return false
      }
    }, [onError])

  // Start conversation
  const startConversation = useCallback(async () => {
    // Prevent double-start from React StrictMode
    if (isStartingRef.current) {
      console.log('[VoiceConversation] Already starting, skipping')
      return conversationId ?? undefined
    }

    // Check if already connected via SDK status
    if (conversation.status === 'connected') {
      console.log('[VoiceConversation] Already connected, skipping')
      return conversationId ?? undefined
    }

    isStartingRef.current = true

    try {
      console.log('[VoiceConversation] Starting conversation for user:', userId)
      if (mountedRef.current) {
        onStatusChange?.('connecting')
      }

      // Request microphone permission first
      const hasMicPermission = await requestMicrophonePermission()
      if (!hasMicPermission) {
        onStatusChange?.('disconnected')
        isStartingRef.current = false
        return undefined
      }

      // Start session with agent ID and WebRTC connection
      const convId = await conversation.startSession({
        agentId: env.ELEVENLABS_AGENT_ID,
        connectionType: 'webrtc',
      })

      // Only update state if still mounted
      if (mountedRef.current) {
        sessionActiveRef.current = true
        setConversationId(convId)
        console.log('[VoiceConversation] Conversation started:', convId)
      }

      return convId
    } catch (error) {
      console.error('[VoiceConversation] Failed to start:', error)
      if (mountedRef.current) {
        onError?.(
          error instanceof Error
            ? error
            : new Error('Failed to start conversation'),
        )
        onStatusChange?.('disconnected')
      }
      throw error
    } finally {
      isStartingRef.current = false
    }
  }, [
    conversation,
    userId,
    onError,
    onStatusChange,
    conversationId,
    requestMicrophonePermission,
  ])

  // End conversation
  const endConversation = useCallback(async () => {
    // Prevent double-end
    if (isEndingRef.current || !sessionActiveRef.current) {
      console.log('[VoiceConversation] Already ending or not active, skipping')
      return
    }

    isEndingRef.current = true

    try {
      console.log('[VoiceConversation] Ending conversation')
      await conversation.endSession()
      if (mountedRef.current) {
        sessionActiveRef.current = false
        setMessages([])
        setConversationId(null)
        setCurrentStreamingText('')
        setIsThinking(false)
      }
    } catch (error) {
      console.error('[VoiceConversation] Failed to end:', error)
      if (mountedRef.current) {
        onError?.(
          error instanceof Error
            ? error
            : new Error('Failed to end conversation'),
        )
      }
    } finally {
      isEndingRef.current = false
      sessionActiveRef.current = false
    }
  }, [conversation, onError])

  // Send text message (for hybrid voice/text mode)
  const sendTextMessage = useCallback(
    (text: string) => {
      const mappedStatus = mapStatus(conversation.status)
      if (mappedStatus !== 'connected') {
        console.warn('[VoiceConversation] Cannot send message: not connected')
        return
      }

      console.log('[VoiceConversation] Sending text message:', text)
      conversation.sendUserMessage(text)
    },
    [conversation],
  )

  // Derive speaking/listening state
  const isSpeaking = conversation.isSpeaking
  const mappedStatus = mapStatus(conversation.status)
  const isListening =
    !conversation.isSpeaking && mappedStatus === 'connected' && !isThinking

  // Context value
  const value = useMemo<VoiceConversationContextType>(
    () => ({
      status: mappedStatus,
      isSpeaking,
      isListening,
      isThinking,
      currentStreamingText,
      messages,
      startConversation,
      endConversation,
      sendTextMessage,
      conversationId,
    }),
    [
      mappedStatus,
      isSpeaking,
      isListening,
      isThinking,
      currentStreamingText,
      messages,
      startConversation,
      endConversation,
      sendTextMessage,
      conversationId,
    ],
  )

  return (
    <VoiceConversationContext.Provider value={value}>
      {children}
    </VoiceConversationContext.Provider>
  )
}

/**
 * Hook to use voice conversation context
 */
export function useVoiceConversation() {
  const context = useContext(VoiceConversationContext)

  if (!context) {
    throw new Error(
      'useVoiceConversation must be used within a VoiceConversationProvider',
    )
  }

  return context
}
