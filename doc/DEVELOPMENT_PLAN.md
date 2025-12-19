# Echo-Learn Development Plan

> **Voice AI Study Partner** - A conversational learning system using 11Labs voice interface with custom RAG backend

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ECHO-LEARN ARCHITECTURE                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────┐     ┌──────────────────────┐                      │
│  │   TURBO REPO         │     │    EXTERNAL SERVICES │                      │
│  │                      │     │                      │                      │
│  │  ┌────────────────┐  │     │  • 11Labs (Voice)    │                      │
│  │  │ apps/web       │  │     │  • Gemini (LLM)      │                      │
│  │  │ (TanStack Start) │  │     │  • Mistral (OCR)     │                      │
│  │  └────────────────┘  │     │  • Google Cloud      │                      │
│  │                      │     │  • Upstash (Vector)  │                      │
│  │  ┌────────────────┐  │     │  • Upstash (Redis)   │                      │
│  │  │ apps/server       │  │     │                      │                      │
│  │  │ (Hono.js)      │  │     └──────────────────────┘                      │
│  │  └────────────────┘  │                                                   │
│  │                      │                                                   │
│  │  ┌────────────────┐  │                                                   │
│  │  │ packages/      │  │                                                   │
│  │  │ shared         │  │                                                   │
│  │  └────────────────┘  │                                                   │
│  └──────────────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Method 1 (Custom LLM) Selected:**
- 11Labs = "Voice Layer" (STT/TTS only)
- Your Backend = "The Brain" (RAG, Context, Analytics)
- Full control over knowledge, prompts, and user state

---

## Technology Stack

**Runtime & Build System:**
- **Bun** - Primary runtime and package manager for development and production
- **Turborepo** - Monorepo build system and task orchestration
- **Bun Workspaces** - Monorepo workspace management

**Why Bun:**
- Fast package installation and execution
- Native TypeScript support
- Built-in bundler and test runner
- Built-in workspace support (no need for separate package manager)
- Compatible with Node.js ecosystem
- Better performance for development workflows

---

## Pre-Development Checklist

- [ ] Turbo Repo initialized with `apps/web` and `apps/server`
- [ ] Bun installed as primary runtime
- [ ] TypeScript strict mode enabled
- [ ] ESLint + Prettier configured
- [ ] Environment variables template created
- [ ] Shared packages structure created

---

# Phase I: Foundation & Ingestion Pipeline

> **Goal:** Set up project structure and build the complete file upload → OCR → chunking → embedding → graph pipeline

---

## Reusable Packages Architecture

**Philosophy:** Extract common functionality into reusable packages that can be shared across apps and projects.

### Package Structure

**Core Packages:**
1. **`@repo/typescript-config`** - Shared TypeScript configurations
   - `base.json` - Base config for all packages
   - `react.json` - React-specific config
   - Ensures consistent TS settings across monorepo

2. **`@repo/gcs`** - Google Cloud Storage utilities
   - Upload operations (signed URLs, buffer upload)
   - Download operations (signed URLs, file retrieval)
   - Delete operations (single, bulk, by URL)
   - List operations (file listing, existence checks)
   - Centralized GCS client management

3. **`@repo/logs`** - Logging utilities
   - Consistent logging interface across apps
   - Structured logging for better debugging
   - Environment-aware log levels

4. **`@repo/shared`** - Shared types and utilities
   - Common TypeScript types
   - Utility functions used across apps
   - Constants and enums

### Benefits of Package Architecture

1. **Code Reusability:** Write once, use everywhere
2. **Consistency:** Same patterns across all apps
3. **Maintainability:** Update in one place
4. **Type Safety:** Shared types ensure contract compliance
5. **Testing:** Test packages independently
6. **Scalability:** Easy to add new apps using existing packages

### Import Pattern from Packages

```typescript
// ** import utils
import { logger } from '@repo/logs'
import { createGCSClient, getSignedUploadUrl } from '@repo/gcs'

// ** import types
import type { SharedType } from '@repo/shared'
```

### When to Create a New Package

- Functionality used by 2+ apps
- Self-contained business logic
- External service wrappers (GCS, OCR, etc.)
- Shared configurations
- Common utilities and helpers

---

## Task 1.1: Turbo Repo Project Setup

**Description:** Initialize the monorepo structure with Vite frontend and Hono.js backend using Bun runtime

**Subtasks:**
- [ ] Install Bun runtime globally
- [ ] Initialize Turbo Repo with Bun workspaces
- [ ] Create `apps/web` (TanStack Start + TypeScript)
- [ ] Create `apps/server` (Hono.js + TypeScript + Bun runtime)
- [ ] Create shared packages for reusability
- [ ] Configure path aliases and tsconfig references
- [ ] Set up TypeScript configuration inheritance

**File Structure:**
```
echo-learn/
├── apps/
│   ├── web/                 # TanStack Start frontend
│   │   ├── src/
│   │   │   ├── api/         # API client functions
│   │   │   ├── components/
│   │   │   ├── lib/
│   │   │   └── types/
│   │   ├── vite.config.ts
│   │   └── tsconfig.json
│   │
│   └── server/                 # Hono.js backend (Bun runtime)
│       ├── src/
│       │   ├── routes/
│       │   ├── lib/
│       │   ├── middleware/
│       │   ├── schema/
│       │   └── index.ts
│       ├── tsconfig.json
│       └── package.json
│
├── packages/
│   ├── typescript-config/   # Shared TypeScript configurations
│   │   ├── base.json
│   │   ├── react.json
│   │   └── package.json
│   │
│   ├── gcs/                 # Google Cloud Storage utilities
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   ├── upload.ts
│   │   │   ├── download.ts
│   │   │   ├── delete.ts
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── logs/                # Logging utilities
│   │   ├── src/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── shared/              # Shared types & utilities
│       ├── src/
│       │   ├── types/
│       │   └── utils/
│       └── package.json
│
├── turbo.json
├── bun.lockb              # Bun lock file (binary)
└── package.json           # Includes "workspaces" field for Bun
```

