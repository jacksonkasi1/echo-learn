// User context for consistent userId across the app
// This provides a temporary user ID until proper auth is implemented

import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

// Temporary user ID - will be replaced with auth later
// HARDCODED for development to ensure consistent user across sessions
const DEFAULT_USER_ID = 'user_1766225500960_0hanw9e' // 'user_dev_echo_learn'

interface UserContextType {
  userId: string
  setUserId: (id: string) => void
  isAuthenticated: boolean
}

const UserContext = createContext<UserContextType | null>(null)

// Get or create a persistent user ID from localStorage
function getStoredUserId(): string {
  // TODO: Remove this hardcoded return when auth is implemented
  // For development, always use the same user ID to persist data
  return DEFAULT_USER_ID

  // Original logic - uncomment when auth is ready:
  // if (typeof window === 'undefined') {
  //   return DEFAULT_USER_ID
  // }
  //
  // const stored = localStorage.getItem('echo-learn-user-id')
  // if (stored) {
  //   return stored
  // }
  //
  // // Generate a new user ID if none exists
  // const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  // localStorage.setItem('echo-learn-user-id', newId)
  // return newId
}

export function UserProvider({ children }: { children: ReactNode }) {
  const [userId, setUserIdState] = useState<string>(() => getStoredUserId())

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

// Export the default user ID for cases where context isn't available
export { DEFAULT_USER_ID }
