# Echo-Learn Smart Memory Cluster Development Plan

> **Goal:** Transform the static Redis memory system into an **intelligent, brain-like learning tracker** that automatically observes, decays, adapts, and evolves — like a real teacher understanding their student over time.

> **Philosophy:** The system should learn from EVERY interaction passively, not require explicit "save learning" calls. Mastery decays over time (like real memory), and the system infers understanding from conversation patterns.

> **Status:** 📋 Planning Complete

---

## Table of Contents

1. [Current State vs Vision](#current-state-vs-vision)
2. [Core Concepts: How Real Learning Works](#core-concepts-how-real-learning-works)
3. [**Phase 0: Three-Mode UX System**](#phase-0-three-mode-ux-system) ⭐ NEW
4. [Phase 1: Smart Mastery Schema with Decay](#phase-1-smart-mastery-schema-with-decay)
5. [Phase 2: Passive Learning Analysis Pipeline](#phase-2-passive-learning-analysis-pipeline)
6. [Phase 3: Graph-Aware Mastery Propagation](#phase-3-graph-aware-mastery-propagation)
7. [Phase 4: Adaptive Question Generation](#phase-4-adaptive-question-generation)
8. [Phase 5: Follow-Up Suggestions (Perplexity-Style)](#phase-5-follow-up-suggestions-perplexity-style)
9. [Phase 6: Learning Analytics Dashboard](#phase-6-learning-analytics-dashboard)
10. [Implementation Roadmap](#implementation-roadmap)
11. [Success Metrics](#success-metrics)

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

## Data Architecture & Topic Flow

### The Core Question: Where Do Topics Come From?

Before implementing the learning system, we need to understand the **three data layers** and how they relate:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATA ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│   ┌─────────────────────┐                                               │
│   │  1. KNOWLEDGE GRAPH │  ← Source of all topics (from uploaded files) │
│   │  (Document Memory)  │                                               │
│   │                     │  What CAN be learned                          │
│   │  • Concepts         │  Redis: user:{userId}:graph                   │
│   │  • Relationships    │                                               │
│   │  • Definitions      │                                               │
│   └──────────┬──────────┘                                               │
│              │                                                          │
│              │  Topics flow DOWN                                        │
│              ▼                                                          │
│   ┌─────────────────────┐                                               │
│   │  2. CONCEPT MASTERY │  ← Progress tracking per topic                │
│   │  (User Memory)      │                                               │
│   │                     │  How WELL they know it                        │
│   │  • Mastery scores   │  Redis: user:{userId}:mastery:{conceptId}     │
│   │  • Decay tracking   │                                               │
│   │  • Spaced rep       │                                               │
│   └──────────┬──────────┘                                               │
│              │                                                          │
│              │  Progress flows DOWN                                     │
│              ▼                                                          │
│   ┌─────────────────────┐                                               │
│   │  3. TEST SESSION    │  ← Temporary quiz state                       │
│   │  (Active Testing)   │                                               │
│   │                     │  Current test in progress                     │
│   │  • Question queue   │  Redis: user:{userId}:test-session            │
│   │  • Score tracking   │                                               │
│   └─────────────────────┘                                               │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### The Three Data Layers Explained

| Layer | What It Is | When Created | Redis Key | Contents |
|-------|------------|--------------|-----------|----------|
| **Knowledge Graph** | The curriculum (topic universe) | When files uploaded | `user:{userId}:graph` | Topics, relationships, definitions |
| **Concept Mastery** | Learning progress per topic | When user interacts with topics | `user:{userId}:mastery:{conceptId}` | Scores, decay, review schedules |
| **Test Session** | Active quiz state | When user enters Test Mode | `user:{userId}:test-session` | Question queue, current score |

### Topic Lifecycle: From Document to Mastery

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          COMPLETE TOPIC FLOW                              │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STEP 1: Document Upload (Creates Topic Universe)                        │
│  ═══════════════════════════════════════════════                         │
│                                                                          │
│     User uploads "ML_basics.pdf"                                         │
│           ↓                                                              │
│     OCR → Chunking → Graph Generation (Gemini)                           │
│           ↓                                                              │
│     Knowledge Graph created with 50 concepts:                            │
│       nodes: [                                                           │
│         { id: "neural_network", label: "Neural Network", type: "concept" }│
│         { id: "backpropagation", label: "Backpropagation", type: "process"}│
│         { id: "learning_rate", label: "Learning Rate", type: "term" },   │
│         ...                                                              │
│       ]                                                                  │
│       edges: [                                                           │
│         { source: "backpropagation", target: "neural_network", ... },    │
│         { source: "learning_rate", target: "gradient_descent", ... },    │
│       ]                                                                  │
│           ↓                                                              │
│     🎯 NOW THE SYSTEM KNOWS ALL 50 TOPICS!                               │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│  STEP 2: Learning Mode Chat (Creates/Updates Mastery)                    │
│  ════════════════════════════════════════════════════                    │
│                                                                          │
│     User: "Explain backpropagation"                                      │
│           ↓                                                              │
│     LLM explains using RAG (retrieves from vector DB + graph)            │
│           ↓                                                              │
│     Background Analysis (Phase 2):                                       │
│       • Extract concepts from response                                   │
│       • Match "backpropagation" → graph node found!                      │
│       • Signal: "user asking about" → learning signal                    │
│       • Create/Update mastery entry:                                     │
│         user:{userId}:mastery:backpropagation = {                        │
│           mastery: 0.2,                                                  │
│           lastInteraction: now(),                                        │
│           interactionCount: 1                                            │
│         }                                                                │
│           ↓                                                              │
│     Follow-up Suggestions (from graph edges):                            │
│       • "chain_rule" (prerequisite of backpropagation)                   │
│       • "gradient_descent" (related concept)                             │
│       • "vanishing_gradient" (common problem)                            │
│                                                                          │
│  ────────────────────────────────────────────────────────────────────    │
│                                                                          │
│  STEP 3: Test Mode (Uses Graph + Mastery)                                │
│  ════════════════════════════════════════                                │
│                                                                          │
│     User enters Test Mode                                                │
│           ↓                                                              │
│     System queries:                                                      │
│       • All graph nodes → 50 topics available                            │
│       • Their mastery scores → progress data                             │
│           ↓                                                              │
│     Topic Selection Algorithm:                                           │
│       • Topics with low mastery (< 0.5)                                  │
│       • Topics due for review (spaced repetition)                        │
│       • Topics with high decay (not visited recently)                    │
│           ↓                                                              │
│     Generate questions using graph context + RAG                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### How Suggestions Work

Suggestions come from **graph edges** (relationships between topics):

```
User is learning "Backpropagation"
           ↓
Query graph for edges where source OR target = "backpropagation":
  • edge: chain_rule → backpropagation (relation: "prerequisite")
  • edge: backpropagation → neural_network (relation: "used_in")
  • edge: backpropagation → vanishing_gradient (relation: "causes")
           ↓
Filter by user's mastery:
  • chain_rule: mastery 0.8 (already knows) → skip
  • neural_network: mastery 0.3 (weak) → suggest!
  • vanishing_gradient: mastery 0.0 (never seen) → suggest!
           ↓
Generate natural language suggestions:
  "Would you like to explore neural networks more deeply?"
  "Ready to learn about the vanishing gradient problem?"
```

### Key Insight: Graph = Topic Universe

| Question | Answer |
|----------|--------|
| "Where do topics come from?" | From the **Knowledge Graph** generated when documents are uploaded |
| "How does LLM know what topics exist?" | LLM queries the graph to get all available topics |
| "How do suggestions know what's next?" | Graph edges define relationships between topics |
| "How does Test Mode pick questions?" | Combines graph (available topics) + mastery (progress) |
| "What if user asks about unknown topic?" | Can dynamically add to graph, or handle as "off-curriculum" |

### Redis Key Structure (Complete)

```
# Knowledge Graph (Topic Universe)
user:{userId}:graph                    → KnowledgeGraph { nodes[], edges[] }

# Concept Mastery (Learning Progress) - one per concept
user:{userId}:mastery:{conceptId}      → ConceptMastery { mastery, decay, ... }
user:{userId}:mastery:_index           → Set of all conceptIds with mastery data

# Test Session (Active Quiz)
user:{userId}:test-session             → TestSession { questions[], current, ... }
user:{userId}:test-history             → List of past test sessions

# Existing (unchanged)
user:{userId}:profile                  → UserProfile
user:{userId}:files                    → Set of fileIds
user:{userId}:interactions             → Sorted set of chat logs
file:{fileId}:metadata                 → FileMetadata
```

---

## Phase 0: Three-Mode UX System

### Goal
Provide clear user control over how the system interacts with their learning memory through three distinct conversation modes.

### Why Three Modes Instead of Pure LLM Control?

| Approach | Pros | Cons |
|----------|------|------|
| **LLM decides everything** | Simpler UI, no mode switching | Unpredictable, less user control, might save unwanted things |
| **Three explicit modes** | Clear intent, user control, optimized behavior per mode | Needs mode-switching UI |

**Decision:** Three explicit modes give users control and predictability while optimizing system behavior for each use case.

### The Three Modes

#### 1. 🎓 **Learn Mode** (Default)

**Purpose:** Normal chat with automatic learning observation

**User Experience:**
- Chat naturally about any topic
- System observes and learns in the background
- No explicit actions required from user

**System Behavior:**
- Full passive analysis pipeline runs (Phase 2)
- Extracts concepts from conversation
- Detects learning signals automatically
- Updates mastery scores based on observations
- Follow-up suggestions generated (Phase 5)

**When to Use:**
- Default mode for all learning conversations
- When actively studying a topic
- When wanting the system to track progress

```
┌─────────────────────────────────────────────────────────────────┐
│                     🎓 LEARN MODE                                │
├─────────────────────────────────────────────────────────────────┤
│  User: "Explain backpropagation to me"                          │
│  AI: [explains backpropagation in detail]                       │
│                                                                 │
│  ┌─── Background (invisible to user) ───┐                       │
│  │ • Detected: "asking about backpropagation"                   │
│  │ • Signal: Learning new concept                               │
│  │ • Action: Created mastery entry (0.2 initial)                │
│  │ • Related: Linked to "neural networks" in graph              │
│  └──────────────────────────────────────┘                       │
│                                                                 │
│  💡 Follow-up suggestions:                                      │
│  • "How does the chain rule apply here?"                        │
│  • "What's the difference between SGD and Adam?"                │
└─────────────────────────────────────────────────────────────────┘
```

#### 2. 💬 **Chat Mode** (Off-Record / Ask Anything)

**Purpose:** Pure Q&A without affecting learning memory

**User Experience:**
- Ask any question freely
- No impact on learning profile
- "Safe space" for exploration

**System Behavior:**
- Skip `analyzeInteractionAsync()` entirely
- No mastery updates
- No concept extraction
- No signal detection
- Regular RAG still works for accurate answers

**When to Use:**
- Asking "stupid questions" without judgment
- Exploring tangential topics
- Getting help on something you don't want tracked
- Debugging or experimenting
- Conversations you want "off the record"

```
┌─────────────────────────────────────────────────────────────────┐
│                     💬 CHAT MODE                                 │
├─────────────────────────────────────────────────────────────────┤
│  User: "What's a really dumb example of overfitting?"           │
│  AI: [provides a silly but educational example]                 │
│                                                                 │
│  ┌─── Background ───┐                                           │
│  │ [Nothing saved]  │                                           │
│  │ [Off the record] │                                           │
│  └──────────────────┘                                           │
│                                                                 │
│  (No follow-up suggestions in Chat Mode)                        │
└─────────────────────────────────────────────────────────────────┘
```

#### 3. 📝 **Test Mode** (Quiz / Review Session)

**Purpose:** Active knowledge testing with spaced repetition

**User Experience:**
- System drives the conversation
- Questions based on weak/due concepts
- Immediate feedback on answers
- Progress tracking visible

**System Behavior:**
- Pull concepts due for review (spaced repetition - Phase 1)
- Pull weakest concepts (mastery < 0.5)
- Generate adaptive questions (Phase 4)
- Evaluate user answers explicitly
- Update mastery with strong signals (+0.3 correct / -0.2 wrong)
- Track test session statistics

**When to Use:**
- Active review sessions
- Before exams or assessments
- When wanting to challenge yourself
- Periodic knowledge checks

```
┌─────────────────────────────────────────────────────────────────┐
│                     📝 TEST MODE                                 │
├─────────────────────────────────────────────────────────────────┤
│  AI: "Let's test your knowledge! Based on your learning         │
│       history, I'll start with concepts due for review."        │
│                                                                 │
│  AI: "Question 1 (Medium Difficulty):                           │
│       What is the purpose of the learning rate in               │
│       gradient descent?"                                        │
│                                                                 │
│  User: "It controls how big the steps are when updating         │
│         the weights"                                            │
│                                                                 │
│  AI: "✅ Correct! The learning rate determines the step size    │
│       during optimization. Too high = overshooting,             │
│       too low = slow convergence."                              │
│                                                                 │
│  ┌─── Background ───┐                                           │
│  │ • Concept: "learning rate"                                   │
│  │ • Answer: Correct                                            │
│  │ • Mastery: 0.45 → 0.75 (+0.30)                               │
│  │ • Next review: 4 days                                        │
│  └──────────────────┘                                           │
│                                                                 │
│  📊 Session Progress: 1/10 | Score: 100%                        │
│  AI: "Ready for the next question?"                             │
└─────────────────────────────────────────────────────────────────┘
```

### Mode Comparison Matrix

| Aspect | 🎓 Learn | 💬 Chat | 📝 Test |
|--------|----------|---------|---------|
| **Who drives conversation** | User | User | System |
| **Memory updates** | Automatic (passive) | None | Explicit (active) |
| **Analysis pipeline** | Full background | Disabled | Test-specific |
| **Signal strength** | Weak-Medium | None | Strong |
| **Follow-up suggestions** | Yes | No | Next question |
| **Use case** | Daily learning | Free exploration | Active review |
| **Mastery update range** | ±0.05 to ±0.2 | 0 | ±0.2 to ±0.3 |

### UI Implementation

#### Option A: Mode Selector Dropdown (Recommended)

```
┌────────────────────────────────────────┐
│  Echo-Learn                    [👤]    │
├────────────────────────────────────────┤
│  Mode: [🎓 Learn ▼]                    │
│        ┌──────────────┐                │
│        │ 🎓 Learn     │ ← Default      │
│        │ 💬 Chat      │                │
│        │ 📝 Test      │                │
│        └──────────────┘                │
├────────────────────────────────────────┤
│                                        │
│  [Chat messages here]                  │
│                                        │
├────────────────────────────────────────┤
│  [Type your message...]        [Send]  │
└────────────────────────────────────────┘
```

#### Option B: Tab-Based Navigation

```
┌────────────────────────────────────────┐
│  [🎓 Learn] [💬 Chat] [📝 Test]        │
│  ─────────                             │
├────────────────────────────────────────┤
│                                        │
│  [Chat messages for selected mode]     │
│                                        │
└────────────────────────────────────────┘
```

#### Option C: Slash Commands (Power Users)

```
/learn  - Switch to Learn mode
/chat   - Switch to Chat mode  
/test   - Start a test session
/mode   - Show current mode
```

### API Design

#### Request Extension

```typescript
interface ChatRequest {
  message: string;
  userId: string;
  conversationId: string;
  mode: 'learn' | 'chat' | 'test';  // NEW
  // ... existing fields
}
```

#### Backend Mode Handling

**Location:** `packages/agentic/src/strategies.ts`

```typescript
async function handleChat(request: ChatRequest) {
  const { message, userId, mode } = request;
  
  // Mode-specific system prompts
  const systemPrompt = getSystemPromptForMode(mode);
  
  // Execute chat
  const response = await streamText({ ... });
  
  // Mode-specific post-processing
  switch (mode) {
    case 'learn':
      // Full passive analysis (Phase 2)
      analyzeInteractionAsync(userId, message, response, history);
      // Generate follow-ups (Phase 5)
      const followUps = await generateFollowUps(userId, response);
      break;
      
    case 'chat':
      // No analysis, no follow-ups
      // Just return the response
      break;
      
    case 'test':
      // Evaluate answer if this is a response to a question
      if (isAnswerToQuestion(history)) {
        await evaluateAndUpdateMastery(userId, message, history);
      }
      // Generate next question or session summary
      break;
  }
  
  return { response, followUps, testProgress };
}
```

#### Mode-Specific System Prompts

```typescript
const MODE_PROMPTS = {
  learn: `You are a learning assistant. Help the user understand concepts.
          The system automatically tracks their learning progress.`,
          
  chat: `You are a helpful assistant. Answer questions directly.
         This conversation is off-record - no learning tracking.`,
         
  test: `You are a quiz master testing the user's knowledge.
         Ask questions about concepts they've learned.
         After each answer, provide clear feedback (correct/incorrect).
         Explain the right answer briefly.
         Then ask if they're ready for the next question.`
};
```

### Test Mode Deep Dive

#### Session Flow

```
1. User enters Test Mode
   ↓
2. System fetches:
   - Concepts due for review (spaced repetition)
   - Weakest concepts (mastery < 0.5)
   - Recently learned concepts (reinforce)
   ↓
3. System generates question queue (5-10 questions)
   ↓
4. For each question:
   a. Present question with difficulty indicator
   b. Wait for user answer
   c. Evaluate answer (correct/partial/incorrect)
   d. Update mastery score
   e. Provide feedback
   f. Update spaced repetition interval
   ↓
5. Session complete → Show summary
```

#### Test Session State

```typescript
interface TestSession {
  sessionId: string;
  userId: string;
  startedAt: Date;
  questions: TestQuestion[];
  currentIndex: number;
  results: TestResult[];
  
  // Computed
  score: number;           // Percentage correct
  conceptsTested: string[];
  masteryChanges: Map<string, number>;
}

interface TestQuestion {
  conceptId: string;
  conceptLabel: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionType: 'definition' | 'application' | 'comparison' | 'analysis';
  question: string;
  expectedAnswer: string;  // For evaluation reference
}

interface TestResult {
  questionIndex: number;
  userAnswer: string;
  evaluation: 'correct' | 'partial' | 'incorrect';
  feedback: string;
  masteryChange: number;
}
```

#### Session Summary UI

```
┌─────────────────────────────────────────────────────────────────┐
│                   📝 TEST SESSION COMPLETE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Score: 7/10 (70%)  ⭐⭐⭐                                       │
│                                                                 │
│  ✅ Correct (7):                                                │
│     • Learning rate                    0.45 → 0.75              │
│     • Gradient descent                 0.60 → 0.85              │
│     • Backpropagation                  0.50 → 0.80              │
│     • ...                                                       │
│                                                                 │
│  ❌ Needs Review (3):                                           │
│     • Batch normalization              0.40 → 0.25              │
│     • Dropout regularization           0.35 → 0.20              │
│     • Adam optimizer                   0.30 → 0.15              │
│                                                                 │
│  💡 Recommendation:                                             │
│     Review "regularization techniques" - you struggled          │
│     with related concepts.                                      │
│                                                                 │
│  [🔄 Review Weak Concepts] [📚 Back to Learning] [🏠 Home]      │
└─────────────────────────────────────────────────────────────────┘
```

### TODO List - Phase 0

- [ ] Add `mode` field to chat request types (`packages/shared/src/types/`)
- [ ] Create mode-specific system prompts
- [ ] Update `strategies.ts` to handle mode parameter
- [ ] Implement mode routing logic (learn/chat/test branches)
- [ ] Create test session management (`packages/agentic/src/test-session/`)
- [ ] Implement test question queue generation
- [ ] Implement answer evaluation logic
- [ ] Create test session summary generator
- [ ] Add mode selector UI component (frontend)
- [ ] Add mode persistence (remember last used mode)
- [ ] Add keyboard shortcuts for mode switching
- [ ] Add mode indicator in chat UI
- [ ] Create test session UI components
- [ ] Add session history/statistics page
- [ ] Write tests for mode-specific behavior

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
| **Phase 0: Three-Mode UX** | 3-4 days | None | 🔴 Critical |
| Phase 1: Smart Schema | 1 week | Phase 0 | 🔴 Critical |
| Phase 2: Passive Analysis | 1 week | Phase 0, 1 | 🔴 Critical |
| Phase 3: Graph Propagation | 1 week | Phase 1, 2 | 🟡 High |
| Phase 4: Adaptive Questions | 1 week | Phase 1, 2 | 🟡 High |
| Phase 5: Follow-up Suggestions | 3-4 days | Phase 1, 2, 3 | 🟡 High |
| Phase 6: Analytics Dashboard | 1 week | All above | 🟢 Medium |

### Phase 0 Breakdown

**Days 1-4: Three-Mode Foundation**

| Day | Task |
|-----|------|
| 1 | Add mode types, update API request schema, create mode routing in strategies.ts |
| 2 | Implement Learn mode (default behavior), implement Chat mode (skip analysis) |
| 3 | Implement Test mode session management, question queue generation |
| 4 | Build mode selector UI, test session UI, integration testing |

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
packages/shared/src/types/learning.ts          # New types (includes mode)
packages/shared/src/types/test-session.ts      # Test session types
packages/storage/src/redis/mastery.ts          # Mastery CRUD
packages/storage/src/redis/test-session.ts     # Test session storage
packages/agentic/src/modes/                    # Mode handling
  ├── index.ts
  ├── learn-mode.ts
  ├── chat-mode.ts
  └── test-mode.ts
packages/agentic/src/test-session/             # Test session management
  ├── index.ts
  ├── question-generator.ts
  ├── answer-evaluator.ts
  └── session-manager.ts
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
apps/web/src/components/ModeSelector.tsx       # Mode selector UI
apps/web/src/components/TestSession/           # Test mode UI
  ├── TestSessionView.tsx
  ├── QuestionCard.tsx
  └── SessionSummary.tsx
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

1. **Respects user intent** with three distinct modes (Learn/Chat/Test)
2. **Observes** every interaction automatically in Learn mode (no explicit saves)
3. **Remembers** with realistic decay (like human memory)
4. **Connects** concepts through the knowledge graph
5. **Adapts** questions to user's current level
6. **Tests** knowledge actively in Test mode with spaced repetition
7. **Suggests** smart follow-ups (Perplexity-style)
8. **Visualizes** progress to motivate learning

The key insights:
- **User control matters:** The three-mode system gives users clear control over when and how their learning is tracked.
- **The agent doesn't manage memory — it queries it.** The memory system is a living, breathing model that updates itself from observation, not explicit instructions.
- **Different contexts need different behaviors:** Learning passively, exploring freely, and testing actively are fundamentally different activities that deserve dedicated modes.

---

*Last Updated: January 2025*
*Author: Echo-Learn Development Team*