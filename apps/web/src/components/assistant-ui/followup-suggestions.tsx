import { ThreadPrimitive } from '@assistant-ui/react'
import { Plus } from 'lucide-react'
import type { FC } from 'react'

import { useLearningContext } from '@/components/learning/LearningContext'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

/**
 * FollowUpSuggestions component
 *
 * Displays minimal list-style follow-up suggestions after an assistant message.
 * Simple text with + icon on the right, separated by dividers.
 */
export const FollowUpSuggestions: FC<{ className?: string }> = ({
  className,
}) => {
  const { suggestions, suggestionsLoading } = useLearningContext()

  // Show skeleton while loading
  if (suggestionsLoading) {
    return (
      <div className={cn('mt-4 space-y-2', className)}>
        {[...Array(3)].map((_, index) => (
          <div key={`skeleton-${index}`}>
            <div className="flex items-center justify-between py-2">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-4 w-4 animate-pulse rounded-full bg-muted" />
            </div>
            {index < 2 && <Separator className="opacity-50" />}
          </div>
        ))}
      </div>
    )
  }

  // Don't show if no suggestions
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn('mt-4 space-y-0', className)}>
      {suggestions.map((suggestion, index) => (
        <div
          key={`followup-${suggestion.conceptId || suggestion.title}-${index}`}
        >
          <ThreadPrimitive.Suggestion prompt={suggestion.text} send asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between rounded-none px-2 py-3 text-left font-normal hover:bg-muted/50"
              aria-label={suggestion.text}
            >
              <span className="text-sm text-foreground">{suggestion.text}</span>
              <Plus className="ml-4 size-4 shrink-0 text-muted-foreground" />
            </Button>
          </ThreadPrimitive.Suggestion>
          {index < suggestions.length - 1 && (
            <Separator className="opacity-30" />
          )}
        </div>
      ))}
    </div>
  )
}

/**
 * Compact version for inline display
 */
export const FollowUpSuggestionsCompact: FC<{ className?: string }> = ({
  className,
}) => {
  const { suggestions } = useLearningContext()

  // Don't show if no suggestions
  if (suggestions.length === 0) {
    return null
  }

  return (
    <div className={cn('mt-3 space-y-0', className)}>
      {suggestions.slice(0, 3).map((suggestion, index) => (
        <div
          key={`followup-compact-${suggestion.conceptId || suggestion.title}-${index}`}
        >
          <ThreadPrimitive.Suggestion prompt={suggestion.text} send asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-between rounded-none px-1 py-2 text-left text-xs font-normal hover:bg-muted/50"
              aria-label={suggestion.text}
            >
              <span className="text-muted-foreground">{suggestion.title}</span>
              <Plus className="ml-3 size-3 shrink-0 text-muted-foreground" />
            </Button>
          </ThreadPrimitive.Suggestion>
          {index < suggestions.slice(0, 3).length - 1 && (
            <Separator className="opacity-20" />
          )}
        </div>
      ))}
    </div>
  )
}
