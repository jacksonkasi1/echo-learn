# Echo-Learn Test Mode Development Plan

> **Enhanced Test Mode** - Transform the testing experience with scenario-based questions, smart configuration, and detailed feedback

---

## Overview

This development plan outlines the implementation of enhanced Test Mode features for Echo-Learn. The goal is to transform Test Mode from a simple quiz feature into a **trusted assessment tool** that evaluates practical understanding, provides meaningful feedback, and respects user preferences.

### Current State

Test Mode already has:
- ✅ Test session management (`packages/agentic/src/modes/test-mode.ts`)
- ✅ Adaptive difficulty based on performance
- ✅ Question types: `definition`, `application`, `comparison`, `analysis`
- ✅ Mastery tracking and scoring
- ✅ Quiz UI component (`QuizQuestionTool.tsx`)
- ✅ Session progress tracking

### What's Been Implemented (Phases 1-3)

- ✅ Test configuration UI before starting
- ✅ Context reset when switching to Test Mode
- ✅ Scenario-based question generation prompts
- ✅ Detailed per-answer feedback with concept explanation
- ✅ End-of-test summary with recommendations
- ✅ Timed vs untimed test options
- ✅ Skill level selection (Beginner/Intermediate/Pro)

### Remaining (Phase 4-5)

- ❌ Full timer integration with auto-submit
- ❌ Accessibility enhancements
- ❌ End-to-end integration testing

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        TEST MODE ENHANCEMENT ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (apps/web)                           │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │   │
│  │  │ TestConfigModal │  │ TestModeContext │  │ TestResultsSummary  │   │   │
│  │  │                 │  │                 │  │                     │   │   │
│  │  │ • Difficulty    │  │ • Session state │  │ • Score display     │   │   │
│  │  │ • Question type │  │ • Timer         │  │ • Per-concept       │   │   │
│  │  │ • Timer toggle  │  │ • Config        │  │   breakdown         │   │   │
│  │  │ • Skill level   │  │ • Context reset │  │ • Recommendations   │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │   │
│  │                                                                       │   │
│  │  ┌───────────────────────────────────────────────────────────────┐   │   │
│  │  │                    QuizQuestionTool (Enhanced)                 │   │   │
│  │  │                                                                │   │   │
│  │  │  • Scenario-based question rendering                           │   │   │
│  │  │  • Timer display (when enabled)                                │   │   │
│  │  │  • Answer feedback panel                                       │   │   │
│  │  │  • Concept tag display                                         │   │   │
│  │  └───────────────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                       BACKEND (packages/agentic)                      │   │
│  │                                                                       │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────┐   │   │
│  │  │ test-mode.ts    │  │ test-prompts.ts │  │ scenario-generator  │   │   │
│  │  │ (Enhanced)      │  │ (New)           │  │ (New)               │   │   │
│  │  │                 │  │                 │  │                     │   │   │
│  │  │ • Config input  │  │ • Scenario      │  │ • Real-world        │   │   │
│  │  │ • Timer logic   │  │   templates     │  │   context builder   │   │   │
│  │  │ • Skill mapping │  │ • Feedback      │  │ • Domain-specific   │   │   │
│  │  │                 │  │   templates     │  │   scenarios         │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        STORAGE (packages/storage)                     │   │
│  │                                                                       │   │
│  │  • Test session config persistence                                    │   │
│  │  • Timer state persistence                                            │   │
│  │  • Enhanced results storage with feedback                             │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# Phase I: Test Configuration & Context Management

> **Goal:** Implement pre-test configuration UI and ensure clean context separation when entering Test Mode

---

## Task 1.1: Test Configuration Modal Component

**Description:** Create a configuration modal that appears before starting Test Mode, allowing users to customize their test experience.

**Status:** ✅ COMPLETED

**Files Created:**
- `packages/shared/src/types/test-config.ts` - Configuration types and constants
- `apps/web/src/components/test-mode/TestConfigModal.tsx` - Configuration modal UI

**Files to Create:**
- `apps/web/src/components/test-mode/TestConfigModal.tsx`
- `apps/web/src/components/test-mode/index.ts`

**Configuration Options:**

```typescript
// packages/shared/src/types/test-config.ts

/**
 * Skill level mapping to internal difficulty
 * User-friendly names that map to technical difficulty
 */
export type SkillLevel = 'beginner' | 'intermediate' | 'pro'

/**
 * Question style preference
 */
export type QuestionStyle = 'scenario' | 'concept' | 'mixed'

/**
 * Test timing mode
 */
export type TimingMode = 'timed' | 'untimed'

/**
 * Complete test configuration from user input
 */
export interface TestConfiguration {
  // Skill & Difficulty
  skillLevel: SkillLevel
  
  // Question Preferences
  questionStyle: QuestionStyle
  questionCount: number  // 5, 10, 15, 20
  
  // Timing
  timingMode: TimingMode
  timePerQuestion?: number  // seconds (30, 60, 90, 120)
  totalTimeLimit?: number   // minutes (optional hard cap)
  
  // Focus Areas (optional)
  focusConceptIds?: string[]
}

/**
 * Skill level to difficulty mapping
 */
export const SKILL_LEVEL_DIFFICULTY_MAP: Record<SkillLevel, QuestionDifficulty> = {
  beginner: 'easy',
  intermediate: 'medium', 
  pro: 'hard'
}

/**
 * Default test configuration
 */
export const DEFAULT_TEST_CONFIGURATION: TestConfiguration = {
  skillLevel: 'intermediate',
  questionStyle: 'mixed',
  questionCount: 10,
  timingMode: 'untimed',
  timePerQuestion: 60,
}
```

**UI Component Structure:**

