'use client'

import { useState } from 'react'
import { makeAssistantToolUI, useThreadRuntime } from '@assistant-ui/react'
import { ArrowRight, ChevronDown, RefreshCw, Square } from 'lucide-react'
import { QuizQuestion, isQuizQuestionArgsComplete } from '@repo/tool-ui'
import type { OptionListSelection } from '@repo/tool-ui'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * Quick Action Buttons for after answering a question
 * These send messages to the LLM to trigger the next action
 */
function QuickActionButtons({
  onSendMessage,
}: {
  onSendMessage: (message: string) => void
}) {
  const sendMessage = (message: string) => {
    onSendMessage(message)
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-border/50">
      {/* Primary: Next Question */}
      <Button
        onClick={() => sendMessage('Next question please.')}
        size="sm"
        className="gap-1.5"
      >
        <ArrowRight className="size-4" />
        Next Question
      </Button>

      {/* Secondary: Different Topic */}
      <Button
        onClick={() => sendMessage('Give me a question on a different topic.')}
        variant="outline"
        size="sm"
        className="gap-1.5"
      >
        <RefreshCw className="size-4" />
        Different Topic
      </Button>

      {/* Difficulty Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1">
            Difficulty
            <ChevronDown className="size-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem
            onClick={() =>
              sendMessage('Make it easier. Give me an easier question.')
            }
          >
            Make Easier
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              sendMessage(
                'Make it harder. Give me a more challenging question.',
              )
            }
          >
            Make Harder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* End Test (less prominent) */}
      <Button
        onClick={() => sendMessage('End the test and show me my results.')}
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
 * Quiz Question Tool UI Registration
 *
 * This connects the backend `present_quiz_question` tool to the frontend
 * QuizQuestion component from @repo/tool-ui.
 *
 * Flow:
 * 1. LLM calls `present_quiz_question` with question data
 * 2. This component renders the interactive OptionList
 * 3. User selects an answer and clicks Submit
 * 4. Local state updates to show receipt, addResult() sends to runtime
 * 5. Composer sends user message to trigger AI evaluation
 * 6. Quick action buttons appear for next steps
 */
export const QuizQuestionTool = makeAssistantToolUI<
  {
    id?: string
    title?: string
    questionText?: string
    conceptId?: string
    conceptLabel?: string
    difficulty?: 'easy' | 'medium' | 'hard'
    options?: Array<{
      id: string
      label: string
      description?: string
    }>
    _meta?: {
      questionId: string
      correctOptionId: string
    }
  },
  OptionListSelection
>({
  toolName: 'present_quiz_question',
  render: function QuizQuestionToolRender({ args, result, addResult }) {
    const threadRuntime = useThreadRuntime()

    // Use local state to track submission since runtime doesn't trigger re-render
    const [localResult, setLocalResult] = useState<
      OptionListSelection | undefined
    >(result)

    // Track whether quick actions should be shown (after first evaluation)
    const [showQuickActions, setShowQuickActions] = useState(false)

    // Wait for args to be complete (streaming may send partial data)
    if (!isQuizQuestionArgsComplete(args)) {
      return (
        <div className="w-full max-w-md animate-pulse rounded-2xl border bg-card p-4">
          <div className="mb-3 h-5 w-3/4 rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
            <div className="h-12 rounded-lg bg-muted" />
          </div>
        </div>
      )
    }

    // Handle submit - update local state, send to runtime, and trigger AI response
    const handleSubmit = (selection: OptionListSelection) => {
      setLocalResult(selection)
      addResult(selection)

      // Send user message to trigger AI evaluation
      // Include the question context and selected answer for clear evaluation
      const selectedLabels = selection.selectedLabels.join(', ')
      const message = `My answer to "${args.questionText}": ${selectedLabels}. Please evaluate if this is correct.`
      threadRuntime.composer.setText(message)
      threadRuntime.composer.send()

      // Show quick actions after a short delay (after AI responds)
      setTimeout(() => {
        setShowQuickActions(true)
      }, 500)
    }

    // Handle skip action
    const handleResponseAction = (actionId: string) => {
      if (actionId === 'skip') {
        const skipResult = { selectedIds: [], selectedLabels: [] }
        setLocalResult(skipResult)
        addResult(skipResult)

        // Send skip message to trigger AI response
        threadRuntime.composer.setText(
          `I skipped the question "${args.questionText}". Please present the next question.`,
        )
        threadRuntime.composer.send()
      }
    }

    // Use local result for UI, fall back to runtime result
    const displayResult = localResult ?? result

    return (
      <div className="w-full max-w-md">
        <QuizQuestion
          id={args.id}
          questionText={args.questionText}
          title={args.title}
          conceptLabel={args.conceptLabel}
          difficulty={args.difficulty}
          options={args.options}
          result={displayResult}
          onSubmit={handleSubmit}
          onResponseAction={handleResponseAction}
          responseActions={[
            { id: 'skip', label: 'Skip', variant: 'ghost' },
            { id: 'confirm', label: 'Submit Answer', variant: 'default' },
          ]}
        />

        {/* Show quick actions after answer is submitted */}
        {displayResult &&
          displayResult.selectedIds.length > 0 &&
          showQuickActions && (
            <QuickActionButtons
              onSendMessage={(message) => {
                threadRuntime.composer.setText(message)
                threadRuntime.composer.send()
              }}
            />
          )}
      </div>
    )
  },
})

export default QuizQuestionTool
