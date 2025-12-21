# Global Shared Graph Architecture Plan

> **Goal:** Design a scalable architecture where documents and their knowledge graphs are shared globally, while learning progress (mastery) remains personal to each user.

> **Status:** 📋 Future Planning (Not Yet Implemented)

> **Prerequisite:** This builds upon the Memory Cluster Improvement Plan. Implement that first.

---

## Table of Contents

1. [Vision & Motivation](#vision--motivation)
2. [Architecture Overview](#architecture-overview)
3. [Data Model](#data-model)
4. [Folder & Topic Organization](#folder--topic-organization)
5. [Learning Scope Selection](#learning-scope-selection)
6. [Three Modes in Global Context](#three-modes-in-global-context)
7. [User Flows](#user-flows)
8. [API Design](#api-design)
9. [Migration Strategy](#migration-strategy)
10. [Implementation Roadmap](#implementation-roadmap)

---

## Vision & Motivation

### The Problem with Per-User Graphs

Current architecture duplicates everything per user:

```
Current (Per-User):
═══════════════════

User A uploads "ML.pdf"     → user:userA:graph = { 50 nodes }
User B uploads "ML.pdf"     → user:userB:graph = { 50 nodes }  ← Duplicate!
User C uploads "ML.pdf"     → user:userC:graph = { 50 nodes }  ← Duplicate!
...
User 1000 uploads "ML.pdf"  → user:user1000:graph = { 50 nodes }  ← Duplicate!

Result: Same content processed 1000 times, stored 1000 times
```

### The Solution: Shared Documents, Personal Progress

```
Future (Global Shared):
═══════════════════════

Document "ML.pdf" uploaded ONCE:
└─→ document:{docId}:graph = { 50 nodes }  ← Single copy!

User A subscribes → user:userA:mastery:* = { personal progress }
User B subscribes → user:userB:mastery:* = { personal progress }
User C subscribes → user:userC:mastery:* = { personal progress }

Result: 1 graph, 1000 personal progress records
```

### Benefits

| Aspect | Per-User (Current) | Global Shared (Future) |
|--------|-------------------|------------------------|
| Storage | O(users × documents) | O(documents) + O(users × concepts) |
| Processing | LLM call per user upload | LLM call per unique document |
| Consistency | Each user may have different graph | All users see same concepts |
| Updates | Must update each user's graph | Update once, affects all |
| Collaboration | Not possible | Users can share, recommend |
| Scalability | Poor | Excellent |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      GLOBAL SHARED GRAPH ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                    GLOBAL LAYER (Shared)                          │     │
│   │                                                                   │     │
│   │   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │     │
│   │   │   Folder:   │    │   Folder:   │    │   Folder:   │          │     │
│   │   │   Science   │    │    Math     │    │   History   │          │     │
│   │   └──────┬──────┘    └──────┬──────┘    └──────┬──────┘          │     │
│   │          │                  │                  │                  │     │
│   │   ┌──────┴──────┐    ┌──────┴──────┐    ┌──────┴──────┐          │     │
│   │   │  Topics:    │    │  Topics:    │    │  Topics:    │          │     │
│   │   │  • Physics  │    │  • Algebra  │    │  • WW2      │          │     │
│   │   │  • Biology  │    │  • Calculus │    │  • Ancient  │          │     │
│   │   │  • Chemistry│    │  • Geometry │    │  • Modern   │          │     │
│   │   └─────────────┘    └─────────────┘    └─────────────┘          │     │
│   │                                                                   │     │
│   │   Each Topic contains:                                            │     │
│   │   • Documents (PDFs, notes, etc.)                                 │     │
│   │   • Knowledge Graph (concepts, relationships)                     │     │
│   │   • Vector embeddings (for RAG)                                   │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
│                              │                                              │
│                              │ Users subscribe to folders/topics            │
│                              ▼                                              │
│                                                                             │
│   ┌───────────────────────────────────────────────────────────────────┐     │
│   │                    PERSONAL LAYER (Per User)                       │     │
│   │                                                                   │     │
│   │   User A:                          User B:                        │     │
│   │   ┌────────────────────┐           ┌────────────────────┐        │     │
│   │   │ Subscriptions:     │           │ Subscriptions:     │        │     │
│   │   │ • Science/Physics  │           │ • Math/Algebra     │        │     │
│   │   │ • Math/Algebra     │           │ • Math/Calculus    │        │     │
│   │   │                    │           │ • History/WW2      │        │     │
│   │   ├────────────────────┤           ├────────────────────┤        │     │
│   │   │ Mastery:           │           │ Mastery:           │        │     │
│   │   │ • newton_laws: 0.8 │           │ • quadratic: 0.9   │        │     │
│   │   │ • quadratic: 0.3   │           │ • derivatives: 0.4 │        │     │
│   │   │ • momentum: 0.6    │           │ • ww2_causes: 0.7  │        │     │
│   │   └────────────────────┘           └────────────────────┘        │     │
│   │                                                                   │     │
│   │   🎯 Same global content, different personal journeys             │     │
│   └───────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Data Model

### Global Entities

```typescript
// ===========================================
// FOLDER (Top-level organization)
// ===========================================

interface Folder {
  id: string;                    // "folder_science_123"
  name: string;                  // "Science"
  description?: string;          // "Natural sciences including physics, chemistry..."
  icon?: string;                 // "🔬"
  parentId?: string;             // For nested folders (optional)
  createdBy: string;             // Admin/creator userId
  createdAt: Date;
  visibility: 'public' | 'private' | 'unlisted';
  
  // Stats (computed)
  topicCount: number;
  subscriberCount: number;
}

// ===========================================
// TOPIC (Learning subject within a folder)
// ===========================================

interface Topic {
  id: string;                    // "topic_physics_mechanics_456"
  folderId: string;              // Reference to parent folder
  name: string;                  // "Classical Mechanics"
  description?: string;          // "Newton's laws, motion, forces..."
  icon?: string;                 // "⚙️"
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  estimatedHours?: number;       // Estimated learning time
  prerequisites?: string[];      // Other topic IDs
  createdBy: string;
  createdAt: Date;
  
  // Stats (computed)
  documentCount: number;
  conceptCount: number;
  subscriberCount: number;
}

// ===========================================
// DOCUMENT (Uploaded content)
// ===========================================

interface GlobalDocument {
  id: string;                    // "doc_789"
  topicId: string;               // Reference to parent topic
  title: string;                 // "Newton's Laws of Motion"
  originalFilename: string;      // "physics_chapter1.pdf"
  fileHash: string;              // SHA-256 for deduplication
  fileSize: number;
  mimeType: string;
  
  // Processing state
  status: 'pending' | 'processing' | 'processed' | 'failed';
  processedAt?: Date;
  
  // References
  gcsPath: string;               // Google Cloud Storage path
  vectorNamespace: string;       // Upstash Vector namespace
  
  uploadedBy: string;
  createdAt: Date;
}

// ===========================================
// TOPIC GRAPH (Knowledge graph for a topic)
// ===========================================

interface TopicGraph {
  topicId: string;
  nodes: GraphNode[];            // All concepts in this topic
  edges: GraphEdge[];            // Relationships between concepts
  lastUpdated: Date;
  
  // When new document added, graph is merged/expanded
}

interface GraphNode {
  id: string;                    // "newton_first_law"
  label: string;                 // "Newton's First Law"
  type: GraphNodeType;           // "concept" | "term" | "definition" | etc.
  description?: string;
  importance?: number;           // 1-10 scale
  documentIds: string[];         // Which documents mention this concept
}

interface GraphEdge {
  source: string;
  target: string;
  relation: string;              // "prerequisite" | "related_to" | "part_of" | etc.
  weight?: number;
  documentIds: string[];         // Which documents define this relationship
}
```

### Personal Entities

```typescript
// ===========================================
// USER SUBSCRIPTION (What user is learning)
// ===========================================

interface UserSubscription {
  userId: string;
  
  // Subscribed folders (learn everything in folder)
  folders: FolderSubscription[];
  
  // Subscribed topics (learn specific topics)
  topics: TopicSubscription[];
}

interface FolderSubscription {
  folderId: string;
  subscribedAt: Date;
  includeNewTopics: boolean;     // Auto-subscribe to new topics in folder
}

interface TopicSubscription {
  topicId: string;
  subscribedAt: Date;
  priority: 'high' | 'medium' | 'low';  // Learning priority
}

// ===========================================
// CONCEPT MASTERY (Personal progress)
// ===========================================

interface ConceptMastery {
  id: string;                    // "{userId}:{conceptId}"
  userId: string;
  conceptId: string;             // References GraphNode.id
  topicId: string;               // Which topic this concept belongs to
  
  // Mastery tracking
  mastery: number;               // 0.0 - 1.0
  confidence: number;            // How sure are we about this score
  
  // Spaced repetition
  easeFactor: number;            // SM-2 ease factor (default 2.5)
  interval: number;              // Days until next review
  nextReviewAt: Date;
  
  // History
  lastInteraction: Date;
  interactionCount: number;
  correctCount: number;
  incorrectCount: number;
  
  // Decay
  decayRate: number;             // How fast this concept is forgotten
}

// ===========================================
// LEARNING SCOPE (What to focus on)
// ===========================================

interface LearningScope {
  userId: string;
  
  // Current active scope for learning/testing
  type: 'all' | 'folder' | 'topic' | 'custom';
  
  // If type is 'folder'
  folderId?: string;
  
  // If type is 'topic'
  topicId?: string;
  
  // If type is 'custom' (multiple selections)
  topicIds?: string[];
  
  // Mode settings
  currentMode: 'learn' | 'chat' | 'test';
}
```

---

## Folder & Topic Organization

### Hierarchical Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      FOLDER & TOPIC HIERARCHY                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📁 Science                                                                 │
│  ├── 📚 Physics                                                             │
│  │   ├── 📄 Newton's Laws.pdf                                               │
│  │   ├── 📄 Thermodynamics.pdf                                              │
│  │   └── 📄 Quantum Basics.pdf                                              │
│  │                                                                          │
│  ├── 📚 Chemistry                                                           │
│  │   ├── 📄 Periodic Table.pdf                                              │
│  │   └── 📄 Organic Chemistry.pdf                                           │
│  │                                                                          │
│  └── 📚 Biology                                                             │
│      ├── 📄 Cell Structure.pdf                                              │
│      └── 📄 Genetics.pdf                                                    │
│                                                                             │
│  📁 Mathematics                                                             │
│  ├── 📚 Algebra                                                             │
│  │   ├── 📄 Linear Equations.pdf                                            │
│  │   └── 📄 Quadratics.pdf                                                  │
│  │                                                                          │
│  ├── 📚 Calculus                                                            │
│  │   ├── 📄 Derivatives.pdf                                                 │
│  │   └── 📄 Integrals.pdf                                                   │
│  │                                                                          │
│  └── 📚 Statistics                                                          │
│      └── 📄 Probability.pdf                                                 │
│                                                                             │
│  📁 Social Sciences                                                         │
│  ├── 📚 History                                                             │
│  ├── 📚 Economics                                                           │
│  └── 📚 Psychology                                                          │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Legend:                                                                    │
│  📁 = Folder (category)                                                     │
│  📚 = Topic (learning subject)                                              │
│  📄 = Document (uploaded file)                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Graph Per Topic

Each topic has its own knowledge graph, built from all documents in that topic:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      TOPIC: Physics (Knowledge Graph)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                         ┌─────────────────┐                                 │
│                         │  Newton's Laws  │                                 │
│                         └────────┬────────┘                                 │
│                                  │                                          │
│              ┌───────────────────┼───────────────────┐                      │
│              │                   │                   │                      │
│              ▼                   ▼                   ▼                      │
│    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │
│    │   First Law     │ │   Second Law    │ │   Third Law     │             │
│    │   (Inertia)     │ │   (F = ma)      │ │   (Action/      │             │
│    └────────┬────────┘ └────────┬────────┘ │    Reaction)    │             │
│             │                   │          └─────────────────┘             │
│             │                   │                                          │
│             ▼                   ▼                                          │
│    ┌─────────────────┐ ┌─────────────────┐                                 │
│    │    Momentum     │ │  Acceleration   │                                 │
│    └────────┬────────┘ └────────┬────────┘                                 │
│             │                   │                                          │
│             └─────────┬─────────┘                                          │
│                       │                                                    │
│                       ▼                                                    │
│              ┌─────────────────┐                                           │
│              │     Force       │                                           │
│              └─────────────────┘                                           │
│                                                                             │
│  Built from: Newton's Laws.pdf + Thermodynamics.pdf + Quantum Basics.pdf    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Learning Scope Selection

### UI: Scope Selector

Users can choose WHAT they want to learn before starting:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LEARNING SCOPE SELECTOR                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  What would you like to learn today?                                │    │
│  │                                                                     │    │
│  │  ○ Everything (All subscribed content)                              │    │
│  │                                                                     │    │
│  │  ○ Specific Folder:                                                 │    │
│  │    ┌──────────────────────────────────────┐                         │    │
│  │    │ 📁 Science                        ▼  │                         │    │
│  │    └──────────────────────────────────────┘                         │    │
│  │                                                                     │    │
│  │  ○ Specific Topic:                                                  │    │
│  │    ┌──────────────────────────────────────┐                         │    │
│  │    │ 📚 Physics                        ▼  │                         │    │
│  │    └──────────────────────────────────────┘                         │    │
│  │                                                                     │    │
│  │  ○ Custom Selection:                                                │    │
│  │    ☑ Physics                                                        │    │
│  │    ☑ Algebra                                                        │    │
│  │    ☐ Chemistry                                                      │    │
│  │    ☐ History                                                        │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Selected: Physics (50 concepts) + Algebra (30 concepts) = 80 concepts      │
│                                                                             │
│  [Start Learning]                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Scope Types

| Scope Type | Description | Use Case |
|------------|-------------|----------|
| **Everything** | All subscribed folders and topics | General review, broad learning |
| **Folder** | All topics within a folder | "I want to study Science today" |
| **Topic** | Single topic only | "I'm preparing for Physics exam" |
| **Custom** | Hand-picked topics | "I need Algebra and Calculus for my test" |

### Scope in API

```typescript
// Set learning scope before starting a session
POST /api/users/:userId/learning-scope
{
  "type": "topic",
  "topicId": "topic_physics_123"
}

// Or for custom selection
POST /api/users/:userId/learning-scope
{
  "type": "custom",
  "topicIds": ["topic_physics_123", "topic_algebra_456"]
}

// Get available concepts based on scope
GET /api/users/:userId/available-concepts
// Returns: Concepts from selected scope only
```

---

## Three Modes in Global Context

### Mode + Scope Combination

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      MODE + SCOPE = LEARNING CONTEXT                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              SCOPE                                          │
│                 ┌──────────────────────────────┐                            │
│                 │  Selected: Physics + Algebra  │                            │
│                 │  (80 concepts available)      │                            │
│                 └──────────────────────────────┘                            │
│                              │                                              │
│         ┌────────────────────┼────────────────────┐                         │
│         │                    │                    │                         │
│         ▼                    ▼                    ▼                         │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│  │ 🎓 LEARN    │     │ 💬 CHAT     │     │ 📝 TEST     │                   │
│  │    MODE     │     │    MODE     │     │    MODE     │                   │
│  ├─────────────┤     ├─────────────┤     ├─────────────┤                   │
│  │ Passive     │     │ Off-record  │     │ Active      │                   │
│  │ learning    │     │ Q&A         │     │ testing     │                   │
│  │ about       │     │ about       │     │ on          │                   │
│  │ Physics &   │     │ ANYTHING    │     │ Physics &   │                   │
│  │ Algebra     │     │ (no scope)  │     │ Algebra     │                   │
│  │             │     │             │     │ concepts    │                   │
│  │ Suggestions │     │ No          │     │ Questions   │                   │
│  │ from scope  │     │ suggestions │     │ from scope  │                   │
│  └─────────────┘     └─────────────┘     └─────────────┘                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### How Each Mode Uses Scope

#### 🎓 Learn Mode + Scope

```
User Scope: Physics
User: "Explain Newton's laws"

System:
1. Check: "Newton's laws" → Found in Physics topic graph ✓
2. Retrieve: RAG from Physics documents
3. Respond: Detailed explanation
4. Background:
   - Update mastery for "newton_laws" concept
   - Suggest related Physics concepts
5. Suggestions:
   - "Would you like to explore momentum?" (from Physics)
   - "Ready to learn about force?" (from Physics)
```

#### 💬 Chat Mode (Scope Ignored)

```
User Scope: Physics (but irrelevant in Chat mode)
User: "What's the capital of France?"

System:
1. No scope filtering
2. Answer: "Paris"
3. No mastery updates
4. No suggestions
```

#### 📝 Test Mode + Scope

```
User Scope: Physics + Algebra
User enters Test Mode

System:
1. Query concepts FROM SCOPE ONLY:
   - Physics concepts: 50
   - Algebra concepts: 30
   - Total: 80 concepts to test from
   
2. Apply selection algorithm:
   - Low mastery in scope
   - Due for review in scope
   
3. Generate questions:
   Q1: "What is Newton's Second Law?" (Physics)
   Q2: "Solve: x² + 5x + 6 = 0" (Algebra)
   Q3: "Define momentum" (Physics)
   ...
```

---

## User Flows

### Flow 1: New User Onboarding

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      NEW USER ONBOARDING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User signs up                                                           │
│           ↓                                                                 │
│  2. Show available folders/topics                                           │
│     ┌────────────────────────────────────────┐                              │
│     │  What would you like to learn?         │                              │
│     │                                        │                              │
│     │  ☑ Science                             │                              │
│     │    ☑ Physics                           │                              │
│     │    ☐ Chemistry                         │                              │
│     │  ☑ Mathematics                         │                              │
│     │    ☑ Algebra                           │                              │
│     │    ☐ Calculus                          │                              │
│     │                                        │                              │
│     │  [Start Learning]                      │                              │
│     └────────────────────────────────────────┘                              │
│           ↓                                                                 │
│  3. Create subscriptions:                                                   │
│     user:{userId}:subscriptions = {                                         │
│       topics: ["physics", "algebra"]                                        │
│     }                                                                       │
│           ↓                                                                 │
│  4. Initialize empty mastery (will populate as user learns)                 │
│           ↓                                                                 │
│  5. Land on main chat with scope selector                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow 2: Admin Uploads Document

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      ADMIN DOCUMENT UPLOAD                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Admin selects folder and topic                                          │
│     Folder: Science → Topic: Physics                                        │
│           ↓                                                                 │
│  2. Admin uploads "Quantum_Mechanics.pdf"                                   │
│           ↓                                                                 │
│  3. Check file hash for deduplication                                       │
│     - If exists: Skip processing, link to existing                          │
│     - If new: Process                                                       │
│           ↓                                                                 │
│  4. Process document:                                                       │
│     OCR → Chunks → Vector DB → Graph Generation                             │
│           ↓                                                                 │
│  5. Merge into TOPIC graph (not user graph):                                │
│     topic:physics:graph = {                                                 │
│       nodes: [...existing, ...new_from_quantum_doc],                        │
│       edges: [...existing, ...new_from_quantum_doc]                         │
│     }                                                                       │
│           ↓                                                                 │
│  6. All users subscribed to Physics now have access to new content!         │
│     (No per-user processing needed)                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow 3: Personal Upload (Optional Feature)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PERSONAL UPLOAD (Private)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Some users may want to upload personal notes that aren't shared:           │
│                                                                             │
│  1. User uploads "my_physics_notes.pdf"                                     │
│           ↓                                                                 │
│  2. Choose destination:                                                     │
│     ○ Add to existing topic (if user has permission)                        │
│     ● Personal notes (private, only for me)                                 │
│           ↓                                                                 │
│  3. Store in personal space:                                                │
│     user:{userId}:personal:documents = [docId]                              │
│     user:{userId}:personal:graph = { nodes, edges }                         │
│           ↓                                                                 │
│  4. Personal graph is MERGED with global graph for RAG:                     │
│     Effective graph = global_subscribed_graph ∪ personal_graph              │
│                                                                             │
│  This allows:                                                               │
│  - Global shared content (curated, high quality)                            │
│  - Personal additions (user's own notes)                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Flow 4: Learning Session

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      LEARNING SESSION                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. User opens Echo-Learn                                                   │
│           ↓                                                                 │
│  2. Select scope: "Physics" (50 concepts)                                   │
│           ↓                                                                 │
│  3. Select mode: "🎓 Learn"                                                 │
│           ↓                                                                 │
│  4. Chat interface opens with context:                                      │
│     ┌────────────────────────────────────────┐                              │
│     │ 📚 Physics | 🎓 Learn Mode             │                              │
│     │ ──────────────────────────────────     │                              │
│     │                                        │                              │
│     │ Hi! I'm ready to help you learn        │                              │
│     │ Physics. You have 50 concepts to       │                              │
│     │ explore. What would you like to        │                              │
│     │ start with?                            │                              │
│     │                                        │                              │
│     │ 💡 Suggested starting points:          │                              │
│     │ • Newton's Laws (foundational)         │                              │
│     │ • Energy (you're weak here)            │                              │
│     │ • Momentum (due for review)            │                              │
│     │                                        │                              │
│     └────────────────────────────────────────┘                              │
│           ↓                                                                 │
│  5. User chats, learns, mastery updated in background                       │
│           ↓                                                                 │
│  6. Switch to Test Mode anytime to verify understanding                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Design

### Global Content APIs (Admin)

```typescript
// ===========================================
// FOLDER MANAGEMENT
// ===========================================

// Create folder
POST /api/admin/folders
{
  "name": "Science",
  "description": "Natural sciences",
  "icon": "🔬",
  "visibility": "public"
}

// List folders
GET /api/folders
// Returns: All public folders

// Get folder details
GET /api/folders/:folderId
// Returns: Folder with topic list

// ===========================================
// TOPIC MANAGEMENT
// ===========================================

// Create topic in folder
POST /api/admin/folders/:folderId/topics
{
  "name": "Physics",
  "description": "Classical and modern physics",
  "difficulty": "intermediate",
  "estimatedHours": 40
}

// List topics in folder
GET /api/folders/:folderId/topics

// Get topic details with graph
GET /api/topics/:topicId
// Returns: Topic info + concept count + document list

// Get topic knowledge graph
GET /api/topics/:topicId/graph
// Returns: Full knowledge graph for topic

// ===========================================
// DOCUMENT MANAGEMENT
// ===========================================

// Upload document to topic
POST /api/admin/topics/:topicId/documents
// Multipart form with file

// List documents in topic
GET /api/topics/:topicId/documents

// Delete document (updates graph)
DELETE /api/admin/documents/:docId
```

### User APIs

```typescript
// ===========================================
// SUBSCRIPTION MANAGEMENT
// ===========================================

// Subscribe to folder
POST /api/users/:userId/subscriptions/folders
{
  "folderId": "folder_science_123",
  "includeNewTopics": true
}

// Subscribe to topic
POST /api/users/:userId/subscriptions/topics
{
  "topicId": "topic_physics_456",
  "priority": "high"
}

// Get user's subscriptions
GET /api/users/:userId/subscriptions
// Returns: { folders: [...], topics: [...] }

// Unsubscribe
DELETE /api/users/:userId/subscriptions/topics/:topicId

// ===========================================
// LEARNING SCOPE
// ===========================================

// Set learning scope
POST /api/users/:userId/learning-scope
{
  "type": "topic",
  "topicId": "topic_physics_456"
}

// Get current scope
GET /api/users/:userId/learning-scope

// Get available concepts (based on scope)
GET /api/users/:userId/available-concepts
// Returns: Concepts from current scope

// ===========================================
// MASTERY (Per User)
// ===========================================

// Get mastery for scope
GET /api/users/:userId/mastery?scope=topic&topicId=xxx
// Returns: Mastery data for concepts in scope

// Get concepts due for review
GET /api/users/:userId/due-reviews?scope=topic&topicId=xxx

// Get weak concepts
GET /api/users/:userId/weak-concepts?scope=topic&topicId=xxx

// ===========================================
// CHAT (with scope context)
// ===========================================

// Send message
POST /api/chat
{
  "userId": "user_123",
  "message": "Explain Newton's laws",
  "mode": "learn",
  "scope": {
    "type": "topic",
    "topicId": "topic_physics_456"
  }
}

// Response includes scope-aware suggestions
{
  "response": "Newton's laws describe...",
  "suggestions": [
    "momentum",      // From Physics topic
    "force",         // From Physics topic
    "acceleration"   // From Physics topic
  ],
  "masteryUpdates": [
    { "conceptId": "newton_laws", "newMastery": 0.3 }
  ]
}
```

### Redis Key Structure

```
# ===========================================
# GLOBAL KEYS (Shared)
# ===========================================

# Folders
folder:{folderId}                    → Folder metadata
folders:list                         → Set of all folder IDs
folders:public                       → Set of public folder IDs

# Topics
topic:{topicId}                      → Topic metadata
topic:{topicId}:graph                → Knowledge graph for topic
topic:{topicId}:documents            → Set of document IDs
folder:{folderId}:topics             → Set of topic IDs in folder

# Documents
document:{docId}                     → Document metadata
document:{docId}:chunks              → Reference info for vector DB
document:hash:{fileHash}             → docId (for deduplication)

# ===========================================
# PERSONAL KEYS (Per User)
# ===========================================

# Subscriptions
user:{userId}:subscriptions:folders  → Set of subscribed folder IDs
user:{userId}:subscriptions:topics   → Set of subscribed topic IDs
user:{userId}:subscription:{topicId} → Subscription details (priority, etc.)

# Learning Scope
user:{userId}:scope                  → Current learning scope

# Mastery (one per concept per user)
user:{userId}:mastery:{conceptId}    → ConceptMastery object
user:{userId}:mastery:_index         → Set of all concept IDs with mastery
user:{userId}:mastery:topic:{topicId} → Set of concept IDs for topic

# Personal uploads (optional)
user:{userId}:personal:documents     → Set of personal doc IDs
user:{userId}:personal:graph         → Personal knowledge graph

# Test sessions
user:{userId}:test-session           → Active test session
user:{userId}:test-history           → List of past sessions
```

---

## Migration Strategy

### Phase 1: Add Global Structure (Non-Breaking)

```
Week 1-2:
─────────

1. Create folder/topic tables
2. Create admin APIs for content management
3. Keep existing per-user system working
4. Admin can start organizing global content

No user impact yet.
```

### Phase 2: Add Subscription System

```
Week 3:
───────

1. Add subscription APIs
2. Add scope selector UI
3. Users can subscribe to global topics
4. Both systems work in parallel:
   - Old: user:{userId}:graph (personal uploads)
   - New: topic:{topicId}:graph (global) + subscriptions

Users see both personal and subscribed content.
```

### Phase 3: Migrate Existing Content

```
Week 4:
───────

1. Analyze existing user graphs
2. Identify common documents (by hash)
3. Create global topics from common content
4. Offer users to migrate:
   - "We found 'ML.pdf' in your uploads. 
      This is now available globally. 
      Would you like to use the global version?"

Gradual, user-controlled migration.
```

### Phase 4: Deprecate Per-User Graphs (Optional)

```
Future:
───────

Once global system is mature:
1. Encourage all content to be global
2. Keep personal uploads for truly personal notes
3. Simplify architecture

Or keep hybrid: global + personal forever.
```

---

## Implementation Roadmap

### Timeline Overview

| Phase | Duration | Description | Dependencies |
|-------|----------|-------------|--------------|
| **Phase 1** | 1 week | Global data model + Admin APIs | None |
| **Phase 2** | 1 week | Subscription system | Phase 1 |
| **Phase 3** | 1 week | Scope selector UI + Integration | Phase 2 |
| **Phase 4** | 1 week | Migration tools | Phase 3 |
| **Phase 5** | 1 week | Polish + Testing | Phase 4 |

### Detailed Tasks

#### Phase 1: Global Data Model

```
Day 1:
- [ ] Define TypeScript types for Folder, Topic, GlobalDocument
- [ ] Create Redis key structure documentation
- [ ] Implement folder CRUD functions

Day 2:
- [ ] Implement topic CRUD functions
- [ ] Implement topic graph storage/retrieval

Day 3:
- [ ] Implement document upload to topic
- [ ] Modify graph merger to work with topic graphs
- [ ] Add file hash deduplication

Day 4-5:
- [ ] Create admin API routes
- [ ] Create admin UI for content management
- [ ] Test admin workflows
```

#### Phase 2: Subscription System

```
Day 1:
- [ ] Define subscription types
- [ ] Implement subscription storage functions
- [ ] Create subscription API routes

Day 2:
- [ ] Implement "get user's effective graph" function
  (combines all subscribed topic graphs)
- [ ] Update RAG to use effective graph

Day 3:
- [ ] Implement scope storage and retrieval
- [ ] Create scope API routes
- [ ] Update chat API to accept scope parameter

Day 4-5:
- [ ] Update mastery functions to work with global concepts
- [ ] Ensure concept IDs are consistent across topics
- [ ] Test subscription + mastery integration
```

#### Phase 3: UI Integration

```
Day 1:
- [ ] Build folder/topic browser UI
- [ ] Build subscription management UI

Day 2:
- [ ] Build scope selector component
- [ ] Integrate scope selector into chat UI

Day 3:
- [ ] Update Learn mode to use scope
- [ ] Update Test mode to use scope
- [ ] Update suggestions to use scope

Day 4-5:
- [ ] Polish UI/UX
- [ ] Add loading states
- [ ] Handle edge cases (no subscriptions, etc.)
```

#### Phase 4: Migration Tools

```
Day 1-2:
- [ ] Build document hash analyzer
- [ ] Identify duplicate content across users

Day 3:
- [ ] Create migration wizard UI
- [ ] "Convert to global" functionality

Day 4-5:
- [ ] Test migration with sample users
- [ ] Document migration process
```

---

## Key Files to Create

### New Files

```
# Types
packages/shared/src/types/folder.ts
packages/shared/src/types/topic.ts
packages/shared/src/types/subscription.ts
packages/shared/src/types/scope.ts

# Storage
packages/storage/src/redis/folders.ts
packages/storage/src/redis/topics.ts
packages/storage/src/redis/subscriptions.ts
packages/storage/src/redis/scope.ts

# Graph (modifications)
packages/graph/src/topic-merger.ts       # Merge into topic graph

# API Routes
apps/server/src/routes/admin/folders.ts
apps/server/src/routes/admin/topics.ts
apps/server/src/routes/admin/documents.ts
apps/server/src/routes/subscriptions.ts
apps/server/src/routes/scope.ts

# Frontend
apps/web/src/components/FolderBrowser/
apps/web/src/components/TopicList/
apps/web/src/components/ScopeSelector/
apps/web/src/components/SubscriptionManager/
apps/web/src/pages/admin/ContentManager.tsx
```

### Modified Files

```
packages/agentic/src/strategies.ts       # Add scope to chat context
packages/agentic/src/tools/              # Update tools to use scope
apps/server/src/routes/chat.ts           # Accept scope parameter
apps/web/src/components/Chat/            # Add scope selector
```

---

## Summary

This Global Shared Graph architecture enables:

1. **Efficient Storage** - Documents and graphs stored once, shared by all
2. **Personal Learning** - Each user has their own mastery progress
3. **Organized Content** - Folders and topics provide clear structure
4. **Flexible Scope** - Learn everything, one folder, one topic, or custom selection
5. **Three Modes** - Learn, Chat, Test all work with selected scope
6. **Easy Migration** - Can gradually move from per-user to global

### Key Insight

```
Global = WHAT can be learned (shared curriculum)
Personal = HOW WELL you know it (individual progress)

Same content, different journeys.
```

---

*Last Updated: January 2025*
*Status: Future Planning*
*Depends On: MEMORY_CLUSTER_IMPROVEMENT_PLAN.md*