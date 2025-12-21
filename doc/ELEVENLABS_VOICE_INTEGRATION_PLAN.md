# ElevenLabs Voice Integration Development Plan

## Executive Summary

This document outlines the integration of ElevenLabs Conversational AI with Echo-Learn's existing agentic RAG system. The goal is to enable real-time voice conversations with "Ikra" (the AI tutor) while leveraging the full power of our knowledge retrieval and agentic processing pipeline.

### Key Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Frontend (TanStack Start)                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐    │
│  │  ElevenLabs UI  │  │  @elevenlabs/    │  │   Conversation      │    │
│  │  Components     │  │  react           │  │   State Manager     │    │
│  │  - Orb          │  │  useConversation │  │                     │    │
│  │  - Conversation │  │  hook            │  │                     │    │
│  │  - Shimmering   │  │                  │  │                     │    │
│  └────────┬────────┘  └────────┬─────────┘  └──────────┬──────────┘    │
│           │                    │                        │               │
│           └────────────────────┼────────────────────────┘               │
│                                │                                        │
│                    WebSocket/WebRTC Connection                          │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
                                 ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     ElevenLabs Platform                                 │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Conversational AI Agent                                          │  │
│  │  - Speech-to-Text (ASR)                                          │  │
│  │  - Text-to-Speech (TTS)                                          │  │
│  │  - Voice Management                                               │  │
│  │  - Custom LLM Connection ────────────────────────────┐           │  │
│  └──────────────────────────────────────────────────────┼───────────┘  │
└─────────────────────────────────────────────────────────┼──────────────┘
                                                          │
                    OpenAI-Compatible API                 │
                    (POST /v1/chat/completions)           │
                                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Echo-Learn Backend (Hono)                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  /v1/chat/completions (OpenAI-Compatible Endpoint)               │  │
│  │                                                                   │  │
│  │  1. Receive transcribed user speech from ElevenLabs              │  │
│  │  2. Extract user_id from elevenlabs_extra_body                   │  │
│  │  3. Retrieve RAG context (Upstash Vector + Hybrid Search)        │  │
│  │  4. Process through Agentic Router (tool calling)                │  │
│  │  5. Generate response with Gemini 2.0 Flash                      │  │
│  │  6. Stream SSE response back to ElevenLabs                       │  │
│  │                                                                   │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                                                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐  │
│  │  @repo/rag  │  │ @repo/agentic│ │  @repo/llm  │  │ @repo/storage│  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Feasibility Analysis

### ✅ Why This Integration IS Possible

1. **OpenAI-Compatible Endpoint Already Exists**
   - Our `/v1/chat/completions` endpoint follows the OpenAI API format
   - ElevenLabs Custom LLM expects exactly this format
   - Streaming SSE responses are already implemented

2. **RAG Pipeline is Complete**
   - Context retrieval from Upstash Vector DB works
   - Hybrid search with RRF/DBSF fusion is implemented
   - Context budget management handles token limits

3. **Agentic Processing is Ready**
   - Tool-based query processing (`search_rag`, `calculator`, etc.)
   - Gemini 2.0 Flash for low-latency generation
   - Streaming responses via Vercel AI SDK

4. **User Context Mechanism**
   - User profiles stored in Redis
   - Per-user RAG filtering already implemented
   - Session management patterns in place

### ⚠️ Technical Considerations

| Aspect | Current State | Required Changes |
|--------|--------------|------------------|
| Response Format | Plain text stream | SSE format with `data:` prefix |
| User Identification | `user_id` in body | Support `elevenlabs_extra_body.user_id` |
| Latency | ~500-800ms TTFB | Target <300ms with buffer words |
| System Tools | Not implemented | Add `end_call`, `skip_turn` support |
| Public Endpoint | Requires server access | May need ngrok/tunnel for dev |

### 🔴 Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Latency too high | Poor UX | Buffer words, Flash model, context caching |
| Tool calls timeout | Agent confusion | Limit tool iterations, async processing |
| Audio quality issues | Hard to understand | Use high-quality ElevenLabs voice |
| WebSocket disconnects | Conversation lost | Implement reconnection logic |

