// ** import lib
import { z } from 'zod'

export const ingestSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  userId: z.string().min(1, 'User ID is required'),
})

export type IngestRequest = z.infer<typeof ingestSchema>
