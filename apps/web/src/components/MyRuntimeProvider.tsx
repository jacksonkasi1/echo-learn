// Chat runtime provider using assistant-ui LocalRuntime and our backend API
import { useCallback, useMemo, useState } from 'react'
import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
  useLocalRuntime,
} from '@assistant-ui/react'
import type { ReactNode } from 'react'

import type { ChatModelAdapter } from '@assistant-ui/react'

import type { ChatMessage } from '@/api/chat'
import { streamChatCompletion } from '@/api/chat'
import { useUserId } from '@/lib/user-context'

// RAG info state that can be displayed in the UI
export interface RagInfo {
  chunks: number
  sources: number
  lastUpdated: Date | null
}

// Create an adapter that connects assistant-ui to our backend API
function createModelAdapter(
  userId: string,
  onRagInfo?: (info: RagInfo) => void,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      // Convert assistant-ui messages to our API format
      // We filter out non-text content for now since our API expects simple content
      const apiMessages: Array<ChatMessage> = messages.map((m) => {
        const textContent = m.content
          .filter((c) => c.type === 'text')
          .map((c) => c.text)
          .join('\n')

        return {
          role: m.role,
          content: textContent,
        }
      })

      try {
        // Use our API client to stream the response with userId for RAG
        const stream = streamChatCompletion(
          {
            messages: apiMessages,
            userId,
            useRag: true,
            ragTopK: 5,
            ragMinScore: 0.01,
          },
          {
            onRagInfo: (info) => {
              onRagInfo?.({
                chunks: info.chunks,
                sources: info.sources,
                lastUpdated: new Date(),
              })
            },
          },
        )

        let text = ''

        for await (const chunk of stream) {
          // Check for abort signal on each iteration
          if (abortSignal.aborted) {
            break
          }

          text += chunk

          // Yield the current state of the response
          yield {
            content: [{ type: 'text', text }],
          }
        }
      } catch (error) {
        if (abortSignal.aborted) return
        console.error('Chat error:', error)
        throw error
      }
    },
  }
}

// Create a speech synthesis adapter for text-to-speech
const speechAdapter = new WebSpeechSynthesisAdapter()

interface MyRuntimeProviderProps {
  children: ReactNode
  onRagInfo?: (info: RagInfo) => void
}

export function MyRuntimeProvider({
  children,
  onRagInfo,
}: Readonly<MyRuntimeProviderProps>) {
  // Get userId from context for RAG-enabled chat
  const userId = useUserId()

  // Create adapter with current userId
  const adapter = useMemo(
    () => createModelAdapter(userId, onRagInfo),
    [userId, onRagInfo],
  )

  // Use useLocalRuntime which manages state automatically
  // and connects to our backend via the adapter
  const runtime = useLocalRuntime(adapter, {
    adapters: {
      speech: speechAdapter,
    },
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  )
}

// Hook to use RAG info in components
export function useRagInfoState() {
  const [ragInfo, setRagInfo] = useState<RagInfo>({
    chunks: 0,
    sources: 0,
    lastUpdated: null,
  })

  const handleRagInfo = useCallback((info: RagInfo) => {
    setRagInfo(info)
  }, [])

  return { ragInfo, handleRagInfo }
}
