// ** import types
import type {
  ToolDefinition,
  ToolRegistry as IToolRegistry,
  ToolCategory,
} from "../types/tools";

// ** import lib
import { tool } from "ai";

// ** import tools (static ESM import)
import { allTools } from "./definitions";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Tool registry implementation
 * Manages tool definitions and provides AI SDK integration
 */
export class ToolRegistry implements IToolRegistry {
  private tools: Map<string, ToolDefinition>;

  constructor() {
    this.tools = new Map();
  }

  /**
   * Register a new tool
   */
  register<TInput, TOutput>(toolDef: ToolDefinition<TInput, TOutput>): void {
    if (this.tools.has(toolDef.name)) {
      logger.warn(`Tool "${toolDef.name}" already registered, overwriting`);
    }

    this.tools.set(toolDef.name, toolDef as ToolDefinition);

    logger.info(`Registered tool: ${toolDef.name}`, {
      category: toolDef.category,
      requiresApproval: toolDef.requiresApproval,
      cacheable: toolDef.cacheable,
    });
  }

  /**
   * Unregister a tool
   */
  unregister(name: string): void {
    if (!this.tools.has(name)) {
      logger.warn(`Tool "${name}" not found for unregistration`);
      return;
    }

    this.tools.delete(name);
    logger.info(`Unregistered tool: ${name}`);
  }

  /**
   * Get a tool by name
   */
  get<TInput, TOutput>(
    name: string,
  ): ToolDefinition<TInput, TOutput> | undefined {
    return this.tools.get(name) as ToolDefinition<TInput, TOutput> | undefined;
  }

  /**
   * Get all tools
   */
  getAll(): Map<string, ToolDefinition> {
    return this.tools;
  }

  /**
   * Get tools by category
   */
  getByCategory(category: ToolCategory): ToolDefinition[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.category === category,
    );
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tool names
   */
  getNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Convert to AI SDK tool format
   * Used for passing to generateText/streamText
   *
   * @param executionContext - Context to pass to all tool executions (userId, query, etc.)
   */
  toAISDKTools(executionContext?: {
    userId?: string;
    query?: string;
    queryType?: string;
  }): Record<string, any> {
    const aiTools: Record<string, any> = {};

    for (const [name, toolDef] of this.tools.entries()) {
      aiTools[name] = tool({
        description: toolDef.description,
        inputSchema: toolDef.inputSchema,
        execute: async (input: any, options: any) => {
          const startTime = Date.now();

          try {
            // Build execution context - use passed context, then options, then defaults
            const context = {
              userId: executionContext?.userId || options?.userId || "unknown",
              query: executionContext?.query || options?.query || "",
              queryType:
                executionContext?.queryType || options?.queryType || "chat",
              previousCalls: options?.previousCalls || [],
              iteration: options?.iteration || 0,
              maxIterations: options?.maxIterations || 5,
              signal: options?.abortSignal,
            };

            // Execute with timeout if specified
            let result;
            if (toolDef.timeout) {
              result = await Promise.race([
                toolDef.execute(input, context),
                new Promise((_, reject) =>
                  setTimeout(
                    () => reject(new Error("Tool execution timeout")),
                    toolDef.timeout,
                  ),
                ),
              ]);
            } else {
              result = await toolDef.execute(input, context);
            }

            const executionTime = Date.now() - startTime;

            logger.info(`Tool executed successfully: ${name}`, {
              executionTime,
              cost: toolDef.cost,
            });

            return result;
          } catch (error) {
            const executionTime = Date.now() - startTime;

            logger.error(`Tool execution failed: ${name}`, {
              error: error instanceof Error ? error.message : "Unknown error",
              executionTime,
            });

            throw error;
          }
        },
      });
    }

    return aiTools;
  }

  /**
   * Get filtered tools based on enabled/disabled lists
   *
   * @param enabledTools - List of tool names to include (if provided, only these are included)
   * @param disabledTools - List of tool names to exclude
   * @param executionContext - Context to pass to all tool executions (userId, query, etc.)
   */
  getFilteredTools(
    enabledTools?: string[],
    disabledTools?: string[],
    executionContext?: {
      userId?: string;
      query?: string;
      queryType?: string;
    },
  ): Record<string, any> {
    const allTools = this.toAISDKTools(executionContext);

    // If enabled list provided, only include those
    if (enabledTools && enabledTools.length > 0) {
      const filtered: Record<string, any> = {};
      for (const toolName of enabledTools) {
        if (allTools[toolName]) {
          filtered[toolName] = allTools[toolName];
        }
      }
      return filtered;
    }

    // If disabled list provided, exclude those
    if (disabledTools && disabledTools.length > 0) {
      const filtered: Record<string, any> = {};
      for (const [name, toolDef] of Object.entries(allTools)) {
        if (!disabledTools.includes(name)) {
          filtered[name] = toolDef;
        }
      }
      return filtered;
    }

    // Return all tools
    return allTools;
  }

  /**
   * Get tool metadata
   */
  getMetadata(name: string) {
    const toolDef = this.tools.get(name);
    if (!toolDef) return undefined;

    return {
      name: toolDef.name,
      description: toolDef.description,
      category: toolDef.category,
      requiresApproval: toolDef.requiresApproval,
      timeout: toolDef.timeout,
      cost: toolDef.cost,
      cacheable: toolDef.cacheable,
      cacheTTL: toolDef.cacheTTL,
    };
  }
}

// Singleton instance
let registryInstance: ToolRegistry | null = null;

/**
 * Get or create the tool registry instance
 */
export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

/**
 * Initialize the tool registry with default tools
 */
export function initializeTools(): void {
  const registry = getToolRegistry();

  // Register all default tools (imported statically at top of file)
  // Cast to ToolDefinition since allTools contains heterogeneous tool types
  for (const toolDef of allTools) {
    registry.register(toolDef as ToolDefinition);
  }
}

// Export the tool registry singleton
export const toolRegistry = getToolRegistry();
