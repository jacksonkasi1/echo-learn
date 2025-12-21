import { ThreadPrimitive } from '@assistant-ui/react'
import { Lightbulb, MessageSquare, ClipboardList } from 'lucide-react'
import type { FC } from 'react'

import { useLearningContext } from '@/components/learning/LearningContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Mode-specific icons and labels
 */
const MODE_CONFIG = {
  learn: {
    icon: Lightbulb,
    label: 'Continue exploring',
  },
  chat: {
    icon: MessageSquare,
    label: 'You might also ask',
  },
  test: {
    icon: ClipboardList,
    label: 'Try these next',
  },
}

/**
 * FollowUpSuggestions component
 *
 * Displays Perplexity-style follow-up suggestions after an assistant message.
 * Suggestions are fetched from the backend using smart LLM-powered generation
 * based on the response content, discussed concepts, and user's knowledge base.
 *
 * Works in all modes: learn, chat, test
 *
 * Usage: Place this component inside AssistantMessage component after the message content.
 */
export const FollowUpSuggestions: FC<{ className?: string }> = ({
  className,
}) => {
  const { suggestions, suggestionsLoading, mode } = useLearningContext()

  const config = MODE_CONFIG[mode]
  const Icon = config.icon

  // Don't show if loading or no suggestions
  if (suggestionsLoading || suggestions.length === 0) {
    return null
  }

  return (
    <div
      className={cn(
        'aui-followup-suggestions mt-4 rounded-xl border border-border/50 bg-muted/30 p-4',
        className,
      )}
    >
      <div className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
        <Icon className="size-4" />
        <span>{config.label}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {suggestions.map((suggestion, index) => (
          <ThreadPrimitive.Suggestion
            key={`followup-${suggestion.conceptId || suggestion.title}-${index}`}
            prompt={suggestion.text}
            send
            asChild
          >
            <Button
              variant="outline"
              size="sm"
              className="h-auto whitespace-normal rounded-full px-4 py-2 text-left text-sm hover:bg-accent/60"
              aria-label={suggestion.text}
            >
              {suggestion.title}
            </Button>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  )
}

/**
 * Compact version for inline display
 * Works in all modes
 */
export const FollowUpSuggestionsCompact: FC<{ className?: string }> = ({
  className,
}) => {
  const { suggestions, suggestionsLoading } = useLearningContext()

  // Don't show if loading or no suggestions
  if (suggestionsLoading || suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn('aui-followup-suggestions-compact mt-3', className)}>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.slice(0, 3).map((suggestion, index) => (
          <ThreadPrimitive.Suggestion
            key={`followup-compact-${suggestion.conceptId || suggestion.title}-${index}`}
            prompt={suggestion.text}
            send
            asChild
          >
            <Button
              variant="ghost"
              size="sm"
              className="h-auto rounded-full border border-border/50 bg-background/50 px-3 py-1.5 text-xs hover:bg-accent/60"
              aria-label={suggestion.text}
            >
              {suggestion.title}
            </Button>
          </ThreadPrimitive.Suggestion>
        ))}
      </div>
    </div>
  )
}
