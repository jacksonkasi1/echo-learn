# Echo-Learn

> **Voice AI Study Partner** - A conversational learning system using 11Labs voice interface with custom RAG backend

## Overview

Echo-Learn is an AI-powered study companion that helps students learn from their uploaded materials through natural voice conversations. It uses a custom LLM backend with RAG (Retrieval Augmented Generation) to provide contextual, personalized tutoring.

## Architecture

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
│  │  │ (TanStack Start)│  │     │  • Mistral (OCR)     │                      │
│  │  └────────────────┘  │     │  • Google Cloud      │                      │
│  │                      │     │  • Upstash (Vector)  │                      │
│  │  ┌────────────────┐  │     │  • Upstash (Redis)   │                      │
│  │  │ apps/server    │  │     │                      │                      │
│  │  │ (Hono.js)      │  │     └──────────────────────┘                      │
│  │  └────────────────┘  │                                                   │
│  │                      │                                                   │
│  │  ┌────────────────┐  │                                                   │
│  │  │ packages/      │  │                                                   │
│  │  │ shared, gcs,   │  │                                                   │
│  │  │ logs           │  │                                                   │
│  │  └────────────────┘  │                                                   │
│  └──────────────────────┘                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technology Stack

- **Runtime:** Bun
- **Build System:** Turborepo
- **Backend:** Hono.js
- **Frontend:** TanStack Start (React)
- **Voice AI:** 11Labs
- **LLM:** Google Gemini
- **OCR:** Mistral
- **Vector DB:** Upstash Vector
- **Cache/State:** Upstash Redis
- **File Storage:** Google Cloud Storage

## Project Structure

```
echo-learn/
├── apps/
│   ├── web/                    # TanStack Start frontend
│   └── server/                 # Hono.js backend API
│       ├── src/
│       │   ├── routes/         # API endpoints
│       │   │   ├── upload/     # File upload handling
│       │   │   ├── ingest/     # Document processing pipeline
│       │   │   ├── files/      # File management
│       │   │   └── v1/chat/    # OpenAI-compatible chat endpoint
│       │   ├── lib/
│       │   │   ├── upstash/    # Vector & Redis clients
│       │   │   ├── ocr/        # Mistral OCR integration
│       │   │   ├── chunker/    # Text chunking logic
│       │   │   ├── embedding/  # Gemini embeddings
│       │   │   ├── graph/      # Knowledge graph generation
│       │   │   ├── rag/        # RAG context retrieval
│       │   │   ├── llm/        # LLM response generation
│       │   │   ├── prompt/     # System prompt building
│       │   │   └── analytics/  # Progress tracking
│       │   └── index.ts        # Main server entry
│       └── package.json
│
├── packages/
│   ├── gcs/                    # Google Cloud Storage utilities
│   ├── logs/                   # Structured logging
│   ├── shared/                 # Shared types & utilities
│   ├── typescript-config/      # Shared TS configurations
│   └── eslint-config/          # Shared ESLint configs
│
├── turbo.json
├── package.json
└── .env.example
```

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0 or later)
- Google Cloud Platform account
- Upstash account
- Mistral API key
- Google Gemini API key
- 11Labs account (for voice features)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/your-org/echo-learn.git
cd echo-learn
```

2. Install dependencies:
```bash
bun install
```

3. Copy the environment template:
```bash
cp .env.example .env
```

4. Configure your environment variables in `.env`

5. Run the development server:
```bash
bun run dev
```

## API Endpoints

### File Upload
- `POST /api/upload/signed-url` - Get signed URL for file upload
- `POST /api/upload/confirm` - Confirm upload completion

### Document Processing
- `POST /api/ingest` - Process uploaded file through the ingestion pipeline
- `GET /api/ingest/status/:fileId` - Get processing status

### File Management
- `GET /api/files` - List user's files
- `GET /api/files/:fileId` - Get file details
- `DELETE /api/files` - Delete file with cascade cleanup

### Chat (OpenAI-Compatible for 11Labs)
- `POST /v1/chat/completions` - Chat completion endpoint
- `GET /v1/chat/completions/health` - Health check

## Ingestion Pipeline

The document processing pipeline:

1. **Upload** - File uploaded to Google Cloud Storage via signed URL
2. **OCR** - Text extraction using Mistral OCR (supports PDF, images, DOCX, PPTX)
3. **Chunking** - Semantic text splitting with overlap
4. **Embedding** - Vector embeddings generated via Gemini
5. **Vector Storage** - Chunks stored in Upstash Vector
6. **Graph Generation** - Knowledge graph extracted using Gemini
7. **Graph Merge** - New knowledge merged into user's main graph

## Environment Variables

See `.env.example` for all required environment variables:

- `UPSTASH_VECTOR_REST_URL` / `UPSTASH_VECTOR_REST_TOKEN`
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`
- `GCS_BUCKET_NAME` / `GCS_PROJECT_ID` / `GCS_KEY_FILE`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `MISTRAL_API_KEY`
- `ELEVENLABS_API_KEY` / `ELEVENLABS_AGENT_SECRET`

## Development

### Type Checking
```bash
bun run check-types
```

### Linting
```bash
bun run lint
```

### Building
```bash
bun run build
```

## License

MIT