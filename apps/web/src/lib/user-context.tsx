// User context for consistent userId across the app
// This provides a temporary user ID until proper auth is implemented

// ** import types
import type { ReactNode } from 'react'

// ** import core packages
import { createContext, useCallback, useContext, useState } from 'react'

// ** import config
import { env } from '@/config/env'

// User ID from environment config
const USER_ID = env.DEFAULT_USER_ID

interface UserContextType {
  userId: string
  setUserId: (id: string) => void
  isAuthenticated: boolean
}

const UserContext = createContext<UserContextType | null>(null)

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<string>(USER_ID)

  const setUserId = useCallback((id: string) => {
    setUserIdState(id)
    if (typeof window !== 'undefined') {
      localStorage.setItem('echo-learn-user-id', id)
    }
  }, [])

  const value: UserContextType = {
    userId,
    setUserId,
    // For now, we consider any user with an ID as "authenticated"
    // This will change when real auth is implemented
    isAuthenticated: !!userId,
  }

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UserContextType {
  const context = useContext(UserContext)
  if (!context) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

// Hook to get just the userId (convenience)
export function useUserId(): string {
  const { userId } = useUser()
  return userId
}

// Export USER_ID for cases where context isn't available
export { USER_ID }
