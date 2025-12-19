// ** File-related types for Echo-Learn

export type FileStatus =
  | 'pending_upload'
  | 'uploaded'
  | 'processing'
  | 'processed'
  | 'failed'

export type SupportedFileType =
  | 'application/pdf'
  | 'text/plain'
  | 'text/markdown'
  | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  | 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  | 'application/vnd.ms-powerpoint'
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'

export interface FileMetadata {
  fileId: string
  fileName: string
  uniqueFileName: string
  filePath: string
  userId: string
  contentType: string
  status: FileStatus
  createdAt: string
  updatedAt?: string
  processedAt?: string
  size?: number
  error?: string
}

export interface FileUploadRequest {
  fileName: string
  contentType: string
  userId: string
}

export interface SignedUrlResponse {
  signedUrl: string
  fileId: string
  filePath: string
  expiresIn: number
}

export interface UploadConfirmRequest {
  fileId: string
  userId: string
}

export interface FileProcessingResult {
  fileId: string
  status: FileStatus
  chunksCount?: number
  graphNodesCount?: number
  graphEdgesCount?: number
  processingTimeMs?: number
  error?: string
}

export interface FileListResponse {
  files: FileMetadata[]
  total: number
  page: number
  pageSize: number
}

export interface FileDeleteRequest {
  fileId: string
  userId: string
}

export interface FileDeleteResponse {
  success: boolean
  deletedFileId: string
  deletedChunks?: number
}
