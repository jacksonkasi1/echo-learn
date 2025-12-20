// ** import types
import type { Context } from 'hono'
import type { ChatCompletionResponse } from '@/types/chat'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

// ** import schema
import { chatCompletionSchema, type ChatCompletionRequest } from '@/schema/chat'

// ** import utils
import { retrieveContext } from '@/lib/rag/retrieve-context'
import { getUserProfile } from '@/lib/upstash/redis'
import { buildSystemPrompt } from '@/lib/prompt/system-prompt'
import { generateResponse, type ChatMessage } from '@/lib/llm/generate-response'
import { updateAnalytics, extractAndRecordTopics } from '@/lib/analytics/update-analytics'
import { logger } from '@repo/logs'

const chatRoute = new Hono()

/**
 * POST /v1/chat/completions
 * OpenAI-compatible chat completions endpoint for 11Labs integration
 */
chatRoute.post(
  '/completions',
  zValidator('json', chatCompletionSchema),
  async (c: Context) => {
    const startTime = Date.now()

    try {
      // 1. Verify authorization (11Labs sends secret in auth header)
      const authHeader = c.req.header('authorization')
      const expectedSecret = process.env.ELEVENLABS_AGENT_SECRET

      // Allow both Bearer token format and direct secret
      if (expectedSecret) {
        const providedSecret = authHeader?.replace('Bearer ', '')
        if (providedSecret !== expectedSecret) {
          logger.warn('Unauthorized chat request', {
            hasAuth: !!authHeader,
          })
          return c.json({ error: 'Unauthorized' }, 401)
        }
      }

      // 2. Parse request
      const body = c.req.valid('json' as never) as ChatCompletionRequest
      const messages = body.messages as ChatMessage[]
      const userId = body.user_id || body.user || 'default'
      const maxTokens = body.max_tokens || 1024
      const temperature = body.temperature || 0.7

      logger.info('Processing chat completion request', {
        userId,
        messageCount: messages.length,
        model: body.model,
      })

      // 3. Extract latest user message
      const userMessage = messages
        .filter((m) => m.role === 'user')
        .pop()?.content || ''

      if (!userMessage) {
        return c.json({ error: 'No user message provided' }, 400)
      }

      // 4. Retrieve relevant context from Vector DB (RAG)
      logger.info('Retrieving context for RAG', { userId, queryLength: userMessage.length })

      const { chunks, sources } = await retrieveContext(userMessage, userId, {
        topK: 5,
        minScore: 0.6,
      })

      logger.info('Context retrieved', {
        userId,
        chunksFound: chunks.length,
        sources: sources.length,
      })

      // 5. Get user profile for personalization
      const profile = await getUserProfile(userId)

      logger.info('User profile loaded', {
        userId,
        level: profile.level,
        questionsAnswered: profile.questionsAnswered,
      })

      // 6. Build system prompt with context and profile
      const systemPrompt = buildSystemPrompt({
        knowledgeChunks: chunks,
        userProfile: profile,
      })

      // 7. Filter out system messages from history (we provide our own)
      const conversationMessages = messages.filter((m) => m.role !== 'system')

      // 8. Generate response using Gemini
      logger.info('Generating response', { userId })

      const responseText = await generateResponse({
        systemPrompt,
        messages: conversationMessages,
        maxTokens,
        temperature,
      })

      logger.info('Response generated', {
        userId,
        responseLength: responseText.length,
      })

      // 9. Update analytics asynchronously (don't block response)
      const processingTimeMs = Date.now() - startTime

      // Extract topics and update analytics in background
      Promise.all([
        extractAndRecordTopics(userId, conversationMessages),
        updateAnalytics({
          userId,
          query: userMessage,
          response: responseText,
          retrievedChunks: chunks,
          processingTimeMs,
        }),
      ]).catch((error) => {
        logger.error('Failed to update analytics', error)
      })

      // 10. Return OpenAI-compatible response
      const response: ChatCompletionResponse = {
        id: `chatcmpl-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'echo-learn-v1',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: responseText,
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: estimateTokens(systemPrompt + userMessage),
          completion_tokens: estimateTokens(responseText),
          total_tokens: estimateTokens(systemPrompt + userMessage + responseText),
        },
      }

      logger.info('Chat completion successful', {
        userId,
        processingTimeMs,
        responseId: response.id,
      })

      return c.json(response)
    } catch (error) {
      logger.error('Chat completion failed', error)

      return c.json(
        {
          error: {
            message: error instanceof Error ? error.message : 'Internal server error',
            type: 'api_error',
            code: 'internal_error',
          },
        },
        500
      )
    }
  }
)

/**
 * GET /v1/chat/completions/health
 * Health check endpoint
 */
chatRoute.get('/health', async (c: Context) => {
  return c.json({
    status: 'ok',
    model: 'echo-learn-v1',
    timestamp: new Date().toISOString(),
  })
})

/**
 * Estimate token count (rough approximation)
 * ~4 characters per token on average
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export { chatRoute }
