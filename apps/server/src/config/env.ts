// ** import utils
import { logger } from "@repo/logs";

/**
 * Server environment configuration
 * All environment variables should be defined here for centralized management
 */
export const env = {
  // Server Configuration
  PORT: Number(process.env.PORT) || 8787,
  NODE_ENV: process.env.NODE_ENV || "development",
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(",") || [
    "http://localhost:3000",
    "http://localhost:5173",
  ],

  // Default User ID (until proper auth is implemented)
  // Fallback: user_1766340918528_63z6u87
  DEFAULT_USER_ID: process.env.DEFAULT_USER_ID || "user_1766340918528_63z6u87",

  // Upstash Vector
  UPSTASH_VECTOR_REST_URL: process.env.UPSTASH_VECTOR_REST_URL || "",
  UPSTASH_VECTOR_REST_TOKEN: process.env.UPSTASH_VECTOR_REST_TOKEN || "",

  // Upstash Redis
  UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL || "",
  UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN || "",

  // Google Cloud Storage
  GCS_PROJECT_ID: process.env.GCS_PROJECT_ID || "",
  GCS_KEY_FILE: process.env.GCS_KEY_FILE || "", // For local development
  GCS_BUCKET_NAME: process.env.GCS_BUCKET_NAME || "",
  // For Cloud Run deployment (pass credentials directly instead of file)
  GCS_CLIENT_EMAIL: process.env.GCS_CLIENT_EMAIL || "",
  GCS_PRIVATE_KEY: process.env.GCS_PRIVATE_KEY || "",

  // AI API Keys
  GOOGLE_GENERATIVE_AI_API_KEY: process.env.GOOGLE_GENERATIVE_AI_API_KEY || "",
  COHERE_API_KEY: process.env.COHERE_API_KEY || "",
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY || "",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || "",

  // ElevenLabs
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY || "",
  ELEVENLABS_AGENT_ID: process.env.ELEVENLABS_AGENT_ID || "",
  ELEVENLABS_AGENT_SECRET: process.env.ELEVENLABS_AGENT_SECRET || "",
} as const;

// Type for the env object
export type Env = typeof env;

/**
 * Validation function to check required env vars
 */
export function validateEnv(): void {
  const requiredVars = [
    "UPSTASH_VECTOR_REST_URL",
    "UPSTASH_VECTOR_REST_TOKEN",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN",
    "GOOGLE_GENERATIVE_AI_API_KEY",
    "DEFAULT_USER_ID",
  ] as const;

  const missing = requiredVars.filter((key) => !env[key]);

  if (missing.length > 0) {
    logger.warn(
      `Missing environment variables: ${missing.join(", ")}. Some features may not work.`,
    );
  }
}

// Run validation on import
validateEnv();
