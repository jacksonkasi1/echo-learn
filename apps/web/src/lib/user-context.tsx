// User context for consistent userId across the app
// This provides a temporary user ID until proper auth is implemented

import { createContext, useCallback, useContext, useState } from 'react'
import type { ReactNode } from 'react'

// Development mode check - only use hardcoded ID in explicit dev mode
const IS_DEV_MODE =
  process.env.NODE_ENV === 'development' ||
  process.env.NEXT_PUBLIC_DEV_MODE === 'true'

// Temporary user ID - will be replaced with auth later
// Only used in development mode to ensure consistent user across sessions
const DEV_USER_ID = 'user_1766225500960_0hanw9e'
const DEFAULT_USER_ID = 'user_anonymous'

interface UserContextType {
  userId: string
  setUserId: (id: string) => void
  isAuthenticated: boolean
}

const UserContext = createContext<UserContextType | null>(null)

// Get or create a persistent user ID from localStorage
function getStoredUserId(): string {
  // In development mode, use hardcoded ID for consistent testing
  if (IS_DEV_MODE) {
    console.log('[Dev Mode] Using hardcoded user ID for development')
    return DEV_USER_ID
  }

  // Production: use localStorage-based user ID
  if (typeof window === 'undefined') {
    return DEFAULT_USER_ID
  }

  const stored = localStorage.getItem('echo-learn-user-id')
  if (stored) {
    return stored
  }

  // Generate a new user ID if none exists
  const newId = `user_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  localStorage.setItem('echo-learn-user-id', newId)
  return newId
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

// Export for cases where context isn't available
export { DEFAULT_USER_ID, DEV_USER_ID, IS_DEV_MODE }
