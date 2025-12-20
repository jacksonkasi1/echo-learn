// ** import types
import type { z } from "zod";

/**
 * Base tool definition interface
 * Follows AI SDK tool structure for compatibility
 */
export interface ToolDefinition<TInput = unknown, TOutput = unknown> {
  /** Unique tool identifier */
  name: string;

  /** Human-readable description for LLM */
  description: string;

  /** Zod schema for input validation */
  inputSchema: z.ZodType<TInput, any, any>;

  /** Tool execution function */
  execute: (input: TInput, context: ToolExecutionContext) => Promise<TOutput>;

  /** Whether this tool requires user approval */
  requiresApproval?: boolean;

  /** Maximum execution time in milliseconds */
  timeout?: number;

  /** Tool category for organization */
  category?: ToolCategory;

  /** Cost estimate (arbitrary units) */
  cost?: number;

  /** Whether to cache results */
  cacheable?: boolean;

  /** Cache TTL in seconds */
  cacheTTL?: number;
}

/**
 * Context passed to tool execution
 */
export interface ToolExecutionContext {
  /** User ID for context */
  userId: string;

  /** Query that triggered the tool */
  query: string;

  /** Query classification */
  queryType: string;

  /** Previous tool calls in this session */
  previousCalls: ToolCall[];

  /** Iteration count (for multi-step) */
  iteration: number;

  /** Maximum iterations allowed */
  maxIterations: number;

  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Tool call result
 */
export interface ToolCall {
  /** Tool call ID */
  id: string;

  /** Tool name */
  toolName: string;

  /** Input arguments */
  input: unknown;

  /** Output result */
  output: unknown;

  /** Execution time in ms */
  executionTime: number;

  /** Whether execution succeeded */
  success: boolean;

  /** Error if failed */
  error?: string;

  /** Timestamp */
  timestamp: Date;
}

/**
 * Tool execution result
 */
export interface ToolExecutionResult<T = unknown> {
  /** Whether execution succeeded */
  success: boolean;

  /** Result data */
  data?: T;

  /** Error if failed */
  error?: string;

  /** Execution time in ms */
  executionTime: number;

  /** Whether to continue with more tools */
  continueExecution?: boolean;
}

/**
 * Tool categories for organization
 */
export enum ToolCategory {
  SEARCH = "search",
  RERANK = "rerank",
  CALCULATION = "calculation",
  DATA_RETRIEVAL = "data_retrieval",
  TRANSFORMATION = "transformation",
  EXTERNAL_API = "external_api",
  INTERNAL = "internal",
}

/**
 * Tool registry interface
 */
export interface ToolRegistry {
  /** Register a new tool */
  register<TInput, TOutput>(tool: ToolDefinition<TInput, TOutput>): void;

  /** Unregister a tool */
  unregister(name: string): void;

  /** Get a tool by name */
  get<TInput, TOutput>(
    name: string,
  ): ToolDefinition<TInput, TOutput> | undefined;

  /** Get all tools */
  getAll(): Map<string, ToolDefinition>;

  /** Get tools by category */
  getByCategory(category: ToolCategory): ToolDefinition[];

  /** Check if tool exists */
  has(name: string): boolean;

  /** Get all tool names */
  getNames(): string[];

  /** Convert to AI SDK tool format */
  toAISDKTools(): Record<string, unknown>;
}
