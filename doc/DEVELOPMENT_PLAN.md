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
│  │  │ apps/web       │  │     │  • Gemini 2.0 Flash  │                      │
│  │  │ (TanStack Start)│  │     │    (LLM + OCR)       │                      │
│  │  └────────────────┘  │     │  • Google Cloud      │                      │
│  │                      │     │  • Upstash (Vector)  │                      │
│  │  ┌────────────────┐  │     │  • Upstash (Redis)   │                      │
│  │  │ apps/server    │  │     │                      │                      │
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

**AI & ML:**
- **Gemini 2.0 Flash** - Primary LLM for response generation, OCR, and embeddings
- **Multimodal Input** - PDF, Images, Documents via Gemini's native multimodal capabilities

**Why Bun:**
- Fast package installation and execution
- Native TypeScript support
- Built-in bundler and test runner
- Built-in workspace support (no need for separate package manager)
- Compatible with Node.js ecosystem
- Better performance for development workflows

---

## Pre-Development Checklist

### Environment Setup
- [x] Bun installed as primary runtime (`bun --version`)
- [x] Turbo Repo initialized with `apps/web` and `apps/server`
- [x] TypeScript strict mode enabled
- [x] ESLint + Prettier configured
- [x] Shared packages structure created

### External Service Accounts
- [ ] Google Cloud Project created
- [ ] Google Cloud Storage bucket created
- [ ] Gemini API key obtained (GOOGLE_GENERATIVE_AI_API_KEY)
- [ ] Upstash Vector database created
- [ ] Upstash Redis database created
- [ ] 11Labs account and Agent created
- [ ] 11Labs API key obtained

### Environment Variables Template
Create `.env` file with:
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