**TypeScript Configuration Pattern:**

```json
// packages/typescript-config/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

```json
// apps/server/tsconfig.json
{
  "extends": "@repo/typescript-config/base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**✅ Validation Checklist:**
- [ ] Bun installed: `bun --version`
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.2: Environment & External Service Configuration

**Description:** Configure all external service connections and create reusable package modules

**Subtasks:**
- [ ] Create `.env.example` with all required keys
- [ ] Create `@repo/gcs` package for Google Cloud Storage
- [ ] Create `@repo/logs` package for logging
- [ ] Set up Upstash Vector client in `apps/server`
- [ ] Set up Upstash Redis client in `apps/server`
- [ ] Set up Gemini AI SDK in `apps/server`
- [ ] Set up Mistral OCR client in `apps/server`

**Environment Variables:**
```env
# Upstash Vector
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Google Cloud Storage
GCS_BUCKET_NAME=
GCS_PROJECT_ID=
GCS_KEY_FILE=              # Path to service account JSON key file
GCS_PUBLIC_URL=            # Public URL for file access

# Gemini
GOOGLE_GENERATIVE_AI_API_KEY=

# Mistral OCR
MISTRAL_API_KEY=

# 11Labs (for later phases)
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_SECRET=
```

**Critical Code - GCS Package Setup:**
```typescript
// packages/gcs/src/client.ts

// ** import lib
import { Storage } from '@google-cloud/storage'

interface GCSConfig {
  projectId: string
  keyFilename: string
}

export function createGCSClient(config: GCSConfig) {
  return new Storage({
    projectId: config.projectId,
    keyFilename: config.keyFilename,
  })
}

// packages/gcs/src/upload.ts

// ** import types
import type { Storage } from '@google-cloud/storage'

// ** import lib
import { nanoid } from 'nanoid'

export async function getSignedUploadUrl(
  storage: Storage,
  bucketName: string,
  options: {
    organizationId: string
    fileName: string
    contentType: string
  }
) {
  const uniqueFileName = `${nanoid()}-${options.fileName}`
  const filePath = `uploads/${options.organizationId}/${uniqueFileName}`

  const [signedUrl] = await storage
    .bucket(bucketName)
    .file(filePath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
      contentType: options.contentType,
    })

  return { signedUrl, filePath, uniqueFileName }
}

export async function uploadBuffer(
  storage: Storage,
  bucketName: string,
  buffer: Buffer,
  filePath: string
) {
  const file = storage.bucket(bucketName).file(filePath)
  await file.save(buffer)
  return { filePath }
}

// packages/gcs/src/index.ts

// ** import lib
export { createGCSClient } from './client'
export { getSignedUploadUrl, uploadBuffer } from './upload'
export { getSignedDownloadUrl, downloadFile } from './download'
export { deleteFile, deleteFileByUrl, deleteMultipleFiles } from './delete'
export { listFiles, fileExists } from './list'
```

**Critical Code - Upstash Clients Setup:**
```typescript
// apps/server/src/lib/upstash/vector.ts

// ** import lib
import { Index } from '@upstash/vector'

export const vectorIndex = new Index({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
})

// Inject data to Vector DB
export async function upsertVectors(
  vectors: Array<{
    id: string
    vector: number[]
    metadata: {
      content: string
      fileId: string
      chunkIndex: number
    }
  }>
) {
  await vectorIndex.upsert(vectors)
}

// Search similar vectors
export async function searchVectors(queryVector: number[], topK = 5) {
  return vectorIndex.query({
    vector: queryVector,
    topK,
    includeMetadata: true,
  })
}
```

```typescript
// apps/server/src/lib/upstash/redis.ts

// ** import lib
import { Redis } from '@upstash/redis'

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
})
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.3: File Upload to Google Cloud Storage

**Description:** Create API endpoint for file upload using @repo/gcs package

**Subtasks:**
- [ ] Create signed URL generation endpoint using @repo/gcs
- [ ] Create file upload confirmation endpoint
- [ ] Store file metadata in Redis
- [ ] Support: PDF, TXT, MD, PPT, DOCX, PPTX formats

**API Endpoints:**
- `POST /api/upload/signed-url` - Get signed upload URL
- `POST /api/upload/confirm` - Confirm upload and trigger processing

**Critical Code - Upload API (Using GCS Package):**
```typescript
// apps/server/src/routes/upload/get-signed-url.ts

// ** import types
import type { Context } from 'hono'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// ** import utils
import { createGCSClient, getSignedUploadUrl } from '@repo/gcs'
import { redis } from '@/lib/upstash/redis'
import { logger } from '@repo/logs'

const uploadRoute = new Hono()

// Initialize GCS client
const gcsClient = createGCSClient({
  projectId: process.env.GCS_PROJECT_ID!,
  keyFilename: process.env.GCS_KEY_FILE!,
})

// Request schema
const signedUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string(),
  userId: z.string(),
})

