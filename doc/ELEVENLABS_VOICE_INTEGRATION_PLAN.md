# ElevenLabs Voice Integration Development Plan

## Implementation Status: ✅ COMPLETED

**Last Updated:** Phase 1-3 Implementation Complete

---

## Executive Summary

This document outlines the integration of ElevenLabs Conversational AI with Echo-Learn's existing agentic RAG system. The goal is to enable real-time voice conversations with "Ikra" (the AI tutor) while leveraging the full power of our knowledge retrieval and agentic processing pipeline.

### Key Integration Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Frontend (TanStack Start)                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────────────┐    │
│  │  VoiceOrb       │  │  @elevenlabs/    │  │   Conversation      │    │
│  │  VoiceInterface │  │  react           │  │   State Manager     │    │
│  │  Components     │  │  useConversation │  │                     │    │
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
                    (POST /elevenlabs/v1/chat/completions)│
                                                          ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     Echo-Learn Backend (Hono)                          │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  /elevenlabs/v1/chat/completions (SSE Endpoint)                  │  │
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
│  │  @repo/rag  │  │@repo/agentic│  │  @repo/llm  │  │@repo/elevenlabs│ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └──────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Feasibility Analysis

### ✅ Confirmed: Integration IS Possible

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

---

## Implementation Completed

### Phase 1: @repo/elevenlabs Package ✅

Created a new isolated package for all ElevenLabs-related functionality:

**Package Structure:**
```
packages/elevenlabs/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts                    # Main exports
    ├── types/
    │   ├── index.ts
    │   ├── request.ts              # ElevenLabsChatRequest, etc.
    │   └── response.ts             # SSEStreamChunk, SystemToolResult, etc.
    ├── sse/
    │   ├── index.ts
    │   ├── transform.ts            # SSE stream transformation
    │   └── buffer-words.ts         # Latency optimization
    └── handler/
        ├── index.ts
        ├── completion.ts           # processElevenLabsCompletion()
        └── system-tools.ts         # end_call, skip_turn handlers
```

**Key Features:**
- SSE stream transformation (OpenAI-compatible format)
- Buffer words for perceived latency reduction
- System tool handlers (end_call, skip_turn, language_detection)
- Integration with @repo/agentic for RAG processing

---

### Phase 2: Server Route ✅

Added new ElevenLabs-specific endpoint (existing `/v1/chat/completions` unchanged):

**New Files:**
```
apps/server/src/
├── routes/elevenlabs/
│   ├── index.ts                    # Route registration
│   └── completions.ts              # POST /elevenlabs/v1/chat/completions
└── schema/elevenlabs/
    ├── index.ts
    └── completions.schema.ts       # Zod validation schemas
```

**Endpoints:**
- `POST /elevenlabs/v1/chat/completions` - SSE streaming for ElevenLabs Custom LLM
- `GET /elevenlabs/v1/chat/completions/health` - Health check

**Key Features:**
- SSE format with `data:` prefix and `[DONE]` terminator
- Support for `elevenlabs_extra_body.user_id` extraction
- Buffer words prepended for latency perception
- Full RAG context retrieval via agentic router

---

### Phase 3: Frontend Voice UI ✅

Created voice conversation interface with ElevenLabs React SDK:

**New Files:**
```
apps/web/src/
├── components/voice/
│   ├── index.ts                    # Exports
│   ├── VoiceConversationProvider.tsx
│   ├── VoiceOrb.tsx               # Animated state visualization
│   └── VoiceInterface.tsx         # Full conversation UI
└── routes/
    └── voice.tsx                   # /voice page
```

**Added Dependencies:**
- `@elevenlabs/react@^0.12.3`
- `motion@^12.18.1`
- `use-stick-to-bottom@^1.0.47`

**Components:**
1. **VoiceConversationProvider** - Context provider wrapping `useConversation` hook
2. **VoiceOrb** - Animated orb with idle/listening/thinking/speaking states
3. **VoiceInterface** - Full UI with call controls and message transcript

