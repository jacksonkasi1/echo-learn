import {
  ActionBarPrimitive,
  AssistantIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from '@assistant-ui/react'
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardList,
  CopyIcon,
  GraduationCap,
  MessageSquare,
  PencilIcon,
  RefreshCwIcon,
  Square,
  Volume2Icon,
  VolumeXIcon,
} from 'lucide-react'
import type { FC } from 'react'

import { FollowUpSuggestions } from '@/components/assistant-ui/followup-suggestions'

import { MarkdownText } from '@/components/assistant-ui/markdown-text'
import { ToolFallback } from '@/components/assistant-ui/tool-fallback'
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button'
import type { ChatMode } from '@/components/learning/LearningContext'
import { useLearningContext } from '@/components/learning/LearningContext'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

import { cn } from '@/lib/utils'

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container relative flex h-full flex-col bg-background"
      style={{
        ['--thread-max-width' as string]: '44rem',
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4"
      >
        <AssistantIf condition={({ thread }) => thread.isEmpty}>
          <ThreadWelcome />
        </AssistantIf>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            EditComposer,
            AssistantMessage,
          }}
        />
      </ThreadPrimitive.Viewport>

      <div className="relative mx-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 px-4 pb-4 md:pb-6">
        <ThreadScrollToBottom />
        <Composer />
      </div>
    </ThreadPrimitive.Root>
  )
}

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom -top-12 absolute z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  )
}

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-8">
          <div className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-2 animate-in font-semibold text-2xl duration-300 ease-out">
            Hello there!
          </div>
          <div className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-2 animate-in text-2xl text-muted-foreground/65 delay-100 duration-300 ease-out">
            How can I help you today?
          </div>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  )
}

const ThreadSuggestions: FC = () => {
  const { suggestions, suggestionsLoading, hasContent, mode } =
    useLearningContext()

  // Show loading skeleton
  if (suggestionsLoading) {
    return (
      <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
        {[...Array(4)].map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="h-20 animate-pulse rounded-3xl border bg-muted/30"
          />
        ))}
      </div>
    )
  }

  // If no content (new user), show upload prompt
  if (!hasContent && mode === 'learn') {
    return (
      <div className="aui-thread-welcome-suggestions flex w-full flex-col items-center gap-4 pb-4 text-center">
        <p className="text-muted-foreground">
          Upload study materials to get personalized learning suggestions
        </p>
      </div>
    )
  }

  // If we have dynamic suggestions, show them
  if (suggestions.length > 0) {
    return (
      <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
        {suggestions.map((suggestion, index) => (
          <div
            key={`suggested-action-${suggestion.conceptId || suggestion.title}-${index}`}
            className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-4 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-300 ease-out"
            style={{ animationDelay: `${index * 50}ms` }}
          >
            <ThreadPrimitive.Suggestion prompt={suggestion.text} send asChild>
              <Button
                variant="ghost"
                className="aui-thread-welcome-suggestion h-auto w-full flex-1 @md:flex-col flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm dark:hover:bg-accent/60"
                aria-label={suggestion.text}
              >
                <span className="aui-thread-welcome-suggestion-text-1 w-full font-medium line-clamp-1">
                  {suggestion.title}
                </span>
                <span className="aui-thread-welcome-suggestion-text-2 w-full text-muted-foreground line-clamp-2">
                  {suggestion.text}
                </span>
              </Button>
            </ThreadPrimitive.Suggestion>
          </div>
        ))}
      </div>
    )
  }

  // Fallback to default suggestions for non-learn modes or empty state
  const defaultSuggestions = [
    {
      title: "What's the weather",
      label: 'in San Francisco?',
      action: "What's the weather in San Francisco?",
    },
    {
      title: 'Explain React hooks',
      label: 'like useState and useEffect',
      action: 'Explain React hooks like useState and useEffect',
    },
    {
      title: 'Write a SQL query',
      label: 'to find top customers',
      action: 'Write a SQL query to find top customers',
    },
    {
      title: 'Create a meal plan',
      label: 'for healthy weight loss',
      action: 'Create a meal plan for healthy weight loss',
    },
  ]

  return (
    <div className="aui-thread-welcome-suggestions grid w-full @md:grid-cols-2 gap-2 pb-4">
      {defaultSuggestions.map((suggestedAction, index) => (
        <div
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-4 @md:nth-[n+3]:block nth-[n+3]:hidden animate-in fill-mode-both duration-300 ease-out"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <ThreadPrimitive.Suggestion
            prompt={suggestedAction.action}
            send
            asChild
          >
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion h-auto w-full flex-1 @md:flex-col flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm dark:hover:bg-accent/60"
              aria-label={suggestedAction.action}
            >
              <span className="aui-thread-welcome-suggestion-text-1 w-full font-medium line-clamp-1">
                {suggestedAction.title}
              </span>
              <span className="aui-thread-welcome-suggestion-text-2 w-full text-muted-foreground line-clamp-2">
                {suggestedAction.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </div>
      ))}
    </div>
  )
}

