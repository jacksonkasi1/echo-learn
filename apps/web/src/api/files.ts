// Files API module
// Handles all file-related API calls to the backend

import { apiClient } from './client'

// Types for file operations
export interface FileMetadata {
  fileId: string
  fileName: string
  uniqueFileName: string
  filePath: string
  userId: string
  contentType: string
  status: 'pending_upload' | 'uploaded' | 'processing' | 'processed' | 'failed'
  createdAt: string
  updatedAt?: string
  processedAt?: string
  size?: number
  error?: string
}

export interface SignedUrlRequest {
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

export interface UploadConfirmResponse {
  success: boolean
  fileId: string
  status: string
  message: string
}

export interface FileListResponse {
  files: Array<FileMetadata>
  total: number
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

/**
 * Get a signed URL for uploading a file to GCS
 */
export async function getSignedUploadUrl(
  request: SignedUrlRequest,
): Promise<SignedUrlResponse> {
  const response = await apiClient.post<SignedUrlResponse>(
    '/api/upload/signed-url',
    request,
  )
  return response.data
}

/**
 * Confirm that a file has been uploaded
 */
export async function confirmUpload(
  request: UploadConfirmRequest,
): Promise<UploadConfirmResponse> {
  const response = await apiClient.post<UploadConfirmResponse>(
    '/api/upload/confirm',
    request,
  )
  return response.data
}

/**
 * Upload a file directly to GCS using the signed URL
 */
export async function uploadFileToGCS(
  signedUrl: string,
  file: File,
): Promise<void> {
  await fetch(signedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  })
}

/**
 * Full upload flow: get signed URL, upload file, confirm upload
 */
export async function uploadFile(
  file: File,
  userId: string,
): Promise<{ fileId: string; status: string }> {
  // Step 1: Get signed URL
  const { signedUrl, fileId } = await getSignedUploadUrl({
    fileName: file.name,
    contentType: file.type,
    userId,
  })

  // Step 2: Upload file to GCS
  await uploadFileToGCS(signedUrl, file)

  // Step 3: Confirm upload
  const confirmation = await confirmUpload({
    fileId,
    userId,
  })

  return {
    fileId: confirmation.fileId,
    status: confirmation.status,
  }
}

/**
 * Get all files for a user
 */
export async function getUserFiles(userId: string): Promise<FileListResponse> {
  const response = await apiClient.get<FileListResponse>('/api/files', {
    params: { userId },
  })
  return response.data
}

/**
 * Get details of a specific file
 */
export async function getFileDetails(
  fileId: string,
  userId?: string,
): Promise<FileMetadata> {
  const response = await apiClient.get<FileMetadata>(`/api/files/${fileId}`, {
    params: userId ? { userId } : undefined,
  })
  return response.data
}

/**
 * Delete a file and all associated data
 */
export async function deleteFile(
  request: FileDeleteRequest,
): Promise<FileDeleteResponse> {
  const response = await apiClient.delete<FileDeleteResponse>('/api/files', {
    data: request,
  })
  return response.data
}

// Export the files API as a namespace for cleaner imports
export const filesApi = {
  getSignedUploadUrl,
  confirmUpload,
  uploadFileToGCS,
  uploadFile,
  getUserFiles,
  getFileDetails,
  deleteFile,
}

export default filesApi
