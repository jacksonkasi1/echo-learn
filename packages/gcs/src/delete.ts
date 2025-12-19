// ** import types
import type { Storage } from '@google-cloud/storage'

export interface DeleteFileResult {
  deleted: boolean
  filePath: string
}

/**
 * Delete a single file from GCS
 */
export async function deleteFile(
  storage: Storage,
  bucketName: string,
  filePath: string
): Promise<DeleteFileResult> {
  const file = storage.bucket(bucketName).file(filePath)

  try {
    await file.delete()
    return { deleted: true, filePath }
  } catch (error) {
    // Check if file doesn't exist (404)
    if ((error as NodeJS.ErrnoException).code === '404') {
      return { deleted: false, filePath }
    }
    throw error
  }
}

/**
 * Delete a file by its public URL
 * Extracts the bucket and path from the URL
 */
export async function deleteFileByUrl(
  storage: Storage,
  publicUrl: string
): Promise<DeleteFileResult> {
  // Parse URL: https://storage.googleapis.com/bucket-name/path/to/file
  const url = new URL(publicUrl)
  const pathParts = url.pathname.split('/').filter(Boolean)

  if (pathParts.length < 2) {
    throw new Error('Invalid GCS URL format')
  }

  const bucketName = pathParts[0]!
  const filePath = pathParts.slice(1).join('/')

  return deleteFile(storage, bucketName, filePath)
}

export interface DeleteMultipleFilesResult {
  deleted: string[]
  failed: Array<{ filePath: string; error: string }>
}

/**
 * Delete multiple files from GCS
 * Continues even if some deletions fail
 */
export async function deleteMultipleFiles(
  storage: Storage,
  bucketName: string,
  filePaths: string[]
): Promise<DeleteMultipleFilesResult> {
  const result: DeleteMultipleFilesResult = {
    deleted: [],
    failed: [],
  }

  await Promise.all(
    filePaths.map(async (filePath) => {
      try {
        await storage.bucket(bucketName).file(filePath).delete()
        result.deleted.push(filePath)
      } catch (error) {
        result.failed.push({
          filePath,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    })
  )

  return result
}

export interface DeleteByPrefixResult {
  deletedCount: number
  prefix: string
}

/**
 * Delete all files with a specific prefix (like a folder)
 * Useful for cleaning up all files related to a user or organization
 */
export async function deleteByPrefix(
  storage: Storage,
  bucketName: string,
  prefix: string
): Promise<DeleteByPrefixResult> {
  const bucket = storage.bucket(bucketName)

  // Get all files with the prefix
  const [files] = await bucket.getFiles({ prefix })

  if (files.length === 0) {
    return { deletedCount: 0, prefix }
  }

  // Delete all files
  await Promise.all(files.map((file) => file.delete()))

  return { deletedCount: files.length, prefix }
}

/**
 * Move a file to a "trash" folder instead of permanently deleting
 * Useful for implementing soft-delete functionality
 */
export async function moveToTrash(
  storage: Storage,
  bucketName: string,
  filePath: string,
  trashPrefix = '_trash'
): Promise<{ newPath: string }> {
  const bucket = storage.bucket(bucketName)
  const file = bucket.file(filePath)

  const timestamp = Date.now()
  const newPath = `${trashPrefix}/${timestamp}/${filePath}`

  await file.move(newPath)

  return { newPath }
}
