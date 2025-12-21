import {
  HeadContent,
  Scripts,
  createRootRoute,
  useLocation,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import appCss from '../styles.css?url'
import { ThemeProvider } from '@/components/theme-provider'
import { UserProvider, useUserId } from '@/lib/user-context'
import { FloatingVoice, VoiceConversationProvider } from '@/components/voice'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Echo Learn - AI Study Partner',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground">
        <UserProvider>
          <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
            <VoiceWrapper>{children}</VoiceWrapper>
            <TanStackDevtools
              config={{
                position: 'bottom-right',
              }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />,
                },
              ]}
            />
            <Scripts />
          </ThemeProvider>
        </UserProvider>
      </body>
    </html>
  )
}

/**
 * VoiceWrapper component
 * Provides voice conversation context at root level to prevent remounting issues
 */
function VoiceWrapper({ children }: { children: React.ReactNode }) {
  const userId = useUserId()
  const location = useLocation()
  const isVoicePage = location.pathname === '/voice'

  return (
    <VoiceConversationProvider userId={userId}>
      {children}
      {!isVoicePage && <FloatingVoice />}
    </VoiceConversationProvider>
  )
}
