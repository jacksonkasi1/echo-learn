# Tool UI Integration Plan for Echo Learn

## Executive Summary

After analyzing Echo Learn's current architecture and the Tool UI framework, this document provides a comprehensive assessment of whether Tool UI components are needed across the three modes (Learn, Chat, Test), what specific components would add value, and a phased implementation plan.

**TL;DR:** Tool UI integration is **highly recommended for Test mode**, **optional but beneficial for Learn mode**, and **not needed for Chat mode**. The primary value is in creating structured, interactive quiz interfaces and decision surfaces that integrate with the existing agentic tooling.

---

## Implementation Status

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 0: Foundation | ✅ **COMPLETE** | `@repo/tool-ui` package created with shared utilities |
| Phase 1: OptionList | ✅ **COMPLETE** | OptionList component + QuizQuestionTool registered |
| Phase 2: Plan | ✅ **COMPLETE** | Plan component + TestProgressTool registered |
| Phase 3: Learn Mode | ⏸️ Deferred | Optional - implement based on user feedback |

### What Was Built

1. **`@repo/tool-ui` package** (`packages/tool-ui/`)
   - Shared utilities: `cn`, schema types, `ActionButtons`
   - `OptionList` component for single/multi-select decisions
   - `Plan` component for progress tracking
   - Frontend tool helpers: `QuizQuestion`, `TestProgress`

2. **Backend Tool** (`packages/agentic/src/tools/definitions/present-quiz.tool.ts`)
   - `present_quiz_question` tool for interactive multiple choice
   - LLM can choose when to use it vs plain text questions

3. **Frontend Registrations** (`apps/web/src/components/tool-ui/`)
   - `QuizQuestionTool` - renders OptionList for quiz questions
   - `TestProgressTool` - renders Plan for test session progress
   - Auto-registered in test mode via `MyRuntimeProvider`

---

## Table of Contents

