/**
 * Legacy Embedding Module
 *
 * DEPRECATED: This module is no longer in use.
 *
 * We now use Upstash's built-in embedding feature which handles
 * vectorization server-side using the BAAI model.
 *
 * For upsert operations: Use `upsertWithEmbedding` from @repo/storage
 * For search operations: Use `searchWithEmbedding` from @repo/storage
 *
 * The legacy Gemini embedding implementation is preserved in ./legacy
 * for reference purposes only.
 */

// Legacy exports preserved for reference - DO NOT USE IN NEW CODE
export * from "./legacy/index.js";