---

## Phase 1: Backend Adaptation for ElevenLabs

### Task 1.1: Update Chat Completions for ElevenLabs SSE Format

**File:** `apps/server/src/routes/v1/chat/completions.ts`

**Current Behavior:**
```typescript
// Returns plain text stream
return new Response(result.stream, {
  headers: {
    "Content-Type": "text/plain; charset=utf-8",
    // ...
  },
});
```

**Required Change:**
```typescript
// Transform to SSE format for ElevenLabs
async function* transformToSSE(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // Emit SSE chunks
      const chunk = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: "echo-learn-v1",
        choices: [{
          delta: { content: buffer },
          index: 0,
          finish_reason: null
        }]
      };
      
      yield `data: ${JSON.stringify(chunk)}\n\n`;
      buffer = "";
    }
    
    yield "data: [DONE]\n\n";
  } finally {
    reader.releaseLock();
  }
}
```

### Task 1.2: Support ElevenLabs Extra Body Parameters

**File:** `apps/server/src/schema/chat/completions.schema.ts`

**Add:**
```typescript
// ElevenLabs extra body schema
export const elevenlabsExtraBodySchema = z.object({
  user_id: z.string().optional(),
  conversation_id: z.string().optional(),
  session_data: z.record(z.unknown()).optional(),
}).optional();

export const chatCompletionSchema = z.object({
  // ... existing fields ...
  
  // ElevenLabs sends custom params here
  elevenlabs_extra_body: elevenlabsExtraBodySchema,
  
  // ElevenLabs may send tools for system functions
  tools: z.array(z.object({
    type: z.literal("function"),
    function: z.object({
      name: z.string(),
      description: z.string().optional(),
      parameters: z.record(z.unknown()).optional(),
    }),
  })).optional(),
});
```

### Task 1.3: Implement Buffer Words for Latency Optimization

**File:** `apps/server/src/lib/chat/handle-completion.ts`

**Add buffer word generation:**
```typescript
const BUFFER_PHRASES = [
  "Let me think about that... ",
  "Looking at your materials... ",
  "Checking my knowledge... ",
  "One moment... ",
];

async function* streamWithBuffer(
  stream: ReadableStream<Uint8Array>,
  useBuffer: boolean = true
): AsyncGenerator<string> {
  // Send buffer phrase first for slow LLM processing
  if (useBuffer) {
    const bufferPhrase = BUFFER_PHRASES[
      Math.floor(Math.random() * BUFFER_PHRASES.length)
    ];
    
    yield `data: ${JSON.stringify({
      id: "chatcmpl-buffer",
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: "echo-learn-v1",
      choices: [{
        delta: { content: bufferPhrase },
        index: 0,
        finish_reason: null
      }]
    })}\n\n`;
  }
  
  // Then stream actual response
  // ... transform stream to SSE format
}
```

### Task 1.4: Handle ElevenLabs System Tools

**File:** `apps/server/src/lib/elevenlabs/system-tools.ts` (NEW)

```typescript
/**
 * ElevenLabs System Tool Handlers
 * These tools control conversation flow
 */

export interface SystemToolCall {
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface SystemToolResult {
  name: string;
  shouldEndCall: boolean;
  message?: string;
}

export function handleSystemTool(toolCall: SystemToolCall): SystemToolResult | null {
  const { name, arguments: argsJson } = toolCall.function;
  const args = JSON.parse(argsJson);
  
  switch (name) {
    case "end_call":
      return {
        name: "end_call",
        shouldEndCall: true,
        message: args.message || "Goodbye!",
      };
      
    case "skip_turn":
      return {
        name: "skip_turn",
        shouldEndCall: false,
      };
      
    case "language_detection":
      // Handle language switch if needed
      return {
        name: "language_detection",
        shouldEndCall: false,
      };
      
    default:
      return null;
  }
}
```

### Task 1.5: Create ElevenLabs-Specific Endpoint

**File:** `apps/server/src/routes/elevenlabs/index.ts` (NEW)

