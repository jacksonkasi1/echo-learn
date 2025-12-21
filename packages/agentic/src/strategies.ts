// ** import types
import type { ChatMessage } from "@repo/llm";
import type {
  QueryProcessingOptions,
  CostBreakdown,
  ToolCallInfo,
} from "./types/query";

// ** import lib
import { ToolLoopAgent, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";

// ** import services
import { buildSystemPrompt } from "@repo/llm";
import { getUserProfile } from "@repo/storage";

// ** import tools
import { getToolRegistry } from "./tools";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Strategy execution result
 */
export interface StrategyResult {
  stream: ReadableStream<Uint8Array>;
  chunks: any[];
  sources: string[];
  reranked: boolean;
  toolCalls: ToolCallInfo[];
  cost: CostBreakdown;
}

/**
 * Create the unified agentic agent
 *
 * Uses AI SDK 6 ToolLoopAgent - the LLM decides what tools to use.
 * No classifier needed - the model IS the intelligent router!
 */
function createAgent(systemPrompt: string, tools: Record<string, any>) {
  return new ToolLoopAgent({
    model: google(process.env.GEMINI_MODEL || "gemini-2.0-flash"),
    instructions: systemPrompt,
    tools,
    // Use prepareStep to force tool call ONLY on first step
    // After that, switch to "auto" so model can generate text response
    prepareStep: ({ stepNumber }) => {
      if (stepNumber === 0) {
        // First step: MUST call a tool (usually search_rag)
        return { toolChoice: "required" as const };
      }
      // Subsequent steps: let model decide (call more tools or generate response)
      return { toolChoice: "auto" as const };
    },
    stopWhen: stepCountIs(5), // Reduced from 10 - usually 1-2 tool calls is enough
  });
}

/**
 * Execute unified agentic strategy
 *
 * This is the ONLY strategy you need! The LLM decides what tools to use.
 *
 * How it works:
 * 1. Give LLM access to ALL tools (search_rag, calculator, etc.)
 * 2. LLM reads the query and decides which tools to call
 * 3. ToolLoopAgent handles the loop automatically
 * 4. LLM generates final response using tool results
 */
export async function executeUnifiedAgenticStrategy(
  query: string,
  messages: ChatMessage[],
  options: QueryProcessingOptions,
): Promise<StrategyResult> {
  const toolCalls: ToolCallInfo[] = [];
  const chunks: any[] = [];
  const sources: string[] = [];
  const cost: CostBreakdown = {
    classification: 0,
    retrieval: 0,
    reranking: 0,
    generation: 0,
    tools: 0,
    total: 0,
  };

  try {
    // Get user profile for personalization
    const userProfile = await getUserProfile(options.userId);

    // Get ALL tools from registry - LLM will choose which to use
    // Pass userId so tools can access user-specific data
    const toolRegistry = getToolRegistry();
    const tools = toolRegistry.toAISDKTools({
      userId: options.userId,
      query: query,
      queryType: "chat",
    });
    const toolNames = Object.keys(tools);

    logger.info("Unified agentic execution", {
      userId: options.userId,
      availableTools: toolNames,
      query: query.slice(0, 50),
    });

    // Build agentic system prompt - tool call is forced by prepareStep
    const systemPrompt = `You are Echo, a knowledgeable study partner helping users learn from their uploaded materials.

## User Profile
- Level: ${userProfile.level}
- Questions: ${userProfile.questionsAnswered}

## Tools

- **search_rag**: Search the user's knowledge base for information
  - Parameter: topK (number of results to retrieve)
  - Parameter: query (search terms)
- **rerank_documents**: Re-rank search results (use only if 15+ results need refinement)
- **calculator**: Evaluate math expressions

## IMPORTANT: Dynamic Search Depth (topK)

Adjust topK based on what the user is asking:

| Query Type | topK | Examples |
|------------|------|----------|
| Specific fact | 3-5 | "Who is Jackson?", "What is the price?" |
| Single concept | 8-10 | "Explain feature X", "How does Y work?" |
| Moderate depth | 12-15 | "Tell me about the product", "What are the benefits?" |
| Broad overview | 20-25 | "List all features", "Give me an overview of everything" |
| Comprehensive | 30-40 | "Train me on this product", "I need to learn everything", "Prepare me for sales" |

**Examples:**
- "Who is the CEO?" → topK=5
- "What does the product do?" → topK=10
- "List all the integrations" → topK=20
- "I'm new, train me on the entire product" → topK=35
- "Tell me more" / "Go deeper" → Increase topK from previous search

## How to Respond

1. Analyze the query to determine appropriate topK
2. Call search_rag with good keywords and the right topK
3. Review the search results carefully
4. Provide a comprehensive, helpful response based on what you found
5. For broad topics, structure the response with sections/headings

## Guidelines

- Use ONLY information from search results - never make things up
- Be direct and informative - share actual content you found
- Structure your response clearly (use headings, lists when helpful)
- If search returns nothing relevant, say so and suggest what the user could upload
- For training/onboarding requests, provide a structured learning path`;

    // Create agent with tools
    const agent = createAgent(systemPrompt, tools);

    // Build conversation messages for the agent
    // Note: The query is passed separately, so we filter it out from messages
    // to avoid duplication (the last user message IS the query)
    const conversationMessages = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    // Check if the last message is already the query to avoid duplication
    const lastMessage = conversationMessages[conversationMessages.length - 1];
    const queryAlreadyInMessages =
      lastMessage?.role === "user" && lastMessage?.content === query;

    // Use agent.stream() for streaming response
    const result = await agent.stream({
      messages: queryAlreadyInMessages
        ? conversationMessages
        : [...conversationMessages, { role: "user" as const, content: query }],
    });

    // Track tool calls from steps
    const stepsPromise = result.steps.then((steps) => {
      for (const step of steps) {
        if (step.toolCalls && step.toolCalls.length > 0) {
          logger.info("Tool calls in step", {
            count: step.toolCalls.length,
            tools: step.toolCalls.map((tc) => tc.toolName),
          });

          for (const tc of step.toolCalls) {
            const toolResult = step.toolResults?.find(
              (tr) => tr.toolCallId === tc.toolCallId,
            );

            toolCalls.push({
              name: tc.toolName,
              input: tc.input,
              output: toolResult?.output,
              executionTimeMs: 0,
              success: true,
            });

            // Capture RAG results if search_rag was called
            if (tc.toolName === "search_rag" && toolResult?.output) {
              const ragResult = toolResult.output as any;
              if (ragResult.chunks) chunks.push(...ragResult.chunks);
              if (ragResult.sources) sources.push(...ragResult.sources);
            }
          }
        }
      }
    });

    // Calculate costs from usage
    result.usage.then((usage) => {
      if (usage) {
        // Gemini Flash: $0.075/1M input, $0.30/1M output
        const inputTokens = usage.inputTokens || 0;
        const outputTokens = usage.outputTokens || 0;
        cost.generation =
          (inputTokens * 0.075) / 1_000_000 + (outputTokens * 0.3) / 1_000_000;
        cost.tools = toolCalls.length * 0.01;
        cost.total = cost.generation + cost.tools;

        logger.info("Execution completed", {
          inputTokens,
          outputTokens,
          totalTokens: usage.totalTokens || 0,
          toolCalls: toolCalls.length,
          cost: cost.total.toFixed(6),
        });
      }
    });

    // Convert textStream to ReadableStream<Uint8Array>
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const text of result.textStream) {
            controller.enqueue(encoder.encode(text));
          }
          // Wait for steps to be processed
          await stepsPromise;
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return {
      stream,
      chunks,
      sources,
      reranked: false,
      toolCalls,
      cost,
    };
  } catch (error) {
    logger.error("Unified agentic strategy failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}

/**
 * Strategy executors map
 * Now simplified - everything goes through the unified strategy!
 */
export const strategyExecutors = {
  hybrid_rerank: executeUnifiedAgenticStrategy,
  hybrid_only: executeUnifiedAgenticStrategy,
  direct_llm: executeUnifiedAgenticStrategy,
  tool_based: executeUnifiedAgenticStrategy,
  reject: executeUnifiedAgenticStrategy,
};
