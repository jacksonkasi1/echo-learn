import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, Mic, Volume2 } from 'lucide-react'

import {
  VoiceConversationProvider,
  VoiceInterface,
} from '@/components/voice'
import { Button } from '@/components/ui/button'
import { useUserId } from '@/lib/user-context'
import { env } from '@/config/env'

export const Route = createFileRoute('/voice')({ component: VoicePage })

/**
 * Voice Page
 *
 * Real-time voice conversation interface with Ikra (AI tutor).
 * Uses ElevenLabs Conversational AI with Custom LLM integration
 * to enable voice-based RAG queries.
 */
function VoicePage() {
  const userId = useUserId()

  // Check if voice is configured
  const isVoiceConfigured = Boolean(env.ELEVENLABS_AGENT_ID)

  if (!isVoiceConfigured) {
    return (
      <div className="h-dvh flex flex-col">
        {/* Header */}
        <header className="border-b px-4 py-3 flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <h1 className="text-lg font-semibold">Voice Chat</h1>
        </header>

        {/* Not configured message */}
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Mic className="w-8 h-8 text-muted-foreground" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Voice Chat Not Configured</h2>
          <p className="text-muted-foreground max-w-md mb-6">
            To enable voice conversations, you need to set up an ElevenLabs agent
            and configure the <code className="bg-muted px-1 rounded">VITE_ELEVENLABS_AGENT_ID</code> environment variable.
          </p>
          <Link to="/">
            <Button>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Text Chat
            </Button>
          </Link>
        </main>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col">
      {/* Header */}
      <header className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              Voice Chat with Ikra
            </h1>
            <p className="text-xs text-muted-foreground">
              Speak naturally to study from your materials
            </p>
          </div>
        </div>

        {/* User indicator */}
        <div className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {userId.replace('user_', '').slice(0, 12)}...
        </div>
      </header>

      {/* Voice Interface */}
      <main className="flex-1 min-h-0">
        <VoiceConversationProvider
          userId={userId}
          onMessage={(message) => {
            console.log('[VoicePage] Message:', message)
          }}
          onError={(error) => {
            console.error('[VoicePage] Error:', error)
          }}
          onStatusChange={(status) => {
            console.log('[VoicePage] Status:', status)
          }}
        >
          <VoiceInterface
            className="h-full"
            onConversationEnd={() => {
              console.log('[VoicePage] Conversation ended')
            }}
          />
        </VoiceConversationProvider>
      </main>

      {/* Footer hint */}
      <footer className="border-t px-4 py-2 text-center text-xs text-muted-foreground">
        Tip: Say "goodbye" to end the conversation, or ask "quiz me" to test your knowledge
      </footer>
    </div>
  )
}
