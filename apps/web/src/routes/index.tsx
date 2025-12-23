import { createFileRoute } from '@tanstack/react-router'
import { Database, FileText } from 'lucide-react'

import type { RagInfo } from '@/components/MyRuntimeProvider'
import { Thread } from '@/components/assistant-ui/thread'
import {
  MyRuntimeProvider,
  useRagInfoState,
} from '@/components/MyRuntimeProvider'
import { useLearningContext } from '@/components/learning/LearningContext'
import { LearningLayout } from '@/components/learning/LearningLayout'

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

function ChatContent({
  onRagInfo,
  ragInfo,
}: {
  onRagInfo: (info: RagInfo) => void
  ragInfo: RagInfo
}) {
  const { mode, runtimeKey } = useLearningContext()

  // Key prop on MyRuntimeProvider forces re-mount when switching to test mode
  // This clears the chat history and creates a fresh session
  return (
    <MyRuntimeProvider key={runtimeKey} onRagInfo={onRagInfo} mode={mode}>
      <div className="relative h-full">
        <Thread />
        <RagInfoDisplay ragInfo={ragInfo} />
      </div>
    </MyRuntimeProvider>
  )
}

function App() {
  const { ragInfo, handleRagInfo } = useRagInfoState()

  return (
    <LearningLayout>
      <ChatContent onRagInfo={handleRagInfo} ragInfo={ragInfo} />
    </LearningLayout>
  )
}