# Gemini (used for LLM, OCR, and Embeddings)
GOOGLE_GENERATIVE_AI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# 11Labs
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
ELEVENLABS_AGENT_SECRET=
```

### Package Dependencies Verification
- [ ] `@ai-sdk/google` installed in `@repo/llm`
- [ ] `@ai-sdk/google` installed in `@repo/ingest`
- [ ] `@google-cloud/storage` installed in `@repo/gcs`
- [ ] `@upstash/vector` installed in `@repo/storage`
- [ ] `@upstash/redis` installed in `@repo/storage`
- [ ] `@11labs/react` installed in `apps/web`

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

5. **`@repo/ingest`** - Document ingestion pipeline
   - Gemini multimodal OCR (replaces Mistral)
   - Text chunking
   - Supports PDF, images, and documents

6. **`@repo/llm`** - LLM utilities
   - Gemini response generation
   - Streaming support
   - Prompt building

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
import { extractTextWithGeminiOCR } from '@repo/ingest/ocr'

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

**Status:** ✅ COMPLETED

**Subtasks:**
- [x] Install Bun runtime globally
- [x] Initialize Turbo Repo with Bun workspaces
- [x] Create `apps/web` (TanStack Start + TypeScript)
- [x] Create `apps/server` (Hono.js + TypeScript + Bun runtime)
- [x] Create shared packages for reusability
- [x] Configure path aliases and tsconfig references
- [x] Set up TypeScript configuration inheritance

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
│   └── server/              # Hono.js backend (Bun runtime)
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
│   ├── ingest/              # Document ingestion (OCR, chunking)
│   │   ├── src/
│   │   │   ├── ocr/
│   │   │   │   ├── gemini-ocr.ts
│   │   │   │   └── index.ts
│   │   │   ├── chunker/
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   ├── llm/                 # LLM utilities
│   │   ├── src/
│   │   │   ├── generate.ts
│   │   │   ├── prompt/
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
├── bun.lock
└── package.json
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
- [x] Bun installed: `bun --version`
- [x] Type check: `bun run turbo typecheck`
- [x] Build check: `bun run turbo build`
- [x] Lint check: `bun run turbo lint`

---

## Task 1.2: Environment & External Service Configuration

**Description:** Configure all external service connections and create reusable package modules

**Subtasks:**
- [ ] Create `.env.example` with all required keys
- [ ] Create `@repo/gcs` package for Google Cloud Storage
- [ ] Create `@repo/logs` package for logging
- [ ] Set up Upstash Vector client in `@repo/storage`
- [ ] Set up Upstash Redis client in `@repo/storage`
- [ ] Set up Gemini AI SDK in `@repo/llm`
- [ ] Set up Gemini OCR in `@repo/ingest`

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

# Gemini (All-in-one: LLM, OCR, Embeddings)
GOOGLE_GENERATIVE_AI_API_KEY=
GEMINI_MODEL=gemini-2.0-flash

# 11Labs (for later phases)
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_ID=
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
// packages/storage/src/vector.ts

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
// packages/storage/src/redis.ts

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
- [ ] Support multimodal formats: PDF, TXT, MD, PPT, DOCX, PPTX, PNG, JPG, JPEG, WEBP, GIF

**Supported File Types (Multimodal):**
| Category | Extensions | MIME Types |
|----------|------------|------------|
| Documents | PDF | application/pdf |
| Documents | DOCX | application/vnd.openxmlformats-officedocument.wordprocessingml.document |
| Documents | PPTX | application/vnd.openxmlformats-officedocument.presentationml.presentation |
| Documents | TXT | text/plain |
| Documents | MD | text/markdown |
| Images | PNG | image/png |
| Images | JPG/JPEG | image/jpeg |
| Images | WEBP | image/webp |
| Images | GIF | image/gif |
| Images | TIFF | image/tiff |

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
import { redis } from '@repo/storage'
import { logger } from '@repo/logs'

const uploadRoute = new Hono()

// Initialize GCS client
const gcsClient = createGCSClient({
  projectId: process.env.GCS_PROJECT_ID!,
  keyFilename: process.env.GCS_KEY_FILE!,
})

// Supported file types for multimodal OCR
const SUPPORTED_CONTENT_TYPES = [
  // Documents
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  // Images
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'image/tiff',
]

// Request schema
const signedUrlSchema = z.object({
  fileName: z.string().min(1),
  contentType: z.string().refine(
    (ct) => SUPPORTED_CONTENT_TYPES.includes(ct),
    { message: 'Unsupported file type for OCR processing' }
  ),
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
          organizationId: userId,
          fileName,
          contentType,
        }
      )

      // Generate file ID
      const fileId = `file_${Date.now()}_${Math.random().toString(36).slice(2)}`

      // Determine file category
      const isImage = contentType.startsWith('image/')
      const fileCategory = isImage ? 'image' : 'document'

      // Store file metadata in Redis
      await redis.set(`file:${fileId}:metadata`, {
        fileId,
        fileName,
        uniqueFileName,
        filePath,
        userId,
        contentType,
        fileCategory,
        status: 'pending_upload',
        createdAt: new Date().toISOString(),
      })

      // Add to user's file list
      await redis.sadd(`user:${userId}:files`, fileId)

      logger.info(`Generated signed URL for file: ${fileName}`, {
        fileCategory,
        contentType,
      })

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

## Task 1.4: Gemini 2.0 Flash Multimodal OCR

**Description:** Extract text content from uploaded files using Gemini 2.0 Flash with native multimodal support. This replaces Mistral OCR with a unified Gemini-based approach.

**Why Gemini 2.0 Flash for OCR:**
- Native multimodal support (images, PDFs, documents)
- Single API for both OCR and LLM tasks
- Faster processing with Flash model
- Better context understanding
- No need for separate OCR service

**Subtasks:**
- [ ] Create Gemini OCR processing function with multimodal input
- [ ] Implement retry logic (3 attempts with exponential backoff)
- [ ] Handle all multimodal formats: PDF, images, DOCX, PPTX
- [ ] Calculate OCR confidence score
- [ ] Return clean Markdown output with page structure
- [ ] Extract and preserve images from documents
- [ ] Cache OCR results temporarily

**Supported Input Types:**
| Type | Gemini Part Type | Notes |
|------|------------------|-------|
| PDF | `fileData` with mimeType | Native PDF support |
| Images | `inlineData` or `fileData` | PNG, JPEG, WEBP, GIF, TIFF |
| DOCX/PPTX | `fileData` | Via Google Cloud Storage URL |

**Critical Code - Gemini 2.0 Flash Multimodal OCR:**
```typescript
// packages/ingest/src/ocr/gemini-ocr.ts

// ** import types
import type { OcrResult, OcrOptions } from "@repo/shared";
import type { Part } from "@google/generative-ai";

// ** import lib
import { GoogleGenerativeAI } from "@google/generative-ai";