uploadRoute.post(
  '/signed-url',
  zValidator('json', signedUrlSchema),
  async (c: Context) => {
    try {
      const { fileName, contentType, userId } = c.req.valid('json')

      // Generate signed upload URL using GCS package
      const { signedUrl, filePath, uniqueFileName } = await getSignedUploadUrl(
        gcsClient,
        process.env.GCS_BUCKET_NAME!,
        {
          organizationId: userId, // Using userId as organizationId for simplicity
          fileName,
          contentType,
        }
      )

      // Generate file ID
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2)}`

      // Store file metadata in Redis
      await redis.set(`file:${fileId}:metadata`, {
        fileId,
        fileName,
        uniqueFileName,
        filePath,
        userId,
        contentType,
        status: 'pending_upload',
        createdAt: new Date().toISOString(),
      })

      // Add to user's file list
      await redis.sadd(`user:${userId}:files`, fileId)

      logger.info(`Generated signed URL for file: ${fileName}`)

      return c.json({
        signedUrl,
        fileId,
        filePath,
        expiresIn: 900, // 15 minutes in seconds
      })
    } catch (error) {
      logger.error('Error generating signed URL:', error)
      return c.json({ error: 'Failed to generate upload URL' }, 500)
    }
  }
)

export { uploadRoute }
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.4: Mistral OCR Integration

**Description:** Extract text content from uploaded files using Mistral OCR with retry logic and confidence scoring

**Subtasks:**
- [ ] Create OCR processing function with Mistral SDK
- [ ] Implement retry logic (3 attempts with exponential backoff)
- [ ] Handle PDF, images, and document formats (DOCX, PPTX)
- [ ] Calculate OCR confidence score
- [ ] Return clean Markdown output with page breaks
- [ ] Include base64 images in response
- [ ] Cache OCR results temporarily

**Critical Code - Mistral OCR with Retry Logic:**
```typescript
// apps/server/src/lib/ocr/mistral-ocr.ts

// ** import types
import type { OcrResult } from '@/types/ocr'

// ** import lib
import { Mistral } from '@mistralai/mistralai'

// ** import utils
import { logger } from '@repo/logs'

const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
})

interface RetryOptions {
  maxAttempts: number
  baseDelay: number // milliseconds
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 2000, // 2 seconds
}

/**
 * Extract text from document using Mistral OCR with retry logic
 * Supports: PDF, images, DOCX, PPTX
 */
export async function extractTextWithMistralOCR(
  fileUrl: string,
  retryOptions: RetryOptions = DEFAULT_RETRY_OPTIONS
): Promise<OcrResult> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
    try {
      logger.info(`Mistral OCR attempt ${attempt}/${retryOptions.maxAttempts}`)

      const response = await mistral.chat.complete({
        model: 'mistral-ocr-latest',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'document_url',
                documentUrl: fileUrl,
              },
            ],
          },
        ],
        includeImageBase64: true,
        timeout: 300000, // 5 minutes for large files
      })

      // Extract markdown from response
      const markdown = response.choices?.[0]?.message?.content || ''

      // Calculate confidence score
      const confidence = calculateOCRConfidence(markdown, response)

      return {
        markdown,
        confidence,
        pageCount: countPages(markdown),
        tokenUsage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
        },
      }
    } catch (error) {
      lastError = error as Error
      logger.error(`Mistral OCR attempt ${attempt} failed:`, error)

      // If not the last attempt, wait before retrying
      if (attempt < retryOptions.maxAttempts) {
        const delay = retryOptions.baseDelay * Math.pow(2, attempt - 1)
        logger.info(`Retrying in ${delay}ms...`)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  // All attempts failed
  throw new Error(
    `Mistral OCR failed after ${retryOptions.maxAttempts} attempts: ${lastError?.message}`
  )
}

/**
 * Calculate OCR confidence score based on content quality indicators
 * Returns: 0-100 confidence score
 */
function calculateOCRConfidence(markdown: string, response: any): number {
  let confidence = 70 // Base confidence

  // Boost for technical terms (study materials often have specific terminology)
  const technicalTerms = /(\b[A-Z]{2,}\b|[a-z]+ology|[a-z]+tion)/g
  const technicalMatches = markdown.match(technicalTerms)
  if (technicalMatches && technicalMatches.length > 10) {
    confidence += 5
  }

  // Boost for structured content (checkboxes, dates, numbers)
  if (/\[\s*[xX✓]\s*\]/.test(markdown)) confidence += 3 // Checkboxes
  if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(markdown)) confidence += 2 // Dates
  if (/\d+\.?\d*\s*(mg|ml|g|kg)/.test(markdown)) confidence += 3 // Dosages/measurements

  // Boost for markdown formatting (indicates structure preservation)
  if (/^#{1,6}\s+/m.test(markdown)) confidence += 5 // Headers
  if (/\n-\s+|\n\d+\.\s+/.test(markdown)) confidence += 3 // Lists

  // Token usage ratio (quality indicator)
  const tokenUsage = response.usage
  if (tokenUsage) {
    const ratio = tokenUsage.completionTokens / (tokenUsage.promptTokens || 1)
    if (ratio > 0.5) confidence += 5
  }

  // Penalties
  if (markdown.length < 100) confidence -= 10 // Too short
  if (/[�\uFFFD]/.test(markdown)) confidence -= 5 // Replacement characters (OCR artifacts)

  return Math.min(100, Math.max(0, confidence))
}

/**
 * Count pages by looking for page break markers
 */
function countPages(markdown: string): number {
  const pageBreaks = markdown.match(/---\s*page\s*\d+\s*---/gi)
  return pageBreaks ? pageBreaks.length : 1
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.5: Text Chunking Logic

**Description:** Split extracted text into semantic chunks for embedding

**Subtasks:**
- [ ] Create recursive text splitter
- [ ] Respect Markdown structure (headers, paragraphs)
- [ ] Configure chunk size and overlap
- [ ] Preserve metadata per chunk

**Critical Code - Chunker:**
```typescript
// apps/server/src/lib/chunker/text-chunker.ts

// ** import types
import type { TextChunk } from '@/types/chunk'

interface ChunkerOptions {
  chunkSize: number      // Target characters per chunk
  chunkOverlap: number   // Overlap between chunks
  separators: string[]   // Priority order for splitting
}

const DEFAULT_OPTIONS: ChunkerOptions = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ['\n## ', '\n### ', '\n\n', '\n', '. ', ' '],
}

export function chunkText(
  text: string,
  fileId: string,
  options: Partial<ChunkerOptions> = {}
): TextChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const chunks: TextChunk[] = []
  
  // Split by headers first to preserve topic structure
  const sections = text.split(/(?=\n#{1,3} )/g)
  
  let chunkIndex = 0
  
  for (const section of sections) {
    if (section.length <= opts.chunkSize) {
      chunks.push({
        id: `${fileId}_chunk_${chunkIndex}`,
        content: section.trim(),
        fileId,
        chunkIndex,
      })
      chunkIndex++
    } else {
      // Recursively split large sections
      const subChunks = splitRecursively(section, opts)
      for (const subChunk of subChunks) {
        chunks.push({
          id: `${fileId}_chunk_${chunkIndex}`,
          content: subChunk.trim(),
          fileId,
          chunkIndex,
        })
        chunkIndex++
      }
    }
  }
  
  return chunks
}

function splitRecursively(text: string, opts: ChunkerOptions): string[] {
  // Implementation: try each separator in order
  // Return array of chunks under chunkSize
  // ... (detailed implementation)
  return [text] // Placeholder
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.6: Gemini Embedding Generation

**Description:** Generate vector embeddings for text chunks using Gemini

**Subtasks:**
- [ ] Create embedding utility function
- [ ] Batch process chunks efficiently
- [ ] Handle rate limiting
- [ ] Store embeddings in Upstash Vector

**Critical Code - Embedding:**
```typescript
// apps/server/src/lib/embedding/gemini-embed.ts

// ** import types
import type { TextChunk } from '@/types/chunk'

// ** import lib
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: 'embedding-001' })
  
  const result = await model.embedContent(text)
  
  return result.embedding.values
}

