'use client'

// ** import lib
import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'

// ** import types
import { MessageSquare, Mic, MicOff, Phone, PhoneOff } from 'lucide-react'
import { VoiceOrb, getStateDisplayText } from './VoiceOrb'
import { useVoiceConversation } from './VoiceConversationProvider'
import type { VoiceMessage } from './VoiceConversationProvider'

// ** import components
import type { OrbAgentState } from './VoiceOrb'

// ** import ui
import { Button } from '@/components/ui/button'

// ** import icons

// ** import utils
import { cn } from '@/lib/utils'

/**
 * Props for VoiceInterface component
 */
interface VoiceInterfaceProps {
  /** Additional class names */
  className?: string
  /** Callback when conversation ends */
  onConversationEnd?: () => void
}

/**
 * VoiceInterface Component
 *
 * The main voice conversation interface that includes:
 * - Animated orb visualization
 * - Call controls (start/end)
 * - Message transcript
 * - Status indicators
 */
export function VoiceInterface({
  className,
  onConversationEnd,
}: VoiceInterfaceProps) {
  const {
    status,
    isSpeaking,
    isListening,
    messages,
    startConversation,
    endConversation,
    sendTextMessage,
  } = useVoiceConversation()

  const [isStarting, setIsStarting] = useState(false)
  const [showTranscript, setShowTranscript] = useState(true)
  const [textInput, setTextInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Derive orb state from conversation state
  const getOrbState = (): OrbAgentState => {
    if (status !== 'connected') return 'idle'
    if (isSpeaking) return 'speaking'
    if (isListening) return 'listening'
    return 'thinking'
  }

  // Handle start conversation
  const handleStart = useCallback(async () => {
    setIsStarting(true)
    try {
      await startConversation()
    } catch (error) {
      console.error('Failed to start conversation:', error)
    } finally {
      setIsStarting(false)
    }
  }, [startConversation])

  // Handle end conversation
  const handleEnd = useCallback(async () => {
    await endConversation()
    onConversationEnd?.()
  }, [endConversation, onConversationEnd])

  // Handle sending text message
  const handleSendText = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      if (textInput.trim() && status === 'connected') {
        sendTextMessage(textInput.trim())
        setTextInput('')
      }
    },
    [textInput, status, sendTextMessage],
  )

  const orbState = getOrbState()
  const stateText = getStateDisplayText(orbState)

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between h-full p-6',
        className,
      )}
    >
      {/* Header with status */}
      <div className="w-full flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              status === 'connected' && 'bg-green-500',
              status === 'connecting' && 'bg-yellow-500 animate-pulse',
              status === 'disconnected' && 'bg-gray-400',
            )}
          />
          <span className="text-sm text-muted-foreground capitalize">
            {status}
          </span>
        </div>

        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTranscript(!showTranscript)}
            className="gap-1"
          >
            <MessageSquare className="w-4 h-4" />
            {showTranscript ? 'Hide' : 'Show'} Transcript
          </Button>
        )}
      </div>

      {/* Main content area */}
      <div className="flex-1 w-full flex flex-col items-center justify-center gap-8">
        {/* Orb visualization */}
        <div className="flex flex-col items-center gap-4">
          <VoiceOrb
            agentState={orbState}
            size={160}
            primaryColor="#6366F1"
            secondaryColor="#8B5CF6"
          />

          {/* Status text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stateText}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center"
            >
              <p className="text-lg font-medium text-foreground">{stateText}</p>
              {status === 'connected' && isListening && (
                <p className="text-sm text-muted-foreground mt-1">
                  Speak now or type below
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Transcript */}
        <AnimatePresence>
          {showTranscript && messages.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full max-w-md"
            >
              <div className="bg-muted/30 rounded-lg p-4 max-h-48 overflow-y-auto">
                <div className="space-y-3">
                  {messages.map((message) => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      <div className="w-full max-w-md space-y-4">
        {/* Text input (when connected) */}
        {status === 'connected' && (
          <form onSubmit={handleSendText} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 px-4 py-2 rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <Button type="submit" disabled={!textInput.trim()}>
              Send
            </Button>
          </form>
        )}

        {/* Call controls */}
        <div className="flex justify-center gap-4">
          {status === 'disconnected' ? (
            <Button
              size="lg"
              onClick={handleStart}
              disabled={isStarting}
              className="gap-2 px-8"
            >
              {isStarting ? (
                <>
                  <motion.div
                    className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      ease: 'linear',
                    }}
                  />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="w-5 h-5" />
                  Start Voice Chat
                </>
              )}
            </Button>
          ) : (
            <>
              {/* Mute indicator */}
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-muted">
                {isListening ? (
                  <Mic className="w-5 h-5 text-green-500" />
                ) : (
                  <MicOff className="w-5 h-5 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {isListening ? 'Mic Active' : 'Mic Paused'}
                </span>
              </div>

              {/* End call button */}
              <Button
                size="lg"
                variant="destructive"
                onClick={handleEnd}
                className="gap-2"
              >
                <PhoneOff className="w-5 h-5" />
                End Call
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Message bubble component
 */
function MessageBubble({ message }: { message: VoiceMessage }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, x: isUser ? 20 : -20 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-3 py-2 text-sm',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground',
        )}
      >
        <p>{message.content}</p>
        <span className="text-xs opacity-70 mt-1 block">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </motion.div>
  )
}
