'use client'

import { makeAssistantToolUI } from '@assistant-ui/react'
import {
  TestProgress,
  isTestProgressArgsComplete,
  type TestProgressToolArgs,
} from '@repo/tool-ui'

/**
 * Test Progress Tool UI Registration
 *
 * This connects the backend test progress display to the frontend
 * TestProgress component from @repo/tool-ui.
 *
 * Flow:
 * 1. LLM calls a tool to show test progress (or it's auto-rendered)
 * 2. This component renders the Plan-based progress UI
 * 3. User can see their progress through the test session
 * 4. Optional actions allow continuing or ending the test
 */
export const TestProgressTool = makeAssistantToolUI<TestProgressToolArgs, void>(
  {
    toolName: 'show_test_progress',
    render: ({ args }) => {
      // Wait for args to be complete (streaming may send partial data)
      if (!isTestProgressArgsComplete(args)) {
        return (
          <div className="w-full max-w-md animate-pulse rounded-2xl border bg-card p-4">
            <div className="mb-3 h-5 w-1/2 rounded bg-muted" />
            <div className="mb-4 h-2 w-full rounded-full bg-muted" />
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="size-5 rounded-full bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
              </div>
              <div className="flex items-center gap-3">
                <div className="size-5 rounded-full bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
              </div>
              <div className="flex items-center gap-3">
                <div className="size-5 rounded-full bg-muted" />
                <div className="h-4 flex-1 rounded bg-muted" />
              </div>
            </div>
          </div>
        )
      }

      return (
        <TestProgress
          id={args.id}
          sessionId={args.sessionId}
          title={args.title ?? 'Test Progress'}
          description={args.description}
          currentIndex={args.currentIndex}
          totalQuestions={args.totalQuestions}
          score={args.score}
          correctCount={args.correctCount}
          incorrectCount={args.incorrectCount}
          questions={args.questions}
          showActions={false}
        />
      )
    },
  },
)

export default TestProgressTool
