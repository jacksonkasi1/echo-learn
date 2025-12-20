// ** import types
import type { ChatCompletionRequest } from "@/schema/chat";
import type { ChatMessage } from "@repo/llm";
import type { QueryProcessingOptions } from "@repo/agentic";

// ** import lib
import { generateStreamingResponse, buildSystemPrompt } from "@repo/llm";
import { retrieveContext } from "@repo/rag";
import { getUserProfile, updateUserProfile } from "@repo/storage";
import { updateAnalytics } from "@repo/analytics";
import { getAgenticRouter } from "@repo/agentic";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Result of chat completion processing
 */
export interface CompletionResult {
  stream: ReadableStream<Uint8Array>;
  knowledgeChunks: string[];
  retrievedSources: string[];
}

/**
 * Extract the latest user message from conversation
 */
export function extractUserMessage(messages: ChatMessage[]): string | null {
  const userMessage =
    messages.filter((m) => m.role === "user").pop()?.content || "";
  return userMessage || null;
}

/**
 * Retrieve RAG context for the user query
 */
export async function retrieveRagContext(
  query: string,
  userId: string,
  options: { topK: number; minScore: number },
): Promise<{ chunks: string[]; sources: string[]; scores: number[] }> {
  try {
    const contextResult = await retrieveContext(query, userId, {
      topK: options.topK,
      minScore: options.minScore,
    });

    logger.info("RAG context retrieved", {
      userId,
      chunksFound: contextResult.chunks.length,
      sourcesFound: contextResult.sources.length,
      avgScore:
        contextResult.scores.length > 0
          ? (
              contextResult.scores.reduce((a, b) => a + b, 0) /
              contextResult.scores.length
            ).toFixed(3)
          : "N/A",
    });

    return contextResult;
  } catch (ragError) {
    logger.warn("RAG retrieval failed, continuing without context", {
      error: ragError instanceof Error ? ragError.message : "Unknown error",
    });
    return { chunks: [], sources: [], scores: [] };
  }
}

/**
 * Create streaming response for chat completion
 */
export function createCompletionStream(
  textStream: AsyncIterable<string>,
  callbacks: {
    onComplete: (fullResponse: string) => void;
    onError: (error: unknown) => void;
  },
): ReadableStream<Uint8Array> {
  let fullResponse = "";

  return new ReadableStream({
    async start(controller) {
      try {
        let chunkCount = 0;
        let totalLength = 0;

        for await (const chunk of textStream) {
          chunkCount++;
          totalLength += chunk.length;
          fullResponse += chunk;

          if (chunkCount <= 3 || chunkCount % 20 === 0) {
            logger.info("Streaming chunk", {
              chunkCount,
              chunkLength: chunk.length,
              preview: chunk.slice(0, 30),
            });
          }

          controller.enqueue(new TextEncoder().encode(chunk));
        }

        logger.info("Stream completed", { chunkCount, totalLength });
        controller.close();
        callbacks.onComplete(fullResponse);
      } catch (error) {
        logger.error("Streaming failed", error);
        controller.enqueue(
          new TextEncoder().encode("Error generating response"),
        );
        controller.close();
        callbacks.onError(error);
      }
    },
  });
}

/**
 * Process chat completion request with agentic routing
 * Main orchestration function for RAG-enhanced chat
 */
export async function processCompletion(
  body: ChatCompletionRequest,
  startTime: number,
): Promise<CompletionResult> {
  const messages = body.messages as ChatMessage[];
  const userId = body.user_id || body.user || "default";
  const maxTokens = body.max_tokens;
  const temperature = body.temperature;
  const useRag = body.use_rag;
  const ragTopK = body.rag_top_k;
  const ragMinScore = body.rag_min_score;
  const enableAgentic = (body as any).enable_agentic !== false; // Default true
  const enableReranking = (body as any).enable_reranking || false;
  const enableMultiStep = (body as any).enable_multi_step !== false; // Default true
  const maxIterations = (body as any).max_iterations || 5;

  logger.info("Processing chat request", {
    userId,
    messageCount: messages.length,
    useRag,
    enableAgentic,
    enableReranking,
  });

  // Extract user message
  const userMessage = extractUserMessage(messages);
  if (!userMessage) {
    throw new Error("No user message provided");
  }

  // Check if agentic routing is enabled
  if (enableAgentic && useRag) {
    return await processAgenticCompletion(
      userMessage,
      messages,
      userId,
      {
        maxTokens,
        temperature,
        ragTopK,
        ragMinScore,
        enableReranking,
        enableMultiStep,
        maxIterations,
      },
      startTime,
    );
  }

  // Fallback to legacy processing
  return await processLegacyCompletion(
    userMessage,
    messages,
    userId,
    {
      maxTokens,
      temperature,
      ragTopK,
      ragMinScore,
      useRag,
    },
    startTime,
  );
}

/**
 * Process completion using agentic router
 */
