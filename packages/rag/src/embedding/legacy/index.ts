/**
 * Legacy Gemini Embedding Module
 *
 * This module contains the previous implementation that used Google's Gemini
 * text-embedding-004 model for generating embeddings client-side.
 *
 * DEPRECATED: We now use Upstash's built-in embedding feature which handles
 * vectorization server-side using the BAAI model. This approach:
 * - Eliminates the need for client-side embedding code
 * - Reduces API calls and latency
 * - Simplifies the codebase
 *
 * This legacy code is preserved for reference and potential fallback use cases.
 */

export * from "./gemini-embed.js";