```tsx
// apps/web/src/components/test-mode/TestConfigModal.tsx

interface TestConfigModalProps {
  isOpen: boolean
  onClose: () => void
  onStartTest: (config: TestConfiguration) => void
  availableConcepts?: Array<{ id: string; label: string }>
}

export function TestConfigModal({ 
  isOpen, 
  onClose, 
  onStartTest,
  availableConcepts 
}: TestConfigModalProps) {
  const [config, setConfig] = useState<TestConfiguration>(DEFAULT_TEST_CONFIGURATION)
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Configure Your Test</DialogTitle>
          <DialogDescription>
            Customize your test experience before starting.
          </DialogDescription>
        </DialogHeader>
        
        {/* Skill Level Selection */}
        <div className="space-y-4">
          <div>
            <Label>Skill Level</Label>
            <RadioGroup 
              value={config.skillLevel}
              onValueChange={(v) => setConfig(c => ({ ...c, skillLevel: v as SkillLevel }))}
            >
              <RadioGroupItem value="beginner" label="Beginner" />
              <RadioGroupItem value="intermediate" label="Intermediate" />
              <RadioGroupItem value="pro" label="Pro" />
            </RadioGroup>
          </div>
          
          {/* Question Style */}
          <div>
            <Label>Question Type</Label>
            <Select 
              value={config.questionStyle}
              onValueChange={(v) => setConfig(c => ({ ...c, questionStyle: v as QuestionStyle }))}
            >
              <SelectItem value="scenario">Scenario-Based</SelectItem>
              <SelectItem value="concept">Concept-Based</SelectItem>
              <SelectItem value="mixed">Mixed</SelectItem>
            </Select>
          </div>
          
          {/* Timing Mode */}
          <div>
            <Label>Timing</Label>
            <RadioGroup 
              value={config.timingMode}
              onValueChange={(v) => setConfig(c => ({ ...c, timingMode: v as TimingMode }))}
            >
              <RadioGroupItem value="untimed" label="Untimed (No pressure)" />
              <RadioGroupItem value="timed" label="Timed (Per question)" />
            </RadioGroup>
          </div>
          
          {/* Time per question (conditional) */}
          {config.timingMode === 'timed' && (
            <div>
              <Label>Seconds per Question</Label>
              <Select 
                value={String(config.timePerQuestion)}
                onValueChange={(v) => setConfig(c => ({ ...c, timePerQuestion: Number(v) }))}
              >
                <SelectItem value="30">30 seconds</SelectItem>
                <SelectItem value="60">60 seconds</SelectItem>
                <SelectItem value="90">90 seconds</SelectItem>
                <SelectItem value="120">2 minutes</SelectItem>
              </Select>
            </div>
          )}
          
          {/* Question Count */}
          <div>
            <Label>Number of Questions</Label>
            <Select 
              value={String(config.questionCount)}
              onValueChange={(v) => setConfig(c => ({ ...c, questionCount: Number(v) }))}
            >
              <SelectItem value="5">5 questions</SelectItem>
              <SelectItem value="10">10 questions</SelectItem>
              <SelectItem value="15">15 questions</SelectItem>
              <SelectItem value="20">20 questions</SelectItem>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onStartTest(config)}>Start Test</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

**Acceptance Criteria:**
- [ ] Modal displays when user clicks "Start Test" in Test Mode
- [ ] All configuration options are selectable
- [ ] Configuration is validated before starting
- [ ] Default values are sensible for first-time users
- [ ] Modal can be dismissed without starting test

---

## Task 1.2: Context Reset on Mode Switch

**Description:** When switching from Study Mode to Test Mode, automatically clear chat history and start a fresh session to prevent answer leakage.

**Status:** ✅ COMPLETED

**Files Modified:**
- `apps/web/src/components/learning/LearningContext.tsx` - Added runtimeKey and context reset logic
- `apps/web/src/components/learning/ModeSelector.tsx` - Opens config modal for test mode
- `apps/web/src/routes/index.tsx` - Uses runtimeKey to force re-mount

**Files to Modify:**
- `apps/web/src/components/learning/LearningContext.tsx`
- `apps/web/src/components/MyRuntimeProvider.tsx`

**Implementation Strategy:**

```typescript
// apps/web/src/components/learning/LearningContext.tsx

export function LearningProvider({ children }: { children: ReactNode }) {
  // ... existing state ...
  
  // NEW: Track if we need to reset the runtime
  const [shouldResetRuntime, setShouldResetRuntime] = useState(false)
  const [testConfig, setTestConfig] = useState<TestConfiguration | null>(null)
  
  // NEW: Enhanced mode setter that triggers reset for test mode
  const handleModeChange = useCallback((newMode: ChatMode) => {
    const previousMode = mode
    
    // If switching TO test mode, we need a clean slate
    if (newMode === 'test' && previousMode !== 'test') {
      setShouldResetRuntime(true)
      // Clear all conversation context
      clearDiscussedConcepts()
      clearSuggestions()
    }
    
    setMode(newMode)
  }, [mode, clearDiscussedConcepts, clearSuggestions])
  
  // NEW: Callback after runtime has been reset
  const onRuntimeReset = useCallback(() => {
    setShouldResetRuntime(false)
  }, [])
  
  // NEW: Start test with configuration
  const startTestWithConfig = useCallback((config: TestConfiguration) => {
    setTestConfig(config)
    handleModeChange('test')
  }, [handleModeChange])
  
  return (
    <LearningContext.Provider
      value={{
        // ... existing values ...
        setMode: handleModeChange,  // Use new handler
        shouldResetRuntime,
        onRuntimeReset,
        testConfig,
        startTestWithConfig,
      }}
    >
      {children}
    </LearningContext.Provider>
  )
}
```

```typescript
// apps/web/src/components/MyRuntimeProvider.tsx

export function MyRuntimeProvider({
  children,
  mode,
  onRagInfo,
}: Readonly<MyRuntimeProviderProps>) {
  const { shouldResetRuntime, onRuntimeReset, testConfig } = useLearningContext()
  
  // Create a key that changes when we need to reset
  const [runtimeKey, setRuntimeKey] = useState(0)
  
  // Reset runtime when switching to test mode
  useEffect(() => {
    if (shouldResetRuntime) {
      setRuntimeKey(k => k + 1)  // Force re-mount of runtime
      onRuntimeReset()
    }
  }, [shouldResetRuntime, onRuntimeReset])
  
  // ... rest of implementation with key={runtimeKey} on runtime components
}
```

**UI Flow:**

1. User is in Study Mode, asks questions, gets answers
2. User clicks "Test" mode button
3. `TestConfigModal` appears (from Task 1.1)
4. User configures and clicks "Start Test"
5. Context is cleared, runtime is reset
6. Fresh test session begins with no prior context

**Acceptance Criteria:**
- [ ] Switching to Test Mode clears all chat history
- [ ] Previous conversation context is not accessible during test
- [ ] Return to Study Mode preserves test isolation
- [ ] User receives visual confirmation of "new session"

---

## Task 1.3: Test Mode Context Provider

**Description:** Create a dedicated context provider for Test Mode state management, separate from learning context.

**Status:** ✅ COMPLETED

**Files Created:**
- `apps/web/src/components/test-mode/TestModeContext.tsx` - Dedicated test mode state
- `apps/web/src/components/test-mode/index.ts` - Exports all test-mode components

**Files to Create:**
- `apps/web/src/components/test-mode/TestModeContext.tsx`

**Implementation:**

```typescript
// apps/web/src/components/test-mode/TestModeContext.tsx

