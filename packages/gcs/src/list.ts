// ** import types
import type { Storage, GetFilesResponse } from "@google-cloud/storage";

export interface ListFilesOptions {
  prefix?: string;
  maxResults?: number;
  pageToken?: string;
}

export interface FileInfo {
  name: string;
  size: number;
  contentType: string | undefined;
  created: Date | undefined;
  updated: Date | undefined;
}

export interface ListFilesResult {
  files: FileInfo[];
  nextPageToken?: string;
}

/**
 * List files in a GCS bucket with optional prefix filtering
 * Supports pagination for large result sets
 */
export async function listFiles(
  storage: Storage,
  bucketName: string,
  options: ListFilesOptions = {},
): Promise<ListFilesResult> {
  const { prefix, maxResults = 100, pageToken } = options;

  const [files, nextQuery] = await storage.bucket(bucketName).getFiles({
    prefix,
    maxResults,
    pageToken,
    autoPaginate: false,
  });

  const fileInfos: FileInfo[] = await Promise.all(
    files.map(async (file) => {
      const [metadata] = await file.getMetadata();
      return {
        name: file.name,
        size: Number(metadata.size) || 0,
        contentType: metadata.contentType,
        created: metadata.timeCreated
          ? new Date(metadata.timeCreated)
          : undefined,
        updated: metadata.updated ? new Date(metadata.updated) : undefined,
      };
    }),
  );

  return {
    files: fileInfos,
    nextPageToken: nextQuery?.pageToken,
  };
}

/**
 * Check if a file exists in the bucket
 */
export async function fileExists(
  storage: Storage,
  bucketName: string,
  filePath: string,
): Promise<boolean> {
  const file = storage.bucket(bucketName).file(filePath);
  const [exists] = await file.exists();
  return exists;
}

/**
 * Get the count of files with a specific prefix
 * Useful for checking how many files a user has uploaded
 */
export async function countFiles(
  storage: Storage,
  bucketName: string,
  prefix: string,
): Promise<number> {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix });
  return files.length;
}

/**
 * List all "folders" (prefixes) in a bucket
 * GCS doesn't have real folders, but we can simulate them with prefixes
 */
export async function listFolders(
  storage: Storage,
  bucketName: string,
  prefix?: string,
): Promise<string[]> {
  const [files, nextQuery, apiResponse] = await storage
    .bucket(bucketName)
    .getFiles({
      prefix,
      delimiter: "/",
      autoPaginate: false,
    });

  // The prefixes array contains the "folder" paths
  // Cast to access prefixes which is available when delimiter is used
  const response = apiResponse as { prefixes?: string[] } | undefined;
  const prefixes = response?.prefixes || [];
  return prefixes;
}

/**
 * Get total size of all files with a specific prefix
 * Useful for tracking storage usage per user/organization
 */
export async function getTotalSize(
  storage: Storage,
  bucketName: string,
  prefix: string,
): Promise<number> {
  const [files] = await storage.bucket(bucketName).getFiles({ prefix });

  let totalSize = 0;
  for (const file of files) {
    const [metadata] = await file.getMetadata();
    totalSize += Number(metadata.size) || 0;
  }

  return totalSize;
}
