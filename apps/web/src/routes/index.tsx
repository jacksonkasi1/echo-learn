import { createFileRoute } from '@tanstack/react-router'
import { BookOpen, Database, FileText } from 'lucide-react'

import type { RagInfo } from '@/components/MyRuntimeProvider'
import { Thread } from '@/components/assistant-ui/thread'
import {
  MyRuntimeProvider,
  useRagInfoState,
} from '@/components/MyRuntimeProvider'
import { useUserId } from '@/lib/user-context'

export const Route = createFileRoute('/')({ component: App })

// RAG info display component
function RagInfoDisplay({ ragInfo }: { ragInfo: RagInfo }) {
  if (!ragInfo.lastUpdated) {
    return null
  }

  return (
    <div className="absolute bottom-24 left-4 z-10 flex items-center gap-3 rounded-lg border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-1.5" title="Knowledge chunks used">
        <Database className="size-3.5" />
        <span>{ragInfo.chunks} chunks</span>
      </div>
      <div className="h-3 w-px bg-border" />
      <div
        className="flex items-center gap-1.5"
        title="Source files referenced"
      >
        <FileText className="size-3.5" />
        <span>{ragInfo.sources} sources</span>
      </div>
    </div>
  )
}

// User info display component
function UserInfoDisplay({ userId }: { userId: string }) {
  return (
    <div className="absolute bottom-24 right-4 z-10 flex items-center gap-2 rounded-lg border bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
      <BookOpen className="size-3.5" />
      <span className="max-w-32 truncate" title={userId}>
        {userId.replace('user_', '').slice(0, 12)}...
      </span>
    </div>
  )
}

function ChatContent({
  onRagInfo,
  ragInfo,
}: {
  onRagInfo: (info: RagInfo) => void
  ragInfo: RagInfo
}) {
  const userId = useUserId()

  return (
    <MyRuntimeProvider onRagInfo={onRagInfo}>
      <main className="relative h-dvh">
        <Thread />
        <RagInfoDisplay ragInfo={ragInfo} />
        <UserInfoDisplay userId={userId} />
      </main>
    </MyRuntimeProvider>
  )
}

function App() {
  const { ragInfo, handleRagInfo } = useRagInfoState()

  return <ChatContent onRagInfo={handleRagInfo} ragInfo={ragInfo} />
}
