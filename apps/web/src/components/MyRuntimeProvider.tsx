// Chat runtime provider using assistant-ui LocalRuntime and our backend API
import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
  useLocalRuntime,
} from '@assistant-ui/react'
import type { ChatModelAdapter } from '@assistant-ui/react'
import type { ReactNode } from 'react'

import type { ChatMessage } from '@/api/chat'
import { streamChatCompletion } from '@/api/chat'

// Create an adapter that connects assistant-ui to our backend API
const MyModelAdapter: ChatModelAdapter = {
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
      // Use our API client to stream the response
      const stream = streamChatCompletion({
        messages: apiMessages,
      })

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

// Create a speech synthesis adapter for text-to-speech
const speechAdapter = new WebSpeechSynthesisAdapter()

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  // Use useLocalRuntime which manages state automatically
  // and connects to our backend via the adapter
  const runtime = useLocalRuntime(MyModelAdapter, {
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
