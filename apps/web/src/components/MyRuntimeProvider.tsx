// Chat runtime provider using assistant-ui LocalRuntime and our backend API
import {
  AssistantRuntimeProvider,
  WebSpeechSynthesisAdapter,
  useLocalRuntime,
} from '@assistant-ui/react'
import { useCallback, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

import type { ChatModelAdapter } from '@assistant-ui/react'

import type { ChatMessage } from '@/api/chat'
import { streamChatCompletion } from '@/api/chat'
import { useLearningContext } from '@/components/learning/LearningContext'
import { useUserId } from '@/lib/user-context'

// Import Tool UI components for test mode
import { QuizQuestionTool, TestProgressTool } from '@/components/tool-ui'

// RAG info state that can be displayed in the UI
export interface RagInfo {
  chunks: number
  sources: number
  lastUpdated: Date | null
}

// Tool UI marker constants - must match backend
const TOOL_UI_MARKER_START = '<!--TOOL_UI_START:'
const TOOL_UI_MARKER_END = ':TOOL_UI_END-->'

/**
 * Parse Tool UI markers from text and extract tool calls
 * Returns the clean text (without markers) and any tool calls found
 */
function parseToolUIMarkers(text: string): {
  cleanText: string
  toolCalls: Array<{
    toolName: string
    toolCallId: string
    args: Record<string, unknown>
  }>
} {
  const toolCalls: Array<{
    toolName: string
    toolCallId: string
    args: Record<string, unknown>
  }> = []

  let cleanText = text

  // Find all Tool UI markers
  // Use a regex that captures content between markers non-greedily
  // Escape special characters in markers for regex safety
  const startEscaped = TOOL_UI_MARKER_START.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&',
  )
  const endEscaped = TOOL_UI_MARKER_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  const markerRegex = new RegExp(`${startEscaped}(.+?)${endEscaped}`, 'gs')

  let match
  while ((match = markerRegex.exec(text)) !== null) {
    try {
      const markerData = JSON.parse(match[1])
      toolCalls.push({
        toolName: markerData.toolName,
        toolCallId: markerData.toolCallId,
        args: markerData.args,
      })
    } catch (e) {
      console.error('Failed to parse Tool UI marker:', e)
    }
  }

  // Remove all markers from the text
  cleanText = text.replace(markerRegex, '').replace(/\n\n+/g, '\n\n').trim()

  return { cleanText, toolCalls }
}

