'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Loader2, Trash2, X } from 'lucide-react'

import { useVoiceConversation } from './VoiceConversationProvider'
import { ClientOrb as Orb } from '@/components/ui/orb-client'
import { Button } from '@/components/ui/button'
import { useLearningContextOptional } from '@/components/learning/LearningContext'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { env } from '@/config/env'

export function FloatingVoice() {
  const {
    status,
    isSpeaking,
    isListening,
    startConversation,
    endConversation,
  } = useVoiceConversation()

  // Safely get clearConversation - may be null if outside LearningProvider
  const learningContext = useLearningContextOptional()
  const clearConversation = learningContext?.clearConversation

  const [isExpanded, setIsExpanded] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const actionInProgressRef = useRef(false)

  // Sync expanded state with connection status
  useEffect(() => {
    if (status === 'connected') {
      setIsExpanded(true)
      setIsLoading(false)
    } else if (status === 'disconnected') {
      setIsLoading(false)
    }
  }, [status])

  // Map state to Orb agentState
  const getAgentState = () => {
    if (status !== 'connected') return null
    if (isSpeaking) return 'talking'
    if (isListening) return 'listening'
    return 'thinking'
  }

  const handleStart = useCallback(async () => {
    // Prevent multiple clicks
    if (actionInProgressRef.current || status !== 'disconnected') {
      console.log(
        '[FloatingVoice] Action in progress or not disconnected, skipping',
      )
      return
    }

    actionInProgressRef.current = true
    setIsLoading(true)

    try {
      await startConversation()
      // isExpanded will be set by the useEffect when status changes to connected
    } catch (error) {
      console.error('Failed to start conversation:', error)
      setIsLoading(false)
    } finally {
      actionInProgressRef.current = false
    }
  }, [startConversation, status])

  const handleEnd = useCallback(async () => {
    // Prevent multiple clicks
    if (actionInProgressRef.current) {
      console.log('[FloatingVoice] Action in progress, skipping')
      return
    }

    actionInProgressRef.current = true

    try {
      await endConversation()
      setIsExpanded(false)
    } catch (error) {
      console.error('Failed to end conversation:', error)
    } finally {
      actionInProgressRef.current = false
    }
  }, [endConversation])

  const toggleExpand = () => {
    if (status === 'connected') {
      setIsExpanded(!isExpanded)
    }
  }

  const handleClearConversation = useCallback(() => {
    if (clearConversation) {
      clearConversation()
    }
  }, [clearConversation])

  // Show only clear button if no ElevenLabs agent configured
  const showVoiceOrb = !!env.ELEVENLABS_AGENT_ID
  // Only show clear button if we have access to clearConversation
  const showClearButton = !!clearConversation

  // If nothing to show, render nothing
  if (!showVoiceOrb && !showClearButton) {
    return null
  }

  return (
    <TooltipProvider>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Clear Conversation Button - only visible if clearConversation is available */}
        {clearConversation && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className={cn(
                      'h-10 w-10 rounded-full mr-2',
                      'bg-background/80 backdrop-blur-md',
                      'border shadow-lg',
                      'hover:bg-destructive/10 hover:border-destructive/50 hover:text-destructive',
                      'transition-colors duration-200',
                    )}
                    onClick={handleClearConversation}
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Clear conversation</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="left">
                  <p>Clear conversation</p>
                </TooltipContent>
              </Tooltip>
            </motion.div>
          </AnimatePresence>
        )}

        {/* Voice Orb - only if ElevenLabs is configured */}
        {showVoiceOrb && (
          <AnimatePresence>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className={cn(
                'transition-all duration-300 ease-in-out bg-background/80 backdrop-blur-md border rounded-2xl shadow-2xl overflow-hidden',
                isExpanded ? 'w-80 h-96' : 'w-16 h-16 rounded-full',
              )}
            >
              {/* Controls Overlay */}
              <div
                className={cn(
                  'absolute top-0 left-0 w-full z-10 flex justify-between p-2',
                  !isExpanded && 'hidden',
                )}
              >
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'w-2 h-2 rounded-full',
                      status === 'connected' ? 'bg-green-500' : 'bg-yellow-500',
                    )}
                  />
                  <span className="text-xs font-medium text-muted-foreground">
                    {status === 'connected'
                      ? isListening
                        ? 'Listening'
                        : isSpeaking
                          ? 'Speaking'
                          : 'Connected'
                      : 'Connecting...'}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hover:bg-destructive/20 hover:text-destructive"
                    onClick={handleEnd}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Orb Container */}
              <div
                className="w-full h-full cursor-pointer relative"
                onClick={() => {
                  if (status === 'disconnected') {
                    handleStart()
                  } else {
                    toggleExpand()
                  }
                }}
              >
                <Orb
                  agentState={getAgentState()}
                  className="w-full h-full"
                  colors={['#FEF08A', '#FDE047']}
                />

                {/* Loading Overlay */}
                {(isLoading || status === 'connecting') && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-20">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>

              {/* Footer controls when expanded */}
              {isExpanded && (
                <div className="absolute bottom-4 left-0 w-full flex justify-center gap-4 z-10 pointer-events-none">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="pointer-events-auto shadow-lg"
                    onClick={handleEnd}
                  >
                    End Call
                  </Button>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </TooltipProvider>
  )
}
