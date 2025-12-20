// ** import lib
import { z } from 'zod'

export const messageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
})

export const chatCompletionSchema = z.object({
  model: z.string().optional().default('echo-learn-v1'),
  messages: z.array(messageSchema).min(1),
  user: z.string().optional(),
  user_id: z.string().optional(),
  max_tokens: z.number().optional().default(1024),
  temperature: z.number().optional().default(0.7),
  stream: z.boolean().optional().default(false),
})

export type ChatCompletionRequest = z.infer<typeof chatCompletionSchema>
export type Message = z.infer<typeof messageSchema>