import { createContext, useContext, useState, useCallback } from 'react'
import type { ReactNode } from 'react'
import type { 
  TestConfiguration, 
  TestSession, 
  TestQuestion,
  TestResult 
} from '@repo/shared'

interface TestModeContextType {
  // Configuration
  config: TestConfiguration | null
  setConfig: (config: TestConfiguration) => void
  
  // Session State
  session: TestSession | null
  currentQuestion: TestQuestion | null
  questionIndex: number
  
  // Timer State (when timed mode)
  timeRemaining: number | null
  isTimerRunning: boolean
  startTimer: () => void
  pauseTimer: () => void
  
  // Results
  results: TestResult[]
  addResult: (result: TestResult) => void
  
  // Actions
  startSession: (config: TestConfiguration) => Promise<void>
  submitAnswer: (answer: string) => Promise<TestResult>
  skipQuestion: () => Promise<void>
  endSession: () => Promise<TestSessionSummary>
  
  // Feedback Display
  currentFeedback: AnswerFeedback | null
  showFeedback: (feedback: AnswerFeedback) => void
  clearFeedback: () => void
}

interface AnswerFeedback {
  isCorrect: boolean
  evaluation: 'correct' | 'partial' | 'incorrect'
  explanation: string
  conceptEvaluated: string
  correctAnswer?: string
}

const TestModeContext = createContext<TestModeContextType | undefined>(undefined)

