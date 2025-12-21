'use client'

// ** import lib
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
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
  /** Conversation messages */
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

  // Add message helper
  const addMessage = useCallback(
    (role: 'user' | 'assistant', content: string) => {
      const message: VoiceMessage = {
        id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        role,
        content,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, message])
      onMessage?.(message)

      return message
    },
    [onMessage],
  )

  // Initialize the conversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('[VoiceConversation] Connected')
      onStatusChange?.('connected')
    },
    onDisconnect: () => {
      console.log('[VoiceConversation] Disconnected')
      onStatusChange?.('disconnected')
      setConversationId(null)
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
        addMessage('user', messageEvent.message)
      } else if (messageEvent.source === 'ai' && messageEvent.message) {
        addMessage('assistant', messageEvent.message)
      }
    },
    onError: (error) => {
      console.error('[VoiceConversation] Error:', error)
      onError?.(new Error(String(error)))
    },
    onModeChange: (mode) => {
      console.log('[VoiceConversation] Mode changed:', mode)
    },
  })

  // Start conversation
  const startConversation = useCallback(async () => {
    try {
      console.log('[VoiceConversation] Starting conversation for user:', userId)
      onStatusChange?.('connecting')

      // Start session with agent ID and connection type
      // The customLlmExtraBody passes user context to our backend
      const convId = await conversation.startSession({
        agentId: env.ELEVENLABS_AGENT_ID,
        connectionType: 'websocket',
        customLlmExtraBody: {
          user_id: userId,
          conversation_id: `conv-${Date.now()}`,
        },
      })

      setConversationId(convId)
      console.log('[VoiceConversation] Conversation started:', convId)

      return convId
    } catch (error) {
      console.error('[VoiceConversation] Failed to start:', error)
      onError?.(
        error instanceof Error
          ? error
          : new Error('Failed to start conversation'),
      )
      onStatusChange?.('disconnected')
      throw error
    }
  }, [conversation, userId, onError, onStatusChange])

  // End conversation
  const endConversation = useCallback(async () => {
    try {
      console.log('[VoiceConversation] Ending conversation')
      await conversation.endSession()
      setMessages([])
      setConversationId(null)
    } catch (error) {
      console.error('[VoiceConversation] Failed to end:', error)
      onError?.(
        error instanceof Error
          ? error
          : new Error('Failed to end conversation'),
      )
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
  const isListening = !conversation.isSpeaking && mappedStatus === 'connected'

  // Context value
  const value = useMemo<VoiceConversationContextType>(
    () => ({
      status: mappedStatus,
      isSpeaking,
      isListening,
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
