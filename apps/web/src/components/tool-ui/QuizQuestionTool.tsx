'use client'

import { useState } from 'react'
import { makeAssistantToolUI, useThreadRuntime } from '@assistant-ui/react'
import {
  
  QuizQuestion,
  isQuizQuestionArgsComplete
} from '@repo/tool-ui'
import type {OptionListSelection} from '@repo/tool-ui';

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
      const message = `My answer to "${args.questionText}": ${selectedLabels}. Please evaluate if this is correct and then present the next question.`
      threadRuntime.composer.setText(message)
      threadRuntime.composer.send()
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
    )
  },
})

export default QuizQuestionTool