export async function generateEmbeddingsForChunks(
  chunks: TextChunk[]
): Promise<Array<{ chunk: TextChunk; embedding: number[] }>> {
  const results: Array<{ chunk: TextChunk; embedding: number[] }> = []
  
  // Process in batches of 10 to respect rate limits
  const batchSize = 10
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    
    const embeddings = await Promise.all(
      batch.map(chunk => generateEmbedding(chunk.content))
    )
    
    batch.forEach((chunk, idx) => {
      results.push({ chunk, embedding: embeddings[idx] })
    })
    
    // Small delay between batches
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  
  return results
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.7: Knowledge Graph Generation

**Description:** Generate knowledge graph from text using Gemini LLM

**Subtasks:**
- [ ] Create graph extraction prompt
- [ ] Use `generateObject` for structured output
- [ ] Normalize node IDs (lowercase, singular)
- [ ] Store graph in Redis as JSON

**Critical Code - Graph Generator:**
```typescript
// apps/server/src/lib/graph/graph-generator.ts

// ** import types
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@/types/graph'

// ** import lib
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

const graphSchema = z.object({
  nodes: z.array(z.object({
    id: z.string().describe('Lowercase, normalized concept ID'),
    label: z.string().describe('Human-readable label'),
    type: z.enum(['concept', 'process', 'detail', 'example', 'term']),
  })),
  edges: z.array(z.object({
    source: z.string().describe('Source node ID'),
    target: z.string().describe('Target node ID'),
    relation: z.string().describe('Relationship type: "is a", "includes", "causes", etc.'),
  })),
})

export async function generateGraphFromText(
  text: string,
  fileId: string
): Promise<KnowledgeGraph> {
  const { object } = await generateObject({
    model: google('gemini-1.5-flash'),
    schema: graphSchema,
    prompt: `
      Analyze the following study material and extract a knowledge graph.
      
      RULES:
      1. Node IDs must be lowercase with underscores (e.g., "cell_division")
      2. Keep nodes simple and focused on key concepts
      3. Create edges that show clear relationships
      4. Limit to 10-15 nodes per chunk for clarity
      
      TEXT:
      ${text}
    `,
  })

  // Normalize all IDs to lowercase
  const normalizedNodes = object.nodes.map(node => ({
    ...node,
    id: node.id.toLowerCase().replace(/\s+/g, '_'),
  }))

  const normalizedEdges = object.edges.map(edge => ({
    ...edge,
    source: edge.source.toLowerCase().replace(/\s+/g, '_'),
    target: edge.target.toLowerCase().replace(/\s+/g, '_'),
    sources: [fileId], // Track which files contribute to this edge
  }))

  return {
    nodes: normalizedNodes,
    edges: normalizedEdges,
  }
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.8: Graph Merger (Incremental Updates)

**Description:** Merge new graph data with existing graph without regenerating everything

**Subtasks:**
- [ ] Implement ID collision detection
- [ ] Merge nodes by normalized ID
- [ ] Track edge sources for deletion logic
- [ ] Handle orphan node cleanup

**Critical Code - Graph Merger:**
```typescript
// apps/server/src/lib/graph/graph-merger.ts

// ** import types
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@/types/graph'

// ** import lib
import { redis } from '@/lib/upstash/redis'

interface MergeResult {
  nodesAdded: number
  nodesUpdated: number
  edgesAdded: number
  edgesUpdated: number
}

export async function mergeGraphIntoMain(
  userId: string,
  newGraph: KnowledgeGraph,
  fileId: string
): Promise<MergeResult> {
  const graphKey = `user:${userId}:graph`
  
  // Fetch existing graph from Redis
  const existingGraph = await redis.get<KnowledgeGraph>(graphKey) || {
    nodes: [],
    edges: [],
  }

  const result: MergeResult = {
    nodesAdded: 0,
    nodesUpdated: 0,
    edgesAdded: 0,
    edgesUpdated: 0,
  }

  // Create lookup maps
  const nodeMap = new Map<string, GraphNode>()
  existingGraph.nodes.forEach(node => nodeMap.set(node.id, node))

  const edgeMap = new Map<string, GraphEdge>()
  existingGraph.edges.forEach(edge => {
    const key = `${edge.source}|${edge.target}|${edge.relation}`
    edgeMap.set(key, edge)
  })

  // Merge new nodes
  for (const newNode of newGraph.nodes) {
    if (nodeMap.has(newNode.id)) {
      result.nodesUpdated++
      // Optionally update metadata
    } else {
      nodeMap.set(newNode.id, newNode)
      result.nodesAdded++
    }
  }

  // Merge new edges (with source tracking)
  for (const newEdge of newGraph.edges) {
    const key = `${newEdge.source}|${newEdge.target}|${newEdge.relation}`
    
    // Ensure both nodes exist
    if (!nodeMap.has(newEdge.source) || !nodeMap.has(newEdge.target)) {
      continue
    }

    if (edgeMap.has(key)) {
      // Edge exists - add this file to sources
      const existing = edgeMap.get(key)!
      if (!existing.sources.includes(fileId)) {
        existing.sources.push(fileId)
      }
      result.edgesUpdated++
    } else {
      edgeMap.set(key, { ...newEdge, sources: [fileId] })
      result.edgesAdded++
    }
  }

  // Save merged graph
  const mergedGraph: KnowledgeGraph = {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  }

  await redis.set(graphKey, mergedGraph)

  return result
}

// Remove file contribution from graph (for deletion)
export async function removeFileFromGraph(
  userId: string,
  fileId: string
): Promise<void> {
  const graphKey = `user:${userId}:graph`
  const graph = await redis.get<KnowledgeGraph>(graphKey)
  
  if (!graph) return

  // Remove file from edge sources
  const updatedEdges = graph.edges
    .map(edge => ({
      ...edge,
      sources: edge.sources.filter(s => s !== fileId),
    }))
    .filter(edge => edge.sources.length > 0) // Remove orphan edges

  // Find nodes that still have connections
  const connectedNodes = new Set<string>()
  updatedEdges.forEach(edge => {
    connectedNodes.add(edge.source)
    connectedNodes.add(edge.target)
  })

  // Keep only connected nodes
  const updatedNodes = graph.nodes.filter(node => 
    connectedNodes.has(node.id)
  )

  await redis.set(graphKey, {
    nodes: updatedNodes,
    edges: updatedEdges,
  })
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.9: Complete Ingestion Pipeline Orchestrator

**Description:** Create the main ingestion route that orchestrates the entire pipeline

**Subtasks:**
- [ ] Create `/api/ingest` endpoint
- [ ] Chain: OCR → Chunk → Embed → Graph → Store
- [ ] Track processing status
- [ ] Handle errors gracefully

**API Flow:**
```
POST /api/ingest
  └─> Fetch file from GCS
  └─> Mistral OCR (extract text)
  └─> Chunk text
  └─> Generate embeddings (Gemini)
  └─> Store in Upstash Vector
  └─> Generate knowledge graph (Gemini)
  └─> Merge graph into Redis
  └─> Return success
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 1.10: File Deletion with Cascade Cleanup

**Description:** Implement file deletion with proper data cleanup

**Subtasks:**
- [ ] Delete file from GCS
- [ ] Delete vectors by `file_id` filter
- [ ] Remove file contribution from graph
- [ ] Clean up orphan nodes
- [ ] Delete file metadata from Redis

**Critical Code - Cascade Delete:**
```typescript
// apps/server/src/routes/files/delete-file.ts

// ** import lib
import { vectorIndex } from '@/lib/upstash/vector'
import { redis } from '@/lib/upstash/redis'
import { removeFileFromGraph } from '@/lib/graph/graph-merger'
import { Storage } from '@google-cloud/storage'

export async function deleteFile(userId: string, fileId: string) {
  // 1. Delete from Vector DB (filter by file_id)
  await vectorIndex.delete({
    filter: `fileId = '${fileId}'`,
  })

  // 2. Remove from Knowledge Graph
  await removeFileFromGraph(userId, fileId)

  // 3. Delete from GCS
  const storage = new Storage()
  const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)
  await bucket.deleteFiles({ prefix: `users/${userId}/${fileId}/` })

  // 4. Remove file metadata
  await redis.del(`file:${fileId}:metadata`)
  await redis.srem(`user:${userId}:files`, fileId)

  return { success: true, deletedFileId: fileId }
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

# Phase II: Runtime Voice Interaction Backend

> **Goal:** Build the Custom LLM endpoint that 11Labs will call for every conversation turn

---

## Task 2.1: OpenAI-Compatible Chat Endpoint

**Description:** Create the main `/v1/chat/completions` endpoint that mimics OpenAI's API

**Subtasks:**
- [ ] Create route with OpenAI-compatible request/response schema
- [ ] Validate 11Labs secret key
- [ ] Parse messages array
- [ ] Return proper format for 11Labs

**Critical Code - Endpoint Structure:**
```typescript
// apps/server/src/routes/v1/chat/completions.ts

// ** import types
import type { Context } from 'hono'
import type { ChatMessage, ChatCompletionResponse } from '@/types/openai'

// ** import lib
import { Hono } from 'hono'

const chatRoute = new Hono()

chatRoute.post('/completions', async (c: Context) => {
  // 1. Verify 11Labs Secret
  const authHeader = c.req.header('authorization')
  if (authHeader !== `Bearer ${process.env.ELEVENLABS_AGENT_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json()
  const messages: ChatMessage[] = body.messages
  const userId = body.user_id || 'default'

  // Extract latest user message
  const userMessage = messages
    .filter(m => m.role === 'user')
    .pop()?.content || ''

  // ... (RAG pipeline - next tasks)

  // Return OpenAI-compatible response
  const response: ChatCompletionResponse = {
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'echo-learn-v1',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: 'Response text here',
      },
      finish_reason: 'stop',
    }],
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
  }

  return c.json(response)
})

