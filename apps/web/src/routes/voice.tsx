// ** import lib
import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft, PhoneOff } from 'lucide-react'

// ** import components
import { useVoiceConversation } from '@/components/voice'
import { Orb } from '@/components/ui/orb'
import { Button } from '@/components/ui/button'
import { ShimmeringText } from '@/components/ui/shimmering-text'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
  Message,
  MessageAvatar,
  MessageContent,
} from '@/components/ui/conversation'

// ** import utils
import { env } from '@/config/env'

export const Route = createFileRoute('/voice')({ component: VoicePage })

/**
 * Voice Page
 *
 * A minimalist, professional voice conversation interface.
 * Features real-time streaming transcription with auto-scroll.
 */
function VoicePage() {
  const {
    status,
    isSpeaking,
    isListening,
    isThinking,
    messages,
    startConversation,
    endConversation,
  } = useVoiceConversation()

  // Map state to Orb agentState
  const getAgentState = () => {
    if (status !== 'connected') return null
    if (isSpeaking) return 'talking'
    if (isThinking) return 'thinking'
    if (isListening) return 'listening'
    return 'thinking'
  }

  // Get status text for display
  const getStatusText = () => {
    if (status !== 'connected') return null
    if (isSpeaking) return 'Echo is speaking...'
    if (isThinking) return 'Echo is thinking...'
    if (isListening) return 'Listening to you...'
    return null
  }

  // Check if voice is configured
  const isVoiceConfigured = Boolean(env.ELEVENLABS_AGENT_ID)

  if (!isVoiceConfigured) {
    return (
      <div className="h-dvh flex flex-col items-center justify-center p-8 text-center bg-background">
        <ShimmeringText
          text="Voice Not Configured"
          className="text-2xl font-bold mb-4"
        />
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
    <div className="h-dvh flex flex-col bg-background text-foreground overflow-hidden relative">
      {/* Absolute Back Button */}
      <div className="absolute top-6 left-6 z-20">
        <Link to="/">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full hover:bg-muted/50"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col md:flex-row items-center justify-center p-4 gap-8 md:gap-32 max-w-screen-2xl mx-auto w-full h-full">
        {/* Left: Orb Visualizer */}
        <div className="flex flex-col items-center justify-center shrink-0">
          <div className="w-56 h-56 md:w-72 md:h-72 relative cursor-pointer hover:scale-105 transition-transform duration-500">
            <Orb
              agentState={getAgentState()}
              className="w-full h-full"
              colors={['#FEF08A', '#FDE047']}
              onClick={
                status === 'disconnected' ? startConversation : undefined
              }
            />

            {/* Start Prompt Overlay */}
            {status === 'disconnected' && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <ShimmeringText
                  text="Click to Start"
                  className="text-lg font-medium text-foreground/80"
                />
              </div>
            )}
          </div>

          {/* Status Text Below Orb */}
          {status === 'connected' && (
            <div className="mt-4 h-6">
              {getStatusText() && (
                <ShimmeringText
                  text={getStatusText()!}
                  className="text-sm text-muted-foreground"
                  duration={1.5}
                />
              )}
            </div>
          )}
        </div>

        {/* Right: Transcript Area with Auto-scroll */}
        {status === 'connected' && (
          <div className="flex-1 w-full h-full max-h-[50vh] md:max-h-[80vh] overflow-hidden">
            <Conversation className="h-full">
              <ConversationContent className="p-4 md:p-6">
                {messages.length === 0 && !isThinking ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">
                      Start speaking to begin the conversation...
                    </p>
                  </div>
                ) : (
                  <>
                    {messages
                      .filter((message) => message.content.trim() !== '')
                      .map((message) => (
                        <Message key={message.id} from={message.role}>
                          <MessageAvatar
                            name={message.role === 'user' ? 'You' : 'Echo'}
                            fallback={
                              message.role === 'assistant' ? (
                                <Orb
                                  className="w-full h-full"
                                  agentState={null}
                                  colors={['#FEF08A', '#FDE047']}
                                />
                              ) : undefined
                            }
                          />
                          <MessageContent from={message.role}>
                            {message.role === 'assistant' ? (
                              <p className="text-sm md:text-base">
                                {message.content}
                              </p>
                            ) : (
                              <p className="text-sm md:text-base text-muted-foreground">
                                {message.content}
                              </p>
                            )}
                          </MessageContent>
                        </Message>
                      ))}

                    {/* Thinking Indicator - shown when agent is processing */}
                    {isThinking && (
                      <Message from="assistant">
                        <MessageAvatar
                          name="Echo"
                          fallback={
                            <Orb
                              className="w-full h-full"
                              agentState="thinking"
                              colors={['#FEF08A', '#FDE047']}
                            />
                          }
                        />
                        <MessageContent from="assistant">
                          <ShimmeringText
                            text="Thinking..."
                            className="text-sm text-muted-foreground"
                            duration={1.5}
                          />
                        </MessageContent>
                      </Message>
                    )}
                  </>
                )}
              </ConversationContent>
              <ConversationScrollButton />
            </Conversation>
          </div>
        )}

        {/* Placeholder when not connected */}
        {status !== 'connected' && status !== 'disconnected' && (
          <div className="flex-1 flex items-center justify-center">
            <ShimmeringText
              text="Connecting..."
              className="text-xl text-muted-foreground"
            />
          </div>
        )}
      </main>

      {/* Floating Controls */}
      {status === 'connected' && (
        <div className="absolute bottom-10 left-0 right-0 flex justify-center z-20">
          <Button
            size="lg"
            variant="destructive"
            onClick={endConversation}
            className="rounded-full h-14 px-8 shadow-2xl hover:scale-105 transition-all duration-300"
          >
            <PhoneOff className="w-5 h-5 mr-2" />
            End Session
          </Button>
        </div>
      )}
    </div>
  )
}
