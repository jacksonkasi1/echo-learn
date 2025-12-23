import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  ChevronDown,
  Lightbulb,
  RefreshCw,
  XCircle,
} from 'lucide-react'

import type { AnswerFeedback as AnswerFeedbackType } from './TestModeContext'
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

interface AnswerFeedbackProps {
  feedback: AnswerFeedbackType
  onAction: (action: QuickAction) => void
  showDifficultyOptions?: boolean
}

const evaluationConfig = {
  correct: {
    icon: CheckCircle,
    title: 'Correct!',
    bgColor: 'bg-green-50 dark:bg-green-950/30',
    borderColor: 'border-green-200 dark:border-green-800',
    iconColor: 'text-green-500',
  },
  partial: {
    icon: AlertCircle,
    title: 'Partially Correct',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-500',
  },
  incorrect: {
    icon: XCircle,
    title: 'Not Quite',
    bgColor: 'bg-red-50 dark:bg-red-950/30',
    borderColor: 'border-red-200 dark:border-red-800',
    iconColor: 'text-red-500',
  },
}

export function AnswerFeedback({
  feedback,
  onAction,
  showDifficultyOptions = true,
}: AnswerFeedbackProps) {
  const config = evaluationConfig[feedback.evaluation]
  const Icon = config.icon

  return (
    <div
      className={cn(
        'rounded-xl border p-5 space-y-4',
        config.bgColor,
        config.borderColor,
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <Icon className={cn('size-7', config.iconColor)} />
        <h3 className="text-lg font-semibold">{config.title}</h3>
      </div>

      {/* Feedback */}
      <p className="text-sm text-muted-foreground leading-relaxed">
        {feedback.feedback}
      </p>

      {/* Correct Approach (if not correct) */}
      {feedback.correctApproach && (
        <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg">
          <Lightbulb className="size-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
              Better Approach
            </p>
            <p className="text-sm">{feedback.correctApproach}</p>
          </div>
        </div>
      )}

      {/* Concept Badge */}
      <div className="pt-3 border-t border-border/50">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concept Tested:
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {feedback.conceptEvaluated}
          </span>
        </div>
        {feedback.conceptSummary && (
          <p className="text-xs text-muted-foreground mt-1.5">
            {feedback.conceptSummary}
          </p>
        )}
      </div>

      {/* Quick Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-2">
        {/* Primary: Next Question */}
        <Button onClick={() => onAction('next')} size="sm" className="gap-1.5">
          <ArrowRight className="size-4" />
          Next Question
        </Button>

        {/* Secondary: Different Topic */}
        <Button
          onClick={() => onAction('different-topic')}
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
              <DropdownMenuItem onClick={() => onAction('easier')}>
                Make Easier
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onAction('harder')}>
                Make Harder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* End Test (less prominent) */}
        <Button
          onClick={() => onAction('end-test')}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-destructive ml-auto"
        >
          End Test
        </Button>
      </div>
    </div>
  )
}
