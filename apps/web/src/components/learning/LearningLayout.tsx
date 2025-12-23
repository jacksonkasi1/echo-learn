import { Link } from '@tanstack/react-router'
import {
  AudioLines,
  BookOpen,
  Brain,
  MessageSquare,
  Trash2,
} from 'lucide-react'
import { LearningProvider, useLearningContext } from './LearningContext'
import type { ReactNode } from 'react'

import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

interface LearningLayoutProps {
  children: ReactNode
}

function LearningLayoutContent({ children }: LearningLayoutProps) {
  const { clearConversation } = useLearningContext()

  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearConversation}
                title="Clear conversation"
              >
                <Trash2 className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Clear conversation</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Link to="/" title="Chat">
          <Button variant="ghost" size="icon">
            <MessageSquare className="size-5" />
          </Button>
        </Link>
        <Link to="/voice" title="Voice Mode">
          <Button variant="ghost" size="icon">
            <AudioLines className="size-5" />
          </Button>
        </Link>
        <Link to="/dashboard" title="Dashboard">
          <Button variant="ghost" size="icon">
            <Brain className="size-5" />
          </Button>
        </Link>
        <Link to="/knowledge" title="Knowledge">
          <Button variant="ghost" size="icon">
            <BookOpen className="size-5" />
          </Button>
        </Link>
        <ModeToggle />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Main Content (Chat) */}
        <main className="relative flex flex-1 flex-col min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}

export function LearningLayout({ children }: LearningLayoutProps) {
  return (
    <LearningProvider>
      <LearningLayoutContent>{children}</LearningLayoutContent>
    </LearningProvider>
  )
}