// ** import utils
import { logger } from "@repo/logs";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// Default model for OCR - Gemini 2.0 Flash has excellent multimodal capabilities
const OCR_MODEL = "gemini-2.0-flash";

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine content type from file extension or URL
 */
function getMimeType(fileUrl: string): string {
  const cleanUrl = fileUrl.split("?")[0].toLowerCase();
  const extension = cleanUrl.split(".").pop();
  
  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    tiff: "image/tiff",
    tif: "image/tiff",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    md: "text/markdown",
  };

  return mimeTypes[extension || ""] || "application/octet-stream";
}

/**
 * Check if file type is an image
 */
function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Fetch file and convert to base64 for inline data
 */
async function fetchFileAsBase64(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

/**
 * Build the OCR extraction prompt based on file type
 */
function buildOcrPrompt(mimeType: string): string {
  const isImage = isImageType(mimeType);
  
  if (isImage) {
    return `
You are an expert OCR system. Extract ALL text content from this image with high accuracy.

OUTPUT FORMAT:
- Return the extracted text as clean Markdown
- Preserve the visual hierarchy using Markdown headers (# ## ###)
- Preserve lists, tables, and formatting where possible
- If there are diagrams or charts, describe them in [brackets]
- For handwritten text, do your best to transcribe accurately
- Mark uncertain text with [?]

IMPORTANT:
- Extract EVERY piece of text visible in the image
- Maintain the logical reading order
- Preserve paragraph breaks
- Do not add any commentary or explanations, only the extracted content
`.trim();
  }

  return `
You are an expert document OCR and extraction system. Extract ALL text content from this document with high accuracy.

OUTPUT FORMAT:
- Return the extracted text as clean Markdown
- Preserve document structure with appropriate Markdown headers
- Maintain the original hierarchy (titles, sections, subsections)
- Preserve lists (bulleted and numbered)
- Preserve tables in Markdown table format
- Mark page breaks with: --- PAGE BREAK ---
- For images/figures in the document, add: [Figure: brief description]
- For charts/diagrams, add: [Chart: brief description]

IMPORTANT:
- Extract EVERY piece of text from the document
- Maintain the logical reading order
- Preserve all formatting cues
- Do not add any commentary, only the extracted content
- If multiple pages, process all pages
`.trim();
}

/**
 * Extract text from document using Gemini 2.0 Flash with multimodal capabilities
 * Supports: PDF, images (PNG, JPEG, WEBP, GIF, TIFF), DOCX, PPTX
 */
export async function extractTextWithGeminiOCR(
  fileUrl: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const startTime = Date.now();
  const fileName = fileUrl.split("/").pop()?.split("?")[0] || "unknown-file";
  const mimeType = getMimeType(fileUrl);

  try {
    logger.info("Starting OCR processing with Gemini 2.0 Flash", {
      fileName,
      mimeType,
      fileUrl: fileUrl.substring(0, 50) + "...",
    });

    const maxRetries = options.maxAttempts || 3;
    const baseDelay = options.baseDelay || 2000;
    let lastError: Error | null = null;
    let extractedText = "";

    // Get the model
    const model = genAI.getGenerativeModel({ 
      model: OCR_MODEL,
      generationConfig: {
        temperature: 0.1, // Low temperature for accurate extraction
        maxOutputTokens: 8192,
      },
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`OCR attempt ${attempt} of ${maxRetries}`, {
          fileName,
          attempt,
        });

        // Build the content parts for multimodal input
        const parts: Part[] = [];

        // Add the file as inline data or file reference
        if (isImageType(mimeType)) {
          // For images, use inline base64 data
          const base64Data = await fetchFileAsBase64(fileUrl);
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        } else {
          // For documents (PDF, DOCX, PPTX), use file data
          // Note: For GCS URLs, Gemini can access them directly if public
          // For signed URLs or private files, we need to fetch and send as base64
          const base64Data = await fetchFileAsBase64(fileUrl);
          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        }

        // Add the extraction prompt
        parts.push({
          text: buildOcrPrompt(mimeType),
        });

        // Generate content with multimodal input
        const result = await model.generateContent(parts);
        const response = result.response;
        extractedText = response.text();

        if (extractedText && extractedText.length > 0) {
          logger.info("Gemini OCR extraction successful", {
            fileName,
            attempt,
            textLength: extractedText.length,
          });
          break;
        } else {
          throw new Error("No text extracted from document");
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn(`OCR attempt ${attempt} failed`, {
          fileName,
          attempt,
          maxRetries,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          const delayMs = baseDelay * Math.pow(2, attempt - 1);
          logger.info(`Retrying OCR in ${delayMs}ms`, { fileName });
          await sleep(delayMs);
        }
      }
    }

    if (!extractedText || extractedText.length === 0) {
      throw new Error(
        `Failed to extract text after ${maxRetries} attempts. ` +
        `Last error: ${lastError?.message || "Unknown error"}`
      );
    }

    // Calculate page count from page break markers
    const pageBreaks = extractedText.match(/---\s*PAGE\s*BREAK\s*---/gi);
    const pageCount = pageBreaks ? pageBreaks.length + 1 : 1;

    // Calculate confidence score
    const confidence = calculateOCRConfidence(extractedText, mimeType);

    // Build result
    const result: OcrResult = {
      markdown: extractedText,
      confidence,
      pageCount,
      tokenUsage: {
        promptTokens: 0, // Gemini doesn't expose this in basic API
        completionTokens: 0,
      },
    };

    const processingTimeMs = Date.now() - startTime;

    logger.info("Gemini OCR processing completed successfully", {
      fileName,
      mimeType,
      textLength: extractedText.length,
      confidence,
      pageCount,
      processingTimeMs,
    });

    return result;
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    logger.error("Gemini OCR processing failed", {
      fileName,
      mimeType,
      processingTimeMs,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Calculate OCR confidence score based on content quality indicators
 */
function calculateOCRConfidence(markdown: string, mimeType: string): number {
  let confidence = 70; // Base confidence

  // Boost for technical terms (study materials often have specific terminology)
  const technicalTerms = /(\b[A-Z]{2,}\b|[a-z]+ology|[a-z]+tion)/g;
  const technicalMatches = markdown.match(technicalTerms);
  if (technicalMatches && technicalMatches.length > 10) {
    confidence += 5;
  }

  // Boost for structured content
  if (/\[\s*[xX✓]\s*\]/.test(markdown)) confidence += 3; // Checkboxes
  if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(markdown)) confidence += 2; // Dates
  if (/\d+\.?\d*\s*(mg|ml|g|kg|cm|mm|m|km)/.test(markdown)) confidence += 3; // Measurements

  // Boost for markdown formatting (indicates structure preservation)
  if (/^#{1,6}\s+/m.test(markdown)) confidence += 5; // Headers
  if (/\n-\s+|\n\d+\.\s+/.test(markdown)) confidence += 3; // Lists
  if (/\|.*\|.*\|/.test(markdown)) confidence += 3; // Tables
  if (/```[\s\S]*?```/.test(markdown)) confidence += 3; // Code blocks

  // Content length checks
  if (markdown.length < 100) confidence -= 20; // Too short
  if (markdown.length < 500) confidence -= 10;
  if (markdown.length > 1000) confidence += 5;
  if (markdown.length > 5000) confidence += 5;

  // Penalties for OCR artifacts
  if (/[�]/.test(markdown)) confidence -= 10; // Replacement characters
  if (/[^\x00-\x7F]{10,}/.test(markdown)) confidence -= 5; // Long non-ASCII sequences

  // Bonus for images (multimodal processing)
  if (isImageType(mimeType)) {
    confidence += 5; // Gemini excels at image understanding
  }

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Check if a file type is supported by Gemini multimodal OCR
 */
export function isSupportedFileType(contentType: string): boolean {
  const supportedTypes = [
    // Documents
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Images
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/tiff",
  ];

  return supportedTypes.includes(contentType);
}

/**
 * Get file extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
  const extensionMap: Record<string, string> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/tiff": "tiff",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",
    "text/markdown": "md",
  };

  return extensionMap[contentType] || "bin";
}
```

**Package.json Update for @repo/ingest:**
```json
{
  "name": "@repo/ingest",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "import": "./src/index.ts",
      "types": "./src/index.ts"
    },
    "./ocr": {
      "import": "./src/ocr/index.ts",
      "types": "./src/ocr/index.ts"
    },
    "./chunker": {
      "import": "./src/chunker/index.ts",
      "types": "./src/chunker/index.ts"
    }
  },
  "scripts": {
    "check-types": "tsc --noEmit"
  },
  "dependencies": {
    "@repo/shared": "workspace:*",
    "@repo/logs": "workspace:*",
    "@google/generative-ai": "^0.21.0"
  },
  "devDependencies": {
    "@repo/typescript-config": "workspace:*",
    "typescript": "^5.7.2"
  }
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
// packages/ingest/src/chunker/text-chunker.ts

// ** import types
import type { TextChunk } from '@repo/shared'

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
  if (text.length <= opts.chunkSize) {
    return [text]
  }

  // Try each separator in order
  for (const separator of opts.separators) {
    const parts = text.split(separator)
    if (parts.length > 1) {
      const result: string[] = []
      let current = ''
      
      for (const part of parts) {
        const potentialChunk = current ? current + separator + part : part
        
        if (potentialChunk.length <= opts.chunkSize) {
          current = potentialChunk
        } else {
          if (current) {
            result.push(current)
          }
          current = part
        }
      }
      
      if (current) {
        result.push(current)
      }
      
      return result.flatMap(chunk => 
        chunk.length > opts.chunkSize 
          ? splitRecursively(chunk, opts) 
          : [chunk]
      )
    }
  }

  // Fallback: hard split at chunkSize
  const result: string[] = []
  for (let i = 0; i < text.length; i += opts.chunkSize - opts.chunkOverlap) {
    result.push(text.slice(i, i + opts.chunkSize))
  }
  return result
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
// packages/llm/src/embedding.ts

// ** import types
import type { TextChunk } from '@repo/shared'

// ** import lib
import { GoogleGenerativeAI } from '@google/generative-ai'

// ** import utils
import { logger } from '@repo/logs'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!)

// Use text-embedding model for embeddings
const EMBEDDING_MODEL = 'text-embedding-004'

export async function generateEmbedding(text: string): Promise<number[]> {
  const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
  
  const result = await model.embedContent(text)
  
  return result.embedding.values
}

export async function generateEmbeddingsForChunks(
  chunks: TextChunk[]
): Promise<Array<{ chunk: TextChunk; embedding: number[] }>> {
  const results: Array<{ chunk: TextChunk; embedding: number[] }> = []
  
  // Process in batches of 10 to respect rate limits
  const batchSize = 10
  
  logger.info(`Generating embeddings for ${chunks.length} chunks`)
  
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize)
    
    const embeddings = await Promise.all(
      batch.map(chunk => generateEmbedding(chunk.content))
    )
    
    batch.forEach((chunk, idx) => {
      results.push({ chunk, embedding: embeddings[idx] })
    })
    
    // Small delay between batches to avoid rate limiting
    if (i + batchSize < chunks.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    logger.info(`Processed ${Math.min(i + batchSize, chunks.length)}/${chunks.length} chunks`)
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
// packages/graph/src/graph-generator.ts

// ** import types
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@repo/shared'

// ** import lib
import { google } from '@ai-sdk/google'
import { generateObject } from 'ai'
import { z } from 'zod'

// ** import utils
import { logger } from '@repo/logs'

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
  logger.info('Generating knowledge graph from text', { 
    textLength: text.length,
    fileId 
  })

  const { object } = await generateObject({
    model: google('gemini-2.0-flash'),
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

  logger.info('Knowledge graph generated', {
    nodeCount: normalizedNodes.length,
    edgeCount: normalizedEdges.length,
  })

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
// packages/graph/src/graph-merger.ts

// ** import types
import type { KnowledgeGraph, GraphNode, GraphEdge } from '@repo/shared'

// ** import lib
import { redis } from '@repo/storage'

// ** import utils
import { logger } from '@repo/logs'

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
      const existing = edgeMap.get(key)!
      if (!existing.sources?.includes(fileId)) {
        existing.sources = [...(existing.sources || []), fileId]
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

  logger.info('Graph merged successfully', { userId, ...result })

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
      sources: (edge.sources || []).filter(s => s !== fileId),
    }))
    .filter(edge => (edge.sources?.length || 0) > 0)

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

  logger.info('File removed from graph', { userId, fileId })
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
  └─> Gemini 2.0 Flash OCR (extract text - multimodal)
  └─> Chunk text
  └─> Generate embeddings (Gemini)
  └─> Store in Upstash Vector
  └─> Generate knowledge graph (Gemini)
  └─> Merge graph into Redis
  └─> Return success
```

**Critical Code - Ingestion Orchestrator:**
```typescript
// apps/server/src/routes/ingest/process.ts

// ** import types
import type { Context } from 'hono'

// ** import lib
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

// ** import utils
import { extractTextWithGeminiOCR } from '@repo/ingest/ocr'
import { chunkText } from '@repo/ingest/chunker'
import { generateEmbeddingsForChunks } from '@repo/llm'
import { generateGraphFromText } from '@repo/graph'
import { mergeGraphIntoMain } from '@repo/graph'
import { upsertVectors, redis } from '@repo/storage'
import { logger } from '@repo/logs'

const ingestRoute = new Hono()

const ingestSchema = z.object({
  fileId: z.string(),
  userId: z.string(),
  fileUrl: z.string().url(),
})

ingestRoute.post(
  '/process',
  zValidator('json', ingestSchema),
  async (c: Context) => {
    const { fileId, userId, fileUrl } = c.req.valid('json')

    try {
      // Update status to processing
      await redis.set(`file:${fileId}:status`, {
        status: 'processing',
        step: 'ocr',
        startedAt: new Date().toISOString(),
      })

      logger.info('Starting ingestion pipeline', { fileId, userId })

      // Step 1: OCR with Gemini 2.0 Flash (multimodal)
      const ocrResult = await extractTextWithGeminiOCR(fileUrl)
      
      await redis.set(`file:${fileId}:status`, {
        status: 'processing',
        step: 'chunking',
        ocrConfidence: ocrResult.confidence,
      })

      // Step 2: Chunk the extracted text
      const chunks = chunkText(ocrResult.markdown, fileId)
      
      await redis.set(`file:${fileId}:status`, {
        status: 'processing',
        step: 'embedding',
        chunkCount: chunks.length,
      })

      // Step 3: Generate embeddings
      const embeddedChunks = await generateEmbeddingsForChunks(chunks)

      // Step 4: Store in Vector DB
      await upsertVectors(
        embeddedChunks.map(({ chunk, embedding }) => ({
          id: chunk.id,
          vector: embedding,
          metadata: {
            content: chunk.content,
            fileId: chunk.fileId,
            chunkIndex: chunk.chunkIndex,
            userId,
          },
        }))
      )

      await redis.set(`file:${fileId}:status`, {
        status: 'processing',
        step: 'graph',
      })

      // Step 5: Generate knowledge graph
      const graph = await generateGraphFromText(ocrResult.markdown, fileId)

      // Step 6: Merge into user's main graph
      const mergeResult = await mergeGraphIntoMain(userId, graph, fileId)

      // Step 7: Update status to completed
      await redis.set(`file:${fileId}:status`, {
        status: 'completed',
        completedAt: new Date().toISOString(),
        stats: {
          pageCount: ocrResult.pageCount,
          confidence: ocrResult.confidence,
          chunkCount: chunks.length,
          nodesAdded: mergeResult.nodesAdded,
          edgesAdded: mergeResult.edgesAdded,
        },
      })

      logger.info('Ingestion pipeline completed', { 
        fileId, 
        userId,
        chunkCount: chunks.length,
        graphStats: mergeResult,
      })

      return c.json({
        success: true,
        fileId,
        stats: {
          pageCount: ocrResult.pageCount,
          confidence: ocrResult.confidence,
          chunkCount: chunks.length,
          graphStats: mergeResult,
        },
      })
    } catch (error) {
      logger.error('Ingestion pipeline failed', { fileId, error })

      await redis.set(`file:${fileId}:status`, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        failedAt: new Date().toISOString(),
      })

      return c.json({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Processing failed' 
      }, 500)
    }
  }
)

export { ingestRoute }
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
import { vectorIndex, redis } from '@repo/storage'
import { removeFileFromGraph } from '@repo/graph'
import { deleteFileByUrl } from '@repo/gcs'

// ** import utils
import { logger } from '@repo/logs'

export async function deleteFile(userId: string, fileId: string) {
  logger.info('Starting file deletion', { userId, fileId })

  // 1. Get file metadata
  const metadata = await redis.get<{ filePath: string }>(`file:${fileId}:metadata`)

  // 2. Delete from Vector DB (filter by file_id)
  await vectorIndex.deleteMany({
    filter: `fileId = '${fileId}'`,
  })

  // 3. Remove from Knowledge Graph
  await removeFileFromGraph(userId, fileId)

  // 4. Delete from GCS
  if (metadata?.filePath) {
    await deleteFileByUrl(metadata.filePath)
  }

  // 5. Remove file metadata and status
  await redis.del(`file:${fileId}:metadata`)
  await redis.del(`file:${fileId}:status`)
  await redis.srem(`user:${userId}:files`, fileId)

  logger.info('File deletion completed', { userId, fileId })

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
import type { ChatMessage, ChatCompletionResponse } from '@repo/shared'

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
// packages/rag/src/retrieve-context.ts

// ** import types
import type { RetrievedContext } from '@repo/shared'

// ** import lib
import { generateEmbedding } from '@repo/llm'
import { searchVectors } from '@repo/storage'

// ** import utils
import { logger } from '@repo/logs'

export async function retrieveContext(
  query: string,
  userId: string,
  topK: number = 5
): Promise<RetrievedContext> {
  logger.info('Retrieving context for query', { queryLength: query.length, topK })

  // 1. Generate query embedding
  const queryEmbedding = await generateEmbedding(query)

  // 2. Search Vector DB with user filter
  const results = await searchVectors(queryEmbedding, topK, {
    filter: `userId = '${userId}'`,
  })

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

  logger.info('Context retrieved', { 
    chunkCount: chunks.length, 
    uniqueSources: [...new Set(sources)].length 
  })

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
// packages/analytics/src/user-profile.ts

// ** import types
import type { UserProfile } from '@repo/shared'

// ** import lib
import { redis } from '@repo/storage'

// ** import utils
import { logger } from '@repo/logs'

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
  logger.info('User profile updated', { userId })
}

export async function markTopicCovered(
  userId: string,
  topics: string[]
): Promise<void> {
  for (const topic of topics) {
    await redis.sadd(`user:${userId}:covered`, topic)
  }
  logger.info('Topics marked as covered', { userId, topicCount: topics.length })
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
// packages/llm/src/prompt/system-prompt.ts

// ** import types
import type { UserProfile } from '@repo/shared'

export interface PromptContext {
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
- If the user says "Continue" or "Go on", resume from where you were interrupted
`.trim()
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 2.5: Gemini Response Generation (Streaming)

**Description:** Call Gemini 2.0 Flash to generate response with streaming for low latency

**Subtasks:**
- [ ] Implement streaming text generation
- [ ] Handle conversation history
- [ ] Return stream to 11Labs
- [ ] Track token usage

**Note:** This is already implemented in `@repo/llm` package (see `packages/llm/src/generate.ts`).

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
// packages/analytics/src/update-analytics.ts

// ** import lib
import { redis } from '@repo/storage'
import { updateUserProfile, markTopicCovered } from './user-profile.js'

// ** import utils
import { logger } from '@repo/logs'

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
  const profile = await redis.get<{ questionsAnswered?: number }>(`user:${userId}:profile`) || {}
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

  logger.info('Analytics updated', { userId, topicsCount: topicsDiscussed.length })
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
import { Hono } from 'hono'
import { retrieveContext } from '@repo/rag'
import { getUserProfile } from '@repo/analytics'
import { buildSystemPrompt, generateResponse } from '@repo/llm'
import { updateAnalytics } from '@repo/analytics'

// ** import utils
import { logger } from '@repo/logs'

const chatRoute = new Hono()

chatRoute.post('/completions', async (c) => {
  // Auth check
  const authHeader = c.req.header('authorization')
  if (authHeader !== `Bearer ${process.env.ELEVENLABS_AGENT_SECRET}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const body = await c.req.json()
  const messages = body.messages
  const userId = body.user_id || 'default'
  const userMessage = messages.filter((m: any) => m.role === 'user').pop()?.content || ''

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
    topicsDiscussed: [],
  }).catch((err) => logger.error('Analytics update failed', err))

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

export { chatRoute }
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

**Status:** ✅ COMPLETED (apps/web exists)

**Subtasks:**
- [x] Initialize TanStack Start project
- [ ] Install React Flow for graph visualization
- [ ] Install 11Labs Convai SDK
- [x] Set up Tailwind CSS
- [ ] Configure API client

**Dependencies:**
```json
{
  "@tanstack/start": "latest",
  "@tanstack/react-router": "latest",
  "@11labs/react": "latest",
  "@xyflow/react": "latest",
  "tailwindcss": "latest"
}
```

**✅ Validation Checklist:**
- [ ] Type check: `bun run turbo typecheck`
- [ ] Build check: `bun run turbo build`
- [ ] Lint check: `bun run turbo lint`

---

## Task 3.2: File Upload Component

**Description:** Create drag-and-drop file upload UI with multimodal support

**Subtasks:**
- [ ] Create dropzone component
- [ ] Show upload progress
- [ ] Handle multiple file types (PDF, images, documents)
- [ ] Display uploaded files list
- [ ] Show processing status

**Supported Upload Types:**
- PDF documents
- Images (PNG, JPEG, WEBP, GIF, TIFF)
- Office documents (DOCX, PPTX)
- Text files (TXT, MD)

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
    await conversation.startSession({})
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
- [ ] Upload PDF → Verify OCR with Gemini 2.0 Flash
- [ ] Upload Image → Verify multimodal extraction
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
import type { TypeName } from '@repo/shared'

// ** import core packages
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'

// ** import storage
import { redis, vectorIndex } from '@repo/storage'

// ** import middleware
import { authMiddleware } from '@/middleware/auth'

// ** import schema
import { createSchema } from '@/schema/create.schema'

// ** import validation
import { z } from 'zod'

// ** import utils
import { logger } from '@repo/logs'
import { createGCSClient } from '@repo/gcs'
import { extractTextWithGeminiOCR } from '@repo/ingest/ocr'

// ** import constants
import { CONSTANT_VALUE } from './constants'
```

**Rules:**
1. Always add 1 line space between different import sections
2. Use exact comment format: `// ** import [category]` (all lowercase)
3. Group related imports under the same comment section
4. Order from abstract to concrete: types → core → storage → middleware → schema → validation → utils → constants
5. Only include categories that are actually used in the file

---

## After Each Task Completion:

1. **Run Validation Suite:**
   ```bash
   bun run turbo typecheck
   bun run turbo build
   bun run turbo lint
   ```

2. **Mark Task Complete:**
   - Check off completed subtasks
   - Check off main task checkbox

3. **Commit Changes:**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

4. **Proceed to Next Task:**
   - Only after all three checks pass

---

# Quick Reference: Critical Code Snippets

## Gemini OCR (Multimodal)
```typescript
import { extractTextWithGeminiOCR } from '@repo/ingest/ocr'

const result = await extractTextWithGeminiOCR(fileUrl)
// Works with: PDF, PNG, JPEG, WEBP, GIF, TIFF, DOCX, PPTX
```

## Vector DB Injection
```typescript
await vectorIndex.upsert([{
  id: 'chunk_id',
  vector: embeddingArray,
  metadata: { content: 'text', fileId: 'file_123', userId: 'user_1' }
}])
```

## Embedding Generation
```typescript
import { generateEmbedding } from '@repo/llm'
const embedding = await generateEmbedding(text)
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

---

# Summary

| Phase | Focus | Tasks | Key Deliverables |
|-------|-------|-------|------------------|
| **I** | Ingestion | 1.1 - 1.10 | Upload, Gemini OCR, Chunk, Embed, Graph |
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
- **LLM & OCR:** Gemini 2.0 Flash (unified for LLM, OCR, and Embeddings)
- **Voice:** 11Labs Conversational AI
- **Logging:** @repo/logs package

**Key Changes from Original Plan:**
- ✅ Replaced Mistral OCR with Gemini 2.0 Flash multimodal OCR
- ✅ Added full multimodal support (PDF, images, documents)
- ✅ Unified all AI operations under Gemini 2.0 Flash
- ✅ Updated Pre-Development Checklist with detailed steps
- ✅ Removed Mistral dependency

**Multimodal Input Support:**
| Format | Support | Notes |
|--------|---------|-------|
| PDF | ✅ | Native Gemini support |
| PNG | ✅ | Image OCR |
| JPEG | ✅ | Image OCR |
| WEBP | ✅ | Image OCR |
| GIF | ✅ | Image OCR |
| TIFF | ✅ | Image OCR |
| DOCX | ✅ | Document extraction |
| PPTX | ✅ | Presentation extraction |
| TXT | ✅ | Direct text |
| MD | ✅ | Markdown passthrough |