// ** import types
import type { ChatMessage } from "@repo/llm";
import type { QueryClassification } from "./types/query";
import { QueryType, QueryStrategy } from "./types/query";

// ** import lib
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Classification result schema
 */
const classificationSchema = z.object({
  type: z.enum(["fact", "summary", "chat", "calculation", "offtopic"]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  needsRewriting: z.boolean(),
  rewrittenQuery: z.string().optional(),
});

/**
 * Get the configured Gemini model for classification
 */
function getClassifierModel() {
  const modelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  return google(modelName);
}

/**
 * Map query type to execution strategy
 */
function mapTypeToStrategy(type: QueryType): QueryStrategy {
  switch (type) {
    case QueryType.FACT:
      return QueryStrategy.HYBRID_RERANK;
    case QueryType.SUMMARY:
      return QueryStrategy.HYBRID_ONLY;
    case QueryType.CHAT:
      return QueryStrategy.DIRECT_LLM;
    case QueryType.CALCULATION:
      return QueryStrategy.TOOL_BASED;
    case QueryType.OFFTOPIC:
      return QueryStrategy.REJECT;
    default:
      return QueryStrategy.HYBRID_ONLY;
  }
}

/**
 * Classify a user query into a type and strategy
 * Uses Gemini Flash for fast, accurate classification
 */
export async function classifyQuery(
  query: string,
  messages?: ChatMessage[],
  context?: string,
): Promise<QueryClassification> {
  const startTime = Date.now();

  try {
    // Build conversation context
    const conversationContext =
      messages && messages.length > 0
        ? messages
            .slice(-5) // Last 5 messages for context
            .map((m) => `${m.role}: ${m.content}`)
            .join("\n")
        : "";

    // Build classification prompt
    const prompt = `You are a query classifier for an AI learning assistant. Analyze the user's query and classify it into one of these types:

**Query Types:**
1. **fact** - User wants specific, precise information or facts from their study materials
   - Example: "What is the definition of mitochondria?"
   - Example: "When did World War 2 end?"
   - Needs: Hybrid search + re-ranking for precision

2. **summary** - User wants a broad overview or summary of a topic
   - Example: "Give me an overview of photosynthesis"
   - Example: "Summarize Chapter 5"
   - Needs: Hybrid search only (no re-ranking needed for broad context)

3. **chat** - Conversational query that doesn't require knowledge retrieval
   - Example: "Hello, how are you?"
   - Example: "Can you help me study?"
   - Example: "Thank you!"
   - Needs: Direct LLM response (no retrieval)

4. **calculation** - Requires computation or mathematical operations
   - Example: "What is 25 * 48?"
   - Example: "Calculate the area of a circle with radius 5"
   - Needs: Tool-based execution

5. **offtopic** - Query is outside the scope of learning/education
   - Example: "What's the weather today?"
   - Example: "Tell me a joke"
   - Needs: Polite rejection

**Your Task:**
Classify the following query and provide:
- type: The query type
- confidence: Your confidence level (0-1)
- reasoning: Brief explanation of your classification
- needsRewriting: Whether the query needs to be rewritten for better retrieval
- rewrittenQuery: If needsRewriting is true, provide an improved version

${conversationContext ? `**Conversation Context:**\n${conversationContext}\n` : ""}
${context ? `**Additional Context:**\n${context}\n` : ""}

**Query to Classify:**
"${query}"

Analyze and classify this query.`;

    logger.info("Classifying query", {
      queryLength: query.length,
      hasMessages: !!messages,
      hasContext: !!context,
    });

    // Generate classification using structured output
    const { object } = await generateObject({
      model: getClassifierModel(),
      schema: classificationSchema,
      prompt,
      temperature: 0.3, // Low temperature for consistent classification
    });

    const executionTime = Date.now() - startTime;

    logger.info("Query classified", {
      type: object.type,
      confidence: object.confidence.toFixed(2),
      needsRewriting: object.needsRewriting,
      executionTime,
    });

    // Map to strategy
    const strategy = mapTypeToStrategy(object.type as QueryType);

    return {
      type: object.type as QueryType,
      confidence: object.confidence,
      reasoning: object.reasoning,
      needsRewriting: object.needsRewriting,
      rewrittenQuery: object.rewrittenQuery,
      strategy,
    };
  } catch (error) {
    logger.error("Query classification failed", {
      error: error instanceof Error ? error.message : "Unknown error",
      query: query.slice(0, 100),
    });

    // Fallback to safe default
    return {
      type: QueryType.SUMMARY,
      confidence: 0.5,
      reasoning: "Classification failed, using fallback",
      needsRewriting: false,
      strategy: QueryStrategy.HYBRID_ONLY,
    };
  }
}

/**
 * Rewrite a query for better retrieval
 * Used when initial retrieval returns no results
 */
export async function rewriteQuery(
  query: string,
  messages: ChatMessage[],
  resultsFound: number,
  attempts: number = 0,
): Promise<string> {
  const startTime = Date.now();

  try {
    // Build conversation context
    const conversationContext = messages
      .slice(-3)
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = `You are a query optimization expert for a semantic search system. The user's query returned ${resultsFound} results (attempt ${attempts + 1}).

**Conversation Context:**
${conversationContext}

**Current Query:**
"${query}"

**Your Task:**
Rewrite this query to improve retrieval results. Make it:
- More specific and detailed
- Use alternative phrasings or synonyms
- Add context from the conversation if helpful
- Focus on key concepts and terms

Provide ONLY the rewritten query, nothing else.`;

    logger.info("Rewriting query", {
      originalQuery: query,
      resultsFound,
      attempts,
    });

    const { object } = await generateObject({
      model: getClassifierModel(),
      schema: z.object({
        rewrittenQuery: z.string(),
      }),
      prompt,
      temperature: 0.5,
    });

    const executionTime = Date.now() - startTime;

    logger.info("Query rewritten", {
      originalLength: query.length,
      rewrittenLength: object.rewrittenQuery.length,
      executionTime,
    });

    return object.rewrittenQuery;
  } catch (error) {
    logger.error("Query rewriting failed", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Return original query on failure
    return query;
  }
}

/**
 * Fast classification for simple cases
 * Uses pattern matching for common query types
 */
export function quickClassify(query: string): QueryType | null {
  const lowerQuery = query.toLowerCase().trim();

  // Chat patterns
  const chatPatterns = [
    /^(hi|hello|hey|greetings)/,
    /^(thanks|thank you|thx)/,
    /^(bye|goodbye|see you)/,
    /(how are you|what's up)/,
  ];

  for (const pattern of chatPatterns) {
    if (pattern.test(lowerQuery)) {
      return QueryType.CHAT;
    }
  }

  // Calculation patterns
  const calcPatterns = [
    /calculate|compute|solve/,
    /what is \d+[\+\-\*\/]\d+/,
    /\d+\s*[\+\-\*\/]\s*\d+/,
  ];

  for (const pattern of calcPatterns) {
    if (pattern.test(lowerQuery)) {
      return QueryType.CALCULATION;
    }
  }

  // Summary patterns
  const summaryPatterns = [
    /^(summarize|overview|summary of)/,
    /explain .+ in simple terms/,
    /give me (an overview|a summary)/,
  ];

  for (const pattern of summaryPatterns) {
    if (pattern.test(lowerQuery)) {
      return QueryType.SUMMARY;
    }
  }

  // Fact patterns
  const factPatterns = [
    /^(what is|what are|define|definition of)/,
    /^(who|when|where|which)/,
    /^(how many|how much)/,
  ];

  for (const pattern of factPatterns) {
    if (pattern.test(lowerQuery)) {
      return QueryType.FACT;
    }
  }

  // If no pattern matched, return null (needs LLM classification)
  return null;
}
