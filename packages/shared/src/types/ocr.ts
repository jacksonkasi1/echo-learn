// ** OCR-related types for Echo-Learn

export interface OcrResult {
  markdown: string
  confidence: number
  pageCount: number
  tokenUsage: TokenUsage
  images?: OcrImage[]
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
}

export interface OcrImage {
  pageNumber: number
  base64: string
  contentType: string
}

export interface OcrOptions {
  maxAttempts?: number
  baseDelay?: number
  timeout?: number
  includeImages?: boolean
}

export interface OcrProcessingStatus {
  fileId: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress?: number
  result?: OcrResult
  error?: string
  startedAt?: string
  completedAt?: string
}

export interface OcrBatchRequest {
  fileUrls: string[]
  options?: OcrOptions
}

export interface OcrBatchResult {
  results: Array<{
    fileUrl: string
    success: boolean
    result?: OcrResult
    error?: string
  }>
  totalProcessed: number
  successCount: number
  failureCount: number
}
