// ** import types
import type { ChatMessage } from "@repo/llm";
import type { ChatMode } from "@repo/shared";

/**
 * Query types for classification
 */
export enum QueryType {
  /** Fact-finding query - needs precise information */
  FACT = "fact",

  /** Summary/overview query - needs broad context */
  SUMMARY = "summary",

  /** Conversational/chat query - no retrieval needed */
  CHAT = "chat",

  /** Calculation/computation query */
  CALCULATION = "calculation",

  /** Off-topic query - outside scope */
  OFFTOPIC = "offtopic",
}

/**
 * Query classification result
 */
export interface QueryClassification {
  /** Classified type */
  type: QueryType;

  /** Confidence score (0-1) */
  confidence: number;

  /** Reasoning for classification */
  reasoning: string;

  /** Whether query needs rewriting */
  needsRewriting: boolean;

  /** Suggested rewritten query */
  rewrittenQuery?: string;

  /** Recommended strategy */
  strategy: QueryStrategy;
}

/**
 * Query execution strategy
 */
export enum QueryStrategy {
  /** Hybrid search + re-ranking (for facts) */
  HYBRID_RERANK = "hybrid_rerank",

  /** Hybrid search only (for summaries) */
  HYBRID_ONLY = "hybrid_only",

  /** Direct LLM response (for chat) */
  DIRECT_LLM = "direct_llm",

  /** Tool-based (for calculations) */
  TOOL_BASED = "tool_based",

  /** Reject (for off-topic) */
  REJECT = "reject",
}

/**
 * Query processing options
 */
export interface QueryProcessingOptions {
  /** User ID */
  userId: string;

  /** Conversation history */
  messages: ChatMessage[];

  /** Whether to use RAG */
  useRag: boolean;

  /** Top K results */
  ragTopK: number;

  /** Minimum score threshold */
  ragMinScore: number;

  /** Maximum tokens */
  maxTokens: number;

  /** Temperature */
  temperature: number;

  /** Whether to enable re-ranking */
  enableReranking: boolean;

  /** Whether to enable multi-step tools */
  enableMultiStep: boolean;

  /** Max iterations for multi-step */
  maxIterations: number;

  /** Abort signal */
  signal?: AbortSignal;

  /** Chat mode (learn/chat/test) - affects how interactions are tracked */
  mode?: ChatMode;
}

/**
 * Query processing result
 */
export interface QueryProcessingResult {
  /** Generated response */
  response: string;

  /** Stream (if streaming) */
  stream?: ReadableStream<Uint8Array>;

  /** Query classification */
  classification: QueryClassification;

  /** Strategy used */
  strategy: QueryStrategy;

  /** Retrieved chunks */
  retrievedChunks: string[];

  /** Retrieved sources */
  retrievedSources: string[];

  /** Re-ranking applied */
  reranked: boolean;

  /** Tool calls made */
  toolCalls: ToolCallInfo[];

  /** Total execution time */
  executionTimeMs: number;

  /** Cost breakdown */
  cost: CostBreakdown;
}

/**
 * Tool call information
 */
export interface ToolCallInfo {
  /** Tool name */
  name: string;

  /** Input */
  input: unknown;

  /** Output */
  output: unknown;

  /** Execution time */
  executionTimeMs: number;

  /** Success status */
  success: boolean;

  /** Error if failed */
  error?: string;
}

/**
 * Cost breakdown
 */
export interface CostBreakdown {
  /** Classification cost */
  classification: number;

  /** Retrieval cost */
  retrieval: number;

  /** Re-ranking cost */
  reranking: number;

  /** LLM generation cost */
  generation: number;

  /** Tool execution cost */
  tools: number;

  /** Total cost */
  total: number;
}

/**
 * Query rewriting options
 */
export interface QueryRewriteOptions {
  /** Original query */
  query: string;

  /** Conversation context */
  messages: ChatMessage[];

  /** Number of results found */
  resultsFound: number;

  /** Previous attempts */
  attempts: number;
}

/**
 * Query rewriting result
 */
export interface QueryRewriteResult {
  /** Rewritten query */
  rewrittenQuery: string;

  /** Changes made */
  changes: string[];

  /** Confidence in rewrite */
  confidence: number;
}
