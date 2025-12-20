import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  FileIcon,
  MoreHorizontal,
  Search,
  Trash2,
  UploadCloud,
} from 'lucide-react'

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

export const Route = createFileRoute('/knowledge')({
  component: KnowledgePage,
})

// Mock data
const INITIAL_FILES = [
  {
    id: '1',
    name: 'React Documentation.pdf',
    type: 'PDF',
    size: '2.4 MB',
    date: '2024-03-10',
    status: 'Processed',
  },
  {
    id: '2',
    name: 'Project Requirements.docx',
    type: 'DOCX',
    size: '1.2 MB',
    date: '2024-03-11',
    status: 'Processing',
  },
  {
    id: '3',
    name: 'API Reference.md',
    type: 'Markdown',
    size: '45 KB',
    date: '2024-03-12',
    status: 'Processed',
  },
  {
    id: '4',
    name: 'Database Schema.png',
    type: 'Image',
    size: '3.1 MB',
    date: '2024-03-12',
    status: 'Failed',
  },
  {
    id: '5',
    name: 'Meeting Notes.txt',
    type: 'Text',
    size: '12 KB',
    date: '2024-03-13',
    status: 'Processed',
  },
  {
    id: '6',
    name: 'Architecture Diagram.svg',
    type: 'SVG',
    size: '150 KB',
    date: '2024-03-14',
    status: 'Processed',
  },
]

function KnowledgePage() {
  const [files, setFiles] = useState(INITIAL_FILES)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const itemsPerPage = 5

  // Filter files based on search
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  // Pagination logic
  const totalPages = Math.ceil(filteredFiles.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedFiles = filteredFiles.slice(
    startIndex,
    startIndex + itemsPerPage,
  )

  const handleDelete = (id: string) => {
    setFiles(files.filter((f) => f.id !== id))
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
    // Handle file drop logic here (placeholder)
    console.log('Files dropped:', e.dataTransfer.files)
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-6xl space-y-8">
        {/* Header */}
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
            <p className="mb-4 mt-2 text-sm text-muted-foreground max-w-xs">
              Drag and drop your files here or click to browse. Supported
              formats: PDF, DOCX, TXT, MD.
            </p>
            <Button>Select Files</Button>
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
                {paginatedFiles.length > 0 ? (
                  paginatedFiles.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileIcon className="h-4 w-4 text-muted-foreground" />
                          {file.name}
                        </div>
                      </TableCell>
                      <TableCell>{file.type}</TableCell>
                      <TableCell>{file.size}</TableCell>
                      <TableCell>{file.date}</TableCell>
                      <TableCell>
                        <span
                          className={cn(
                            'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset',
                            file.status === 'Processed'
                              ? 'bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-900/20 dark:text-green-400'
                              : file.status === 'Processing'
                                ? 'bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-900/20 dark:text-blue-400'
                                : 'bg-red-50 text-red-700 ring-red-600/20 dark:bg-red-900/20 dark:text-red-400',
                          )}
                        >
                          {file.status}
                        </span>
                      </TableCell>
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
                              onClick={() => handleDelete(file.id)}
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
                      No files found.
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
