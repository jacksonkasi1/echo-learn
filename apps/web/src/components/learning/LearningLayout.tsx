import { Link } from '@tanstack/react-router'
import { BookOpen, Brain, MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'

import { LearningProvider } from './LearningContext'
import { ModeToggle } from '@/components/mode-toggle'
import { Button } from '@/components/ui/button'

interface LearningLayoutProps {
  children: ReactNode
}

function LearningLayoutContent({ children }: LearningLayoutProps) {
  return (
    <div className="relative flex h-screen w-full flex-col overflow-hidden bg-background text-foreground">
      <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
        <Link to="/" title="Chat">
          <Button variant="ghost" size="icon">
            <MessageSquare className="size-5" />
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
