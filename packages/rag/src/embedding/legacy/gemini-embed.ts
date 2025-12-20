// ** import types
import type {
  TextChunk,
  ChunkWithEmbedding,
  EmbeddingResult,
  BatchEmbeddingResult,
} from "@repo/shared";

// ** import lib
import { GoogleGenerativeAI } from "@google/generative-ai";

// ** import utils
import { logger } from "@repo/logs";

// Initialize Gemini client
const getGenAI = () => {
  if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    throw new Error(
      "GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set",
    );
  }
  return new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY);
};

// Default embedding model
const EMBEDDING_MODEL = "text-embedding-004";

// Batch processing configuration
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 100; // Delay between batches to respect rate limits

/**
 * Generate embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const genAI = getGenAI();
    const model = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });

    const result = await model.embedContent(text);

    return result.embedding.values;
  } catch (error) {
    logger.error("Failed to generate embedding", error);
    throw error;
  }
}

/**
 * Generate embedding with metadata
 */
export async function generateEmbeddingWithMetadata(
  text: string,
): Promise<EmbeddingResult> {
  try {
    const embedding = await generateEmbedding(text);

    return {
      text,
      embedding,
      tokenCount: estimateTokenCount(text),
    };
  } catch (error) {
    logger.error("Failed to generate embedding with metadata", error);
    throw error;
  }
}

/**
 * Generate embeddings for multiple text chunks
 * Processes in batches to respect rate limits
 */
export async function generateEmbeddingsForChunks(
  chunks: TextChunk[],
): Promise<ChunkWithEmbedding[]> {
  const results: ChunkWithEmbedding[] = [];
  const startTime = Date.now();

  logger.info(`Generating embeddings for ${chunks.length} chunks`);

  // Process in batches
  for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
    const batch = chunks.slice(i, i + BATCH_SIZE);
    const batchNumber = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(chunks.length / BATCH_SIZE);

    logger.info(`Processing batch ${batchNumber}/${totalBatches}`);

    try {
      const embeddings = await Promise.all(
        batch.map((chunk) => generateEmbedding(chunk.content)),
      );

      batch.forEach((chunk, idx) => {
        results.push({
          chunk,
          embedding: embeddings[idx]!,
        });
      });

      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < chunks.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    } catch (error) {
      logger.error(`Batch ${batchNumber} failed`, error);

      // Retry individual chunks in the failed batch
      for (const chunk of batch) {
        try {
          const embedding = await generateEmbedding(chunk.content);
          results.push({ chunk, embedding });
        } catch (retryError) {
          logger.error(
            `Failed to generate embedding for chunk ${chunk.id}`,
            retryError,
          );
          // Skip this chunk but continue with others
        }
      }
    }
  }

  const elapsedMs = Date.now() - startTime;

  logger.info(
    `Generated ${results.length}/${chunks.length} embeddings in ${elapsedMs}ms`,
  );

  return results;
}

/**
 * Generate embeddings for an array of texts
 * Returns a batch result with timing and token information
 */
export async function generateBatchEmbeddings(
  texts: string[],
): Promise<BatchEmbeddingResult> {
  const startTime = Date.now();
  const results: EmbeddingResult[] = [];
  let totalTokens = 0;

  logger.info(`Generating batch embeddings for ${texts.length} texts`);

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const embeddings = await Promise.all(
        batch.map((text) => generateEmbedding(text)),
      );

      batch.forEach((text, idx) => {
        const tokenCount = estimateTokenCount(text);
        totalTokens += tokenCount;
        results.push({
          text,
          embedding: embeddings[idx]!,
          tokenCount,
        });
      });

      // Add delay between batches
      if (i + BATCH_SIZE < texts.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    } catch (error) {
      logger.error(`Batch starting at index ${i} failed`, error);
      throw error;
    }
  }

  const processingTimeMs = Date.now() - startTime;

  return {
    results,
    totalTokens,
    processingTimeMs,
  };
}

/**
 * Generate embedding for a query (for similarity search)
 * Uses the same model as document embeddings for consistency
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  try {
    logger.info("Generating query embedding", { queryLength: query.length });

    const embedding = await generateEmbedding(query);

    return embedding;
  } catch (error) {
    logger.error("Failed to generate query embedding", error);
    throw error;
  }
}

/**
 * Estimate token count for a text
 * Rough estimate: ~4 characters per token on average
 */
function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get the embedding dimension for the current model
 * text-embedding-004 produces 768-dimensional embeddings
 */
export function getEmbeddingDimension(): number {
  return 768;
}

/**
 * Validate that embeddings have the expected dimension
 */
export function validateEmbedding(embedding: number[]): boolean {
  return embedding.length === getEmbeddingDimension();
}

/**
 * Calculate cosine similarity between two embeddings
 * Useful for debugging and testing
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Embeddings must have the same dimension");
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
