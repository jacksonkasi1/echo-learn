# Echo-Learn RAG Improvement Plan

> **Goal:** Transform the current basic RAG system into a production-grade knowledge retrieval system that provides deep, comprehensive answers comparable to uploading PDFs directly to Gemini/ChatGPT.

---

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Phase 1: Quick Wins](#phase-1-quick-wins-immediate-impact)
3. [Phase 2: Upstash Hybrid Index](#phase-2-upstash-hybrid-index-built-in-bm25)
4. [Phase 3: Cohere Re-Ranking](#phase-3-cohere-re-ranking)
5. [Phase 4: Query Enhancement](#phase-4-query-enhancement)
6. [Phase 5: Contextual Compression](#phase-5-contextual-compression)
7. [Phase 6: Advanced Chunking](#phase-6-advanced-chunking)
8. [Phase 7: Agentic RAG](#phase-7-agentic-rag-advanced)
9. [Implementation Roadmap](#implementation-priority--roadmap)
10. [Package Architecture](#package-architecture)
11. [Configuration](#configuration-options)
12. [Monitoring](#monitoring--evaluation)

---

## Problem Analysis

### Current Issues Identified

Based on the logs and code analysis, the current RAG system has several limitations:

```
[INFO] Found 5 similar vectors
[INFO] Context retrieved successfully {"chunksFound":5,"uniqueSources":3,"avgScore":0.723756918}
```

| Issue | Current State | Impact |
|-------|---------------|--------|
| Limited Context | Only 5 chunks retrieved | Missing relevant information |
| Source Coverage | 3/5 uploaded sources used | Incomplete knowledge |
| Low Similarity Threshold | 0.72 avg score with 0.6 min | Moderate relevance |
| No Hybrid Search | Dense vectors only | Poor keyword matching |
| No Re-ranking | Single-pass retrieval | Sub-optimal ordering |
| Basic Chunking | Fixed 1000 chars | Loses semantic coherence |

---

## Phase 1: Quick Wins (Immediate Impact)

### 1.1 Increase Retrieval Parameters

**File:** `apps/server/src/routes/v1/chat/completions.ts`

| Parameter | Current | Recommended | Impact |
|-----------|---------|-------------|--------|
| `topK` | 5 | 15-20 | More context coverage |
| `minScore` | 0.6 | 0.4 | Include moderately relevant chunks |

### TODO List - Phase 1.1

- [x] Update `completions.ts` - change default `ragTopK` from 5 to 15
- [x] Update `completions.ts` - change default `ragMinScore` from 0.6 to 0.4
- [x] Update `retrieve-context.ts` - change `DEFAULT_OPTIONS.topK` from 5 to 15
- [x] Update `retrieve-context.ts` - change `DEFAULT_OPTIONS.minScore` from 0.7 to 0.4
- [x] Add environment variables for RAG configuration
- [ ] Test with existing uploaded documents
- [ ] Measure baseline improvement in response quality

**Estimated Effort:** 30 minutes  
**Expected Improvement:** 40-50% more relevant context

---

### 1.2 Dynamic Context Window Management

Instead of fixed `topK`, use a token budget approach.

### TODO List - Phase 1.2

- [x] Create new file `packages/rag/src/context-manager.ts`
- [x] Implement `ContextBudget` interface with `maxTokens`, `minChunks`, `maxChunks`
- [x] Implement `selectChunksWithBudget()` function
- [x] Add source diversity logic (ensure chunks from all uploaded files)
- [x] Integrate into `retrieve-context.ts`
- [ ] Add unit tests for context manager
- [ ] Update documentation

**Estimated Effort:** 2-3 hours  
**Expected Improvement:** Better context utilization

---

## Phase 2: Upstash Hybrid Index (Built-in BM25)

### Overview

Upstash Vector supports **Hybrid Indexes** that combine:
- **Dense vectors** (semantic similarity via embeddings)
- **Sparse vectors** (exact token matching via BM25)

This eliminates the need for client-side BM25 implementation!

### Upstash Hybrid Index Configuration

When creating the index in Upstash Console:
- **Type:** Hybrid
- **Dense Embedding Model:** **BAAI/bge-large-en-v1.5** (Built-in, 1024 dimensions)
- **Sparse Embedding Model:** BM25 (built-in)
- **Metric:** COSINE

*Note: We switched from Client-side Gemini embeddings to Upstash Server-side BAAI embeddings for simplicity and performance.*

### Fusion Algorithms Available

1. **RRF (Reciprocal Rank Fusion)** - Default, focuses on ranking order
2. **DBSF (Distribution-Based Score Fusion)** - Considers score distribution

### TODO List - Phase 2

- [x] **Upstash Setup**
  - [x] Create new Hybrid index in Upstash Console
  - [x] Configure Dense: BAAI/bge-large-en-v1.5 (Upstash Built-in)
  - [x] Configure Sparse: BM25
  - [x] Update environment variables with new index credentials

- [x] **Package: `@repo/storage/vector`** (updated existing)
  - [x] Add hybrid search types (FusionAlgorithm, QueryMode, HybridSearchOptions)
  - [x] Add `upsertWithEmbedding()` for server-side embedding generation
  - [x] Add `searchWithEmbedding()` for text-based hybrid search
  - [x] Add support for `fusionAlgorithm` option (RRF/DBSF)

- [x] **Update Ingestion Pipeline**
  - [x] Modify `apps/server/src/routes/ingest/process.ts`
  - [x] Removed client-side Gemini embedding generation
  - [x] Switched to `upsertWithEmbedding` (sends raw text to Upstash)
  - [x] Upstash handles BAAI embedding + BM25 generation automatically

- [x] **Update Retrieval Pipeline**
  - [x] Modify `packages/rag/src/retrieve-context.ts`
  - [x] Use hybrid query with fusion algorithm
  - [x] Switched to `searchWithEmbedding` (sends raw query text)
  - [x] Removed legacy client-side embedding logic

- [x] **Migration**
  - [x] Re-indexed all documents with new BAAI embeddings
  - [x] Verified hybrid search results with RRF scoring

### Code Example - Hybrid Query (TypeScript)

```typescript
import { searchWithEmbedding } from "@repo/storage";

// New "Upstash Native" Approach
// We just send the text, Upstash handles BAAI embedding + BM25 + RRF Fusion
const results = await searchWithEmbedding("What is the main topic?", {
  topK: 50,
  fusionAlgorithm: "RRF",
  includeMetadata: true,
  filter: "userId = 'user_123'"
});

// Returns sorted results based on Reciprocal Rank Fusion of:
// 1. Semantic Similarity (BAAI/bge-large-en-v1.5)
// 2. Keyword Matching (BM25)

// Then pass to Cohere for re-ranking
```

**Estimated Effort:** 6-8 hours  
**Expected Improvement:** 30-40% better keyword matching

---

## Phase 3: Cohere Re-Ranking

### Overview

After initial retrieval (hybrid search), use Cohere's re-ranking models to improve precision.

### Cohere Re-Rank Models

| Model | Description | Use Case |
|-------|-------------|----------|
| `rerank-v4.0-pro` | State-of-the-art, multilingual, 32K context | Complex use cases |
| `rerank-v4.0-fast` | Light version of pro | Low latency, high throughput |
| `rerank-v3.5` | Multilingual, 4K context | Good balance |
| `rerank-english-v3.0` | English only, 4K context | English-only apps |

**Recommended:** `rerank-v3.5` for balance of quality and cost, or `rerank-v4.0-fast` for production.

### Cohere Best Practices

1. **Document Chunking:** Cohere handles chunking internally (32K for v4, 4K for v3)
2. **Max Documents:** Up to 10,000 documents per request
3. **Score Interpretation:** Scores are normalized 0-1, use for ranking not absolute comparison
4. **Threshold Selection:** Test with 30-50 queries to find optimal threshold

### TODO List - Phase 3

- [x] **Package: `@repo/rerank`** (new package)
  - [x] Create `packages/rerank/package.json`
  - [x] Create `packages/rerank/src/index.ts` - main exports
  - [x] Create `packages/rerank/src/types.ts` - interfaces
  - [x] Create `packages/rerank/src/cohere.ts` - Cohere implementation
  - [x] Create `packages/rerank/src/gemini.ts` - Gemini fallback implementation
  - [x] Create `packages/rerank/src/factory.ts` - provider factory
  - [x] Add environment variable `RERANK_PROVIDER` (cohere/gemini)
  - [ ] Add `COHERE_API_KEY` to env template

- [x] **Cohere Integration**
  - [x] Install `cohere-ai` package in `@repo/rerank`
  - [x] Implement `rerankWithCohere()` function
  - [x] Handle rate limits and errors gracefully
  - [ ] Add retry logic with exponential backoff
  - [x] Log rerank latency for monitoring

- [x] **Gemini Fallback**
  - [x] Implement LLM-based re-ranking as fallback
  - [x] Use structured output for relevance scoring
  - [ ] Cache results where appropriate

- [ ] **Integration**
  - [ ] Modify `apps/server/src/lib/rag/retrieve-context.ts`
  - [ ] Add reranking step after hybrid retrieval
  - [ ] Make reranking optional via config flag
  - [ ] Return top N after reranking (e.g., top 10 from 30)

- [ ] **Testing**
  - [ ] Create test suite for reranking
  - [ ] Compare quality with/without reranking
  - [ ] Measure latency impact
  - [ ] Test with various query types

### Code Example - Cohere Re-Rank

```typescript
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({
  token: process.env.COHERE_API_KEY,
});

export async function rerankWithCohere(
  query: string,
  documents: string[],
  topN: number = 10
): Promise<Array<{ index: number; score: number }>> {
  const response = await cohere.rerank({
    model: "rerank-v3.5",
    query,
    documents,
    topN,
    returnDocuments: false,
  });

  return response.results.map((r) => ({
    index: r.index,
    score: r.relevanceScore,
  }));
}
```

**Estimated Effort:** 4-5 hours  
**Expected Improvement:** 25-35% better precision

---

## Phase 4: Query Enhancement

### 4.1 Multi-Query Retrieval (Fusion)

Generate multiple query variants to improve recall.

### TODO List - Phase 4.1

- [ ] **Package: `@repo/rag`** (new package)
  - [ ] Create `packages/rag/package.json`
  - [ ] Create `packages/rag/src/index.ts` - main exports
  - [ ] Create `packages/rag/src/query-expander.ts` - query expansion logic
  - [ ] Create `packages/rag/src/retriever.ts` - main retrieval orchestrator
  - [ ] Create `packages/rag/src/types.ts` - shared types

- [ ] **Query Expansion Implementation**
  - [ ] Use Gemini to generate 3-4 query variants
  - [ ] Include: rephrased, specific, broader, related concepts
  - [ ] Implement parallel retrieval for all variants
  - [ ] Merge and dedupe results
  - [ ] Apply reciprocal rank fusion or Cohere rerank

- [ ] **Integration**
  - [ ] Update `retrieve-context.ts` to use query expander
  - [ ] Add feature flag `RAG_ENABLE_QUERY_EXPANSION`
  - [ ] Add tests for query expansion

### 4.2 HyPE (Hypothetical Prompt Embeddings)

Pre-compute hypothetical questions for each chunk during ingestion.

### TODO List - Phase 4.2

- [ ] **Update Ingestion Pipeline**
  - [ ] Modify `apps/server/src/routes/ingest/process.ts`
  - [ ] After chunking, generate 3-5 hypothetical questions per chunk
  - [ ] Store questions with reference to parent chunk
  - [ ] Index both chunk content AND hypothetical questions

- [ ] **Package: `@repo/rag`**
  - [ ] Create `packages/rag/src/hype.ts` - HyPE implementation
  - [ ] Implement `generateHypotheticalQuestions()` function
  - [ ] Add batch processing for efficiency

- [ ] **Vector Storage Update**
  - [ ] Store chunks with `type: 'chunk'` metadata
  - [ ] Store questions with `type: 'question'` and `parentChunkId`
  - [ ] On retrieval, if question matches, return parent chunk content

**Estimated Effort:** 8-10 hours  
**Expected Improvement:** 40-50% better precision

---

## Phase 5: Contextual Compression

### Overview

Before sending to LLM, compress chunks to extract only query-relevant parts.

### TODO List - Phase 5

- [ ] **Package: `@repo/rag`**
  - [ ] Create `packages/rag/src/compressor.ts`
  - [ ] Implement `compressChunks()` function
  - [ ] Use Gemini Flash for fast compression
  - [ ] Filter out "NOT_RELEVANT" responses
  - [ ] Process chunks in parallel

- [ ] **Integration**
  - [ ] Add compression step after reranking
  - [ ] Make optional via `RAG_ENABLE_COMPRESSION` flag
  - [ ] Monitor token savings

- [ ] **Testing**
  - [ ] Compare response quality with/without compression
  - [ ] Measure latency impact
  - [ ] Test with various chunk sizes

**Estimated Effort:** 3-4 hours  
**Expected Improvement:** 20-30% better answer quality

---

## Phase 6: Advanced Chunking

### 6.1 Semantic Chunking

Replace fixed-size chunking with semantic-aware chunking.

### TODO List - Phase 6.1

- [ ] **Package: `@repo/chunker`** (move from server)
  - [ ] Create `packages/chunker/package.json`
  - [ ] Move `text-chunker.ts` to package
  - [ ] Create `packages/chunker/src/semantic.ts`
  - [ ] Implement sentence splitting
  - [ ] Implement embedding-based breakpoint detection
  - [ ] Add cosine similarity helper

- [ ] **Integration**
  - [ ] Update ingestion pipeline to use semantic chunking
  - [ ] Add feature flag `ENABLE_SEMANTIC_CHUNKING`
  - [ ] Benchmark against fixed-size chunking

### 6.2 Parent-Child Document Retrieval

Small chunks for retrieval, large chunks for context.

### TODO List - Phase 6.2

- [ ] **Package: `@repo/chunker`**
  - [ ] Create `packages/chunker/src/hierarchical.ts`
  - [ ] Implement parent chunk creation (2000 chars)
  - [ ] Implement child chunk creation (500 chars)
  - [ ] Store parent-child relationships in metadata

- [ ] **Vector Storage Update**
  - [ ] Index child chunks with `parentId` and `parentContent` metadata
  - [ ] On retrieval, return parent content instead of child

**Estimated Effort:** 8-10 hours  
**Expected Improvement:** 30-40% better context coherence

---

## Phase 7: Agentic RAG (Advanced)

### Overview

Let the LLM decide when it needs more context using tool calling.

### TODO List - Phase 7

- [ ] **Package: `@repo/rag`**
  - [ ] Create `packages/rag/src/agentic.ts`
  - [ ] Define `searchKnowledgeBase` tool
  - [ ] Implement iterative retrieval loop (max 3 iterations)
  - [ ] Handle tool call results

- [ ] **Integration**
  - [ ] Update chat completions endpoint
  - [ ] Add feature flag `RAG_ENABLE_AGENTIC`
  - [ ] Monitor iteration count and latency

- [ ] **Testing**
  - [ ] Test with complex multi-hop questions
  - [ ] Compare to single-pass retrieval
  - [ ] Monitor cost per query

**Estimated Effort:** 8-10 hours  
**Expected Improvement:** Significant for complex queries

---

## Implementation Priority & Roadmap

### Week 1: Foundation

| Task | Package | Effort | Priority |
|------|---------|--------|----------|
| Phase 1.1: Update retrieval params | server | 30 min | P0 |
| Phase 2: Create Upstash Hybrid Index | Upstash Console | 1 hr | P0 |
| Phase 2: Create `@repo/vector` package | packages/vector | 4 hrs | P0 |
| Phase 2: Update ingestion for hybrid | server | 2 hrs | P0 |

### Week 2: Re-Ranking

| Task | Package | Effort | Priority |
|------|---------|--------|----------|
| Phase 3: Create `@repo/rerank` package | packages/rerank | 3 hrs | P0 |
| Phase 3: Cohere integration | packages/rerank | 2 hrs | P0 |
| Phase 3: Integrate into retrieval | server | 2 hrs | P0 |
| Phase 1.2: Context manager | packages/rag | 3 hrs | P1 |

### Week 3: Query Enhancement

| Task | Package | Effort | Priority |
|------|---------|--------|----------|
| Phase 4.1: Create `@repo/rag` package | packages/rag | 2 hrs | P0 |
| Phase 4.1: Query expansion | packages/rag | 4 hrs | P0 |
| Phase 5: Contextual compression | packages/rag | 3 hrs | P1 |

### Week 4: Advanced Features

| Task | Package | Effort | Priority |
|------|---------|--------|----------|
| Phase 4.2: HyPE implementation | packages/rag | 5 hrs | P1 |
| Phase 6.1: Create `@repo/chunker` | packages/chunker | 3 hrs | P2 |
| Phase 6.1: Semantic chunking | packages/chunker | 5 hrs | P2 |
| Phase 7: Agentic RAG | packages/rag | 8 hrs | P2 |

---

## Package Architecture

### New Package Structure

```
packages/
├── chunker/                    # Text chunking utilities
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main exports
│       ├── types.ts            # TypeScript interfaces
│       ├── text-chunker.ts     # Fixed-size chunking (moved from server)
│       ├── semantic.ts         # Semantic chunking
│       └── hierarchical.ts     # Parent-child chunking
│
├── embedding/                  # Embedding generation
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main exports
│       ├── types.ts            # TypeScript interfaces
│       ├── gemini.ts           # Gemini embedding (moved from server)
│       └── utils.ts            # Helpers
│
├── vector/                     # Vector database operations
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main exports
│       ├── types.ts            # TypeScript interfaces
│       ├── client.ts           # Upstash client initialization
│       ├── upsert.ts           # Upsert operations (hybrid)
│       ├── query.ts            # Query operations (hybrid)
│       └── delete.ts           # Delete operations
│
├── rerank/                     # Re-ranking utilities
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main exports
│       ├── types.ts            # TypeScript interfaces
│       ├── cohere.ts           # Cohere re-ranking
│       ├── gemini.ts           # Gemini LLM re-ranking (fallback)
│       └── factory.ts          # Provider factory
│
├── rag/                        # RAG orchestration
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts            # Main exports
│       ├── types.ts            # TypeScript interfaces
│       ├── retriever.ts        # Main retrieval orchestrator
│       ├── query-expander.ts   # Multi-query expansion
│       ├── compressor.ts       # Contextual compression
│       ├── context-manager.ts  # Token budget management
│       ├── hype.ts             # Hypothetical questions
│       └── agentic.ts          # Agentic RAG with tools
│
├── graph/                      # Knowledge graph (existing, move if needed)
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── generator.ts        # Graph generation from text
│       └── merger.ts           # Graph merging
│
├── ocr/                        # OCR utilities
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       └── mistral.ts          # Mistral OCR (moved from server)
│
├── llm/                        # LLM utilities
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── types.ts
│       ├── gemini.ts           # Gemini client
│       └── prompts.ts          # Prompt templates
│
└── shared/                     # Existing shared types
    └── ...
```

### Package Dependencies

```
┌─────────────────────────────────────────────────────────────────┐
│                        apps/server                               │
│                                                                  │
│  Imports from packages:                                          │
│  - @repo/chunker      (text chunking)                           │
│  - @repo/embedding    (generate embeddings)                      │
│  - @repo/vector       (vector DB operations)                     │
│  - @repo/rerank       (re-ranking)                               │
│  - @repo/rag          (RAG orchestration)                        │
│  - @repo/graph        (knowledge graph)                          │
│  - @repo/ocr          (document OCR)                             │
│  - @repo/llm          (LLM responses)                            │
│  - @repo/shared       (shared types)                             │
│  - @repo/logs         (logging)                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                         packages/                                │
│                                                                  │
│  @repo/rag ────────────► @repo/vector                           │
│      │                       │                                   │
│      ├──────────────────► @repo/rerank                          │
│      │                       │                                   │
│      ├──────────────────► @repo/embedding                       │
│      │                       │                                   │
│      └──────────────────► @repo/llm                             │
│                              │                                   │
│  @repo/chunker ──────────► @repo/embedding                      │
│                              │                                   │
│  @repo/ocr ──────────────► @repo/shared                         │
│                              │                                   │
│  @repo/graph ────────────► @repo/llm                            │
│                              │                                   │
│  All packages ───────────► @repo/logs                           │
│                              │                                   │
│  All packages ───────────► @repo/shared                         │
└─────────────────────────────────────────────────────────────────┘
```

### Server Simplified (After Refactoring)

```typescript
// apps/server/src/routes/ingest/process.ts
import { chunkText } from '@repo/chunker';
import { generateEmbeddings } from '@repo/embedding';
import { upsertHybridVectors } from '@repo/vector';
import { extractTextWithOCR } from '@repo/ocr';
import { generateGraph } from '@repo/graph';

// apps/server/src/routes/v1/chat/completions.ts
import { retrieveWithRAG } from '@repo/rag';
import { generateResponse } from '@repo/llm';
```

### TODO List - Package Migration

- [ ] **Create `@repo/chunker`**
  - [ ] Initialize package with `package.json`, `tsconfig.json`
  - [ ] Move `apps/server/src/lib/chunker/*` to package
  - [ ] Export from `packages/chunker/src/index.ts`
  - [ ] Update imports in server
  - [ ] Test functionality

- [ ] **Create `@repo/embedding`**
  - [ ] Initialize package
  - [ ] Move `apps/server/src/lib/embedding/*` to package
  - [ ] Export from index
  - [ ] Update imports in server
  - [ ] Test functionality

- [ ] **Create `@repo/vector`**
  - [ ] Initialize package
  - [ ] Move `apps/server/src/lib/upstash/vector.ts` to package
  - [ ] Add hybrid index support
  - [ ] Export from index
  - [ ] Update imports in server
  - [ ] Test functionality

- [ ] **Create `@repo/rerank`**
  - [ ] Initialize package
  - [ ] Implement Cohere reranking
  - [ ] Implement Gemini fallback
  - [ ] Export from index
  - [ ] Test functionality

- [ ] **Create `@repo/rag`**
  - [ ] Initialize package
  - [ ] Implement retriever with all enhancements
  - [ ] Export from index
  - [ ] Update imports in server
  - [ ] Test functionality

- [ ] **Create `@repo/ocr`**
  - [ ] Initialize package
  - [ ] Move `apps/server/src/lib/ocr/*` to package
  - [ ] Export from index
  - [ ] Update imports in server
  - [ ] Test functionality

- [ ] **Create `@repo/graph`**
  - [ ] Initialize package
  - [ ] Move `apps/server/src/lib/graph/*` to package
  - [ ] Export from index
  - [ ] Update imports in server
  - [ ] Test functionality

- [ ] **Create `@repo/llm`**
  - [ ] Initialize package
  - [ ] Move `apps/server/src/lib/llm/*` to package
  - [ ] Move `apps/server/src/lib/prompt/*` to package
  - [ ] Export from index
  - [ ] Update imports in server
  - [ ] Test functionality

---

## Configuration Options

### Environment Variables

```env
# ===========================================
# RAG Configuration
# ===========================================
RAG_TOP_K=15
RAG_MIN_SCORE=0.4
RAG_MAX_CONTEXT_TOKENS=8000
RAG_ENABLE_QUERY_EXPANSION=true
RAG_ENABLE_COMPRESSION=false
RAG_ENABLE_AGENTIC=false

# ===========================================
# Upstash Vector (Hybrid Index)
# ===========================================
UPSTASH_VECTOR_REST_URL=
UPSTASH_VECTOR_REST_TOKEN=
UPSTASH_FUSION_ALGORITHM=DBSF  # RRF or DBSF

# ===========================================
# Re-Ranking Configuration
# ===========================================
RAG_ENABLE_RERANK=true
RERANK_PROVIDER=cohere  # cohere or gemini
RERANK_MODEL=rerank-v3.5  # rerank-v4.0-pro, rerank-v4.0-fast, rerank-v3.5
RERANK_TOP_N=10
COHERE_API_KEY=

# ===========================================
# Chunking Configuration
# ===========================================
CHUNK_SIZE=1500
CHUNK_OVERLAP=300
ENABLE_SEMANTIC_CHUNKING=false
ENABLE_HIERARCHICAL_CHUNKING=false

# ===========================================
# HyPE Configuration
# ===========================================
ENABLE_HYPE=false
HYPE_QUESTIONS_PER_CHUNK=3

# ===========================================
# Existing Configuration
# ===========================================
GEMINI_API_KEY=
MISTRAL_API_KEY=
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ELEVENLABS_API_KEY=
ELEVENLABS_AGENT_SECRET=
```

---

## Monitoring & Evaluation

### Metrics to Track

| Metric | Description | Target |
|--------|-------------|--------|
| `rag.chunks_retrieved` | Number of chunks found | 10-15 |
| `rag.sources_used` | Unique source files used | 80%+ of uploaded |
| `rag.avg_similarity_score` | Average chunk score | > 0.6 |
| `rag.rerank_latency_ms` | Time for reranking | < 500ms |
| `rag.total_latency_ms` | Total retrieval time | < 2000ms |
| `rag.query_expansion_count` | Number of expanded queries | 3-4 |

### TODO List - Monitoring

- [ ] Add structured logging for all RAG metrics
- [ ] Create dashboard in monitoring tool
- [ ] Set up alerts for latency thresholds
- [ ] Implement A/B testing framework for features
- [ ] Track user satisfaction (thumbs up/down)

### A/B Testing Framework

```typescript
// Feature flags for gradual rollout
const ragFeatures = {
  hybridSearch: process.env.RAG_ENABLE_HYBRID === 'true',
  queryExpansion: process.env.RAG_ENABLE_QUERY_EXPANSION === 'true',
  reranking: process.env.RAG_ENABLE_RERANK === 'true',
  compression: process.env.RAG_ENABLE_COMPRESSION === 'true',
  agentic: process.env.RAG_ENABLE_AGENTIC === 'true',
};

// Log for analysis
logger.info('RAG request completed', {
  userId,
  features: ragFeatures,
  metrics: {
    chunksRetrieved,
    sourcesUsed,
    avgScore,
    rerankLatency,
    totalLatency,
  }
});
```

---

## Cost Considerations

| Feature | Additional API Calls | Cost per Query |
|---------|---------------------|----------------|
| Hybrid Search (Upstash) | Built-in | ~$0.0001 |
| Query Expansion | 1 Gemini call | ~$0.001 |
| Re-ranking (Cohere) | 1 API call | ~$0.0002 |
| Re-ranking (Gemini) | 1 LLM call | ~$0.002 |
| Compression | N Gemini Flash calls | ~$0.003 |
| Agentic (3 iterations) | Up to 3 additional | ~$0.01 |
| HyPE (at indexing) | 1 LLM call/chunk | One-time |

**Recommendation:** Start with Hybrid Search + Cohere Re-ranking. Best cost-to-improvement ratio.

---

## References

- [Upstash Hybrid Indexes Documentation](https://upstash.com/docs/vector/features/hybridindexes)
- [Cohere Re-Rank Best Practices](https://docs.cohere.com/docs/reranking-best-practices)
- [Cohere Re-Rank API](https://docs.cohere.com/v2/docs/rerank)
- [RAG Techniques Repository](https://github.com/NirDiamant/RAG_Techniques)
- [LlamaIndex RAG Guide](https://docs.llamaindex.ai/)
- [Vercel AI SDK](https://sdk.vercel.ai/)