// Create an adapter that connects assistant-ui to our backend API
function createModelAdapter(
  userId: string,
  mode: 'learn' | 'chat' | 'test',
  onRagInfo?: (info: RagInfo) => void,
  onResponseComplete?: (assistantResponse: string, userMessage: string) => void,
): ChatModelAdapter {
  return {
    async *run({ messages, abortSignal }) {
      // Convert assistant-ui messages to our API format
      // Handle text, tool calls, and tool results
      const apiMessages: Array<ChatMessage> = messages.flatMap((m) => {
        const result: Array<ChatMessage> = []

        // Collect text content
        const textParts = m.content
          .filter((c): c is { type: 'text'; text: string } => c.type === 'text')
          .map((c) => c.text)

        // Collect tool call info for assistant messages
        const toolCalls = m.content.filter(
          (
            c,
          ): c is {
            type: 'tool-call'
            toolCallId: string
            toolName: string
            args: Record<string, unknown>
          } => c.type === 'tool-call',
        )

        // Collect tool results
        const toolResults = m.content.filter(
          (
            c,
          ): c is {
            type: 'tool-result'
            toolCallId: string
            result: unknown
          } => c.type === 'tool-result',
        )

        // Build message content
        if (m.role === 'assistant' && toolCalls.length > 0) {
          // Assistant message with tool calls - include both text and tool call info
          const contentParts: string[] = []
          if (textParts.length > 0) {
            contentParts.push(textParts.join('\n'))
          }
          // Add tool call info as text so the LLM knows what it called
          for (const tc of toolCalls) {
            contentParts.push(
              `[Tool Call: ${tc.toolName}(${JSON.stringify(tc.args)})]`,
            )
          }
          result.push({
            role: 'assistant',
            content: contentParts.join('\n'),
          })
        } else if (m.role === 'tool' || toolResults.length > 0) {
          // Tool result message - convert to user message with the result
          for (const tr of toolResults) {
            const resultText =
              typeof tr.result === 'string'
                ? tr.result
                : JSON.stringify(tr.result)
            result.push({
              role: 'user',
              content: `[Tool Result: ${resultText}]`,
            })
          }
        } else if (textParts.length > 0) {
          // Regular text message
          result.push({
            role: m.role,
            content: textParts.join('\n'),
          })
        }

        return result
      })

      // Filter out empty messages
      const filteredMessages = apiMessages.filter((m) => m.content.length > 0)

      // Extract the last user message for follow-up suggestions
      const lastUserMessage =
        filteredMessages.filter((m) => m.role === 'user').pop()?.content || ''

      try {
        // Use our API client to stream the response with userId for RAG
        const stream = streamChatCompletion(
          {
            messages: filteredMessages,
            userId,
            mode,
            maxTokens: 4000,
            useRag: true,
            ragTopK: 50,
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

        let fullText = ''
        let lastYieldedText = ''

        for await (const chunk of stream) {
          // Check for abort signal on each iteration
          if (abortSignal.aborted) {
            break
          }

          fullText += chunk

          // Check if we have complete Tool UI markers
          // Only yield text up to any potential marker start
          const markerStartIndex = fullText.indexOf(TOOL_UI_MARKER_START)

          if (markerStartIndex === -1) {
            // No marker found, yield all accumulated text if changed
            if (fullText !== lastYieldedText) {
              lastYieldedText = fullText
              yield {
                content: [{ type: 'text', text: fullText }],
              }
            }
          } else {
            // Marker found - only yield text before the marker
            const textBeforeMarker = fullText.substring(0, markerStartIndex)
            if (textBeforeMarker && textBeforeMarker !== lastYieldedText) {
              lastYieldedText = textBeforeMarker
              yield {
                content: [{ type: 'text', text: textBeforeMarker }],
              }
            }
          }
        }

        // After stream completes, parse any Tool UI markers
        const { cleanText, toolCalls } = parseToolUIMarkers(fullText)

        // Build final content array
        const content: Array<
          | { type: 'text'; text: string }
          | {
              type: 'tool-call'
              toolCallId: string
              toolName: string
              args: Record<string, unknown>
            }
        > = []

        // Add cleaned text if present
        if (cleanText) {
          content.push({ type: 'text', text: cleanText })
        }

        // Add tool calls as tool-call content parts
        for (const tc of toolCalls) {
          content.push({
            type: 'tool-call',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args,
          })
        }

        // Yield final state with tool calls included
        if (content.length > 0) {
          yield { content }
        }

        // Notify about response completion for smart follow-up suggestions
        if (cleanText && onResponseComplete) {
          onResponseComplete(cleanText, lastUserMessage)
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
  mode: 'learn' | 'chat' | 'test'
  onRagInfo?: (info: RagInfo) => void
}

export function MyRuntimeProvider({
  children,
  mode,
  onRagInfo,
}: Readonly<MyRuntimeProviderProps>) {
  // Get userId from context for RAG-enabled chat
  const userId = useUserId()

  // Get setLastMessages from learning context for smart follow-up suggestions
  const { setLastMessages } = useLearningContext()

  // Callback when response completes - triggers smart follow-up generation
  const handleResponseComplete = useCallback(
    (assistantResponse: string, userMessage: string) => {
      setLastMessages(assistantResponse, userMessage)
    },
    [setLastMessages],
  )

  // Create adapter with current userId and response callback
  const adapter = useMemo(
    () => createModelAdapter(userId, mode, onRagInfo, handleResponseComplete),
    [userId, mode, onRagInfo, handleResponseComplete],
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
      {/* Tool UI components auto-register when mounted */}
      {/* Only register quiz tools in test mode to keep other modes lightweight */}
      {mode === 'test' && (
        <>
          <QuizQuestionTool />
          <TestProgressTool />
        </>
      )}
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
