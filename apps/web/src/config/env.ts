export const env = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
}

if (!env.OPENAI_API_KEY && typeof window === 'undefined') {
  console.warn('Missing OPENAI_API_KEY environment variable')
}
