// ** import lib
export { createGCSClient, createGCSClientFromEnv } from './client.js'
export type { GCSConfig } from './client.js'

export {
  getSignedUploadUrl,
  uploadBuffer,
  uploadStream,
} from './upload.js'
export type {
  SignedUploadUrlOptions,
  SignedUploadUrlResult,
  UploadBufferOptions,
  UploadBufferResult,
} from './upload.js'

export {
  getSignedDownloadUrl,
  downloadFile,
  downloadAsStream,
  getPublicUrl,
  getFileMetadata,
} from './download.js'
export type {
  SignedDownloadUrlOptions,
  SignedDownloadUrlResult,
  DownloadFileResult,
} from './download.js'

export {
  deleteFile,
  deleteFileByUrl,
  deleteMultipleFiles,
  deleteByPrefix,
  moveToTrash,
} from './delete.js'
export type {
  DeleteFileResult,
  DeleteMultipleFilesResult,
  DeleteByPrefixResult,
} from './delete.js'

export {
  listFiles,
  fileExists,
  countFiles,
  listFolders,
  getTotalSize,
} from './list.js'
export type {
  ListFilesOptions,
  FileInfo,
  ListFilesResult,
} from './list.js'