1. [Current Architecture Overview](#current-architecture-overview)
2. [Tool UI Assessment by Mode](#tool-ui-assessment-by-mode)
3. [Recommended Tool UI Components](#recommended-tool-ui-components)
4. [Implementation Plan](#implementation-plan)
5. [Technical Integration Details](#technical-integration-details)
6. [Risk Assessment](#risk-assessment)
7. [Decision Matrix](#decision-matrix)

---

## Current Architecture Overview

### Existing Stack

- **Frontend**: React + assistant-ui (`@assistant-ui/react`) with `LocalRuntime`
- **Backend**: Agentic tools system with tool registry (`packages/agentic`)
- **Modes**: Learn, Chat, Test (defined in `LearningContext`)
- **Tools**: 
  - `search_rag` - Knowledge retrieval
  - `save_learning_progress` - Mastery tracking
  - `generate_adaptive_question` - Quiz question generation
  - `query_graph` - Knowledge graph queries
  - `rerank_documents` - Result re-ranking

### Current User Interaction Flow

```
User Input → Mode Detection → LLM + Tools → Text Stream → UI Render
```

The current implementation renders all tool outputs as text. Tool UIs would add **structured, interactive surfaces** within messages.

---

## Tool UI Assessment by Mode

### 1. Learn Mode

**Current State:**
- Users ask questions, system retrieves from RAG and responds
- Background analysis tracks learning signals passively
- `save_learning_progress` tool updates mastery silently

**Tool UI Assessment: OPTIONAL (Medium Value)**

| Aspect | Analysis |
|--------|----------|
| Primary Interaction | Q&A - text-based works well |
| Where Tool UI Helps | Learning progress visualization, topic cards |
| Pain Point Solved | Users don't see their progress inline |
| Risk of Not Having | Lower engagement, progress feels invisible |

**Recommended Tool UI Components for Learn Mode:**
- `Plan` - Show learning path/roadmap for a topic
- `LinkPreview` - Rich previews for referenced resources
- None required for core functionality

### 2. Chat Mode

**Current State:**
- Off-record conversations
- No learning tracking
- Pure Q&A experience

**Tool UI Assessment: NOT NEEDED**

| Aspect | Analysis |
|--------|----------|
| Primary Interaction | Casual conversation |
| Where Tool UI Helps | Almost nowhere - defeats the purpose |
| Pain Point Solved | None |
| Risk of Not Having | None |

**Recommendation:** Skip Tool UI for Chat mode. It's intentionally lightweight.

### 3. Test Mode

**Current State:**
- `generate_adaptive_question` creates questions
- LLM evaluates answers in text
- `save_learning_progress` updates mastery
- No structured UI for questions/options

**Tool UI Assessment: HIGHLY RECOMMENDED (High Value)**

| Aspect | Analysis |
|--------|----------|
| Primary Interaction | Quiz/test questions with evaluations |
| Where Tool UI Helps | Question display, multiple choice, receipts |
| Pain Point Solved | Questions blur with conversation; answers hard to track |
| Risk of Not Having | Poor UX, test feels like chatting, not testing |

**Recommended Tool UI Components for Test Mode:**
- `OptionList` - Multiple choice questions (CRITICAL)
- `Plan` - Test progress visualization
- Response Actions - Submit answer, skip question, end test

---

## Recommended Tool UI Components

### Priority 1: OptionList for Test Mode (Critical)

**Use Case:** Multiple choice and selection-based quiz questions

**Why It's Needed:**
- Current implementation relies on user typing answers as text
- LLM must parse free-text answers (unreliable)
- No clear visual distinction between question and answer
- No receipt state showing what user selected

**Integration Point:**
```typescript
// Backend tool returns structured question
{
  id: "question-abc123",
  options: [
    { id: "a", label: "Option A", description: "..." },
    { id: "b", label: "Option B", description: "..." },
    { id: "c", label: "Option C", description: "..." },
    { id: "d", label: "Option D", description: "..." }
  ],
  selectionMode: "single",
  responseActions: [
    { id: "submit", label: "Submit Answer", variant: "default" },
    { id: "skip", label: "Skip", variant: "ghost" }
  ]
}
```

**User Flow:**
1. LLM calls `generate_adaptive_question` 
2. Tool returns structured question with options
3. `OptionList` renders inline with clickable options
4. User selects and clicks "Submit"
5. Selection feeds back to LLM for evaluation
6. Component transitions to receipt state showing selection
7. `save_learning_progress` updates mastery

### Priority 2: Plan for Test Progress (Recommended)

**Use Case:** Show test session progress inline

**Why It's Useful:**
- Visual progress indicator (3 of 10 questions)
- Status for each question (completed, current, pending)
- Creates sense of progression

**Integration Point:**
```typescript
{
  id: "test-session-xyz",
  title: "JavaScript Fundamentals Quiz",
  description: "Testing your knowledge of closures, promises, and more",
  todos: [
    { id: "q1", label: "Closures", status: "completed" },
    { id: "q2", label: "Promises", status: "completed" },
    { id: "q3", label: "Event Loop", status: "in_progress" },
    { id: "q4", label: "Prototypes", status: "pending" },
    { id: "q5", label: "Async/Await", status: "pending" }
  ]
}
```

### Priority 3: Response Actions (Recommended)

**Use Case:** Clear action buttons after question/explanation

**Why It's Useful:**
- "I understand" / "Explain more" for learn mode
- "Next Question" / "End Test" for test mode
- Reduces ambiguity in user intent

---

## Implementation Plan

### Phase 0: Foundation ✅ COMPLETE

**Goal:** Set up Tool UI infrastructure without changing existing behavior

**Tasks:**
1. [x] Created `@repo/tool-ui` package at `packages/tool-ui/`
2. [x] Installed Radix UI dependencies (checkbox, radio-group, collapsible)
3. [x] Created shared utilities (cn, schema types, ActionButtons)
4. [x] Added package to web app dependencies

**Files Created:**
```
packages/tool-ui/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    └── shared/
        ├── utils.ts
        ├── schema.ts
        ├── action-buttons.tsx
        └── index.ts
```

### Phase 1: OptionList for Test Mode ✅ COMPLETE

**Goal:** Add interactive multiple choice questions using OptionList

**Tasks:**

1. [x] Created OptionList component with single/multi select support
2. [x] Created `QuizQuestionTool` using `makeAssistantToolUI`
3. [x] Created `present_quiz_question` backend tool
4. [x] Registered tool UI in `MyRuntimeProvider` (test mode only)
5. [x] Updated test-mode.ts with guidance on when to use tool vs plain text

**Key Design Decision:** The LLM decides when to use `present_quiz_question` vs plain text.
- Multiple choice with clear options → use tool
- Open-ended/explanation questions → plain text
- This keeps the system flexible and natural

**Files Created:**
```
packages/tool-ui/src/option-list/
├── option-list.tsx       # Main component
├── schema.ts             # Zod schemas + parsers
└── index.tsx             # Exports + ErrorBoundary

packages/tool-ui/src/tools/
├── quiz-question.tsx     # QuizQuestion wrapper component
└── index.ts

packages/agentic/src/tools/definitions/
└── present-quiz.tool.ts  # Backend tool definition

apps/web/src/components/tool-ui/
├── QuizQuestionTool.tsx  # assistant-ui registration
└── index.ts
```

### Phase 2: Plan for Test Progress ✅ COMPLETE

**Goal:** Show visual test progress inline in conversation

**Tasks:**

1. [x] Created Plan component with progress bar and todo states
2. [x] Created TestProgress wrapper for test session display
3. [x] Created `TestProgressTool` registration for assistant-ui
4. [x] Registered in `MyRuntimeProvider` (test mode only)

**Files Created:**
```
packages/tool-ui/src/plan/
├── plan.tsx              # Main Plan component
├── schema.ts             # Zod schemas + helpers
└── index.tsx             # Exports + ErrorBoundary

packages/tool-ui/src/tools/
└── test-progress.tsx     # TestProgress wrapper

apps/web/src/components/tool-ui/
└── TestProgressTool.tsx  # assistant-ui registration
```

### Phase 3: Learn Mode Enhancements (Optional, 2-3 days)

**Goal:** Add optional visual surfaces for learning

**Tasks:**

1. [ ] Add LinkPreview for resource references
2. [ ] Add Plan for showing learning paths
3. [ ] Add Response Actions for "I understand" / "Explain more"

**Scope:** Only if Phase 1-2 are successful and user feedback requests this.

---

## Technical Integration Details

### Runtime Integration

The current `MyRuntimeProvider` uses `useLocalRuntime` with a custom adapter. Tool UI components need to be registered with assistant-ui:

```typescript
// apps/web/src/components/MyRuntimeProvider.tsx
import { QuizQuestionTool } from "./tool-ui/quiz-question";
import { TestProgressTool } from "./tool-ui/test-progress";

export function MyRuntimeProvider({ children, mode, onRagInfo }) {
  const runtime = useLocalRuntime(adapter, {
    adapters: { speech: speechAdapter },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {/* Tool UIs auto-register when mounted */}
      {mode === "test" && (
        <>
          <QuizQuestionTool />
          <TestProgressTool />
        </>
      )}
      {children}
    </AssistantRuntimeProvider>
  );
}
```

### Tool Schema Alignment

Backend tools must output schemas that match Tool UI's `Serializable*Schema`:

```typescript
// packages/agentic/src/tools/definitions/present-quiz.tool.ts
import { tool } from "ai";
import { z } from "zod";

export const presentQuizTool = tool({
  description: "Present a multiple choice question to the user",
  inputSchema: z.object({
    conceptId: z.string(),
    question: z.string(),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })),
  }),
  outputSchema: z.object({
    id: z.string(),
    options: z.array(z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
    })),
    selectionMode: z.literal("single"),
    responseActions: z.array(z.object({
      id: z.string(),
      label: z.string(),
      variant: z.enum(["default", "secondary", "ghost"]).optional(),
    })),
  }),
  async execute({ conceptId, question, options }) {
    return {
      id: `quiz-${conceptId}-${Date.now()}`,
      options,
      selectionMode: "single" as const,
      responseActions: [
        { id: "submit", label: "Submit Answer", variant: "default" },
        { id: "skip", label: "Skip", variant: "ghost" },
      ],
    };
  },
});
```

### Frontend Tool (addResult flow)

When user clicks "Submit", the selection goes back to the LLM:

```typescript
// Selection flows back via addResult
onConfirm={(selection) => {
  // selection = { id: "option-b", label: "The answer is B" }
  addResult(selection);
  // This triggers the tool to complete and LLM can evaluate
}}
```

The LLM receives the selection and can then:
1. Evaluate correctness
2. Call `save_learning_progress` with `mark_topic_strong` or `mark_topic_weak`
3. Generate feedback text
4. Call next question or end test

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Tool UI complexity delays launch | Medium | High | Start with OptionList only; skip Plan |
| Schema mismatch between backend/frontend | Medium | Medium | Share Zod schemas via `@repo/shared` |
| User prefers text-based answers | Low | Medium | Keep text input as fallback |
| Performance overhead from Tool UI | Low | Low | Components are lightweight |
| Breaking existing test mode | Medium | High | Feature flag; A/B test |

---

## Decision Matrix

| Mode | Tool UI Needed? | Recommended Components | Priority | Effort |
|------|-----------------|------------------------|----------|--------|
| **Test** | YES | OptionList, Plan, Response Actions | P0 | 5-8 days |
| **Learn** | Optional | Plan, LinkPreview | P2 | 3-5 days |
| **Chat** | NO | None | - | - |

---

## Conclusion

### Do We Need Tool UI?

**Yes, specifically for Test mode.** The current text-based quiz experience is suboptimal:
- Users must type answers (friction)
- LLM must parse free-text (unreliable)
- No visual distinction between question/answer
- No receipt showing what was selected

Tool UI's `OptionList` component directly solves this with:
- Clickable options (less friction)
- Structured selection (reliable)
- Visual question card (clear UX)
- Receipt state (audit trail)

### Implementation Complete ✅

Phases 0-2 have been implemented:

1. **@repo/tool-ui package** - Reusable Tool UI components
2. **present_quiz_question tool** - Backend tool for multiple choice
3. **QuizQuestionTool** - Frontend assistant-ui registration
4. **Plan + TestProgressTool** - Progress visualization

### Key Design Principles Applied

1. **LLM decides format**: The agent chooses when to use `present_quiz_question` vs plain text based on question type
2. **Test mode only**: Tool UIs only registered in test mode to keep other modes lightweight
3. **Separate package**: `@repo/tool-ui` is a standalone package for reusability
4. **Receipt states**: OptionList shows confirmed selections for audit trail

### Next Steps (If Needed)

1. **Phase 3 (Learn mode)**: Add Plan for learning paths, LinkPreview for resources
2. **Enhanced quiz types**: Add image-based questions, drag-and-drop
3. **Analytics integration**: Track tool UI usage patterns

---

## Appendix: Tool UI Component Reference

| Component | Role | Use Case in Echo Learn |
|-----------|------|------------------------|
| OptionList | Decision | Multiple choice quiz questions |
| Plan | State | Test progress, learning paths |
| DataTable | Information | Analytics, concept lists |
| LinkPreview | Information | Resource references |
| Image | Information | Diagrams, visual content |
| Response Actions | Control | Submit, skip, continue actions |

For full documentation, see: https://www.tool-ui.com/docs/