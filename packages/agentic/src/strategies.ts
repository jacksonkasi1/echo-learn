// ** import types
import type { ChatMessage } from "@repo/llm";
import type { ChatMode } from "@repo/shared";
import type {
  QueryProcessingOptions,
  CostBreakdown,
  ToolCallInfo,
} from "./types/query";

// ** import lib
import { ToolLoopAgent, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";

// ** import services
import { getUserProfile } from "@repo/storage";

// ** import tools
import { getToolRegistry } from "./tools";

// ** import modes
import {
  initializeMode,
  getToolsForMode,
  shouldRunPassiveAnalysis,
  type ModeResult,
} from "./modes";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Extended query processing options with mode support
 */
export interface ModeAwareQueryOptions extends QueryProcessingOptions {
  mode?: ChatMode;
}

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
  mode: ChatMode;
  modeResult?: ModeResult;
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
 * Build mode-specific system prompt
 */
function buildModeSystemPrompt(
  mode: ChatMode,
  modeResult: ModeResult,
  userProfile: { level: string; questionsAnswered: number },
): string {
  // Base prompt from mode
  const modePrompt = modeResult.systemPrompt;

  // Common tool documentation
  const toolsDoc = `
## Tools

- **search_rag**: Search the user's knowledge base for information
  - Parameter: topK (number of results to retrieve)
  - Parameter: query (search terms)
- **rerank_documents**: Re-rank search results (use only if 15+ results need refinement)
- **calculator**: Evaluate math expressions
${mode !== "chat" ? "- **save_learning_progress**: Save user's learning progress to memory (use sparingly!)" : ""}

## IMPORTANT: Dynamic Search Depth (topK)

Adjust topK based on what the user is asking:

| Query Type | topK | Examples |
|------------|------|----------|
| Specific fact | 3-5 | "Who is Jackson?", "What is the price?" |
| Single concept | 8-10 | "Explain feature X", "How does Y work?" |
| Moderate depth | 12-15 | "Tell me about the product", "What are the benefits?" |
| Broad overview | 20-25 | "List all features", "Give me an overview of everything" |
| Comprehensive | 30-40 | "Train me on this product", "I need to learn everything", "Prepare me for sales" |

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
- If search returns nothing relevant, say so and suggest what the user could upload`;

  // Mode-specific additions
  let modeSpecificPrompt = "";

  switch (mode) {
    case "learn":
      modeSpecificPrompt = `

## Mode: 🎓 LEARN MODE (Active)

The system automatically tracks learning progress in the background.
Focus on clear explanations that help build understanding.

## When to Save Learning Progress (save_learning_progress tool)

**ONLY call save_learning_progress when meaningful learning occurred:**

| Situation | Action | Example |
|-----------|--------|---------|
| Completed training on a topic | mark_topic_learned | After "Train me on pricing" → topics=["pricing", "plans"] |
| User struggles/gets confused | mark_topic_weak | User asks same thing 3 times → topics=["integrations"] |
| User demonstrates mastery | mark_topic_strong | Correct quiz answer → topics=["product features"] |
| Long learning session ends | log_session_summary | After 10+ exchanges on a topic |
| Major milestone reached | update_level | After completing full product training |

**DO NOT call save_learning_progress for:**
- Simple Q&A ("Who is X?" → no need to save)
- Quick lookups ("What's the price?" → no need to save)
- Casual conversation
- Single questions about a topic`;
      break;

    case "chat":
      modeSpecificPrompt = `

## Mode: 💬 CHAT MODE (Off-Record)

This conversation is NOT being tracked for learning purposes.
The user wants to explore freely without affecting their learning profile.
- Answer questions directly and helpfully
- Don't mention learning progress or suggest saving anything
- Be conversational and relaxed
- No learning tools are available in this mode`;
      break;

    case "test":
      // Test mode prompt is fully handled by test-mode.ts with question context
      // Don't add duplicate instructions here - modeResult.systemPrompt has everything
      modeSpecificPrompt = "";
      break;
  }

  return `${modePrompt}

## User Profile
- Level: ${userProfile.level}
- Questions answered: ${userProfile.questionsAnswered}
${toolsDoc}
${modeSpecificPrompt}`;
}

/**
 * Execute unified agentic strategy with mode support
 *
 * This is the ONLY strategy you need! The LLM decides what tools to use.
 *
 * How it works:
 * 1. Initialize mode (learn/chat/test)
 * 2. Give LLM access to mode-appropriate tools
 * 3. LLM reads the query and decides which tools to call
 * 4. ToolLoopAgent handles the loop automatically
 * 5. LLM generates final response using tool results
 * 6. If in learn mode, trigger background analysis (Phase 2)
 */
export async function executeUnifiedAgenticStrategy(
  query: string,
  messages: ChatMessage[],
  options: ModeAwareQueryOptions,
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

  // Default to learn mode if not specified
  const mode: ChatMode = options.mode || "learn";

  try {
    // Get user profile for personalization
    const userProfile = await getUserProfile(options.userId);

    // Initialize mode handling
    const modeResult = await initializeMode({
      userId: options.userId,
      mode,
      query,
      conversationHistory: messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    logger.info("Mode initialized", {
      userId: options.userId,
      mode,
      shouldAnalyze:
        "shouldAnalyze" in modeResult ? modeResult.shouldAnalyze : false,
    });

    // Get ALL tools from registry - LLM will choose which to use
    // Pass userId so tools can access user-specific data
    const toolRegistry = getToolRegistry();
    const allTools = toolRegistry.toAISDKTools({
      userId: options.userId,
      query: query,
      queryType: mode,
    });

    // Filter tools based on mode (e.g., chat mode removes learning tools)
    const tools = getToolsForMode(allTools, mode);
    const toolNames = Object.keys(tools);

    logger.info("Unified agentic execution", {
      userId: options.userId,
      mode,
      availableTools: toolNames,
      query: query.slice(0, 50),
    });

    // Build mode-specific system prompt
    const systemPrompt = buildModeSystemPrompt(mode, modeResult, {
      level: userProfile.level,
      questionsAnswered: userProfile.questionsAnswered,
    });

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

    // Calculate costs from usage - wait for both steps and usage to resolve
    // to ensure toolCalls array is populated before computing tool costs
    const costPromise = Promise.all([stepsPromise, result.usage]).then(
      ([, usage]) => {
        if (usage) {
          // Gemini Flash: $0.075/1M input, $0.30/1M output
          const inputTokens = usage.inputTokens || 0;
          const outputTokens = usage.outputTokens || 0;
          cost.generation =
            (inputTokens * 0.075) / 1_000_000 +
            (outputTokens * 0.3) / 1_000_000;
          cost.tools = toolCalls.length * 0.01;
          cost.total = cost.generation + cost.tools;

          logger.info("Execution completed", {
            mode,
            inputTokens,
            outputTokens,
            totalTokens: usage.totalTokens || 0,
            toolCalls: toolCalls.length,
            cost: cost.total.toFixed(6),
          });
        }
      },
    );

    // Convert textStream to ReadableStream<Uint8Array>
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const text of result.textStream) {
            controller.enqueue(encoder.encode(text));
          }
          // Wait for steps and cost to be processed
          await costPromise;
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    // Note: Background analysis for learn mode will be triggered in Phase 2
    // by the caller after streaming completes
    if (shouldRunPassiveAnalysis(mode)) {
      logger.info("Learn mode - background analysis will be triggered", {
        userId: options.userId,
      });
    }

    return {
      stream,
      chunks,
      sources,
      reranked: false,
      toolCalls,
      cost,
      mode,
      modeResult,
    };
  } catch (error) {
    logger.error("Unified agentic strategy failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      mode,
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
