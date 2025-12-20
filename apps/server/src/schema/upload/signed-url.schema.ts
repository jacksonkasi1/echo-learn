// ** import lib
import { z } from 'zod'

export const signedUrlSchema = z.object({
  fileName: z.string().min(1, 'File name is required'),
  contentType: z.string().min(1, 'Content type is required'),
  userId: z.string().min(1, 'User ID is required'),
})

export const confirmUploadSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  userId: z.string().min(1, 'User ID is required'),
})

export type SignedUrlRequest = z.infer<typeof signedUrlSchema>
export type ConfirmUploadRequest = z.infer<typeof confirmUploadSchema>