**Features:**
- Real-time voice conversation via WebSocket
- Animated visual feedback for agent state
- Hybrid voice/text input support
- Message transcript display
- Navigation from main chat via "Voice Chat" button

---

## Configuration Required

### Environment Variables

Add to your `.env` files:

**Server (`apps/server/.env`):**
```env
# No additional server env needed - uses existing Gemini/RAG config
```

**Web (`apps/web/.env`):**
```env
# ElevenLabs Agent ID (create at elevenlabs.io)
VITE_ELEVENLABS_AGENT_ID=your_agent_id_here
```

### ElevenLabs Agent Setup

1. Go to [ElevenLabs](https://elevenlabs.io) and create a Conversational AI Agent
2. Configure Custom LLM:
   ```json
   {
     "model": {
       "type": "custom_llm",
       "url": "https://your-server.com/elevenlabs/v1/chat/completions",
       "model_id": "echo-learn-v1"
     }
   }
   ```
3. Copy the Agent ID to `VITE_ELEVENLABS_AGENT_ID`

### Local Development with Tunnel

For local development, expose your server via tunnel:

```bash
# Option 1: ngrok
ngrok http 8787

# Option 2: Cloudflare Tunnel
cloudflared tunnel --url http://localhost:8787
```

Then configure ElevenLabs Custom LLM URL to use the tunnel URL.

---

## File Structure Summary

```
echo-learn/
├── packages/
│   └── elevenlabs/                 # ✅ NEW - Isolated ElevenLabs package
│       ├── src/
│       │   ├── types/              # Request/Response types
│       │   ├── sse/                # SSE transformation & buffer words
│       │   └── handler/            # Completion & system tool handlers
│       └── package.json
│
├── apps/
│   ├── server/
│   │   └── src/
│   │       ├── routes/
│   │       │   ├── elevenlabs/     # ✅ NEW - ElevenLabs endpoint
│   │       │   │   ├── index.ts
│   │       │   │   └── completions.ts
│   │       │   └── v1/chat/        # ❌ UNCHANGED - Existing text chat
│   │       └── schema/
│   │           └── elevenlabs/     # ✅ NEW - Zod schemas
│   │
│   └── web/
│       └── src/
│           ├── components/
│           │   └── voice/          # ✅ NEW - Voice UI components
│           │       ├── VoiceConversationProvider.tsx
│           │       ├── VoiceOrb.tsx
│           │       └── VoiceInterface.tsx
│           └── routes/
│               ├── index.tsx       # ✅ UPDATED - Added Voice Chat button
│               └── voice.tsx       # ✅ NEW - Voice page
│
└── doc/
    └── ELEVENLABS_VOICE_INTEGRATION_PLAN.md  # This file
```

---

## Usage

### Start Voice Conversation

1. Run the server: `bun run dev` (in apps/server)
2. Run the web app: `bun run dev` (in apps/web)
3. Navigate to `http://localhost:3000`
4. Click "Voice Chat" button in top-right
5. Click "Start Voice Chat" to begin conversation
6. Speak naturally - the agent will respond using your uploaded study materials

### Voice Commands

- **"Goodbye"** - Ends the conversation
- **"Quiz me"** - Triggers quiz mode
- **"Let me think"** - Agent waits silently

---

## Phase 4 & 5: Future Enhancements

### Testing (TODO)
- [ ] Unit tests for SSE transformation
- [ ] Integration tests with mock ElevenLabs
- [ ] Latency benchmarking
- [ ] End-to-end voice conversation tests

### Production Hardening (TODO)
- [ ] ElevenLabs webhook signature verification
- [ ] Rate limiting for voice endpoint
- [ ] Voice conversation analytics
- [ ] Error recovery and reconnection
- [ ] Voice quality monitoring

---

## References

- [ElevenLabs Custom LLM Documentation](https://elevenlabs.io/docs/agents-platform/customization/llm/custom-llm)
- [ElevenLabs React SDK](https://www.npmjs.com/package/@elevenlabs/react)
- [Latency Optimization Best Practices](https://elevenlabs.io/docs/developers/best-practices/latency-optimization)