export { chatRoute }
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 2.2: RAG Context Retrieval

**Description:** Search Vector DB and retrieve relevant knowledge chunks

**Subtasks:**
- [ ] Convert user query to embedding
- [ ] Search Upstash Vector for similar chunks
- [ ] Format chunks as context string
- [ ] Limit context to avoid token overflow

**Critical Code - RAG Search:**
```typescript
// apps/server/src/lib/rag/retrieve-context.ts

// ** import lib
import { generateEmbedding } from '@/lib/embedding/gemini-embed'
import { searchVectors } from '@/lib/upstash/vector'

interface RetrievedContext {
  chunks: string[]
  sources: string[]
}

export async function retrieveContext(
  query: string,
  userId: string,
  topK: number = 5
): Promise<RetrievedContext> {
  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query)

  // 2. Search Vector DB
  const results = await searchVectors(queryEmbedding, topK)

  // 3. Extract content and sources
  const chunks: string[] = []
  const sources: string[] = []

  for (const result of results) {
    if (result.metadata?.content) {
      chunks.push(result.metadata.content as string)
    }
    if (result.metadata?.fileId) {
      sources.push(result.metadata.fileId as string)
    }
  }

  return { chunks, sources: [...new Set(sources)] }
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 2.3: User Profile & Learning State

**Description:** Manage user's learning progress in Redis

**Subtasks:**
- [ ] Create user profile schema
- [ ] Track covered topics
- [ ] Track weak/strong areas
- [ ] Store session history

**Critical Code - User Profile:**
```typescript
// apps/server/src/lib/user/profile.ts