async function processAgenticCompletion(
  userMessage: string,
  messages: ChatMessage[],
  userId: string,
  options: {
    maxTokens: number;
    temperature: number;
    ragTopK: number;
    ragMinScore: number;
    enableReranking: boolean;
    enableMultiStep: boolean;
    maxIterations: number;
  },
  startTime: number,
): Promise<CompletionResult> {
  try {
    logger.info("Using agentic router for completion", {
      userId,
      enableReranking: options.enableReranking,
      enableMultiStep: options.enableMultiStep,
    });

    // Get agentic router
    const router = getAgenticRouter();

    // Build processing options
    const processingOptions: QueryProcessingOptions = {
      userId,
      messages,
      useRag: true,
      ragTopK: options.ragTopK,
      ragMinScore: options.ragMinScore,
      maxTokens: options.maxTokens,
      temperature: options.temperature,
      enableReranking: options.enableReranking,
      enableMultiStep: options.enableMultiStep,
      maxIterations: options.maxIterations,
    };

    // Process query with agentic router
    const result = await router.processQuery(userMessage, processingOptions);

    logger.info("Agentic processing completed", {
      userId,
      queryType: result.classification.type,
      strategy: result.strategy,
      chunksRetrieved: result.retrievedChunks.length,
      reranked: result.reranked,
      toolCalls: result.toolCalls.length,
      executionTimeMs: result.executionTimeMs,
    });

    // Wrap stream with analytics callbacks
    const wrappedStream = createCompletionStream(
      streamToAsyncIterable(result.stream!),
      {
        onComplete: (fullResponse) => {
          // Update analytics asynchronously
          updateAnalytics({
            userId,
            query: userMessage,
            response: fullResponse,
            retrievedChunks: result.retrievedChunks,
            processingTimeMs: Date.now() - startTime,
          }).catch((err) => {
            logger.error("Failed to update analytics", err);
          });

          // Update user's last interaction
          updateUserProfile(userId, {
            lastInteraction: new Date().toISOString(),
          }).catch((err) => {
            logger.error("Failed to update user profile", err);
          });
        },
        onError: (error) => {
          logger.error("Completion stream error", error);
        },
      },
    );

    return {
      stream: wrappedStream,
      knowledgeChunks: result.retrievedChunks,
      retrievedSources: result.retrievedSources,
    };
  } catch (error) {
    logger.error("Agentic completion failed, falling back to legacy", {
      error: error instanceof Error ? error.message : "Unknown error",
    });

    // Fallback to legacy processing
    return await processLegacyCompletion(
      userMessage,
      messages,
      userId,
      {
        maxTokens: options.maxTokens,
        temperature: options.temperature,
        ragTopK: options.ragTopK,
        ragMinScore: options.ragMinScore,
        useRag: true,
      },
      startTime,
    );
  }
}

/**
 * Legacy processing (original implementation)
 */
async function processLegacyCompletion(
  userMessage: string,
  messages: ChatMessage[],
  userId: string,
  options: {
    maxTokens: number;
    temperature: number;
    ragTopK: number;
    ragMinScore: number;
    useRag: boolean;
  },
  startTime: number,
): Promise<CompletionResult> {
  logger.info("Using legacy processing", { userId });

  // Get user profile for personalization
  const userProfile = await getUserProfile(userId);

  // Retrieve RAG context if enabled
  let knowledgeChunks: string[] = [];
  let retrievedSources: string[] = [];

  if (options.useRag) {
    const contextResult = await retrieveRagContext(userMessage, userId, {
      topK: options.ragTopK,
      minScore: options.ragMinScore,
    });
    knowledgeChunks = contextResult.chunks;
    retrievedSources = contextResult.sources;
  }

  // Build system prompt with knowledge context
  const systemPrompt = buildSystemPrompt({
    knowledgeChunks,
    userProfile,
  });

  // Filter conversation messages
  const conversationMessages = messages.filter((m) => m.role !== "system");

  // Generate streaming response
  const { textStream } = await generateStreamingResponse({
    systemPrompt,
    messages: conversationMessages,
    maxTokens: options.maxTokens,
    temperature: options.temperature,
  });

  // Create stream with callbacks
  const stream = createCompletionStream(textStream, {
    onComplete: (fullResponse) => {
      // Update analytics asynchronously
      updateAnalytics({
        userId,
        query: userMessage,
        response: fullResponse,
        retrievedChunks: knowledgeChunks,
        processingTimeMs: Date.now() - startTime,
      }).catch((err) => {
        logger.error("Failed to update analytics", err);
      });

      // Update user's last interaction
      updateUserProfile(userId, {
        lastInteraction: new Date().toISOString(),
      }).catch((err) => {
        logger.error("Failed to update user profile", err);
      });
    },
    onError: (error) => {
      logger.error("Completion stream error", error);
    },
  });

  return {
    stream,
    knowledgeChunks,
    retrievedSources,
  };
}

/**
 * Convert ReadableStream to AsyncIterable
 */
async function* streamToAsyncIterable(
  stream: ReadableStream<Uint8Array>,
): AsyncIterable<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
}
