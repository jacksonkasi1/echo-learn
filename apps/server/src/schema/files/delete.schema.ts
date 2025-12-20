// ** import lib
import { z } from 'zod'

export const deleteFileSchema = z.object({
  fileId: z.string().min(1, 'File ID is required'),
  userId: z.string().min(1, 'User ID is required'),
})

export const listFilesSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
})

export type DeleteFileRequest = z.infer<typeof deleteFileSchema>
export type ListFilesRequest = z.infer<typeof listFilesSchema>