```typescript
import { Hono } from "hono";
import { processElevenLabsCompletion } from "@/lib/elevenlabs/handler";

const elevenlabsRoute = new Hono();

/**
 * POST /elevenlabs/v1/chat/completions
 * 
 * ElevenLabs Custom LLM endpoint
 * Optimized for voice conversation with:
 * - Buffer words for perceived latency
 * - SSE streaming format
 * - System tool handling
 * - elevenlabs_extra_body support
 */
elevenlabsRoute.post("/v1/chat/completions", async (c) => {
  const body = await c.req.json();
  
  // Extract user ID from ElevenLabs extra body
  const userId = body.elevenlabs_extra_body?.user_id || 
                 body.user_id || 
                 body.user || 
                 "anonymous";
  
  // Check for system tools
  const hasSystemTools = body.tools?.some(
    (t: any) => ["end_call", "skip_turn", "language_detection"].includes(t.function?.name)
  );
  
  // Process with voice-optimized settings
  const result = await processElevenLabsCompletion({
    messages: body.messages,
    userId,
    maxTokens: body.max_tokens || 500, // Shorter for voice
    temperature: body.temperature || 0.7,
    useBufferWords: true,
    systemTools: hasSystemTools ? body.tools : undefined,
  });
  
  return new Response(result.stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
});

export { elevenlabsRoute };
```

---

## Phase 2: ElevenLabs Agent Configuration

### Task 2.1: Create ElevenLabs Agent via API/Dashboard

**Agent Configuration JSON:**
```json
{
  "name": "Ikra - Echo-Learn Tutor",
  "conversation": {
    "first_message": "Hello! I'm Ikra, your personal study assistant. I can help you learn from your uploaded materials. What would you like to study today?",
    "model": {
      "type": "custom_llm",
      "url": "https://your-server.com/elevenlabs/v1/chat/completions",
      "model_id": "echo-learn-v1",
      "api_key": {
        "secret_key": "YOUR_API_SECRET"
      }
    }
  },
  "voice": {
    "voice_id": "EXAVITQu4vr4xnSDxMaL",
    "stability": 0.5,
    "similarity_boost": 0.8,
    "style": 0.2,
    "use_speaker_boost": true
  },
  "language": "en",
  "platform_settings": {
    "latency_optimization": {
      "use_flash_model": true,
      "optimize_streaming_latency": 4
    }
  },
  "tools": [
    {
      "type": "system",
      "name": "end_call",
      "description": "End the conversation when the user says goodbye or the session is complete"
    },
    {
      "type": "system", 
      "name": "skip_turn",
      "description": "Wait silently when user needs time to think"
    }
  ]
}
```

### Task 2.2: Environment Variables

**File:** `apps/server/.env` (additions)

```env
# ElevenLabs Configuration
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_AGENT_ID=your_agent_id_here
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL

# Voice Endpoint Security
ELEVENLABS_WEBHOOK_SECRET=your_webhook_secret

# Server Public URL (for ElevenLabs to call back)
SERVER_PUBLIC_URL=https://your-server.com
```

---

## Phase 3: Frontend Voice Interface

### Task 3.1: Install ElevenLabs Dependencies

**File:** `apps/web/package.json`

```json
{
  "dependencies": {
    "@elevenlabs/react": "^0.5.0",
    "@react-three/fiber": "^8.15.0",
    "@react-three/drei": "^9.88.0",
    "three": "^0.160.0",
    "use-stick-to-bottom": "^1.0.0",
    "motion": "^11.0.0"
  }
}
```

### Task 3.2: Install ElevenLabs UI Components

**Commands to run:**
```bash
# Navigate to web app
cd apps/web

# Install ElevenLabs UI components via CLI
npx @elevenlabs/cli@latest components add orb
npx @elevenlabs/cli@latest components add conversation
npx @elevenlabs/cli@latest components add message
npx @elevenlabs/cli@latest components add shimmering-text
npx @elevenlabs/cli@latest components add response
```

### Task 3.3: Create Voice Conversation Provider

