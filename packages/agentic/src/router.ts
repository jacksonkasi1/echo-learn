// ** import types
import type { ChatMessage } from "@repo/llm";
import type {
  QueryClassification,
  QueryProcessingOptions,
  QueryProcessingResult,
} from "./types/query";
import { QueryType, QueryStrategy } from "./types/query";

// ** import strategies
import { executeUnifiedAgenticStrategy } from "./strategies";
import { initializeTools, getToolRegistry } from "./tools";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Agentic router configuration
 */
export interface AgenticRouterConfig {
  /** Maximum tool execution steps */
  maxSteps: number;

  /** Enable detailed logging */
  enableDetailedLogging: boolean;
}

/**
 * Default router configuration
 */
const DEFAULT_CONFIG: AgenticRouterConfig = {
  maxSteps: 5,
  enableDetailedLogging: true,
};

/**
 * Agentic Router
 *
 * Simplified architecture - NO classifier needed!
 * The LLM itself decides which tools to use based on the query.
 *
 * How it works:
 * 1. User sends a query
 * 2. LLM receives query + available tools (search_rag, calculator, etc.)
 * 3. LLM decides: "Do I need to search? Calculate? Or just respond?"
 * 4. AI SDK handles the tool execution loop automatically
 * 5. LLM generates final response using tool results
 */
export class AgenticRouter {
  private config: AgenticRouterConfig;
  private initialized: boolean = false;

  constructor(config?: Partial<AgenticRouterConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the router and tool registry
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      logger.info("Initializing agentic router");

      // Initialize tool registry
      initializeTools();

      const registry = getToolRegistry();
      const toolNames = registry.getNames();

      logger.info("Agentic router initialized", {
        toolCount: toolNames.length,
        tools: toolNames,
        config: this.config,
      });

      this.initialized = true;
    } catch (error) {
      logger.error("Failed to initialize agentic router", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }

  /**
   * Process a query with unified agentic strategy
   *
   * No classification step - the LLM decides what to do!
   */
  async processQuery(
    query: string,
    options: QueryProcessingOptions,
  ): Promise<QueryProcessingResult> {
    const startTime = Date.now();

    // Ensure router is initialized
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      logger.info("Processing query", {
        userId: options.userId,
        queryLength: query.length,
      });

      // Execute unified agentic strategy
      // The LLM will decide which tools to use
      const result = await executeUnifiedAgenticStrategy(
        query,
        options.messages,
        {
          ...options,
          maxIterations: this.config.maxSteps,
        },
      );

      const executionTimeMs = Date.now() - startTime;

      // Build classification info (for backward compatibility)
      const classification: QueryClassification = {
        type: QueryType.FACT, // Generic - LLM decides actual behavior
        strategy: QueryStrategy.TOOL_BASED,
        confidence: 1.0,
        reasoning: "Unified agentic strategy - LLM decides tool usage",
        needsRewriting: false,
      };

      logger.info("Query completed", {
        userId: options.userId,
        toolCalls: result.toolCalls.length,
        chunksRetrieved: result.chunks.length,
        executionTimeMs,
      });

      return {
        response: "",
        stream: result.stream,
        classification,
        strategy: QueryStrategy.TOOL_BASED,
        retrievedChunks: result.chunks,
        retrievedSources: result.sources,
        reranked: result.reranked,
        toolCalls: result.toolCalls,
        executionTimeMs,
        cost: result.cost,
      };
    } catch (error) {
      logger.error("Query processing failed", {
        error: error instanceof Error ? error.message : "Unknown error",
        userId: options.userId,
      });
      throw error;
    }
  }
}

// Singleton instance
let routerInstance: AgenticRouter | null = null;

/**
 * Get or create the agentic router instance
 */
export function getAgenticRouter(
  config?: Partial<AgenticRouterConfig>,
): AgenticRouter {
  if (!routerInstance) {
    routerInstance = new AgenticRouter(config);
  }
  return routerInstance;
}

/**
 * Initialize the agentic router
 */
export async function initializeAgenticRouter(
  config?: Partial<AgenticRouterConfig>,
): Promise<AgenticRouter> {
  const router = getAgenticRouter(config);
  await router.initialize();
  return router;
}