export function TestModeProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<TestConfiguration | null>(null)
  const [session, setSession] = useState<TestSession | null>(null)
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  const [results, setResults] = useState<TestResult[]>([])
  const [currentFeedback, setCurrentFeedback] = useState<AnswerFeedback | null>(null)
  
  // Timer effect
  useEffect(() => {
    if (!isTimerRunning || timeRemaining === null || timeRemaining <= 0) return
    
    const interval = setInterval(() => {
      setTimeRemaining(t => {
        if (t === null || t <= 1) {
          setIsTimerRunning(false)
          // Auto-submit on timeout
          handleTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isTimerRunning, timeRemaining])
  
  const startSession = useCallback(async (testConfig: TestConfiguration) => {
    setConfig(testConfig)
    // API call to create session
    const newSession = await api.startTestSession(testConfig)
    setSession(newSession)
    
    if (testConfig.timingMode === 'timed') {
      setTimeRemaining(testConfig.timePerQuestion || 60)
    }
  }, [])
  
  // ... other methods
  
  return (
    <TestModeContext.Provider value={{
      config,
      setConfig,
      session,
      currentQuestion: session?.questions[session.currentIndex] ?? null,
      questionIndex: session?.currentIndex ?? 0,
      timeRemaining,
      isTimerRunning,
      startTimer: () => setIsTimerRunning(true),
      pauseTimer: () => setIsTimerRunning(false),
      results,
      addResult: (r) => setResults(prev => [...prev, r]),
      startSession,
      submitAnswer,
      skipQuestion,
      endSession,
      currentFeedback,
      showFeedback: setCurrentFeedback,
      clearFeedback: () => setCurrentFeedback(null),
    }}>
      {children}
    </TestModeContext.Provider>
  )
}

export function useTestMode() {
  const context = useContext(TestModeContext)
  if (!context) {
    throw new Error('useTestMode must be used within TestModeProvider')
  }
  return context
}
```

**Acceptance Criteria:**
- [ ] Test state is isolated from learning state
- [ ] Timer functionality works correctly
- [ ] Session can be started, progressed, and ended
- [ ] Feedback can be displayed and cleared

---

# Phase II: Scenario-Based Question Generation

> **Goal:** Implement real-world scenario question generation that tests practical understanding

---

## Task 2.1: Scenario Question Types Definition

**Description:** Define the structure and types for scenario-based questions.

**Status:** ✅ COMPLETED

**Files Modified:**
- `packages/shared/src/types/test-config.ts` - Added ScenarioContext, ScenarioType
- `packages/shared/src/types/test-session.ts` - Added scenario fields to TestQuestion
- `packages/shared/src/types/index.ts` - Exported new types

**Files to Modify:**
- `packages/shared/src/types/learning.ts`
- `packages/shared/src/types/test-session.ts`

**New Types:**

```typescript
// packages/shared/src/types/learning.ts

/**
 * Extended question types including scenarios
 */
export type QuestionType =
  | 'definition'      // "What is X?"
  | 'application'     // "How would you use X?"
  | 'comparison'      // "Compare X and Y"
  | 'analysis'        // "Why does X happen?"
  | 'scenario_decision'   // "Given situation S, what would you do?"
  | 'scenario_debug'      // "This code/process has issue I, fix it"
  | 'scenario_design'     // "Design a solution for problem P"

/**
 * Scenario context for scenario-based questions
 */
export interface ScenarioContext {
  /** Brief setup of the scenario */
  situation: string
  
  /** Role the user plays in this scenario */
  role?: string
  
  /** Constraints or requirements */
  constraints?: string[]
  
  /** Background information */
  background?: string
  
  /** Domain/industry context */
  domain?: string
}

/**
 * Extended test question with scenario support
 */
export interface TestQuestion {
  questionId: string
  conceptId: string
  conceptLabel: string
  difficulty: QuestionDifficulty
  questionType: QuestionType
  question: string
  expectedAnswer: string
  hints?: string[]
  createdAt: string
  
  // NEW: Scenario-specific fields
  scenario?: ScenarioContext
  isScenarioBased: boolean
}
```

**Acceptance Criteria:**
- [ ] New question types are defined
- [ ] Scenario context structure is complete
- [ ] Types are exported from shared package

---

## Task 2.2: Scenario Generation Prompts

**Description:** Create specialized prompts for generating scenario-based questions from knowledge context.

**Status:** ✅ COMPLETED

**Files Created:**
- `packages/agentic/src/prompts/scenario.ts` - Scenario generation and evaluation prompts
- Updated `packages/agentic/src/prompts/index.ts` - Exported scenario prompts

**Files to Create:**
- `packages/agentic/src/prompts/scenario-prompts.ts`

**Implementation:**

```typescript
// packages/agentic/src/prompts/scenario-prompts.ts

import type { QuestionDifficulty, ScenarioContext } from '@repo/shared'

/**
 * Template for generating scenario-based questions
 */
export function getScenarioGenerationPrompt(
  conceptLabel: string,
  conceptContext: string,
  difficulty: QuestionDifficulty,
  scenarioType: 'decision' | 'debug' | 'design'
): string {
  const difficultyGuidelines = {
    easy: 'straightforward situation with clear best answer',
    medium: 'realistic situation with some ambiguity requiring reasoning',
    hard: 'complex situation with multiple valid approaches and trade-offs'
  }
  
  const scenarioTypeGuidelines = {
    decision: `Create a scenario where the user must make a decision about ${conceptLabel}.
The scenario should present a realistic workplace or project situation.
Include relevant context but don't give away the answer.`,
    
    debug: `Create a scenario where something related to ${conceptLabel} is not working correctly.
Present symptoms/error messages the user would see.
The user must identify and explain how to fix the issue.`,
    
    design: `Create a scenario where the user must design or plan something using ${conceptLabel}.
Provide requirements and constraints.
The user should demonstrate understanding by proposing a solution.`
  }
  
  return `You are creating a scenario-based test question about: ${conceptLabel}

CONCEPT CONTEXT:
${conceptContext}

DIFFICULTY: ${difficulty} - ${difficultyGuidelines[difficulty]}

SCENARIO TYPE: ${scenarioType}
${scenarioTypeGuidelines[scenarioType]}

Generate a scenario-based question with the following structure:

1. SCENARIO SETUP (2-4 sentences):
   - Set the scene with relevant context
   - Define the user's role if applicable
   - Include realistic constraints

2. THE QUESTION (1-2 sentences):
   - Clear, actionable question
   - Should require understanding of ${conceptLabel}

3. EXPECTED ANSWER ELEMENTS:
   - Key points a correct answer must include
   - What demonstrates understanding vs. surface knowledge

OUTPUT FORMAT (JSON):
{
  "scenario": {
    "situation": "...",
    "role": "...",
    "constraints": ["...", "..."],
    "domain": "..."
  },
  "question": "...",
  "expectedAnswerElements": ["...", "..."],
  "conceptBeingTested": "${conceptLabel}",
  "whyThisTests": "Brief explanation of what understanding this question evaluates"
}

Make the scenario feel real and practical, not academic. The user should feel like they're solving a real problem.`
}

/**
 * Prompt for evaluating scenario-based answers
 */
export function getScenarioEvaluationPrompt(
  question: string,
  scenario: ScenarioContext,
  expectedElements: string[],
  userAnswer: string,
  conceptLabel: string
): string {
  return `You are evaluating a user's answer to a scenario-based question.

SCENARIO:
${scenario.situation}
${scenario.role ? `Role: ${scenario.role}` : ''}
${scenario.constraints ? `Constraints: ${scenario.constraints.join(', ')}` : ''}

QUESTION:
${question}

CONCEPT BEING TESTED: ${conceptLabel}

EXPECTED ANSWER ELEMENTS:
${expectedElements.map((e, i) => `${i + 1}. ${e}`).join('\n')}

USER'S ANSWER:
${userAnswer}

Evaluate the answer and provide:

1. EVALUATION: "correct" | "partial" | "incorrect"
   - correct: Addresses most expected elements with understanding
   - partial: Shows some understanding but misses key points
   - incorrect: Misunderstands the concept or scenario

2. FEEDBACK (2-3 sentences):
   - What they got right (be encouraging)
   - What was missing or incorrect (be constructive)
   - Brief explanation of the correct approach

3. CONCEPT SUMMARY (1 sentence):
   - What this question was testing about ${conceptLabel}

OUTPUT FORMAT (JSON):
{
  "evaluation": "correct|partial|incorrect",
  "feedback": "...",
  "conceptSummary": "This question tested your understanding of...",
  "correctApproach": "The ideal answer would..." // Only if not correct
}`
}
```

**Acceptance Criteria:**
- [ ] Scenario generation prompts produce realistic questions
- [ ] Evaluation prompts provide constructive feedback
- [ ] Different scenario types are supported
- [ ] Difficulty levels affect scenario complexity

---

## Task 2.3: Scenario Generator Service

**Description:** Create a service that generates scenario-based questions using RAG context and LLM.

**Status:** ✅ COMPLETED (Prompts ready, integrated with existing adaptive-question tool)

**Implementation Notes:**
- Scenario prompts created in `packages/agentic/src/prompts/scenario.ts`
- Can be used by the existing `generate_adaptive_question` tool
- Includes decision, debug, and design scenario types

**Files to Create:**
- `packages/agentic/src/scenarios/scenario-generator.ts`
- `packages/agentic/src/scenarios/index.ts`

**Implementation:**

```typescript
// packages/agentic/src/scenarios/scenario-generator.ts

import type { 
  TestQuestion, 
  QuestionDifficulty, 
  ScenarioContext,
  QuestionType 
} from '@repo/shared'
import { retrieveContext } from '@repo/rag'
import { generateObject } from '@repo/llm'
import { getScenarioGenerationPrompt } from '../prompts/scenario-prompts'
import { logger } from '@repo/logs'

export interface GenerateScenarioOptions {
  userId: string
  conceptId: string
  conceptLabel: string
  difficulty: QuestionDifficulty
  scenarioType?: 'decision' | 'debug' | 'design'
  avoidQuestionIds?: string[]
}

export interface GeneratedScenarioQuestion {
  question: TestQuestion
  reasoning: string
  contextUsed: string[]
}

/**
 * Generate a scenario-based question for a concept
 */
export async function generateScenarioQuestion(
  options: GenerateScenarioOptions
): Promise<GeneratedScenarioQuestion> {
  const {
    userId,
    conceptId,
    conceptLabel,
    difficulty,
    scenarioType = 'decision'
  } = options
  
  logger.info('Generating scenario question', { 
    conceptId, 
    difficulty, 
    scenarioType 
  })
  
  // Retrieve relevant context for the concept
  const contextResult = await retrieveContext(
    `${conceptLabel} practical applications examples real-world usage`,
    userId,
    { topK: 10, minScore: 0.3 }
  )
  
  const conceptContext = contextResult.chunks.join('\n\n')
  
  // Generate the scenario question
  const prompt = getScenarioGenerationPrompt(
    conceptLabel,
    conceptContext,
    difficulty,
    scenarioType
  )
  
  const result = await generateObject({
    prompt,
    schema: scenarioQuestionSchema,
  })
  
  const questionType: QuestionType = 
    scenarioType === 'decision' ? 'scenario_decision' :
    scenarioType === 'debug' ? 'scenario_debug' : 'scenario_design'
  
  const testQuestion: TestQuestion = {
    questionId: generateQuestionId(),
    conceptId,
    conceptLabel,
    difficulty,
    questionType,
    question: result.question,
    expectedAnswer: result.expectedAnswerElements.join('; '),
    scenario: result.scenario,
    isScenarioBased: true,
    createdAt: new Date().toISOString(),
  }
  
  return {
    question: testQuestion,
    reasoning: result.whyThisTests,
    contextUsed: contextResult.sources,
  }
}

/**
 * Generate multiple scenario questions for a test session
 */
export async function generateScenarioQuestions(
  userId: string,
  concepts: Array<{ id: string; label: string }>,
  count: number,
  difficulty: QuestionDifficulty
): Promise<GeneratedScenarioQuestion[]> {
  const questions: GeneratedScenarioQuestion[] = []
  const scenarioTypes = ['decision', 'debug', 'design'] as const
  
  for (let i = 0; i < count; i++) {
    const concept = concepts[i % concepts.length]
    const scenarioType = scenarioTypes[i % scenarioTypes.length]
    
    try {
      const question = await generateScenarioQuestion({
        userId,
        conceptId: concept.id,
        conceptLabel: concept.label,
        difficulty,
        scenarioType,
        avoidQuestionIds: questions.map(q => q.question.questionId)
      })
      
      questions.push(question)
    } catch (error) {
      logger.error('Failed to generate scenario question', { 
        conceptId: concept.id, 
        error 
      })
    }
  }
  
  return questions
}
```

**Acceptance Criteria:**
- [ ] Scenarios are generated from user's uploaded content
- [ ] Different scenario types produce distinct question styles
- [ ] Generated questions are coherent and testable
- [ ] Context from RAG is properly utilized

---

# Phase III: Enhanced Feedback & Scoring

> **Goal:** Provide detailed, constructive feedback on each answer with concept-level breakdown

---

## Task 3.1: Answer Feedback Component

**Description:** Create a component that displays detailed feedback after each answer.

**Status:** ✅ COMPLETED

**Files Created:**
- `apps/web/src/components/test-mode/AnswerFeedback.tsx` - Feedback UI component

**Files to Create:**
- `apps/web/src/components/test-mode/AnswerFeedback.tsx`

**Implementation:**

```tsx
// apps/web/src/components/test-mode/AnswerFeedback.tsx

import { CheckCircle, XCircle, AlertCircle, Lightbulb } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AnswerFeedbackProps {
  evaluation: 'correct' | 'partial' | 'incorrect'
  feedback: string
  conceptEvaluated: string
  conceptSummary: string
  correctApproach?: string
  onContinue: () => void
}

export function AnswerFeedback({
  evaluation,
  feedback,
  conceptEvaluated,
  conceptSummary,
  correctApproach,
  onContinue
}: AnswerFeedbackProps) {
  const evaluationConfig = {
    correct: {
      icon: CheckCircle,
      title: 'Correct!',
      bgColor: 'bg-green-50 dark:bg-green-950/30',
      borderColor: 'border-green-200 dark:border-green-800',
      iconColor: 'text-green-500',
    },
    partial: {
      icon: AlertCircle,
      title: 'Partially Correct',
      bgColor: 'bg-yellow-50 dark:bg-yellow-950/30',
      borderColor: 'border-yellow-200 dark:border-yellow-800',
      iconColor: 'text-yellow-500',
    },
    incorrect: {
      icon: XCircle,
      title: 'Not Quite',
      bgColor: 'bg-red-50 dark:bg-red-950/30',
      borderColor: 'border-red-200 dark:border-red-800',
      iconColor: 'text-red-500',
    },
  }
  
  const config = evaluationConfig[evaluation]
  const Icon = config.icon
  
  return (
    <div className={cn(
      'rounded-xl border p-6 space-y-4',
      config.bgColor,
      config.borderColor
    )}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <Icon className={cn('size-8', config.iconColor)} />
        <h3 className="text-xl font-semibold">{config.title}</h3>
      </div>
      
      {/* Feedback */}
      <p className="text-muted-foreground">{feedback}</p>
      
      {/* Correct Approach (if not correct) */}
      {correctApproach && (
        <div className="flex items-start gap-2 p-3 bg-background/50 rounded-lg">
          <Lightbulb className="size-5 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-sm">Better Approach</p>
            <p className="text-sm text-muted-foreground">{correctApproach}</p>
          </div>
        </div>
      )}
      
      {/* Concept Badge */}
      <div className="pt-2 border-t">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Concept Tested:
          </span>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
            {conceptEvaluated}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">{conceptSummary}</p>
      </div>
      
      {/* Continue Button */}
      <Button 
        onClick={onContinue} 
        className="w-full"
      >
        Continue to Next Question
      </Button>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Feedback clearly indicates correct/partial/incorrect
- [ ] Concept being tested is displayed
- [ ] Constructive feedback helps user understand mistakes
- [ ] Visual design matches evaluation result

---

## Task 3.2: Test Results Summary Component

**Description:** Create a comprehensive end-of-test summary with score breakdown and recommendations.

**Status:** ✅ COMPLETED

**Files Created:**
- `apps/web/src/components/test-mode/TestResultsSummary.tsx` - Summary UI component

**Files to Create:**
- `apps/web/src/components/test-mode/TestResultsSummary.tsx`

**Implementation:**

```tsx
// apps/web/src/components/test-mode/TestResultsSummary.tsx

import { Trophy, Target, TrendingUp, BookOpen } from 'lucide-react'
import type { TestSessionSummary } from '@repo/shared'

interface TestResultsSummaryProps {
  summary: TestSessionSummary
  onRetake: () => void
  onReview: (conceptId: string) => void
  onClose: () => void
}

export function TestResultsSummary({
  summary,
  onRetake,
  onReview,
  onClose
}: TestResultsSummaryProps) {
  const scorePercentage = Math.round(summary.score)
  const scoreLevel = 
    scorePercentage >= 90 ? 'Excellent' :
    scorePercentage >= 70 ? 'Good' :
    scorePercentage >= 50 ? 'Needs Work' : 'Keep Practicing'
  
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Score Header */}
      <div className="text-center space-y-2">
        <Trophy className="size-12 mx-auto text-yellow-500" />
        <h2 className="text-3xl font-bold">Test Complete!</h2>
        <div className="text-6xl font-bold text-primary">{scorePercentage}%</div>
        <p className="text-muted-foreground">{scoreLevel}</p>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg text-center">
          <div className="text-2xl font-bold text-green-600">{summary.correct.length}</div>
          <div className="text-sm text-muted-foreground">Correct</div>
        </div>
        <div className="p-4 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg text-center">
          <div className="text-2xl font-bold text-yellow-600">{summary.partial.length}</div>
          <div className="text-sm text-muted-foreground">Partial</div>
        </div>
        <div className="p-4 bg-red-50 dark:bg-red-950/30 rounded-lg text-center">
          <div className="text-2xl font-bold text-red-600">{summary.incorrect.length}</div>
          <div className="text-sm text-muted-foreground">Incorrect</div>
        </div>
      </div>
      
      {/* Concepts Breakdown */}
      <div className="space-y-4">
        <h3 className="font-semibold flex items-center gap-2">
          <Target className="size-5" />
          Concept Performance
        </h3>
        
        {/* Strong Areas */}
        {summary.correct.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-green-600">Strong Areas</p>
            <div className="flex flex-wrap gap-2">
              {summary.correct.map((item) => (
                <span 
                  key={item.conceptId}
                  className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full text-sm"
                >
                  {item.conceptLabel}
                </span>
              ))}
            </div>
          </div>
        )}
        
        {/* Needs Review */}
        {(summary.incorrect.length > 0 || summary.partial.length > 0) && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-orange-600">Needs Review</p>
            <div className="space-y-2">
              {[...summary.incorrect, ...summary.partial].map((item) => (
                <div 
                  key={item.conceptId}
                  className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{item.conceptLabel}</p>
                    <p className="text-xs text-muted-foreground">
                      Mastery: {Math.round(item.masteryBefore * 100)}% → {Math.round(item.masteryAfter * 100)}%
                    </p>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onReview(item.conceptId)}
                  >
                    <BookOpen className="size-4 mr-1" />
                    Review
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      
      {/* Recommendations */}
      {summary.recommendations.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold flex items-center gap-2">
            <TrendingUp className="size-5" />
            Recommendations
          </h3>
          <ul className="space-y-2">
            {summary.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="text-primary">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onClose} className="flex-1">
          Done
        </Button>
        <Button onClick={onRetake} className="flex-1">
          Take Another Test
        </Button>
      </div>
    </div>
  )
}
```

**Acceptance Criteria:**
- [ ] Score is prominently displayed
- [ ] Concept breakdown shows performance per topic
- [ ] Review buttons link to study mode for weak areas
- [ ] Recommendations are actionable and helpful

---

## Task 3.3: Enhanced Evaluation Service

**Description:** Improve the answer evaluation to provide detailed, constructive feedback.

**Status:** ✅ COMPLETED

**Files Created/Modified:**
- `packages/agentic/src/prompts/scenario.ts` - Includes `getScenarioEvaluationPrompt` and `getConceptEvaluationPrompt`
- `apps/server/src/routes/learning/test.ts` - Test mode API routes
- `apps/web/src/api/test.ts` - Frontend API client

**Files to Modify:**
- `packages/agentic/src/modes/test-mode.ts`

**Files to Create:**
- `packages/agentic/src/evaluation/answer-evaluator.ts`

**Implementation:**

```typescript
// packages/agentic/src/evaluation/answer-evaluator.ts

import type { 
  TestQuestion, 
  AnswerEvaluation,
  ScenarioContext 
} from '@repo/shared'
import { generateObject } from '@repo/llm'
import { getScenarioEvaluationPrompt, getConceptEvaluationPrompt } from '../prompts'
import { logger } from '@repo/logs'

export interface DetailedEvaluation {
  evaluation: AnswerEvaluation
  feedback: string
  conceptSummary: string
  correctApproach?: string
  keyPointsHit: string[]
  keyPointsMissed: string[]
  confidence: number
}

/**
 * Evaluate a user's answer with detailed feedback
 */
export async function evaluateAnswer(
  question: TestQuestion,
  userAnswer: string
): Promise<DetailedEvaluation> {
  logger.info('Evaluating answer', { 
    questionId: question.questionId,
    isScenarioBased: question.isScenarioBased 
  })
  
  const prompt = question.isScenarioBased && question.scenario
    ? getScenarioEvaluationPrompt(
        question.question,
        question.scenario,
        question.expectedAnswer.split('; '),
        userAnswer,
        question.conceptLabel
      )
    : getConceptEvaluationPrompt(
        question.question,
        question.expectedAnswer,
        userAnswer,
        question.conceptLabel
      )
  
  const result = await generateObject({
    prompt,
    schema: detailedEvaluationSchema,
  })
  
  return {
    evaluation: result.evaluation,
    feedback: result.feedback,
    conceptSummary: result.conceptSummary,
    correctApproach: result.evaluation !== 'correct' ? result.correctApproach : undefined,
    keyPointsHit: result.keyPointsHit || [],
    keyPointsMissed: result.keyPointsMissed || [],
    confidence: result.confidence || 0.9,
  }
}

/**
 * Generate session summary with recommendations
 */
export function generateSessionRecommendations(
  results: Array<{ conceptLabel: string; evaluation: AnswerEvaluation }>
): string[] {
  const recommendations: string[] = []
  
  // Find consistently weak areas
  const conceptPerformance = new Map<string, { correct: number; total: number }>()
  
  for (const result of results) {
    const current = conceptPerformance.get(result.conceptLabel) || { correct: 0, total: 0 }
    current.total++
    if (result.evaluation === 'correct') current.correct++
    conceptPerformance.set(result.conceptLabel, current)
  }
  
  for (const [concept, perf] of conceptPerformance) {
    const accuracy = perf.correct / perf.total
    
    if (accuracy < 0.5) {
      recommendations.push(
        `Focus on "${concept}" - review the fundamentals and try practice problems.`
      )
    } else if (accuracy < 0.8) {
      recommendations.push(
        `Good progress on "${concept}" - a few more practice scenarios will solidify your understanding.`
      )
    }
  }
  
  // Add general recommendations
  if (recommendations.length === 0) {
    recommendations.push(
      'Excellent work! Consider exploring advanced topics or helping others learn.'
    )
  }
  
  return recommendations.slice(0, 5) // Max 5 recommendations
}
```

**Acceptance Criteria:**
- [ ] Evaluation identifies correct, partial, and incorrect answers
- [ ] Feedback explains why answer is right or wrong
- [ ] Concept being tested is clearly identified
- [ ] Recommendations are personalized based on performance

---

# Phase IV: Timer & Accessibility

> **Goal:** Implement timer functionality with accessibility considerations

---

## Task 4.1: Timer Component

**Description:** Create a timer component that displays remaining time and handles timeout.

**Status:** ✅ COMPLETED

**Files Created:**
- `apps/web/src/components/test-mode/QuestionTimer.tsx` - Timer UI component

**Files to Create:**
- `apps/web/src/components/test-mode/QuestionTimer.tsx`

**Implementation:**

```tsx
// apps/web/src/components/test-mode/QuestionTimer.tsx

import { useEffect, useState } from 'react'
import { Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface QuestionTimerProps {
  duration: number  // seconds
  onTimeout: () => void
  isPaused?: boolean
  className?: string
}

export function QuestionTimer({
  duration,
  onTimeout,
  isPaused = false,
  className
}: QuestionTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState(duration)
  
  useEffect(() => {
    if (isPaused || timeRemaining <= 0) return
    
    const interval = setInterval(() => {
      setTimeRemaining(t => {
        if (t <= 1) {
          onTimeout()
          return 0
        }
        return t - 1
      })
    }, 1000)
    
    return () => clearInterval(interval)
  }, [isPaused, timeRemaining, onTimeout])
  
  // Reset when duration changes (new question)
  useEffect(() => {
    setTimeRemaining(duration)
  }, [duration])
  
  const minutes = Math.floor(timeRemaining / 60)
  const seconds = timeRemaining % 60
  const percentage = (timeRemaining / duration) * 100
  
  const isLow = timeRemaining <= 10
  const isWarning = timeRemaining <= 30 && timeRemaining > 10
  
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {isLow ? (
        <AlertTriangle className="size-5 text-red-500 animate-pulse" />
      ) : (
        <Clock className={cn(
          'size-5',
          isWarning ? 'text-yellow-500' : 'text-muted-foreground'
        )} />
      )}
      
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div 
          className={cn(
            'h-full transition-all duration-1000 ease-linear',
            isLow ? 'bg-red-500' : isWarning ? 'bg-yellow-500' : 'bg-primary'
          )}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <span className={cn(
        'font-mono text-sm font-medium min-w-[3rem] text-right',
        isLow ? 'text-red-500' : isWarning ? 'text-yellow-500' : ''
      )}>
        {minutes}:{seconds.toString().padStart(2, '0')}
      </span>
    </div>
  )
}
```

**Accessibility Considerations:**
- Visual progress bar for at-a-glance status
- Color changes for warnings (with enough contrast)
- Screen reader announcements at key thresholds
- Option to pause for accessibility needs

**Acceptance Criteria:**
- [ ] Timer counts down correctly
- [ ] Visual warnings at 30s and 10s
- [ ] Timeout callback is triggered at 0
- [ ] Timer resets for new questions

---

## Task 4.2: Accessibility Enhancements

**Description:** Ensure Test Mode is accessible to all users.

**Status:** 🔲 NOT STARTED (Phase 4 - Future)

**Implementation Notes:**

```tsx
// Key accessibility features to implement:

// 1. Screen reader announcements for timer
useEffect(() => {
  if (timeRemaining === 30) {
    announceToScreenReader('30 seconds remaining')
  } else if (timeRemaining === 10) {
    announceToScreenReader('10 seconds remaining, hurry!')
  }
}, [timeRemaining])

// 2. Keyboard navigation for answer selection
<RadioGroup
  aria-label="Answer options"
  onKeyDown={(e) => {
    if (e.key === 'Enter') {
      handleSubmit()
    }
  }}
>
  {options.map((option, index) => (
    <RadioGroupItem
      key={option.id}
      value={option.id}
      aria-describedby={`option-${index}-description`}
    />
  ))}
</RadioGroup>

// 3. Focus management after feedback
useEffect(() => {
  if (showFeedback) {
    feedbackRef.current?.focus()
  }
}, [showFeedback])

// 4. Reduced motion support
const prefersReducedMotion = usePrefersReducedMotion()
```

**Acceptance Criteria:**
- [ ] All interactive elements are keyboard accessible
- [ ] Screen reader announces important state changes
- [ ] Timer can be paused for users who need it
- [ ] Color is not the only indicator of status

---

# Phase V: Integration & Testing

> **Goal:** Integrate all components and ensure the complete flow works

---

## Task 5.1: End-to-End Integration

**Description:** Connect all components into a seamless test flow.

**Status:** 🔲 NOT STARTED (Phase 5 - Future)

**Test Flow:**

1. **Mode Selection** → User clicks "Test" tab
2. **Configuration** → TestConfigModal appears
3. **Context Reset** → Chat history cleared, fresh runtime
4. **Test Start** → First question displayed with timer (if timed)
5. **Answer & Feedback** → User answers, feedback shown
6. **Progress** → Move to next question, repeat
7. **Completion** → TestResultsSummary displayed
8. **Post-Test** → Options to review weak areas or retake

**Files to Modify:**
- `apps/web/src/routes/index.tsx`
- `apps/web/src/components/learning/LearningLayout.tsx`

**Acceptance Criteria:**
- [ ] Complete flow from start to finish works
- [ ] All state transitions are smooth
- [ ] Error states are handled gracefully
- [ ] User can exit test at any point

---

## Task 5.2: Backend API Updates

**Description:** Update backend APIs to support new test configuration options.

**Status:** ✅ COMPLETED

**Files Created:**
- `apps/server/src/routes/learning/test.ts` - Test mode API endpoints
- Updated `apps/server/src/routes/learning/index.ts` - Mounted test routes
- `apps/web/src/api/test.ts` - Frontend API client
- Updated `apps/web/src/api/index.ts` - Exported test API

**Files to Modify:**
- `packages/agentic/src/modes/test-mode.ts`
- `packages/storage/src/test-session.ts`
- `apps/server/src/routes/learning/index.ts`

**New Endpoints:**

```typescript
// POST /api/learning/test/start
interface StartTestRequest {
  userId: string
  config: TestConfiguration
}

// POST /api/learning/test/answer
interface SubmitAnswerRequest {
  userId: string
  sessionId: string
  questionId: string
  answer: string
}

// Response includes detailed feedback
interface SubmitAnswerResponse {
  evaluation: DetailedEvaluation
  nextQuestion?: TestQuestion
  progress: TestSessionProgress
  isComplete: boolean
}

// GET /api/learning/test/summary/:sessionId
interface TestSummaryResponse {
  summary: TestSessionSummary
}
```

**Acceptance Criteria:**
- [ ] API accepts test configuration
- [ ] Responses include detailed feedback
- [ ] Session state is properly persisted
- [ ] Summary endpoint returns complete data

---

## Task 5.3: Testing & Quality Assurance

**Description:** Write tests for all new Test Mode functionality.

**Status:** 🔲 NOT STARTED (Phase 5 - Future)

**Test Categories:**

1. **Unit Tests**
   - Scenario generation prompts
   - Answer evaluation logic
   - Timer component
   - Score calculation

2. **Integration Tests**
   - Full test session flow
   - Context reset on mode switch
   - API endpoint responses

3. **E2E Tests**
   - Complete user journey
   - Edge cases (timeout, skip, abandon)
   - Accessibility checks

**Acceptance Criteria:**
- [ ] Unit test coverage > 80%
- [ ] Integration tests pass
- [ ] E2E tests cover happy path
- [ ] Accessibility audit passes

---

# Development Workflow

## Task Completion Checklist

After completing each task:

- [ ] Code follows project style guide
- [ ] Types are properly exported from `@repo/shared`
- [ ] Component has proper accessibility attributes
- [ ] Error states are handled
- [ ] Loading states are displayed
- [ ] Console has no errors/warnings
- [ ] Changes are tested locally

## Import Organization

```typescript
// ** import types
import type { TestConfiguration, TestQuestion } from '@repo/shared'

// ** import lib
import { useState, useCallback } from 'react'

// ** import components
import { Button } from '@/components/ui/button'
import { QuestionTimer } from '@/components/test-mode/QuestionTimer'

// ** import hooks
import { useTestMode } from '@/components/test-mode/TestModeContext'

// ** import utils
import { cn } from '@/lib/utils'
import { logger } from '@repo/logs'
```

---

# Summary

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| I | Configuration & Context | 1.1, 1.2, 1.3 | ✅ COMPLETED |
| II | Scenario Questions | 2.1, 2.2, 2.3 | ✅ COMPLETED |
| III | Feedback & Scoring | 3.1, 3.2, 3.3 | ✅ COMPLETED |
| IV | Timer & Accessibility | 4.1, 4.2 | 🟡 Partial (Timer done) |
| V | Integration & Testing | 5.1, 5.2, 5.3 | 🟡 Partial (API done) |

**Completed:** Phases 1-3 fully implemented
**Remaining:** Full integration testing, accessibility enhancements

**Key Dependencies:**
- Task 1.2 (Context Reset) blocks all other tasks
- Task 2.1 (Types) blocks 2.2 and 2.3
- Phase V requires all other phases complete

---

# Quick Reference: Key Code Locations

## Existing Test Mode Files
- `packages/agentic/src/modes/test-mode.ts` - Core test logic
- `packages/shared/src/types/test-session.ts` - Test types (updated with scenario support)
- `apps/web/src/components/tool-ui/QuizQuestionTool.tsx` - Quiz UI

## New Files Created (Phases 1-3)
- ✅ `packages/shared/src/types/test-config.ts` - Configuration types
- ✅ `apps/web/src/components/test-mode/TestConfigModal.tsx` - Config modal
- ✅ `apps/web/src/components/test-mode/TestModeContext.tsx` - Test state management
- ✅ `apps/web/src/components/test-mode/AnswerFeedback.tsx` - Feedback component
- ✅ `apps/web/src/components/test-mode/TestResultsSummary.tsx` - Summary component
- ✅ `apps/web/src/components/test-mode/QuestionTimer.tsx` - Timer component
- ✅ `apps/web/src/components/test-mode/index.ts` - Exports
- ✅ `packages/agentic/src/prompts/scenario.ts` - Scenario generation prompts
- ✅ `apps/server/src/routes/learning/test.ts` - Test API routes
- ✅ `apps/web/src/api/test.ts` - Frontend API client

## Modified Files
- ✅ `packages/shared/src/types/index.ts` - Export new types
- ✅ `packages/shared/src/types/test-session.ts` - Added scenario fields
- ✅ `packages/agentic/src/prompts/index.ts` - Export scenario prompts
- ✅ `apps/web/src/components/learning/LearningContext.tsx` - Context reset
- ✅ `apps/web/src/components/learning/ModeSelector.tsx` - Test config modal
- ✅ `apps/web/src/routes/index.tsx` - Runtime key for reset
- ✅ `apps/server/src/routes/learning/index.ts` - Mount test routes
- ✅ `apps/web/src/api/index.ts` - Export test API