**File:** `apps/web/src/components/voice/VoiceConversationProvider.tsx`

```tsx
"use client";

import { createContext, useContext, ReactNode, useCallback } from "react";
import { useConversation } from "@elevenlabs/react";
import { env } from "@/config/env";

interface VoiceConversationContextType {
  status: "connected" | "connecting" | "disconnected";
  isSpeaking: boolean;
  isListening: boolean;
  startConversation: () => Promise<void>;
  endConversation: () => Promise<void>;
  sendTextMessage: (text: string) => void;
}

const VoiceConversationContext = createContext<VoiceConversationContextType | null>(null);

interface Props {
  children: ReactNode;
  userId: string;
  onMessage?: (message: { role: string; content: string }) => void;
  onError?: (error: Error) => void;
}

export function VoiceConversationProvider({ 
  children, 
  userId,
  onMessage,
  onError,
}: Props) {
  const conversation = useConversation({
    onConnect: () => {
      console.log("Voice conversation connected");
    },
    onDisconnect: () => {
      console.log("Voice conversation disconnected");
    },
    onMessage: (message) => {
      onMessage?.({
        role: message.source === "user" ? "user" : "assistant",
        content: message.message,
      });
    },
    onError: (error) => {
      console.error("Voice conversation error:", error);
      onError?.(new Error(String(error)));
    },
    onModeChange: (mode) => {
      console.log("Mode changed:", mode);
    },
  });

  const startConversation = useCallback(async () => {
    try {
      // Get signed URL from your backend (more secure)
      // OR use agent ID directly for public agents
      await conversation.startSession({
        agentId: env.ELEVENLABS_AGENT_ID,
        overrides: {
          agent: {
            prompt: {
              prompt: `You are helping user ${userId} study from their uploaded materials.`,
            },
          },
        },
        customLlmExtraBody: {
          user_id: userId,
        },
      });
    } catch (error) {
      console.error("Failed to start conversation:", error);
      throw error;
    }
  }, [conversation, userId]);

  const endConversation = useCallback(async () => {
    await conversation.endSession();
  }, [conversation]);

  const sendTextMessage = useCallback((text: string) => {
    conversation.sendUserMessage(text);
  }, [conversation]);

  return (
    <VoiceConversationContext.Provider
      value={{
        status: conversation.status,
        isSpeaking: conversation.isSpeaking,
        isListening: !conversation.isSpeaking && conversation.status === "connected",
        startConversation,
        endConversation,
        sendTextMessage,
      }}
    >
      {children}
    </VoiceConversationContext.Provider>
  );
}

export function useVoiceConversation() {
  const context = useContext(VoiceConversationContext);
  if (!context) {
    throw new Error("useVoiceConversation must be used within VoiceConversationProvider");
  }
  return context;
}
```

### Task 3.4: Create Voice Interface Component

**File:** `apps/web/src/components/voice/VoiceInterface.tsx`

