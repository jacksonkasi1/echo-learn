'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

/* -----------------------------------------------------------------------------
 * Conversation Container
 * -------------------------------------------------------------------------- */

interface ConversationProps extends React.ComponentProps<typeof StickToBottom> {
  className?: string
  children: React.ReactNode
}

function Conversation({ className, children, ...props }: ConversationProps) {
  return (
    <StickToBottom
      className={cn('relative flex h-full flex-col', className)}
      resize="smooth"
      initial="smooth"
      {...props}
    >
      {children}
    </StickToBottom>
  )
}

/* -----------------------------------------------------------------------------
 * Conversation Content
 * -------------------------------------------------------------------------- */

interface ConversationContentProps extends React.ComponentProps<
  typeof StickToBottom.Content
> {
  className?: string
}

function ConversationContent({
  className,
  children,
  ...props
}: ConversationContentProps) {
  return (
    <StickToBottom.Content
      className={cn(
        'flex flex-1 flex-col gap-4 overflow-y-auto p-4',
        className,
      )}
      {...props}
    >
      {children}
    </StickToBottom.Content>
  )
}

/* -----------------------------------------------------------------------------
 * Conversation Empty State
 * -------------------------------------------------------------------------- */

interface ConversationEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string
  description?: string
  icon?: React.ReactNode
}

function ConversationEmptyState({
  title = 'No messages yet',
  description,
  icon,
  className,
  children,
  ...props
}: ConversationEmptyStateProps) {
  if (children) {
    return (
      <div
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-4 text-center',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex flex-1 flex-col items-center justify-center gap-4 text-center',
        className,
      )}
      {...props}
    >
      {icon && <div className="text-muted-foreground">{icon}</div>}
      {title && (
        <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      )}
      {description && (
        <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
    </div>
  )
}

/* -----------------------------------------------------------------------------
 * Conversation Scroll Button
 * -------------------------------------------------------------------------- */

interface ConversationScrollButtonProps extends React.ComponentProps<
  typeof Button
> {
  className?: string
}

function ConversationScrollButton({
  className,
  ...props
}: ConversationScrollButtonProps) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext()

  if (isAtBottom) {
    return null
  }

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
      <Button
        variant="outline"
        size="sm"
        className={cn(
          'rounded-full shadow-lg bg-background/80 backdrop-blur-sm',
          className,
        )}
        onClick={() => scrollToBottom()}
        {...props}
      >
        <ChevronDown className="h-4 w-4 mr-1" />
        Scroll to bottom
      </Button>
    </div>
  )
}

/* -----------------------------------------------------------------------------
 * Message Components
 * -------------------------------------------------------------------------- */

interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from: 'user' | 'assistant'
}

function Message({ from, className, children, ...props }: MessageProps) {
  return (
    <div
      className={cn(
        'flex gap-3',
        from === 'user' ? 'flex-row-reverse' : 'flex-row',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: 'user' | 'assistant'
}

function MessageContent({
  from,
  className,
  children,
  ...props
}: MessageContentProps) {
  return (
    <div
      className={cn(
        'min-w-0 max-w-[80%] rounded-2xl px-4 py-3',
        from === 'user' ? 'ml-12' : 'bg-muted mr-12',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}

interface MessageAvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  name?: string
  fallback?: React.ReactNode
}

function MessageAvatar({
  src,
  name,
  fallback,
  className,
  ...props
}: MessageAvatarProps) {
  return (
    <div
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted overflow-hidden ring-1 ring-border',
        className,
      )}
      {...props}
    >
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className="h-full w-full object-cover"
        />
      ) : fallback ? (
        fallback
      ) : (
        <span className="text-xs font-medium text-muted-foreground">
          {name?.charAt(0).toUpperCase() || '?'}
        </span>
      )}
    </div>
  )
}

/* -----------------------------------------------------------------------------
 * Exports
 * -------------------------------------------------------------------------- */

export {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
  Message,
  MessageContent,
  MessageAvatar,
}

export type {
  ConversationProps,
  ConversationContentProps,
  ConversationEmptyStateProps,
  ConversationScrollButtonProps,
  MessageProps,
  MessageContentProps,
  MessageAvatarProps,
}
