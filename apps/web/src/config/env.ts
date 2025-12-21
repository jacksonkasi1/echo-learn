// Environment configuration for the web app
// All environment variables should be defined here for centralized management

export const env = {
  // Backend API URL - the base URL for all API calls
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787',

  // Environment mode
  NODE_ENV: import.meta.env.MODE || 'development',

  // Feature flags
  ENABLE_VOICE: import.meta.env.VITE_ENABLE_VOICE === 'true',

  // 11Labs configuration (for voice features)
  ELEVENLABS_AGENT_ID: import.meta.env.VITE_ELEVENLABS_AGENT_ID || '',
} as const

// Type for the env object
export type Env = typeof env

// Validation function to check required env vars
export function validateEnv(): void {
  const requiredVars = ['API_BASE_URL'] as const

  const missing = requiredVars.filter((key) => !env[key])

  if (missing.length > 0 && typeof window !== 'undefined') {
    console.warn(
      `Missing environment variables: ${missing.join(', ')}. Using defaults.`,
    )
  }
}

// Run validation on import (client-side only)
if (typeof window !== 'undefined') {
  validateEnv()
}