```tsx
"use client";

import { useState, useCallback } from "react";
import { Orb } from "@/components/ui/orb";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ui/conversation";
import { Message, MessageContent } from "@/components/ui/message";
import { Response } from "@/components/ui/response";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { useVoiceConversation } from "./VoiceConversationProvider";

interface ConversationMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export function VoiceInterface() {
  const {
    status,
    isSpeaking,
    isListening,
    startConversation,
    endConversation,
  } = useVoiceConversation();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isStarting, setIsStarting] = useState(false);

  // Determine orb state based on conversation status
  const getOrbState = () => {
    if (status !== "connected") return null;
    if (isSpeaking) return "talking";
    if (isListening) return "listening";
    return "thinking";
  };

  const handleStart = useCallback(async () => {
    setIsStarting(true);
    try {
      await startConversation();
    } finally {
      setIsStarting(false);
    }
  }, [startConversation]);

  const handleEnd = useCallback(async () => {
    await endConversation();
    setMessages([]);
  }, [endConversation]);

  return (
    <div className="flex flex-col h-full">
      {/* Orb Visualization */}
      <div className="flex justify-center py-8">
        <div className="relative">
          <div className="bg-muted relative h-40 w-40 rounded-full p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.1)]">
            <div className="bg-background h-full w-full overflow-hidden rounded-full shadow-[inset_0_0_12px_rgba(0,0,0,0.05)]">
              <Orb
                colors={["#6366F1", "#8B5CF6"]}
                agentState={getOrbState()}
              />
            </div>
          </div>
          
          {/* Status Indicator */}
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2">
            {status === "connecting" && (
              <ShimmeringText text="Connecting..." className="text-sm" />
            )}
            {status === "connected" && isSpeaking && (
              <ShimmeringText text="Ikra is speaking..." className="text-sm" />
            )}
            {status === "connected" && isListening && (
              <span className="text-sm text-green-500 flex items-center gap-1">
                <Mic className="w-3 h-3" /> Listening...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Conversation Display */}
      <div className="flex-1 min-h-0">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<Orb className="size-12" agentState={null} />}
                title="Voice Conversation"
                description="Click the button below to start talking with Ikra"
              />
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    <Response>{message.content}</Response>
                  </MessageContent>
                  {message.role === "assistant" && (
                    <div className="ring-border size-8 overflow-hidden rounded-full ring-1">
                      <Orb className="h-full w-full" agentState={null} />
                    </div>
                  )}
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-4 py-4 border-t">
        {status === "disconnected" ? (
          <Button
            size="lg"
            onClick={handleStart}
            disabled={isStarting}
            className="gap-2"
          >
            <Phone className="w-5 h-5" />
            {isStarting ? "Connecting..." : "Start Voice Chat"}
          </Button>
        ) : (
          <Button
            size="lg"
            variant="destructive"
            onClick={handleEnd}
            className="gap-2"
          >
            <PhoneOff className="w-5 h-5" />
            End Conversation
          </Button>
        )}
      </div>
    </div>
  );
}
```

### Task 3.5: Create Voice Page Route

**File:** `apps/web/src/routes/voice.tsx`

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { VoiceConversationProvider } from "@/components/voice/VoiceConversationProvider";
import { VoiceInterface } from "@/components/voice/VoiceInterface";
import { useUserId } from "@/lib/user-context";

export const Route = createFileRoute("/voice")({
  component: VoicePage,
});

function VoicePage() {
  const userId = useUserId();

  return (
    <div className="container max-w-4xl mx-auto py-8 h-screen">
      <VoiceConversationProvider userId={userId}>
        <VoiceInterface />
      </VoiceConversationProvider>
    </div>
  );
}
```

---

## Phase 4: Testing & Optimization

### Task 4.1: Local Development Setup with Tunneling

For local development, ElevenLabs needs to reach your server:

```bash
# Option 1: ngrok
ngrok http 3001 --domain=your-subdomain.ngrok.app

# Option 2: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:3001

# Option 3: localtunnel
lt --port 3001
```

Update ElevenLabs agent config with your tunnel URL:
```json
{
  "model": {
    "type": "custom_llm",
    "url": "https://your-subdomain.ngrok.app/elevenlabs/v1/chat/completions"
  }
}
```

### Task 4.2: Latency Testing Checklist

- [ ] Measure Time-to-First-Byte (TTFB) for `/elevenlabs/v1/chat/completions`
- [ ] Target: <300ms TTFB
- [ ] Test buffer words effectiveness
- [ ] Verify SSE streaming format
- [ ] Test with various query complexities

### Task 4.3: Integration Test Scenarios

| Scenario | Expected Behavior |
|----------|-------------------|
| Simple greeting | Immediate response (<500ms) |
| RAG-required question | Buffer word → RAG retrieval → Response |
| Tool-calling query | Buffer word → Tool execution → Response |
| User interruption | Graceful context switch |
| Long silence | Agent prompt for continuation |
| "Goodbye" | Call end_call tool |

---

## Phase 5: Production Deployment

### Task 5.1: Security Considerations

```typescript
// Verify ElevenLabs webhook signatures
import { createHmac } from "crypto";

function verifyElevenLabsSignature(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expectedSignature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return signature === `sha256=${expectedSignature}`;
}

