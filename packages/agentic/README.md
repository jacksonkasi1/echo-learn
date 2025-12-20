# @repo/agentic

**Phase 5: Agentic RAG System** - Intelligent query routing and tool calling for Echo Learn.

## Overview

The `@repo/agentic` package provides a comprehensive agentic RAG (Retrieval-Augmented Generation) system that intelligently routes queries based on their type and executes appropriate strategies. It's designed to be highly scalable, supporting 100+ tools with minimal configuration.

## Key Features

- 🎯 **Query Classification** - Automatically classifies queries into types (fact, summary, chat, calculation, off-topic)
- 🔀 **Smart Routing** - Routes queries to optimal execution strategies
- 🛠️ **Tool System** - Scalable tool calling with AI SDK integration
- 🔄 **Query Rewriting** - Automatically rewrites queries when no results are found
- 📊 **Cost Tracking** - Built-in cost estimation for operations
- ⚡ **Performance** - Uses Gemini Flash for fast classification
- 🔌 **Pluggable** - Easy to add new tools and strategies

## Architecture

```
@repo/agentic/
├── src/
│   ├── router.ts           # Main orchestrator
│   ├── classifier.ts       # Query classification
│   ├── strategies.ts       # Execution strategies
│   ├── tools/
│   │   ├── registry.ts     # Tool registry
│   │   ├── definitions/    # Individual tool definitions
│   │   │   ├── search-rag.tool.ts
│   │   │   ├── rerank.tool.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── query.ts        # Query types
│   │   ├── tools.ts        # Tool types
│   │   └── index.ts
│   └── index.ts
```

## Installation

Already included as a workspace package. Import in your app:

```typescript
import { initializeAgenticRouter, getAgenticRouter } from "@repo/agentic";
```

## Usage

### 1. Initialize the Router

```typescript
import { initializeAgenticRouter } from "@repo/agentic";

// Initialize on server startup
await initializeAgenticRouter({
  enableQuickClassify: true,
  enableQueryRewriting: true,
  maxRewriteAttempts: 2,
  enableCostTracking: true,
  enableDetailedLogging: true,
});
```

### 2. Process Queries

```typescript
import { getAgenticRouter } from "@repo/agentic";

const router = getAgenticRouter();

const result = await router.processQuery(userMessage, {
  userId: "user123",
  messages: conversationHistory,
  useRag: true,
  ragTopK: 50,
  ragMinScore: 0.01,
  maxTokens: 4000,
  temperature: 0.7,
  enableReranking: false, // Optional: enable for fact queries
  enableMultiStep: true,
  maxIterations: 5,
});

// Access results
console.log(result.classification.type); // "fact" | "summary" | "chat" | "calculation" | "offtopic"
console.log(result.strategy); // "hybrid_rerank" | "hybrid_only" | "direct_llm" | "tool_based" | "reject"
console.log(result.retrievedChunks); // Retrieved context
console.log(result.toolCalls); // Tools that were called
console.log(result.cost); // Cost breakdown
```

## Query Types & Strategies

| Query Type | Description | Strategy | Re-ranking |
|------------|-------------|----------|------------|
| **fact** | Specific, precise information | Hybrid + Rerank | ✅ Yes |
| **summary** | Broad overview or summary | Hybrid Only | ❌ No |
| **chat** | Conversational, no retrieval | Direct LLM | ❌ No |
| **calculation** | Math or computation | Tool-based | ❌ No |
| **offtopic** | Outside scope | Reject | ❌ No |

## Adding New Tools

Tools are **dynamically registered** and easy to add. Simply create a new tool definition:

### Step 1: Create Tool Definition

```typescript
// packages/agentic/src/tools/definitions/calculator.tool.ts
import type { ToolDefinition, ToolExecutionContext } from "../../types/tools";
import { ToolCategory } from "../../types/tools";
import { z } from "zod";
import { logger } from "@repo/logs";

const calculatorInputSchema = z.object({
  expression: z.string().describe("Mathematical expression to evaluate"),
});

type CalculatorInput = z.infer<typeof calculatorInputSchema>;

interface CalculatorOutput {
  result: number;
  expression: string;
}

export const calculatorTool: ToolDefinition<CalculatorInput, CalculatorOutput> = {
  name: "calculator",
  description: "Evaluate mathematical expressions and return the result.",
  
  inputSchema: calculatorInputSchema,
  
  category: ToolCategory.CALCULATION,
  requiresApproval: false,
  timeout: 5000,
  cost: 0.5,
  cacheable: true,
  cacheTTL: 3600,
  
  async execute(input, context) {
    try {
      // Safely evaluate expression
      const result = eval(input.expression); // Use a proper math parser in production
      
      logger.info("Calculator executed", {
        userId: context.userId,
        expression: input.expression,
        result,
      });
      
      return {
        result,
        expression: input.expression,
      };
    } catch (error) {
      logger.error("Calculator failed", error);
      throw new Error(`Invalid expression: ${input.expression}`);
    }
  },
};
```

### Step 2: Register Tool

