'use client'

import { useCallback } from 'react'
import { useThreadRuntime } from '@assistant-ui/react'
import {
  ArrowRight,
  ChevronDown,
  RefreshCw,
  Square,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type QuickAction =
  | 'next'
  | 'different-topic'
  | 'easier'
  | 'harder'
  | 'end-test'

interface TestModeQuickActionsProps {
  /** Whether to show difficulty adjustment options */
  showDifficultyOptions?: boolean
  /** Optional className for styling */
  className?: string
  /** Callback when an action is taken (for tracking/state management) */
  onAction?: (action: QuickAction) => void
}

/**
 * Quick action buttons for Test Mode
 *
 * These buttons send messages to the LLM to trigger the next action.
 * They appear after a user answers a question and receives feedback.
 */
export function TestModeQuickActions({
  showDifficultyOptions = true,
  className,
  onAction,
}: TestModeQuickActionsProps) {
  const threadRuntime = useThreadRuntime()

  const sendMessage = useCallback(
    (message: string, action: QuickAction) => {
      onAction?.(action)
      threadRuntime.composer.setText(message)
      threadRuntime.composer.send()
    },
    [threadRuntime, onAction],
  )

  const handleNext = useCallback(() => {
    sendMessage(
      'Next question please.',
      'next',
    )
  }, [sendMessage])

  const handleDifferentTopic = useCallback(() => {
    sendMessage(
      'Give me a question on a different topic.',
      'different-topic',
    )
  }, [sendMessage])

  const handleEasier = useCallback(() => {
    sendMessage(
      'Make it easier. Give me an easier question.',
      'easier',
    )
  }, [sendMessage])

  const handleHarder = useCallback(() => {
    sendMessage(
      'Make it harder. Give me a more challenging question.',
      'harder',
    )
  }, [sendMessage])

  const handleEndTest = useCallback(() => {
    sendMessage(
      'End the test and show me my results.',
      'end-test',
    )
  }, [sendMessage])

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {/* Primary: Next Question */}
      <Button onClick={handleNext} size="sm" className="gap-1.5">
        <ArrowRight className="size-4" />
        Next Question
      </Button>

      {/* Secondary: Different Topic */}
      <Button
        onClick={handleDifferentTopic}
        variant="outline"
        size="sm"
        className="gap-1.5"
      >
        <RefreshCw className="size-4" />
        Different Topic
      </Button>

      {/* Difficulty Dropdown */}
      {showDifficultyOptions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              Difficulty
              <ChevronDown className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleEasier}>
              Make Easier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleHarder}>
              Make Harder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* End Test (less prominent) */}
      <Button
        onClick={handleEndTest}
        variant="ghost"
        size="sm"
        className="text-muted-foreground hover:text-destructive ml-auto gap-1.5"
      >
        <Square className="size-3" />
        End Test
      </Button>
    </div>
  )
}

/**
 * Inline version of quick actions for embedding in chat messages
 * More compact, meant to be shown directly in the message flow
 */
export function TestModeQuickActionsInline({
  onAction,
}: {
  onAction?: (action: QuickAction) => void
}) {
  const threadRuntime = useThreadRuntime()

  const sendMessage = useCallback(
    (message: string, action: QuickAction) => {
      onAction?.(action)
      threadRuntime.composer.setText(message)
      threadRuntime.composer.send()
    },
    [threadRuntime, onAction],
  )

  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/50">
      <Button
        size="sm"
        variant="secondary"
        className="h-7 text-xs"
        onClick={() => sendMessage('Next question please.', 'next')}
      >
        Next →
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() =>
          sendMessage('Give me a question on a different topic.', 'different-topic')
        }
      >
        Different Topic
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => sendMessage('Make it easier.', 'easier')}
      >
        Easier
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        onClick={() => sendMessage('Make it harder.', 'harder')}
      >
        Harder
      </Button>
    </div>
  )
}