// Middleware for ElevenLabs routes
app.use("/elevenlabs/*", async (c, next) => {
  const signature = c.req.header("x-elevenlabs-signature");
  const body = await c.req.text();
  
  if (!verifyElevenLabsSignature(body, signature!, env.ELEVENLABS_WEBHOOK_SECRET)) {
    return c.json({ error: "Invalid signature" }, 401);
  }
  
  // Re-parse body for downstream handlers
  c.set("body", JSON.parse(body));
  await next();
});
```

### Task 5.2: Monitoring & Analytics

```typescript
// Track voice conversation metrics
interface VoiceMetrics {
  conversationId: string;
  userId: string;
  startTime: Date;
  endTime?: Date;
  turnCount: number;
  avgResponseLatencyMs: number;
  ragChunksUsed: number;
  toolCallsMade: number;
  endReason: "user" | "timeout" | "error";
}

// Log to analytics service
async function logVoiceConversation(metrics: VoiceMetrics) {
  await analytics.track("voice_conversation", metrics);
}
```

---

## File Structure Summary

```
apps/
├── server/
│   └── src/
│       ├── routes/
│       │   ├── elevenlabs/           # NEW
│       │   │   └── index.ts          # ElevenLabs-specific endpoint
│       │   └── v1/
│       │       └── chat/
│       │           └── completions.ts # Updated SSE format
│       ├── lib/
│       │   ├── chat/
│       │   │   └── handle-completion.ts # Buffer words
│       │   └── elevenlabs/           # NEW
│       │       ├── handler.ts        # ElevenLabs request handler
│       │       ├── system-tools.ts   # System tool handlers
│       │       └── sse-transform.ts  # SSE stream transformer
│       └── schema/
│           └── chat/
│               └── completions.schema.ts # elevenlabs_extra_body
└── web/
    └── src/
        ├── components/
        │   ├── ui/                   # ElevenLabs UI components
        │   │   ├── orb.tsx           # 3D animated orb
        │   │   ├── conversation.tsx  # Chat container
        │   │   ├── message.tsx       # Message bubbles
        │   │   ├── shimmering-text.tsx
        │   │   └── response.tsx
        │   └── voice/                # NEW
        │       ├── VoiceConversationProvider.tsx
        │       └── VoiceInterface.tsx
        └── routes/
            └── voice.tsx             # NEW voice page
```

---

## Development Timeline Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | Backend SSE adaptation | 2-3 days |
| Phase 2 | ElevenLabs agent config | 1 day |
| Phase 3 | Frontend voice interface | 2-3 days |
| Phase 4 | Testing & optimization | 2-3 days |
| Phase 5 | Production hardening | 1-2 days |

**Total Estimate: 8-12 days**

---

## Quick Start Commands

```bash
# 1. Install dependencies
cd apps/web && bun add @elevenlabs/react motion use-stick-to-bottom

# 2. Install UI components
npx @elevenlabs/cli@latest components add orb
npx @elevenlabs/cli@latest components add conversation
npx @elevenlabs/cli@latest components add message
npx @elevenlabs/cli@latest components add shimmering-text
npx @elevenlabs/cli@latest components add response

# 3. Set up environment variables
cp apps/server/.env.example apps/server/.env
# Add ELEVENLABS_API_KEY, ELEVENLABS_AGENT_ID, etc.

# 4. Start development
bun run dev

# 5. Start tunnel for local testing
ngrok http 3001
```

---

## References

- [ElevenLabs Custom LLM Documentation](https://elevenlabs.io/docs/agents-platform/customization/llm/custom-llm)
- [ElevenLabs UI Components](https://ui.elevenlabs.io/docs/components/orb)
- [ElevenLabs React SDK](https://www.npmjs.com/package/@elevenlabs/react)
- [Latency Optimization Best Practices](https://elevenlabs.io/docs/developers/best-practices/latency-optimization)
- [Multi-Context WebSocket Guide](https://elevenlabs.io/docs/developers/guides/cookbooks/multi-context-web-socket)
