# Echo-Learn RAG Improvement Plan

> **Goal:** Transform the current basic RAG system into a production-grade knowledge retrieval system with intelligent query routing and high-quality context extraction.

---

## Table of Contents

1. [Problem Analysis](#problem-analysis)
2. [Phase 1: Quick Wins (✅ COMPLETED)](#phase-1-quick-wins-completed)
3. [Phase 2: Upstash Hybrid Index (✅ COMPLETED)](#phase-2-upstash-hybrid-index-completed)
4. [Phase 3: Re-Ranking (Optional)](#phase-3-re-ranking-optional)
5. [Phase 4: Advanced Chunking](#phase-4-advanced-chunking)
6. [Phase 5: Agentic RAG with Query Routing](#phase-5-agentic-rag-with-query-routing)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Configuration](#configuration-options)
9. [Monitoring](#monitoring--evaluation)

---

## Problem Analysis

### Current Issues (Solved)

| Issue | Solution | Status |
|-------|----------|--------|
| Limited Context (5 chunks) | Increased to 50 chunks | ✅ Done |
| Poor keyword matching | Hybrid Search (BAAI + BM25) | ✅ Done |
| Wrong minScore (0.6) | Adjusted to 0.01 for RRF | ✅ Done |
| Token overflow | Context budget manager | ✅ Done |
| Client-side embeddings | Switched to Upstash Native | ✅ Done |

### Remaining Challenges

| Issue | Proposed Solution | Priority |
|-------|-------------------|----------|
| "Summary" queries filter too much | Agentic Router (Phase 5) | High |
| Broken semantic chunks | Semantic Chunking (Phase 4) | Medium |
| Noise in top results | Re-ranking (Phase 3) | Optional |

---

## Phase 1: Quick Wins (✅ COMPLETED)

### 1.1 Increase Retrieval Parameters

**Status:** ✅ Done

| Parameter | Old | New | Reason |
|-----------|-----|-----|--------|
| `topK` | 5 | **50** | Support "summary" queries |
| `minScore` | 0.6 | **0.01** | Adjusted for RRF scoring (0.01-0.02 range) |

### 1.2 Dynamic Context Window Management

**Status:** ✅ Done

- [x] Created `packages/rag/src/context-manager.ts`
- [x] Implemented token budget manager
- [x] Added source diversity logic
- [x] Integrated into retrieval pipeline

---

## Phase 2: Upstash Hybrid Index (✅ COMPLETED)

### Overview

**Status:** ✅ Done (Switched to Upstash Native Architecture)

We migrated from **Client-side Gemini embeddings** to **Upstash Server-side embeddings**.

### What Changed

**Before (Gemini Client-side):**
```typescript
// Generate embedding locally
const embedding = await generateEmbedding(text); // 768 dimensions
await upsertVectors([{ id, vector: embedding, metadata }]);
```

**After (Upstash Native):**
```typescript
// Send raw text, Upstash handles everything
await upsertWithEmbedding([{ id, data: text, metadata }]);
```

### The Stack

Upstash automatically handles:
1. **Dense Embedding:** BAAI/bge-large-en-v1.5 (1024 dimensions)
2. **Sparse Embedding:** BM25 (keyword matching)
3. **Fusion:** RRF (Reciprocal Rank Fusion)

### Index Configuration

When creating the index in Upstash Console:
- **Type:** Hybrid
- **Dense Model:** BAAI/bge-large-en-v1.5 (Built-in)
- **Sparse Model:** BM25 (Built-in)
- **Metric:** COSINE

### Code Example

```typescript
import { searchWithEmbedding } from "@repo/storage";

// Search with automatic embedding + fusion
const results = await searchWithEmbedding("What is the main topic?", {
  topK: 50,
  fusionAlgorithm: "RRF", // or "DBSF"
  includeMetadata: true,
  minScore: 0.01,
  filter: "userId = 'user_123'"
});

// Upstash returns results sorted by:
// 1. Semantic Similarity (BAAI)
// 2. Keyword Matching (BM25)
// 3. Fused via RRF
```

### Benefits

✅ **Simpler Code:** No client-side embedding logic  
✅ **Better Accuracy:** Hybrid = Semantic + Keywords  
✅ **Performance:** Server-side vectorization is faster  
✅ **Lower Latency:** One API call instead of two  

---

## Phase 3: Re-Ranking (Optional)

### Overview

Add a "Quality Filter" after Hybrid Search to refine the top results.

**The Flow:**
1. **Upstash (Fast):** Retrieves top 50 candidates using math (RRF).
2. **Re-Ranker (Smart):** Reads the 50 candidates and picks the best 10 using AI.
3. **LLM:** Generates answer from the best 10.

### Why It Helps

Even with Hybrid Search, the top 50 will contain "noise" (irrelevant chunks that just happened to match keywords). Re-ranking ensures only the most relevant chunks reach the LLM.

### Trade-offs

| Aspect | Benefit | Cost |
|--------|---------|------|
| Accuracy | +15-20% relevance | +1-2s latency |
| Token Cost | -60% (10 instead of 50) | +API cost (Cohere) |
| Use Case | Best for "Specific Fact" queries | Overkill for "Summary" queries |

### When to Use It

**Use Re-ranking:**
- "Who is the CEO?" (Specific fact)
- "What is error code 8085?" (Precise answer)

**Skip Re-ranking:**
- "Summarize the project." (Needs all 50 chunks)
- "List all features." (Needs broad coverage)

### Implementation

**Option A: Cohere (Recommended)**
```typescript
import { CohereClient } from "cohere-ai";

const cohere = new CohereClient({ token: process.env.COHERE_API_KEY });

async function rerankWithCohere(query: string, documents: string[]) {
  const response = await cohere.rerank({
    model: "rerank-english-v3.0",
    query,
    documents,
    topN: 10,
  });
  
  return response.results.map(r => ({
    index: r.index,
    score: r.relevanceScore,
  }));
}
```

**Option B: Gemini (Fallback)**
- Use structured output to rank documents
- Slower but free (already using Gemini)

### TODO List - Phase 3

- [ ] Install Cohere SDK: `bun add cohere-ai`
- [ ] Create `packages/rerank/src/cohere-reranker.ts`
- [ ] Add `COHERE_API_KEY` to environment
- [ ] Integrate into `retrieve-context.ts` with `useRerank` flag
- [ ] Test with "Specific Fact" queries
- [ ] Measure latency impact

**Estimated Effort:** 3-4 hours  
**Expected Improvement:** +15-20% accuracy for specific queries  
**Recommendation:** Implement only if current accuracy is insufficient.

---

## Phase 4: Advanced Chunking

### Overview

Stop cutting text at arbitrary character limits. Cut text at **semantic boundaries**.

### The Problem (Current State)

**Standard Chunking (Dumb):**
```
Chunk 1: "Germany invaded Pol..." [CUT]
Chunk 2: "...and. The war began in 1939."
```
The idea is broken. The AI sees garbage.

**Semantic Chunking (Smart):**
```
Chunk 1: "Germany invaded Poland. The war began in 1939." [Complete thought]
Chunk 2: "Meanwhile, in the Pacific, Japan attacked Pearl Harbor." [New topic]
```
Every chunk is a complete, understandable story.

### 4.1 Semantic Chunking

**How It Works:**
1. Compare each sentence to the next one using embeddings.
2. If the meaning changes (Love → Fight), cut there.
3. If the meaning is similar (Fight → Fight), keep together.

**Tamil Movie Analogy:**
Don't cut the film every 5 minutes blindly. Cut when the "mood" changes (Love song → Fight scene).

### 4.2 Parent-Child Document Retrieval

**The Concept:**
- **Child (Index):** Small, specific sentence (easy to search).
- **Parent (Return):** Full paragraph/scene containing that sentence (full context).

**The Flow:**
1. User asks: "What did he say about the bomb?"
2. Vector DB finds: Small sentence "...cut the red wire..." (Child).
3. System retrieves: The entire "Bomb Defusal Scene" (Parent).
4. LLM reads: Full scene with who, what, where, why.

**Tamil Movie Example:**
- **Child:** The punch dialogue *"Naan oru thadava sonna..."* (Easy to find)
- **Parent:** The entire interval fight scene (Full context)

You search for the dialogue, but the AI gets the whole scene to understand the story.

### Implementation Strategy

**For Normal PDFs (with structure):**
```typescript
// Use headings/paragraphs as natural boundaries
function cutByStructure(text: string) {
  return text.split(/\n\n+|#+\s+/); // Split on headings or double newlines
}
```

**For Flat OCR Text (no structure):**
```typescript
// Use semantic similarity to detect topic changes
function cutByTopicChange(sentences: string[]) {
  const chunks = [];
  let currentChunk = [sentences[0]];
  
  for (let i = 1; i < sentences.length; i++) {
    const similarity = cosineSimilarity(
      embed(sentences[i-1]),
      embed(sentences[i])
    );
    
    if (similarity < 0.7) { // Topic changed
      chunks.push(currentChunk.join(' '));
      currentChunk = [sentences[i]];
    } else {
      currentChunk.push(sentences[i]);
    }
  }
  
  return chunks;
}
```

### TODO List - Phase 4

**4.1 Semantic Chunking**
- [ ] Create `packages/ingest/src/chunking/semantic-chunker.ts`
- [ ] Implement topic-change detection algorithm
- [ ] Test with flat OCR text (no headings)
- [ ] Compare quality vs. standard chunking

**4.2 Parent-Child Retrieval**
- [ ] Update database schema to store parent-child relationships
- [ ] Modify `upsertWithEmbedding` to store both child (index) and parent (content)
- [ ] Update `searchWithEmbedding` to swap child → parent on retrieval
- [ ] Test with complex documents

**Estimated Effort:** 8-10 hours  
**Expected Improvement:** +30% context quality, clearer answers

---

## Phase 5: Agentic RAG with Query Routing

### Overview

Build a "Smart Brain" that decides **how** to search based on the user's question.

### The Problem

Currently, every query uses the same strategy:
- Hybrid Search → Get 50 chunks → (Optional Re-rank) → Answer

But this is wasteful:
- **"Who is the CEO?"** needs only 1 specific fact (Re-ranking helps).
- **"Summarize the project."** needs all 50 chunks (Re-ranking hurts by filtering out 40 chunks).

### The Solution: Query Router

The Agent **classifies** the query and **picks a strategy**.

### Strategy Table

| User Question | Classification | Strategy | Workflow |
|---------------|----------------|----------|----------|
| "Who is the CEO?" | **Specific Fact** | Strategy A | Hybrid (50) → Re-rank (10) → Answer |
| "Summarize the project." | **Broad Summary** | Strategy B | Hybrid (50) → No Re-rank → Answer |
| "Hi, how are you?" | **Chit-chat** | Strategy C | No Search → Direct Answer |
| "Explain quantum physics." | **Off-topic** | Strategy D | Redirect to uploaded materials |

### Implementation

**Step 1: Query Classifier (LLM)**
```typescript
async function classifyQuery(query: string): Promise<'fact' | 'summary' | 'chat' | 'offtopic'> {
  const prompt = `
Classify this user query:
"${query}"

Types:
- fact: Asking for a specific detail (who, what, when, where)
- summary: Asking for overview, list, or broad explanation
- chat: Small talk or greetings
- offtopic: Not related to uploaded documents

Respond with only one word: fact, summary, chat, or offtopic
`;

  const response = await generateResponse({ systemPrompt: prompt, messages: [] });
  return response.trim().toLowerCase() as any;
}
```

**Step 2: Strategy Router**
```typescript
async function routeQuery(query: string, userId: string) {
  const queryType = await classifyQuery(query);
  
  switch (queryType) {
    case 'fact':
      // Precise search with re-ranking
      const candidates = await searchWithEmbedding(query, { topK: 50 });
      const ranked = await rerankWithCohere(query, candidates);
      return ranked.slice(0, 10); // Top 10 only
      
    case 'summary':
      // Broad search without re-ranking
      const allChunks = await searchWithEmbedding(query, { topK: 50 });
      return allChunks; // All 50 chunks
      
    case 'chat':
      // No search needed
      return [];
      
    case 'offtopic':
      // Polite redirect
      return [];
  }
}
```

**Step 3: Dynamic Tool Calling (Advanced)**

Allow the Agent to decide:
- "I need more context" → Search again with different keywords
- "I found enough" → Stop searching

```typescript
const tools = [
  {
    name: "searchKnowledgeBase",
    description: "Search the user's uploaded documents",
    parameters: {
      query: "string",
      topK: "number (default: 10)"
    }
  }
];

// The LLM can call this tool multiple times if needed
```

### TODO List - Phase 5

**5.1 Query Router**
- [ ] Create `packages/rag/src/query-router.ts`
- [ ] Implement `classifyQuery()` function
- [ ] Implement `routeQuery()` with strategy A/B/C/D
- [ ] Add `RAG_USE_ROUTER` environment flag

**5.2 Dynamic Re-ranking**
- [ ] Integrate Phase 3 re-ranker
- [ ] Use re-ranker only for "fact" queries
- [ ] Skip re-ranker for "summary" queries

**5.3 Tool Calling (Advanced)**
- [ ] Define `searchKnowledgeBase` tool schema
- [ ] Implement iterative search loop (max 3 calls)
- [ ] Add cost/latency monitoring

**5.4 Query Rewriting (Integrated)**
- [ ] If search returns 0 results, Agent rewrites query
- [ ] Example: "Fix it" → "How to fix login error"
- [ ] Retry search with new query

**Estimated Effort:** 12-15 hours  
**Expected Improvement:** Solves the "Summary vs. Specific" problem permanently

---

## Implementation Roadmap

### Current Status (December 2024)

✅ **Phase 1:** Quick Wins (Completed)  
✅ **Phase 2:** Upstash Hybrid (Completed)  
🔄 **Phase 3:** Re-Ranking (Optional)  
⏳ **Phase 4:** Advanced Chunking (In Progress)  
⏳ **Phase 5:** Agentic RAG (Planned)  

### Recommended Priority

**High Priority (Do Now):**
1. **Phase 5:** Agentic Router (Solves the core "filtering" problem)
2. **Phase 4:** Semantic Chunking (Improves data quality)

**Medium Priority (Do Later):**
3. **Phase 3:** Re-Ranking (Only if accuracy is insufficient)

**Removed (Obsolete):**
- ~~Phase 4: Query Enhancement~~ → Integrated into Phase 5 (Agent)
- ~~Phase 5: Contextual Compression~~ → Not needed with modern LLMs

### Timeline

**Week 1-2: Agentic Router (Phase 5)**
- Implement query classification
- Implement strategy A/B routing
- Test with "fact" vs. "summary" queries

**Week 3-4: Advanced Chunking (Phase 4)**
- Implement semantic chunking
- Implement parent-child retrieval
- Re-index existing documents

**Optional: Re-Ranking (Phase 3)**
- Add Cohere integration
- Test with specific queries
- Monitor latency impact

---

## Configuration Options

### Environment Variables

```env
# RAG Configuration
RAG_TOP_K=50
RAG_MIN_SCORE=0.01
RAG_USE_HYBRID=true
RAG_FUSION_ALGORITHM=RRF

# Agentic RAG
RAG_USE_ROUTER=true
RAG_ENABLE_TOOL_CALLING=false

# Re-Ranking (Optional)
RAG_USE_RERANK=false
COHERE_API_KEY=your_key_here

# Upstash Vector
UPSTASH_VECTOR_REST_URL=https://...
UPSTASH_VECTOR_REST_TOKEN=...
```

### Runtime Configuration

```typescript
// In retrieve-context.ts
const results = await retrieveContext(query, userId, {
  topK: 50,
  minScore: 0.01,
  fusionAlgorithm: "RRF",
  useContextBudget: true,
  useRouter: true,      // Enable Agentic routing
  useRerank: false,     // Disable re-ranking by default
});
```

---

## Monitoring & Evaluation

### Metrics to Track

```typescript
interface RagMetrics {
  queryType: 'fact' | 'summary' | 'chat';
  strategyUsed: 'A' | 'B' | 'C';
  chunksRetrieved: number;
  tokensUsed: number;
  latencyMs: number;
  userSatisfaction: boolean; // Thumbs up/down
}
```

### A/B Testing

Compare strategies:
- **Control:** Always use 50 chunks (no router)
- **Treatment:** Use Agentic Router

Measure:
- Answer quality (human evaluation)
- Token cost per query
- Latency

---

## Cost Considerations

| Component | Cost | Notes |
|-----------|------|-------|
| Upstash Hybrid | Free tier: 10K queries/day | Sufficient for most use cases |
| Gemini (LLM) | $0.075 per 1M input tokens | Main cost driver |
| Cohere Re-rank | $1 per 1K searches | Optional, only if needed |
| Query Router | ~200 tokens per query | Minimal overhead |

**Optimization Tips:**
1. Use Router to reduce unnecessary searches
2. Skip re-ranking for summary queries (saves 40 chunks = fewer tokens)
3. Cache common queries (future enhancement)

---

## References

- [Upstash Hybrid Index Docs](https://upstash.com/docs/vector/features/hybridindex)
- [RRF Fusion Algorithm](https://arxiv.org/abs/2406.06520)
- [Cohere Re-Rank](https://docs.cohere.com/docs/rerank-2)
- [Advanced RAG Techniques](https://arxiv.org/abs/2312.10997)

---

**Document Version:** 2.0  
**Last Updated:** December 20, 2024  
**Status:** Phase 1 & 2 Complete, Phase 3-5 In Progress