```typescript
// packages/agentic/src/tools/definitions/index.ts
import { searchRAGTool } from "./search-rag.tool";
import { rerankTool } from "./rerank.tool";
import { calculatorTool } from "./calculator.tool"; // Import your tool

export { searchRAGTool } from "./search-rag.tool";
export { rerankTool } from "./rerank.tool";
export { calculatorTool } from "./calculator.tool"; // Export your tool

export const allTools = [
  searchRAGTool,
  rerankTool,
  calculatorTool, // Add to array
  // Add more tools here... (100+ can be added easily!)
] as const;

export const defaultTools = allTools;
```

That's it! The tool is now available system-wide. No other code changes needed.

## Tool Categories

Tools are organized by category for better management:

```typescript
enum ToolCategory {
  SEARCH = "search",           // RAG search, vector search
  RERANK = "rerank",           // Re-ranking documents
  CALCULATION = "calculation", // Math, computation
  DATA_RETRIEVAL = "data_retrieval", // External data
  TRANSFORMATION = "transformation", // Data transformation
  EXTERNAL_API = "external_api",     // API calls
  INTERNAL = "internal",       // Internal operations
}
```

## Configuration Options

```typescript
interface AgenticRouterConfig {
  enableQuickClassify: boolean;      // Fast pattern-based classification
  enableQueryRewriting: boolean;     // Rewrite when no results
  maxRewriteAttempts: number;        // Max rewrite iterations
  enableCostTracking: boolean;       // Track operation costs
  enableDetailedLogging: boolean;    // Verbose logging
}
```

## Cost Breakdown

Every query returns a detailed cost breakdown:

```typescript
interface CostBreakdown {
  classification: number;  // Classification cost
  retrieval: number;       // RAG retrieval cost
  reranking: number;       // Re-ranking cost
  generation: number;      // LLM generation cost
  tools: number;           // Tool execution cost
  total: number;           // Total cost
}
```

## Query Classification

### Automatic Classification

The classifier uses Gemini Flash to intelligently determine query type:

```typescript
const classification = await classifyQuery(
  "What is the definition of photosynthesis?",
  messages
);

console.log(classification);
// {
//   type: "fact",
//   confidence: 0.95,
//   reasoning: "User is asking for a specific definition",
//   needsRewriting: false,
//   strategy: "hybrid_rerank"
// }
```

### Quick Classification

For common patterns, quick classification bypasses LLM:

```typescript
const quickType = quickClassify("Hello, how are you?");
// Returns: "chat" (instant, no LLM call)
```

## Query Rewriting

When retrieval returns no results, queries are automatically rewritten:

```typescript
const rewrittenQuery = await rewriteQuery(
  "mitochondria",
  messages,
  0, // resultsFound
  0  // attempt
);
// Returns: "What are mitochondria and what is their function in cells?"
```

## Advanced: Custom Strategies

You can create custom execution strategies:

```typescript
import type { QueryProcessingOptions } from "@repo/agentic";

export async function executeCustomStrategy(
  query: string,
  messages: ChatMessage[],
  options: QueryProcessingOptions
): Promise<StrategyResult> {
  // Your custom strategy logic
}

// Register in strategyExecutors map
```

## Best Practices

1. **Tool Naming**: Use descriptive, action-based names (`search_rag`, `calculate`, `fetch_weather`)
2. **Timeouts**: Set appropriate timeouts for tools (10s for search, 5s for calculations)
3. **Cost Estimation**: Assign relative costs (1 = cheap, 10 = expensive)
4. **Caching**: Enable caching for idempotent operations
5. **Error Handling**: Always handle errors gracefully in tool execution
6. **Logging**: Use structured logging for debugging
7. **Testing**: Test each tool independently before registration

## Examples

### Example 1: Fact Query

```
User: "What is the capital of France?"
→ Classification: "fact"
→ Strategy: "hybrid_rerank"
→ Tools: [search_rag, rerank_documents]
→ Result: "Paris is the capital of France..."
```

### Example 2: Summary Query

```
User: "Give me an overview of Chapter 5"
→ Classification: "summary"
→ Strategy: "hybrid_only"
→ Tools: [search_rag]
→ Result: "Chapter 5 covers..."
```

### Example 3: Chat Query

```
User: "Thank you for your help!"
→ Classification: "chat"
→ Strategy: "direct_llm"
→ Tools: []
→ Result: "You're welcome! Happy to help..."
```

## Environment Variables

```env
GEMINI_MODEL=gemini-2.0-flash  # Model for classification & generation
NODE_ENV=development           # Controls detailed logging
```

## Dependencies

- `@repo/llm` - LLM generation
- `@repo/rag` - RAG retrieval
- `@repo/storage` - User profiles
- `@repo/logs` - Logging
- `ai` - Vercel AI SDK
- `@ai-sdk/google` - Google Gemini
- `zod` - Schema validation

## Future Enhancements

- [ ] Cohere re-ranking integration
- [ ] Multi-step tool calling with iteration control
- [ ] Tool approval workflow for sensitive operations
- [ ] Advanced caching with Redis
- [ ] A/B testing framework for strategies
- [ ] Monitoring dashboard
- [ ] Tool marketplace for sharing tools
- [ ] Streaming tool results

## Contributing

To add a new tool:

1. Create tool definition in `src/tools/definitions/your-tool.tool.ts`
2. Export from `src/tools/definitions/index.ts`
3. Add to `allTools` array
4. Test your tool
5. Update this README

## License

MIT