// ** import types
import type { UserProfile } from '@/types/user'

// ** import lib
import { redis } from '@/lib/upstash/redis'

const DEFAULT_PROFILE: UserProfile = {
  level: 'beginner',
  weakAreas: [],
  strongAreas: [],
  coveredTopics: [],
  questionsAnswered: 0,
  lastInteraction: null,
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const profile = await redis.get<UserProfile>(`user:${userId}:profile`)
  return profile || DEFAULT_PROFILE
}

export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>
): Promise<void> {
  const current = await getUserProfile(userId)
  const updated = { ...current, ...updates }
  await redis.set(`user:${userId}:profile`, updated)
}

export async function markTopicCovered(
  userId: string,
  topics: string[]
): Promise<void> {
  for (const topic of topics) {
    await redis.sadd(`user:${userId}:covered`, topic)
  }
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 2.4: System Prompt Builder

**Description:** Construct dynamic system prompt with context and user profile

**Subtasks:**
- [ ] Create base tutor persona prompt
- [ ] Inject retrieved knowledge chunks
- [ ] Add user profile context
- [ ] Include interruption handling rules

**Critical Code - Prompt Builder:**
```typescript
// apps/server/src/lib/prompt/system-prompt.ts

// ** import types
import type { UserProfile } from '@/types/user'

interface PromptContext {
  knowledgeChunks: string[]
  userProfile: UserProfile
}

export function buildSystemPrompt(context: PromptContext): string {
  const { knowledgeChunks, userProfile } = context

  return `
You are a patient, encouraging study partner and tutor called Echo.

## Knowledge Context (from user's uploaded materials):
${knowledgeChunks.join('\n\n---\n\n')}

## User's Learning Profile:
- Level: ${userProfile.level}
- Weak Areas: ${userProfile.weakAreas.join(', ') || 'None identified yet'}
- Strong Areas: ${userProfile.strongAreas.join(', ') || 'None identified yet'}
- Topics Covered: ${userProfile.coveredTopics.length} topics

## Your Behavior:
1. Use ONLY the knowledge context above to answer questions
2. Adapt explanations to user's level
3. If they struggle, offer simpler explanations
4. Periodically ask if they want to be quizzed
5. When quizzing, generate questions based on the knowledge context
6. Be encouraging and supportive

## Response Format:
- Keep responses conversational (this will be spoken aloud)
- Use short sentences
- Pause naturally with "..." for emphasis
- Avoid bullet points or markdown (voice doesn't read those well)

## Interruption Handling:
- If the user says "Stop" or "Wait", acknowledge it briefly ("Okay, I'll pause.")
- If the user says "Continue" or "Go on", check your last message in history
- Resume from where you were interrupted with a transition like "As I was saying..."
`.trim()
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 2.5: Gemini Response Generation (Streaming)

**Description:** Call Gemini to generate response with streaming for low latency

**Subtasks:**
- [ ] Implement streaming text generation
- [ ] Handle conversation history
- [ ] Return stream to 11Labs
- [ ] Track token usage

**Critical Code - Streaming Response:**
```typescript
// apps/server/src/lib/llm/generate-response.ts

// ** import types
import type { ChatMessage } from '@/types/openai'

// ** import lib
import { google } from '@ai-sdk/google'
import { streamText } from 'ai'

interface GenerateOptions {
  systemPrompt: string
  messages: ChatMessage[]
}

export async function generateStreamingResponse(options: GenerateOptions) {
  const { systemPrompt, messages } = options

  const result = await streamText({
    model: google('gemini-1.5-flash'),
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  return result
}

// Non-streaming version for simpler cases
export async function generateResponse(options: GenerateOptions): Promise<string> {
  const { systemPrompt, messages } = options

  const { text } = await generateText({
    model: google('gemini-1.5-flash'),
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  })

  return text
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 2.6: Analytics & Progress Tracking

**Description:** Update user analytics after each conversation turn

**Subtasks:**
- [ ] Extract topics from conversation
- [ ] Update covered topics
- [ ] Detect weak areas from quiz failures
- [ ] Store interaction history

**Critical Code - Analytics Update:**
```typescript
// apps/server/src/lib/analytics/update-analytics.ts

// ** import lib
import { redis } from '@/lib/upstash/redis'
import { updateUserProfile, markTopicCovered } from '@/lib/user/profile'

interface AnalyticsData {
  userId: string
  query: string
  response: string
  retrievedChunks: string[]
  topicsDiscussed: string[]
}

export async function updateAnalytics(data: AnalyticsData): Promise<void> {
  const { userId, query, response, retrievedChunks, topicsDiscussed } = data

  // Mark topics as covered
  if (topicsDiscussed.length > 0) {
    await markTopicCovered(userId, topicsDiscussed)
  }

  // Update question count
  const profile = await redis.get(`user:${userId}:profile`) || {}
  await updateUserProfile(userId, {
    questionsAnswered: (profile.questionsAnswered || 0) + 1,
    lastInteraction: new Date().toISOString(),
  })

  // Store interaction for history
  await redis.lpush(`user:${userId}:interactions`, {
    timestamp: Date.now(),
    query,
    responseLength: response.length,
    topicsDiscussed,
  })

  // Trim history to last 100 interactions
  await redis.ltrim(`user:${userId}:interactions`, 0, 99)
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 2.7: Complete Chat Endpoint Integration

**Description:** Wire all components together in the main chat endpoint

**Subtasks:**
- [ ] Integrate RAG retrieval
- [ ] Add user profile fetch
- [ ] Build system prompt
- [ ] Generate streaming response
- [ ] Update analytics async
- [ ] Return OpenAI-compatible response

**Critical Code - Full Endpoint:**
```typescript
// apps/server/src/routes/v1/chat/completions.ts (complete)

// ** import lib
import { retrieveContext } from '@/lib/rag/retrieve-context'
import { getUserProfile } from '@/lib/user/profile'
import { buildSystemPrompt } from '@/lib/prompt/system-prompt'
import { generateResponse } from '@/lib/llm/generate-response'
import { updateAnalytics } from '@/lib/analytics/update-analytics'

chatRoute.post('/completions', async (c) => {
  // Auth check...
  const body = await c.req.json()
  const messages = body.messages
  const userId = body.user_id || 'default'
  const userMessage = messages.filter(m => m.role === 'user').pop()?.content || ''

  // 1. Retrieve relevant context
  const { chunks, sources } = await retrieveContext(userMessage, userId)

  // 2. Get user profile
  const profile = await getUserProfile(userId)

  // 3. Build system prompt
  const systemPrompt = buildSystemPrompt({
    knowledgeChunks: chunks,
    userProfile: profile,
  })

  // 4. Generate response
  const responseText = await generateResponse({
    systemPrompt,
    messages,
  })

  // 5. Update analytics (async, don't block response)
  updateAnalytics({
    userId,
    query: userMessage,
    response: responseText,
    retrievedChunks: chunks,
    topicsDiscussed: [], // Extract from response
  }).catch(console.error)

  // 6. Return OpenAI-compatible response
  return c.json({
    id: `chatcmpl-${Date.now()}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: 'echo-learn-v1',
    choices: [{
      index: 0,
      message: { role: 'assistant', content: responseText },
      finish_reason: 'stop',
    }],
    usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  })
})
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

# Phase III: Frontend & 11Labs Integration

> **Goal:** Build the TanStack Start frontend with 11Labs voice widget and knowledge visualization

---

## Task 3.1: Frontend Project Setup

**Description:** Configure TanStack Start app with required dependencies

**Subtasks:**
- [ ] Initialize TanStack Start project
- [ ] Install React Flow for graph visualization
- [ ] Install 11Labs Convai SDK
- [ ] Set up Tailwind CSS
- [ ] Configure API client

**Dependencies:**
```json
{
  "@tanstack/start": "latest",
  "@tanstack/react-router": "latest",
  "@11labs/react": "latest",
  "@xyflow/react": "latest",
  "tailwindcss": "latest",
  "axios": "latest"
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.2: File Upload Component

**Description:** Create drag-and-drop file upload UI

**Subtasks:**
- [ ] Create dropzone component
- [ ] Show upload progress
- [ ] Handle multiple file types
- [ ] Display uploaded files list

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.3: 11Labs Voice Widget Integration

**Description:** Embed 11Labs conversational widget

**Subtasks:**
- [ ] Create voice toggle component
- [ ] Connect to custom agent
- [ ] Handle connection state
- [ ] Show speaking/listening indicators

**Critical Code - 11Labs Widget:**
```typescript
// apps/web/src/components/voice/VoiceWidget.tsx

// ** import lib
import { useConversation } from '@11labs/react'

export function VoiceWidget({ agentId }: { agentId: string }) {
  const conversation = useConversation({
    agentId,
    onConnect: () => console.log('Connected'),
    onDisconnect: () => console.log('Disconnected'),
    onMessage: (message) => console.log('Message:', message),
    onError: (error) => console.error('Error:', error),
  })

  const handleStart = async () => {
    await conversation.startSession({
      // Custom user context if needed
    })
  }

  const handleStop = async () => {
    await conversation.endSession()
  }

  return (
    <div className="voice-widget">
      <button
        onClick={conversation.status === 'connected' ? handleStop : handleStart}
        className={`mic-button ${conversation.status}`}
      >
        {conversation.status === 'connected' ? '🔴 Stop' : '🎙️ Start'}
      </button>
      
      {conversation.isSpeaking && (
        <div className="speaking-indicator">AI is speaking...</div>
      )}
    </div>
  )
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.4: Knowledge Graph Visualization

**Description:** Display knowledge graph using React Flow

**Subtasks:**
- [ ] Fetch graph data from API
- [ ] Transform graph to React Flow format
- [ ] Add zoom/pan controls
- [ ] Highlight covered topics

**Critical Code - Graph Visualization:**
```typescript
// apps/web/src/components/graph/KnowledgeGraph.tsx

// ** import lib
import { ReactFlow, Background, Controls } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

// ** import types
import type { KnowledgeGraph } from '@/types/graph'

interface Props {
  graph: KnowledgeGraph
  coveredTopics: string[]
}

export function KnowledgeGraphView({ graph, coveredTopics }: Props) {
  // Transform to React Flow format
  const nodes = graph.nodes.map((node, idx) => ({
    id: node.id,
    position: { x: idx * 150, y: Math.random() * 300 },
    data: { label: node.label },
    style: {
      backgroundColor: coveredTopics.includes(node.id) 
        ? '#4ade80' // Green for covered
        : '#f3f4f6', // Gray for uncovered
    },
  }))

  const edges = graph.edges.map(edge => ({
    id: `${edge.source}-${edge.target}`,
    source: edge.source,
    target: edge.target,
    label: edge.relation,
    animated: true,
  }))

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <ReactFlow nodes={nodes} edges={edges} fitView>
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  )
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.5: Progress Dashboard

**Description:** Show user's learning progress and analytics

**Subtasks:**
- [ ] Display coverage percentage
- [ ] Show weak/strong areas
- [ ] Display recent topics
- [ ] Add session history

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.6: Main App Layout & Routing

**Description:** Create the main application layout with navigation

**Subtasks:**
- [ ] Create app shell with sidebar
- [ ] Set up TanStack Start routing and SSR
- [ ] Create pages: Home, Upload, Study, Progress
- [ ] Add loading states

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.7: 11Labs Agent Configuration

**Description:** Configure the 11Labs agent to use your custom LLM

**11Labs Agent Config (via Dashboard or API):**
```json
{
  "name": "Echo Learn Study Partner",
  "conversation": {
    "first_message": "Hello! I'm Echo, your study partner. I've read through your materials and I'm ready to help you learn. What would you like to explore today?",
    "model": {
      "type": "custom_llm",
      "url": "https://your-api-domain.com/v1/chat/completions",
      "model_id": "echo-learn-v1",
      "api_key": {
        "secret_key": "YOUR_ELEVENLABS_AGENT_SECRET"
      }
    }
  },
  "voice": {
    "voice_id": "your-preferred-voice-id",
    "stability": 0.7,
    "similarity_boost": 0.8
  }
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.8: End-to-End Testing

**Description:** Test complete flow from upload to voice conversation

**Test Scenarios:**
- [ ] Upload PDF → Verify vectors created
- [ ] Ask question → Verify RAG retrieval
- [ ] Interrupt mid-response → Verify resume works
- [ ] Delete file → Verify cleanup
- [ ] Check graph updates after new upload

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

# Development Workflow Rules

## Import Organization Guidelines

**CRITICAL:** Follow strict import organization pattern for ALL TypeScript files:

```typescript
// ** import types
import type { TypeName } from '@/types/module'

// ** import core packages
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

// ** import database
import { db, table } from '@repo/db'

// ** import middleware
import { authMiddleware } from '@/middleware/auth'

// ** import schema
import { createSchema } from '@/schema/create.schema'

// ** import validation
import { z } from 'zod'

// ** import utils
import { logger } from '@repo/logs'
import { createGCSClient } from '@repo/gcs'

// ** import apis
import { apiFunction } from '@/api/module'

// ** import constants
import { CONSTANT_VALUE } from './constants'

// ** import styles
import '@/entrypoints/style.css'
```

**Rules:**
1. Always add 1 line space between different import sections
2. Use exact comment format: `// ** import [category]` (all lowercase)
3. Group related imports under the same comment section
4. Order from abstract to concrete: types → core packages → database → middleware → schema → validation → utils → apis → constants → styles
5. No additional descriptive text in comments
6. Only include categories that are actually used in the file

---

## After Each Task Completion:

1. **Run Validation Suite:**
   ```bash
   # Type check
   bun run turbo typecheck

   # Build check
   bun run turbo build

   # Lint check
   bun run turbo lint
   ```

2. **Mark Task Complete:**
   - Return to this document
   - Check off completed subtasks
   - Check off main task checkbox

3. **Commit Changes:**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Proceed to Next Task:**
   - Only after all three checks pass
   - Only after TODO is marked complete

---

# Quick Reference: Critical Code Snippets

## Vector DB Injection
```typescript
await vectorIndex.upsert([{
  id: 'chunk_id',
  vector: embeddingArray,
  metadata: { content: 'text', fileId: 'file_123' }
}])
```

## Embedding Generation
```typescript
const model = genAI.getGenerativeModel({ model: 'embedding-001' })
const result = await model.embedContent(text)
return result.embedding.values
```

## Graph Merger (ID Normalization)
```typescript
const normalizedId = node.id.toLowerCase().replace(/\s+/g, '_')
if (nodeMap.has(normalizedId)) { /* merge */ } else { /* add */ }
```

## 11Labs Custom LLM Connection
```json
{
  "model": {
    "type": "custom_llm",
    "url": "https://api.example.com/v1/chat/completions"
  }
}
```

## Memory Graph Storage (Redis)
```typescript
await redis.set(`user:${userId}:graph`, {
  nodes: [...],
  edges: [{ source, target, relation, sources: [fileId] }]
})
```

---

# Summary

| Phase | Focus | Tasks | Key Deliverables |
|-------|-------|-------|------------------|
| **I** | Ingestion | 1.1 - 1.10 | Upload, OCR, Chunk, Embed, Graph |
| **II** | Runtime | 2.1 - 2.7 | Chat API, RAG, Streaming, Analytics |
| **III** | Frontend | 3.1 - 3.8 | Voice Widget, Graph View, Dashboard |

**Total Tasks:** 25

**Stack:**
- **Runtime:** Bun (Development & Production)
- **Monorepo:** Turborepo + Bun workspaces
- **Frontend:** TanStack Start + TypeScript
- **Backend:** Hono.js + TypeScript + Bun
- **Storage:** Upstash Vector + Redis
- **Files:** Google Cloud Storage (@repo/gcs package)
- **LLM:** Gemini 1.5 Flash (LLM & Embeddings)
- **OCR:** Mistral OCR (with retry logic & confidence scoring)
- **Voice:** 11Labs Conversational AI
- **Logging:** @repo/logs package
- **TypeScript Config:** @repo/typescript-config package

**Key Architectural Patterns:**
- Reusable package architecture (@repo/* packages)
- Strict import organization guidelines
- TypeScript strict mode across all packages
- Zod schema validation for API endpoints
- Environment-based configuration
- Centralized logging and error handling