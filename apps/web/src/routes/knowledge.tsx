import { Link, createFileRoute } from '@tanstack/react-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  FileIcon,
  Loader2,
  MoreHorizontal,
  RefreshCw,
  Search,
  Trash2,
  UploadCloud,
  XCircle,
} from 'lucide-react'

import type { FileMetadata } from '@/api/files'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { filesApi } from '@/api/files'
import { ingestApi } from '@/api/ingest'

export const Route = createFileRoute('/knowledge')({
  component: KnowledgePage,
})

// Temporary user ID until auth is implemented
const TEMP_USER_ID = 'user_demo_123'

// Supported file types
const SUPPORTED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown',
]

const SUPPORTED_EXTENSIONS = '.pdf,.docx,.txt,.md'

type UploadStatus = 'idle' | 'uploading' | 'processing' | 'success' | 'error'

interface UploadingFile {
  file: File
  status: UploadStatus
  progress: number
  fileId?: string
  error?: string
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getFileType(contentType: string): string {
  const typeMap: Record<string, string> = {
    'application/pdf': 'PDF',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      'DOCX',
    'text/plain': 'Text',
    'text/markdown': 'Markdown',
  }
  return typeMap[contentType] ?? 'Unknown'
}

function KnowledgePage() {
  const [files, setFiles] = useState<Array<FileMetadata>>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [uploadingFiles, setUploadingFiles] = useState<Array<UploadingFile>>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const itemsPerPage = 5

  // Fetch files on mount
  const fetchFiles = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await filesApi.getUserFiles(TEMP_USER_ID)
      setFiles(response.files)
    } catch (err) {
      console.error('Failed to fetch files:', err)
      setError('Failed to load files. Please try again.')
      // Keep empty array if fetch fails
      setFiles([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchFiles()
  }, [fetchFiles])

  // Filter files based on search
  const filteredFiles = files.filter((file) =>
    file.fileName.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedFiles = filteredFiles.slice(
    startIndex,
    startIndex + itemsPerPage,
  )

  const handleDelete = async (fileId: string) => {
    try {
      await filesApi.deleteFile({
        fileId,
        userId: TEMP_USER_ID,
      })
      // Optimistically remove from list
      setFiles((prev) => prev.filter((f) => f.fileId !== fileId))
    } catch (err) {
      console.error('Failed to delete file:', err)
      setError('Failed to delete file. Please try again.')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files)
    void handleFilesSelected(droppedFiles)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files)
      void handleFilesSelected(selectedFiles)
      // Reset input
      e.target.value = ''
    }
  }

  const handleFilesSelected = async (selectedFiles: Array<File>) => {
    // Filter to supported types
    const validFiles = selectedFiles.filter((file) =>
      SUPPORTED_FILE_TYPES.includes(file.type),
    )

    if (validFiles.length !== selectedFiles.length) {
      setError(
        'Some files were skipped. Only PDF, DOCX, TXT, and MD files are supported.',
      )
    }

    if (validFiles.length === 0) return

    // Add files to uploading state
    const newUploadingFiles: Array<UploadingFile> = validFiles.map((file) => ({
      file,
      status: 'uploading' as UploadStatus,
      progress: 0,
    }))

    setUploadingFiles((prev) => [...prev, ...newUploadingFiles])

    // Upload each file
    for (const uploadingFile of newUploadingFiles) {
      await processFile(uploadingFile.file)
    }
  }

  const processFile = async (file: File) => {
    const updateFileStatus = (
      fileName: string,
      updates: Partial<UploadingFile>,
    ) => {
      setUploadingFiles((prev) =>
        prev.map((f) => (f.file.name === fileName ? { ...f, ...updates } : f)),
      )
    }

    try {
      // Upload file
      updateFileStatus(file.name, { status: 'uploading', progress: 30 })

      const { fileId } = await filesApi.uploadFile(file, TEMP_USER_ID)
      updateFileStatus(file.name, {
        status: 'processing',
        progress: 60,
        fileId,
      })

      // Start ingestion
      await ingestApi.ingestFile({ fileId, userId: TEMP_USER_ID })
      updateFileStatus(file.name, { progress: 80 })

      // Poll for completion
      const status = await ingestApi.waitForIngestion(fileId, {
        pollIntervalMs: 2000,
        maxAttempts: 60,
        onStatusChange: (s) => {
          if (s.status === 'processed') {
            updateFileStatus(file.name, { status: 'success', progress: 100 })
          } else if (s.status === 'failed') {
            updateFileStatus(file.name, {
              status: 'error',
              error: s.error ?? 'Processing failed',
            })
          }
        },
      })

      if (status.status === 'processed') {
        updateFileStatus(file.name, { status: 'success', progress: 100 })
        // Refresh file list
        await fetchFiles()
      } else if (status.status === 'failed') {
        updateFileStatus(file.name, {
          status: 'error',
          error: status.error ?? 'Processing failed',
        })
      }

      // Remove from uploading after a delay
      setTimeout(() => {
        setUploadingFiles((prev) =>
          prev.filter((f) => f.file.name !== file.name),
        )
      }, 3000)
    } catch (err) {
      console.error('Upload failed:', err)
      updateFileStatus(file.name, {
        status: 'error',
        error: err instanceof Error ? err.message : 'Upload failed',
      })
    }
  }