const Composer: FC = () => {
  const { mode } = useLearningContext()

  const placeholders = {
    learn: 'Ask a question to start learning...',
    chat: 'Ask anything (off the record)...',
    test: 'Ready for a quiz? Type "start test"...',
  }

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <div className="flex w-full flex-col rounded-3xl border border-input bg-background px-1 pt-2 shadow-xs outline-none transition-[color,box-shadow] has-[textarea:focus-visible]:border-ring has-[textarea:focus-visible]:ring-[3px] has-[textarea:focus-visible]:ring-ring/50 dark:bg-background">
        <ComposerPrimitive.Input
          placeholder={placeholders[mode]}
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus-visible:ring-0"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerToolbar />
      </div>
    </ComposerPrimitive.Root>
  )
}

const ComposerToolbar: FC = () => {
  return (
    <div className="flex items-center justify-between px-2 pb-2">
      <div className="flex items-center gap-1">
        <ComposerModeSelector />
      </div>
      <ComposerAction />
    </div>
  )
}

const ComposerModeSelector: FC = () => {
  const { mode, setMode } = useLearningContext()

  const MODES: Record<ChatMode, { label: string; icon: React.ReactNode }> = {
    learn: {
      label: 'Learn',
      icon: <GraduationCap className="size-4" />,
    },
    chat: {
      label: 'Chat',
      icon: <MessageSquare className="size-4" />,
    },
    test: {
      label: 'Test',
      icon: <ClipboardList className="size-4" />,
    },
  }

  const currentMode = MODES[mode]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-2 px-2 text-muted-foreground hover:text-foreground"
        >
          {currentMode.icon}
          <span className="text-xs font-medium">{currentMode.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {(Object.keys(MODES) as Array<ChatMode>).map((key) => (
          <DropdownMenuItem
            key={key}
            onClick={() => setMode(key)}
            className="gap-2"
          >
            {MODES[key].icon}
            <span>{MODES[key].label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper flex items-center justify-end">
      <AssistantIf condition={({ thread }) => !thread.isRunning}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="top"
            type="submit"
            variant="default"
            size="icon"
            className="aui-composer-send size-8.5 rounded-full p-1"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </AssistantIf>

      <AssistantIf condition={({ thread }) => thread.isRunning}>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-8.5 rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
            aria-label="Stop generating"
          >
            <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </AssistantIf>
    </div>
  )
}

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  )
}

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-assistant-message-root fade-in slide-in-from-bottom-1 relative mx-auto w-full max-w-(--thread-max-width) animate-in py-4 duration-150 ease-out"
      data-role="assistant"
    >
      <div className="aui-assistant-message-content wrap-break-word mx-2 text-foreground leading-7">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
            tools: { Fallback: ToolFallback },
          }}
        />
        <MessageError />
      </div>

      <div className="aui-assistant-message-footer mt-2 ml-2 flex">
        <BranchPicker />
        <AssistantActionBar />
      </div>

      {/* Follow-up suggestions - only shown on last message when not running */}
      <AssistantIf condition={({ thread }) => !thread.isRunning}>
        <div className="mx-2">
          <FollowUpSuggestions />
        </div>
      </AssistantIf>
    </MessagePrimitive.Root>
  )
}

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root -ml-1 col-start-3 row-start-2 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AssistantIf condition={({ message }) => message.isCopied}>
            <CheckIcon />
          </AssistantIf>
          <AssistantIf condition={({ message }) => !message.isCopied}>
            <CopyIcon />
          </AssistantIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarPrimitive.Speak asChild>
        <TooltipIconButton tooltip="Read aloud">
          <Volume2Icon />
        </TooltipIconButton>
      </ActionBarPrimitive.Speak>
      <ActionBarPrimitive.StopSpeaking asChild>
        <TooltipIconButton tooltip="Stop reading">
          <VolumeXIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.StopSpeaking>
    </ActionBarPrimitive.Root>
  )
}

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto grid w-full max-w-(--thread-max-width) animate-in auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-4 duration-150 ease-out [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word rounded-3xl bg-muted px-5 py-2.5 text-foreground">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper -translate-x-full -translate-y-1/2 absolute top-1/2 left-0 pr-2">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker className="aui-user-branch-picker -mr-1 col-span-full col-start-1 row-start-3 justify-end" />
    </MessagePrimitive.Root>
  )
}

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  )
}

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 px-2">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input flex min-h-15 w-full resize-none bg-transparent p-4 text-foreground outline-none"
          autoFocus
        />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  )
}

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        'aui-branch-picker-root -ml-2 mr-2 inline-flex items-center text-muted-foreground text-xs',
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  )
}
