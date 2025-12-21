# Echo-Learn Smart Memory Cluster Development Plan

> **Goal:** Transform the static Redis memory system into an **intelligent, brain-like learning tracker** that automatically observes, decays, adapts, and evolves — like a real teacher understanding their student over time.

> **Philosophy:** The system should learn from EVERY interaction passively, not require explicit "save learning" calls. Mastery decays over time (like real memory), and the system infers understanding from conversation patterns.

> **Status:** 📋 Planning Complete

---

## Table of Contents

1. [Current State vs Vision](#current-state-vs-vision)
2. [Core Concepts: How Real Learning Works](#core-concepts-how-real-learning-works)
3. [Phase 1: Smart Mastery Schema with Decay](#phase-1-smart-mastery-schema-with-decay)
4. [Phase 2: Passive Learning Analysis Pipeline](#phase-2-passive-learning-analysis-pipeline)
5. [Phase 3: Graph-Aware Mastery Propagation](#phase-3-graph-aware-mastery-propagation)
6. [Phase 4: Adaptive Question Generation](#phase-4-adaptive-question-generation)
7. [Phase 5: Follow-Up Suggestions (Perplexity-Style)](#phase-5-follow-up-suggestions-perplexity-style)
8. [Phase 6: Learning Analytics Dashboard](#phase-6-learning-analytics-dashboard)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Success Metrics](#success-metrics)

---

## Current State vs Vision

### ❌ Current System (Static, Explicit)

```
User answers wrong → Agent calls save_learning_progress("mark_topic_weak") → Adds to weakAreas[]
User answers right → Agent calls save_learning_progress("mark_topic_strong") → Adds to strongAreas[]
```

**Problems:**
- Binary weak/strong — no spectrum
- Agent must explicitly decide to save
- No time decay — once "strong" always "strong"
- No pattern detection
- No automatic learning from conversations
- Flat string arrays, not linked to knowledge graph

### ✅ New System (Dynamic, Implicit, Brain-Like)

```
Every conversation → System automatically observes → Extracts learning signals → Updates mastery scores
                                                  → Applies time decay → Propagates to related concepts
                                                  → Generates smart follow-ups
```

**How It's Different:**

| Aspect | Current | New |
|--------|---------|-----|
| **Tracking** | Explicit tool calls | Automatic observation |
| **Mastery** | Binary (weak/strong) | Spectrum (0.0 - 1.0) |
| **Memory** | Permanent | Decays over time |
| **Scope** | Independent topics | Graph-connected concepts |
| **Agent Role** | Saves learning | Queries learning state |
| **Follow-ups** | LLM guesses | Graph + mastery based |

---

## Core Concepts: How Real Learning Works

### 1. Ebbinghaus Forgetting Curve

Humans forget information exponentially over time. A real teacher knows: "We covered this 2 weeks ago, they probably forgot some of it."

```
Effective Mastery = Stored Mastery × e^(-λ × days_since_last_interaction)

Example:
- User scored 90% on "backpropagation" 7 days ago
- λ (decay rate) = 0.1
- Effective mastery = 0.9 × e^(-0.1 × 7) = 0.9 × 0.497 = 0.45 (45%)
```

**Implication:** The system knows you probably forgot and should review.

### 2. Spaced Repetition (SM-2 Algorithm)

Optimal learning happens when you review at the RIGHT time — not too soon (waste), not too late (forgot).

```
If answered correctly:
  interval = previous_interval × ease_factor
  ease_factor += 0.1

If answered wrong:
  interval = 1 day (reset)
  ease_factor -= 0.2 (min 1.3)
```

### 3. Confidence vs Mastery

- **Mastery Score:** How well do they know it? (based on performance)
- **Confidence:** How sure are we about that score? (based on data points)

Low confidence = We haven't tested this enough to know.

### 4. Learning Signals (What a Real Teacher Observes)

| Signal | Interpretation |
|--------|----------------|
| User asks "What is X?" | Low mastery of X |
| User explains X correctly | High mastery of X |
| User asks clarifying questions | Medium mastery, actively learning |
| User asks same thing twice | Confusion, retention issue |
| User asks deeper question about X | Growing mastery |
| Quick correct answer | Strong mastery |
| Hesitant/wrong answer | Weak mastery |
| User makes connection A→B | Understanding relationships |

### 5. Mastery Propagation

Concepts are connected. Mastering "backpropagation" should slightly boost "chain rule" (prerequisite).

```
When user masters concept X:
  For each prerequisite P of X:
    P.mastery += 0.1 × X.mastery_gain  (you clearly understood the prereq)
  
  For each concept Y that requires X:
    Y.potential += small_boost  (you're ready to learn this)
```

---

## Phase 1: Smart Mastery Schema with Decay

### Goal
Replace flat `weakAreas: string[]` with structured, time-aware mastery tracking per concept.

### New Schema

**Location:** `packages/shared/src/types/learning.ts`

```typescript
interface ConceptMastery {
  conceptId: string           // Links to GraphNode.id
  
  // Core Mastery
  masteryScore: number        // 0.0 - 1.0
  confidence: number          // 0.0 - 1.0 (how sure are we?)
  
  // Time Tracking (for decay)
  lastInteraction: string     // ISO timestamp
  lastCorrectAnswer: string   // ISO timestamp
  
  // Attempt History
  totalAttempts: number
  correctAttempts: number
  streakCorrect: number       // Consecutive correct
  streakWrong: number         // Consecutive wrong
  
  // Spaced Repetition
  nextReviewDate: string      // When to quiz again
  easeFactor: number          // SM-2 ease factor (default 2.5)
  intervalDays: number        // Current interval
  
  // Pattern Detection
  commonMistakes: string[]    // What they get wrong
  confusedWith: string[]      // Concepts they confuse this with
}
```

### Redis Storage Structure

```
user:{userId}:mastery:{conceptId}  →  JSON of ConceptMastery
user:{userId}:mastery:index        →  Sorted Set (score = masteryScore)
user:{userId}:review:queue         →  Sorted Set (score = nextReviewDate timestamp)
```

### Key Functions to Implement

**Location:** `packages/storage/src/redis/mastery.ts`

| Function | Purpose |
|----------|---------|
| `getMastery(userId, conceptId)` | Get mastery with decay applied |
| `getEffectiveMastery(userId, conceptId)` | Apply forgetting curve to stored score |
| `updateMastery(userId, conceptId, signal)` | Update based on learning signal |
| `getWeakestConcepts(userId, limit)` | Concepts with lowest effective mastery |
| `getDueForReview(userId)` | Concepts past their review date |
| `getMasteryMap(userId)` | All mastery scores for visualization |

### Decay Calculation

```typescript
function getEffectiveMastery(stored: ConceptMastery): number {
  const daysSinceInteraction = daysBetween(stored.lastInteraction, now());
  const decayRate = 0.1; // Tune this
  const decayFactor = Math.exp(-decayRate * daysSinceInteraction);
  return stored.masteryScore * decayFactor;
}
```

### Migration Strategy

1. Keep existing `weakAreas`/`strongAreas` during transition
2. New system runs in parallel
3. When stable, deprecate old fields

### TODO List - Phase 1

- [ ] Create `packages/shared/src/types/learning.ts` with new interfaces
- [ ] Create `packages/storage/src/redis/mastery.ts` with CRUD functions
- [ ] Implement `getEffectiveMastery()` with decay calculation
- [ ] Implement SM-2 algorithm for review scheduling
- [ ] Add mastery index sorted set for efficient queries
- [ ] Add review queue sorted set for spaced repetition
- [ ] Export from `@repo/storage`
- [ ] Write unit tests for decay calculation
- [ ] Write unit tests for SM-2 interval calculation

---

## Phase 2: Passive Learning Analysis Pipeline

### Goal
Automatically extract learning signals from EVERY conversation without explicit tool calls.

### Architecture

```
User Message → Agent Response → [ASYNC] Analysis Pipeline
                                         ↓
                              Extract concepts discussed
                                         ↓
                              Detect learning signals
                                         ↓
                              Update mastery scores
                                         ↓
                              (Does NOT block response)
```

### Where It Runs

**Location:** `packages/agentic/src/strategies.ts`

After `streamText()` completes, trigger background analysis:

```typescript
// After response streaming completes
analyzeInteractionAsync(userId, userMessage, assistantResponse, conversationHistory);
```

### Signal Detection

**Location:** `packages/agentic/src/analysis/signal-detector.ts`

| Pattern | Signal | Mastery Update |
|---------|--------|----------------|
| "What is X?" | Learning about X | Neutral (asking = beginning) |
| User explains X correctly | Understands X | +0.2 to mastery |
| User explains X incorrectly | Struggles with X | -0.1 to mastery |
| "I don't understand X" | Confused about X | -0.15 to mastery |
| Asks follow-up about X | Engaging with X | +0.05 (curiosity signal) |
| Asks same thing again | Retention issue | -0.1, flag for review |
| Correct quiz answer | Knows it | +0.3 (strong signal) |
| Wrong quiz answer | Doesn't know | -0.2 (strong signal) |
| Makes connection A→B | Deep understanding | +0.1 to both |

### Concept Extraction

Use lightweight LLM call or keyword matching:

```typescript
async function extractConceptsFromText(text: string, userGraph: KnowledgeGraph): string[] {
  // Option 1: Match against known graph nodes (fast)
  const mentioned = userGraph.nodes.filter(node => 
    text.toLowerCase().includes(node.label.toLowerCase())
  );
  
  // Option 2: LLM extraction (more accurate, slower)
  // Only use for complex cases
}
```

### Background Processing

Must NOT block the response stream:

```typescript
function analyzeInteractionAsync(userId, userMsg, assistantMsg, history) {
  // Fire and forget - don't await
  setImmediate(async () => {
    try {
      const concepts = await extractConcepts(assistantMsg, userId);
      const signals = await detectSignals(userMsg, assistantMsg, history);
      
      for (const signal of signals) {
        await updateMastery(userId, signal.conceptId, signal);
      }
    } catch (error) {
      logger.warn("Background analysis failed", { error });
      // Non-critical - don't crash
    }
  });
}
```

### TODO List - Phase 2

- [ ] Create `packages/agentic/src/analysis/` directory
- [ ] Implement `extractConcepts()` - match text to graph nodes
- [ ] Implement `detectSignals()` - pattern matching on conversation
- [ ] Implement `analyzeInteractionAsync()` - background pipeline
- [ ] Integrate into `strategies.ts` after response completion
- [ ] Add logging for analysis results
- [ ] Add feature flag to enable/disable
- [ ] Test with various conversation patterns
- [ ] Tune signal weights based on real usage

---

## Phase 3: Graph-Aware Mastery Propagation

### Goal
When user masters a concept, related concepts should be affected. The knowledge graph enables this.

### Relationship Types for Learning

Extend graph edges with learning semantics:

```typescript
interface LearningEdge extends GraphEdge {
  learningRelation: 
    | 'prerequisite'    // Must know source before target
    | 'corequisite'     // Often learned together
    | 'application'     // Target applies source concept
    | 'example'         // Target is example of source
    | 'opposite'        // Contrasting concepts
}
```

### Propagation Rules

```
When user MASTERS concept X:

1. Prerequisites get credit:
   For each edge (P → X, type='prerequisite'):
     P.mastery += 0.1  // You clearly understood the prereq
   
2. Related concepts get boost:
   For each edge (X → R, type='related'):
     R.potential_boost = 0.05  // Easier to learn now
     
3. Applications become available:
   For each edge (X → A, type='application'):
     Mark A as "ready to learn"
```

```
When user STRUGGLES with concept X:

1. Check prerequisites:
   For each edge (P → X, type='prerequisite'):
     If P.mastery < 0.5:
       Suggest: "You might want to review {P} first"
       
2. Flag related weak spots:
   For each edge (R → X, type='related'):
     If R.mastery low and X.mastery low:
       Detect: "User struggles with this whole area"
```

### Agent Tool: Query Related Concepts

**Location:** `packages/agentic/src/tools/definitions/query-graph.tool.ts`

```typescript
const queryGraphTool = {
  name: "query_knowledge_graph",
  description: "Find concepts related to a topic in user's knowledge graph",
  
  inputSchema: z.object({
    conceptId: z.string().describe("Concept to find relations for"),
    relationTypes: z.array(z.string()).optional(),
    maxDepth: z.number().default(2),
  }),
  
  // Returns: related concepts with mastery scores
}
```

### TODO List - Phase 3

- [ ] Add `learningRelation` field to GraphEdge type
- [ ] Update graph generator to infer learning relationships
- [ ] Implement `propagateMastery(userId, conceptId, change)` 
- [ ] Implement `checkPrerequisites(userId, conceptId)` 
- [ ] Create `query_knowledge_graph` agent tool
- [ ] Create `get_learning_path` tool (suggests order to learn)
- [ ] Add prerequisite check to question generation
- [ ] Test propagation doesn't cause infinite loops

---

## Phase 4: Adaptive Question Generation

### Goal
Generate questions at the RIGHT difficulty for the RIGHT concepts at the RIGHT time.

### Question Selection Algorithm

```
1. Get concepts due for review (spaced repetition)
2. Get weakest concepts (mastery < 0.5)
3. Get recently discussed concepts (reinforce)
4. Rank by: priority = (1 - mastery) × urgency × recency
5. Select top concept
6. Generate question at appropriate difficulty
```

### Difficulty Adjustment

```
If mastery < 0.3:
  → Easy question (definition, recognition)
  
If mastery 0.3 - 0.6:
  → Medium question (application, comparison)
  
If mastery > 0.6:
  → Hard question (analysis, edge cases, synthesis)
```

### Agent Tool: Generate Adaptive Question

**Location:** `packages/agentic/src/tools/definitions/adaptive-question.tool.ts`

```typescript
const generateAdaptiveQuestionTool = {
  name: "generate_adaptive_question",
  description: "Generate a question optimized for user's current learning state",
  
  inputSchema: z.object({
    topic: z.string().optional().describe("Specific topic, or auto-select"),
    difficulty: z.enum(['easy', 'medium', 'hard', 'auto']).default('auto'),
    questionType: z.enum(['definition', 'application', 'comparison', 'analysis']).optional(),
  }),
  
  // Execution:
  // 1. If no topic: select from weak/due concepts
  // 2. If auto difficulty: based on mastery score
  // 3. Generate question using RAG context
  // 4. Return question + expected answer + concept mapping
}
```

### TODO List - Phase 4

- [ ] Create question selection algorithm
- [ ] Implement difficulty adjustment based on mastery
- [ ] Create `generate_adaptive_question` tool
- [ ] Add question type variety (not always same format)
- [ ] Track question history (don't repeat exact questions)
- [ ] Implement answer evaluation (correct/partial/wrong)
- [ ] Update mastery based on answer quality
- [ ] Test question variety and difficulty progression

---

## Phase 5: Follow-Up Suggestions (Perplexity-Style)

### Goal
After every response, suggest 3-4 smart follow-up questions based on:
1. Concepts discussed in the response
2. Related concepts user hasn't mastered
3. Concepts due for review
4. Natural learning progression

### UI Flow

```
┌─────────────────────────────────────────────────────┐
│  Echo's Response about Machine Learning...          │
│  ...and that's how gradient descent works.          │
├─────────────────────────────────────────────────────┤
│  💡 Continue exploring:                             │
│                                                     │
│  ○ What is the learning rate and how do I choose it?│
│  ○ How does gradient descent differ from SGD?       │
│  ○ Quiz me on gradient descent                      │
│  ○ Show me a practical example                      │
└─────────────────────────────────────────────────────┘
```

### Follow-Up Generation Algorithm

```
1. Extract concepts mentioned in response
2. For each concept:
   a. Find graph neighbors (related, prerequisites, applications)
   b. Filter by: user hasn't mastered + not recently asked
3. Add special options:
   - "Quiz me on {main_topic}"
   - "Explain {prerequisite} that I'm weak on"
4. Rank by learning value
5. Return top 4 as natural language questions
```

### Implementation Location

**New function:** `packages/agentic/src/followup/generator.ts`

**Called from:** After streaming completes in `strategies.ts`

**Returns:** Array of follow-up question strings

### API Response Extension

```typescript
interface ChatResponse {
  message: string
  followUpSuggestions: string[]  // NEW: 3-4 suggestions
  conceptsDiscussed: string[]    // NEW: for frontend tracking
}
```

### TODO List - Phase 5

- [ ] Create `packages/agentic/src/followup/generator.ts`
- [ ] Implement concept extraction from response
- [ ] Implement graph-based follow-up finding
- [ ] Add mastery filtering (suggest weak areas)
- [ ] Add variety (quiz, explain, example, deeper)
- [ ] Return suggestions with streaming response
- [ ] Update API response schema
- [ ] Update frontend to display suggestions
- [ ] Make suggestions clickable (pre-fill chat)
- [ ] Track which suggestions users click (for tuning)

---

## Phase 6: Learning Analytics Dashboard

### Goal
Visualize user's learning progress: mastery map, decay over time, recommended reviews.

### Dashboard Components

1. **Mastery Map** (Graph visualization)
   - Nodes colored by mastery (red → yellow → green)
   - Size by importance/connections
   - Click to see details

2. **Decay Timeline**
   - Show mastery decay over time
   - Highlight concepts about to "expire"
   - Motivate review sessions

3. **Learning Velocity**
   - Concepts learned per week
   - Average mastery improvement
   - Time spent per topic

4. **Review Schedule**
   - "Due today" list
   - "Coming up" list
   - One-click "Start Review Session"

5. **Strengths & Gaps**
   - Strongest topics
   - Weakest topics
   - Suggested focus areas

### API Endpoints

```
GET /api/users/:userId/learning/mastery-map
GET /api/users/:userId/learning/due-reviews
GET /api/users/:userId/learning/analytics
GET /api/users/:userId/learning/recommendations
```

### TODO List - Phase 6

- [ ] Create analytics API endpoints
- [ ] Implement mastery map data transformation
- [ ] Implement decay timeline calculation
- [ ] Create learning velocity metrics
- [ ] Build frontend mastery map component
- [ ] Build frontend decay timeline chart
- [ ] Build frontend review queue component
- [ ] Add "Start Review Session" feature
- [ ] Add progress notifications

---

## Implementation Roadmap

### Timeline Overview

| Phase | Duration | Dependencies | Priority |
|-------|----------|--------------|----------|
| Phase 1: Smart Schema | 1 week | None | 🔴 Critical |
| Phase 2: Passive Analysis | 1 week | Phase 1 | 🔴 Critical |
| Phase 3: Graph Propagation | 1 week | Phase 1, 2 | 🟡 High |
| Phase 4: Adaptive Questions | 1 week | Phase 1, 2 | 🟡 High |
| Phase 5: Follow-up Suggestions | 3-4 days | Phase 1, 2, 3 | 🟡 High |
| Phase 6: Analytics Dashboard | 1 week | All above | 🟢 Medium |

### Phase 1 Breakdown

**Week 1: Foundation**

| Day | Task |
|-----|------|
| 1 | Create `learning.ts` types, design Redis schema |
| 2 | Implement basic CRUD for ConceptMastery |
| 3 | Implement decay calculation + tests |
| 4 | Implement SM-2 spaced repetition + tests |
| 5 | Implement mastery index queries (weak, due) |

### Phase 2 Breakdown

**Week 2: Observation Layer**

| Day | Task |
|-----|------|
| 1 | Create analysis pipeline structure |
| 2 | Implement concept extraction from text |
| 3 | Implement signal detection patterns |
| 4 | Integrate into strategies.ts (background) |
| 5 | Test + tune signal weights |

### Phase 3-4 Combined

**Week 3: Intelligence Layer**

| Day | Task |
|-----|------|
| 1-2 | Graph propagation logic |
| 3 | Agent tool: query_knowledge_graph |
| 4-5 | Agent tool: generate_adaptive_question |

### Phase 5

**Week 4 (first half): User Experience**

| Day | Task |
|-----|------|
| 1 | Follow-up generator logic |
| 2 | API response extension |
| 3 | Frontend integration |

### Phase 6

**Week 4-5: Visualization**

- Build dashboard components
- Launch with feature flag

---

## Success Metrics

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Mastery update latency | < 100ms | P95 of background analysis |
| Analysis accuracy | > 80% | Manual review of signal detection |
| Decay calculation correctness | 100% | Unit tests |
| Follow-up relevance | > 70% click rate | Track user clicks |

### Learning Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| User retention | +20% | Users returning after 7 days |
| Mastery improvement | +15% avg | Compare first vs 10th interaction |
| Review completion | > 50% | Users completing suggested reviews |
| Concept coverage | +30% | Breadth of topics user interacts with |

### User Experience Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Follow-up click rate | > 30% | Users clicking suggested questions |
| Session length | +25% | Time spent per session |
| "Aha moments" | Qualitative | User feedback, survey |

---

## Key Files to Create/Modify

### New Files

```
packages/shared/src/types/learning.ts          # New types
packages/storage/src/redis/mastery.ts          # Mastery CRUD
packages/agentic/src/analysis/                 # Analysis pipeline
  ├── index.ts
  ├── concept-extractor.ts
  ├── signal-detector.ts
  └── background-analyzer.ts
packages/agentic/src/followup/
  ├── index.ts
  └── generator.ts
packages/agentic/src/tools/definitions/
  ├── query-graph.tool.ts
  └── adaptive-question.tool.ts
apps/server/src/routes/learning/               # New API routes
```

### Modified Files

```
packages/shared/src/types/index.ts             # Export new types
packages/storage/src/index.ts                  # Export mastery functions
packages/agentic/src/strategies.ts             # Add analysis hook
packages/agentic/src/tools/definitions/index.ts # Register new tools
apps/server/src/index.ts                       # Mount learning routes
```

---

## Summary

This plan transforms Echo-Learn from a static Q&A system into an **intelligent learning companion** that:

1. **Observes** every interaction automatically (no explicit saves)
2. **Remembers** with realistic decay (like human memory)
3. **Connects** concepts through the knowledge graph
4. **Adapts** questions to user's current level
5. **Suggests** smart follow-ups (Perplexity-style)
6. **Visualizes** progress to motivate learning

The key insight: **The agent doesn't manage memory — it queries it.** The memory system is a living, breathing model that updates itself from observation, not explicit instructions.

---

*Last Updated: January 2025*
*Author: Echo-Learn Development Team*