  const getStatusBadge = (status: FileMetadata['status']) => {
    const styles = {
      processed:
        'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400',
      processing:
        'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400',
      uploaded:
        'bg-yellow-50 text-yellow-700 ring-yellow-600/20 dark:bg-yellow-900/20 dark:text-yellow-400',
      pending_upload:
        'bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-900/20 dark:text-gray-400',
      failed:
        'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400',
    }

    const labels = {
      processed: 'Processed',
      processing: 'Processing',
      uploaded: 'Uploaded',
      pending_upload: 'Pending',
      failed: 'Failed',
    }

    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset',
          styles[status],
        )}
      >
        {status === 'processing' && (
          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
        )}
        {labels[status]}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Knowledge Base
              </h1>
              <p className="text-muted-foreground">
                Manage your uploaded documents and resources.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void fetchFiles()}>
            <RefreshCw
              className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
            <div className="flex items-center justify-between">
              <p className="text-sm">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-red-600 hover:text-red-800 dark:text-red-400"
              >
                <XCircle className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* Uploading Files Progress */}
        {uploadingFiles.length > 0 && (
          <div className="space-y-2">
            {uploadingFiles.map((uploadingFile) => (
              <div
                key={uploadingFile.file.name}
                className="rounded-md border bg-card p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileIcon className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{uploadingFile.file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {uploadingFile.status === 'uploading' && 'Uploading...'}
                        {uploadingFile.status === 'processing' &&
                          'Processing document...'}
                        {uploadingFile.status === 'success' && 'Complete!'}
                        {uploadingFile.status === 'error' &&
                          (uploadingFile.error ?? 'Failed')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {uploadingFile.status === 'uploading' && (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    )}
                    {uploadingFile.status === 'processing' && (
                      <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
                    )}
                    {uploadingFile.status === 'success' && (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    )}
                    {uploadingFile.status === 'error' && (
                      <XCircle className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                </div>
                {(uploadingFile.status === 'uploading' ||
                  uploadingFile.status === 'processing') && (
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadingFile.progress}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Drag & Drop Area */}
        <Card
          className={cn(
            'border-2 border-dashed transition-colors',
            isDragging
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25 hover:border-primary/50',
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4 rounded-full bg-muted p-4">
              <UploadCloud className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold">Upload Files</h3>
            <p className="mb-4 mt-2 max-w-xs text-sm text-muted-foreground">
              Drag and drop your files here or click to browse. Supported
              formats: PDF, DOCX, TXT, MD.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={SUPPORTED_EXTENSIONS}
              onChange={handleFileInputChange}
              className="hidden"
            />
            <Button onClick={() => fileInputRef.current?.click()}>
              Select Files
            </Button>
          </CardContent>
        </Card>

        {/* Search & Table Area */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="relative w-72">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search files..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value)
                  setCurrentPage(1) // Reset to page 1 on search
                }}
                className="pl-8"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {filteredFiles.length} file{filteredFiles.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Date Uploaded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : paginatedFiles.length > 0 ? (
                  paginatedFiles.map((file) => (
                    <TableRow key={file.fileId}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="max-w-50 truncate">
                            {file.fileName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getFileType(file.contentType)}</TableCell>
                      <TableCell>
                        {file.size ? formatFileSize(file.size) : '—'}
                      </TableCell>
                      <TableCell>{formatDate(file.createdAt)}</TableCell>
                      <TableCell>{getStatusBadge(file.status)}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Open menu</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => void handleDelete(file.fileId)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      {searchQuery
                        ? 'No files match your search.'
                        : 'No files uploaded yet. Upload your first document above.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    className={
                      currentPage === 1 ? 'pointer-events-none opacity-50' : ''
                    }
                  />
                </PaginationItem>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <PaginationItem key={page}>
                      <PaginationLink
                        isActive={currentPage === page}
                        onClick={() => setCurrentPage(page)}
                      >
                        {page}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    className={
                      currentPage === totalPages
                        ? 'pointer-events-none opacity-50'
                        : ''
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  )
}
