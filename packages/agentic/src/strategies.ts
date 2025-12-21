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
    stopWhen: stepCountIs(10), // Allow up to 10 steps for complex queries
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

    // Build system prompt with tool usage instructions
    const basePrompt = buildSystemPrompt({
      knowledgeChunks: [],
      userProfile,
    });

    const systemPrompt = `${basePrompt}

## Your Tools

- **search_rag**: Search the user's uploaded knowledge base
- **rerank_documents**: Re-rank search results to find the most relevant ones
- **calculator**: Evaluate mathematical expressions

## Tool Usage Rules

**Step 1 - ALWAYS search first:**
For ANY factual question (Who/What/Where/When/Why/How), call search_rag first.

**Step 2 - Rerank for specific questions:**
After search_rag returns results, use rerank_documents when:
- User asks about a SPECIFIC person, fact, or detail (e.g., "Who is Jackson?", "What is the price?")
- You got many results (10+) and need to find the most relevant ones
- The question needs a precise answer, not a broad summary

**Skip reranking for:**
- Summary/overview questions ("Summarize the project", "List all features")
- When search returns few results (<5)
- Broad exploratory questions

**Example workflow for "Who is Jackson?":**
1. Call search_rag with query "Jackson"
2. If results > 5, call rerank_documents with query "Who is Jackson?" and the document texts
3. Use the top reranked results to answer

**ONLY skip search_rag for:**
- Pure greetings: "hi", "hello"
- Math: use calculator
- Questions about yourself (the assistant)

**MANDATORY**: Never say "I don't have information" without calling search_rag first.

## Response Guidelines

- Share actual content from the retrieved/reranked chunks
- Be specific and substantive
- Use markdown formatting when helpful`;

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
