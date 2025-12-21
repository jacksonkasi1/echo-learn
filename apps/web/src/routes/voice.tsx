// ** import lib
import { useCallback, useMemo } from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, PhoneOff, Mic, Volume2 } from 'lucide-react'

// ** import components
import { useVoiceConversation } from '@/components/voice'
import { Orb } from '@/components/ui/orb'
import { ShimmeringText } from '@/components/ui/shimmering-text'
import { Response } from '@/components/ui/response'
import { Button } from '@/components/ui/button'

// ** import utils
import { env } from '@/config/env'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/voice')({ component: VoicePage })

/**
 * Voice Page
 *
 * A minimalist, professional voice conversation interface.
 */
function VoicePage() {
  const {
    status,
    isSpeaking,
    isListening,
    messages,
    startConversation,
    endConversation,
  } = useVoiceConversation()

  // Map state to Orb agentState
  const getAgentState = () => {
    if (status !== 'connected') return null
    if (isSpeaking) return 'talking'
    if (isListening) return 'listening'
    return 'thinking'
  }

  // Combine messages for the Response component
  const fullTranscript = useMemo(() => {
    if (messages.length === 0) return ''
    return messages
      .map((m) => {
        const role = m.role === 'user' ? '**You:**' : '**Ikra:**'
        return `${role} ${m.content}`
      })
      .join('\n\n')
  }, [messages])

  // Check if voice is configured
  const isVoiceConfigured = Boolean(env.ELEVENLABS_AGENT_ID)

  if (!isVoiceConfigured) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center p-8 text-center bg-background">
        <ShimmeringText
          text="Voice Not Configured"
          className="text-2xl font-bold mb-4"
        />
        <p className="text-muted-foreground max-w-md mb-8">
          Please set up your ElevenLabs Agent ID in the environment variables.
        </p>
        <Link to="/">
          <Button variant="outline" className="rounded-full">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden">
      {/* Minimal Header */}
      <header className="p-6 flex items-center justify-between border-b bg-background/50 backdrop-blur-md z-10">
        <Link to="/">
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div className="flex flex-col items-center">
          <ShimmeringText
            text="Echo Learn Voice"
            className="text-xl font-bold tracking-tight"
          />
          <div className="flex items-center gap-2 mt-1">
            <div className={cn(
              "w-1.5 h-1.5 rounded-full animate-pulse",
              status === 'connected' ? "bg-green-500" : "bg-muted-foreground"
            )} />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
              {status === 'connected' ? 'Live Session' : 'Standby'}
            </span>
          </div>
        </div>
        <div className="w-10" />
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-8 md:gap-12 max-w-7xl mx-auto w-full">
        {/* Left/Center: Visualizer Area */}
        <div className="flex flex-col items-center justify-center flex-1 w-full max-w-md">
          <div className="relative group">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-3xl group-hover:bg-primary/10 transition-colors" />
            <div className="w-64 h-64 md:w-96 md:h-96 relative">
              <Orb
                agentState={getAgentState()}
                className="w-full h-full"
                colors={['#FEF08A', '#FDE047']}
                onClick={status === 'disconnected' ? startConversation : undefined}
              />
            </div>
          </div>

          <div className="mt-8 text-center space-y-2">
             <div className="flex items-center justify-center gap-3">
               {isListening && <Mic className="w-4 h-4 text-primary animate-bounce" />}
               {isSpeaking && <Volume2 className="w-4 h-4 text-primary animate-pulse" />}
               <p className="text-lg font-medium tracking-tight">
                {status === 'disconnected'
                  ? 'Ready to Start'
                  : status === 'connecting'
                    ? 'Connecting...'
                    : isListening
                      ? 'I\'m Listening'
                      : isSpeaking
                        ? 'Ikra is Speaking'
                        : 'Connected'}
              </p>
             </div>
             {status === 'disconnected' && (
               <p className="text-sm text-muted-foreground">
                 Click the orb or button below to begin
               </p>
             )}
          </div>
        </div>

        {/* Right: Transcriber Area */}
        <div className={cn(
          "flex-1 w-full max-w-xl flex flex-col h-full max-h-[50vh] md:max-h-[70vh] transition-all duration-500",
          status !== 'connected' && "opacity-20 grayscale pointer-events-none"
        )}>
          <div className="flex items-center justify-between mb-3 px-1">
            <ShimmeringText 
              text="Transcriber View" 
              className="text-xs font-bold uppercase tracking-widest text-muted-foreground"
            />
            {status === 'connected' && (
              <span className="text-[10px] text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-full">
                Streaming
              </span>
            )}
          </div>
          
          <div className="flex-1 bg-muted/20 rounded-3xl p-8 border border-border/50 backdrop-blur-sm overflow-y-auto shadow-inner scrollbar-hide">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Mic className="w-6 h-6 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground/60 italic">
                  Transcript will appear here as you speak...
                </p>
              </div>
            ) : (
              <Response className="text-foreground text-lg leading-relaxed antialiased">
                {fullTranscript}
              </Response>
            )}
          </div>
        </div>
      </main>

      {/* Footer Controls */}
      <footer className="p-8 flex justify-center bg-background/80 backdrop-blur-sm border-t">
        {status === 'connected' ? (
          <Button
            size="lg"
            variant="destructive"
            onClick={endConversation}
            className="rounded-full h-16 px-10 gap-3 shadow-xl hover:scale-105 transition-transform"
          >
            <PhoneOff className="w-6 h-6" />
            <span className="font-bold">End Session</span>
          </Button>
        ) : (
          status === 'disconnected' && (
            <Button
              size="lg"
              onClick={startConversation}
              className="rounded-full h-16 px-10 shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold hover:scale-105 transition-transform"
            >
              Start Conversation
            </Button>
          )
        )}
      </footer>
    </div>
  )
}
