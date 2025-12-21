// ** export router
export {
  AgenticRouter,
  getAgenticRouter,
  initializeAgenticRouter,
} from "./router";
export type { AgenticRouterConfig } from "./router";

// ** export strategies
export { executeUnifiedAgenticStrategy, strategyExecutors } from "./strategies";
export type { StrategyResult, ModeAwareQueryOptions } from "./strategies";

// ** export tools
export * from "./tools";

// ** export modes
export * from "./modes";

// ** export analysis pipeline
export * from "./analysis";

// ** export types
export type {
  // Query types
  QueryClassification,
  QueryProcessingOptions,
  QueryProcessingResult,
  ToolCallInfo,
  CostBreakdown,
  // Tool types
  ToolDefinition,
  ToolExecutionContext,
  ToolCall,
  ToolExecutionResult,
  ToolRegistry as IToolRegistry,
} from "./types";

export { ToolCategory } from "./types/tools";
export { QueryType, QueryStrategy } from "./types/query";
