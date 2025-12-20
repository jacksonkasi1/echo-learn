// ** Context Manager for Dynamic Context Window Management
// Implements token budget approach instead of fixed topK for better context utilization

// ** import types
import type { VectorSearchResult } from "@repo/shared";

/**
 * Configuration for context budget management
 */
export interface ContextBudgetConfig {
  /** Maximum tokens allowed for context (default: 6000) */
  maxTokens: number;
  /** Minimum number of chunks to include regardless of budget (default: 3) */
  minChunks: number;
  /** Maximum number of chunks to consider (default: 30) */
  maxChunks: number;
  /** Average tokens per character (approximate, default: 0.25) */
  tokensPerChar: number;
  /** Ensure chunks from different sources are included (default: true) */
  ensureDiversity: boolean;
  /** Minimum sources to include if available (default: 2) */
  minSources: number;
}

/**
 * Default context budget configuration
 */
export const DEFAULT_CONTEXT_BUDGET: ContextBudgetConfig = {
  maxTokens: 6000,
  minChunks: 3,
  maxChunks: 30,
  tokensPerChar: 0.25,
  ensureDiversity: true,
  minSources: 2,
};

/**
 * Result of context selection
 */
export interface ContextSelectionResult {
  /** Selected chunks in order of relevance */
  chunks: Array<string>;
  /** Source file IDs included */
  sources: Array<string>;
  /** Similarity scores for selected chunks */
  scores: Array<number>;
  /** Estimated token count */
  estimatedTokens: number;
  /** Number of chunks filtered out due to budget */
  filteredCount: number;
  /** Statistics about the selection */
  stats: {
    totalCandidates: number;
    selectedCount: number;
    uniqueSources: number;
    avgScore: number;
    budgetUsed: number; // percentage of token budget used
  };
}

/**
 * Estimate token count for a text string
 * Uses a simple character-based approximation
 */
export function estimateTokens(
  text: string,
  tokensPerChar: number = DEFAULT_CONTEXT_BUDGET.tokensPerChar,
): number {
  // More accurate estimation considering word boundaries and punctuation
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const charCount = text.length;

  // Average of word-based (1.3 tokens per word) and char-based estimation
  const wordBasedEstimate = wordCount * 1.3;
  const charBasedEstimate = charCount * tokensPerChar;

  return Math.ceil((wordBasedEstimate + charBasedEstimate) / 2);
}

/**
 * Select chunks based on token budget with source diversity
 * Implements a greedy selection algorithm that prioritizes:
 * 1. Source diversity (ensure multiple files are represented)
 * 2. Relevance score (higher scores preferred)
 * 3. Token budget (stay within limits)
 */
export function selectChunksWithBudget(
  results: Array<VectorSearchResult>,
  config: Partial<ContextBudgetConfig> = {},
): ContextSelectionResult {
  const cfg = { ...DEFAULT_CONTEXT_BUDGET, ...config };

  // Initialize result containers
  const selectedChunks: Array<string> = [];
  const selectedSources: Set<string> = new Set();
  const selectedScores: Array<number> = [];
  let currentTokens = 0;
  let filteredCount = 0;

  // Filter results with valid content
  const validResults = results.filter(
    (r) => r.metadata?.content && typeof r.metadata.content === "string",
  );

  if (validResults.length === 0) {
    return {
      chunks: [],
      sources: [],
      scores: [],
      estimatedTokens: 0,
      filteredCount: 0,
      stats: {
        totalCandidates: 0,
        selectedCount: 0,
        uniqueSources: 0,
        avgScore: 0,
        budgetUsed: 0,
      },
    };
  }

  // Phase 1: Ensure source diversity by selecting top chunk from each unique source
  if (cfg.ensureDiversity) {
    const sourceToTopChunk = new Map<
      string,
      { result: VectorSearchResult; index: number }
    >();

    // Group by source and keep the highest-scoring chunk for each
    for (let i = 0; i < validResults.length; i++) {
      const result = validResults[i];
      if (!result) continue;

      const sourceId = result.metadata?.fileId as string | undefined;

      if (sourceId) {
        const existing = sourceToTopChunk.get(sourceId);
        if (!existing || result.score > existing.result.score) {
          sourceToTopChunk.set(sourceId, { result, index: i });
        }
      }
    }

    // Select top chunks from different sources (up to minSources)
    const sortedSources = Array.from(sourceToTopChunk.entries())
      .sort((a, b) => b[1].result.score - a[1].result.score)
      .slice(0, cfg.minSources);

    for (const [sourceId, { result }] of sortedSources) {
      const content = result.metadata!.content as string;
      const chunkTokens = estimateTokens(content, cfg.tokensPerChar);

      if (
        currentTokens + chunkTokens <= cfg.maxTokens &&
        selectedChunks.length < cfg.maxChunks
      ) {
        selectedChunks.push(content);
        selectedSources.add(sourceId);
        selectedScores.push(result.score);
        currentTokens += chunkTokens;
      }
    }
  }

  // Phase 2: Fill remaining budget with highest-scoring chunks
  // Sort by score (descending)
  const sortedResults = [...validResults].sort((a, b) => b.score - a.score);

  for (const result of sortedResults) {
    // Check if we've reached limits
    if (selectedChunks.length >= cfg.maxChunks) {
      filteredCount += sortedResults.length - selectedChunks.length;
      break;
    }

    const content = result.metadata!.content as string;
    const chunkTokens = estimateTokens(content, cfg.tokensPerChar);

    // Skip if already selected (from diversity phase)
    if (selectedChunks.includes(content)) {
      continue;
    }

    // Check token budget
    if (currentTokens + chunkTokens > cfg.maxTokens) {
      // If we haven't met minChunks, try to include shorter chunks
      if (selectedChunks.length < cfg.minChunks) {
        // Look for a shorter chunk that fits
        const remainingBudget = cfg.maxTokens - currentTokens;
        if (chunkTokens <= remainingBudget * 1.1) {
          // Allow 10% overflow for min chunks
          selectedChunks.push(content);
          const sourceId = result.metadata?.fileId as string | undefined;
          if (sourceId) selectedSources.add(sourceId);
          selectedScores.push(result.score);
          currentTokens += chunkTokens;
        } else {
          filteredCount++;
        }
      } else {
        filteredCount++;
      }
      continue;
    }

    // Add chunk
    selectedChunks.push(content);
    const sourceId = result.metadata?.fileId as string | undefined;
    if (sourceId) selectedSources.add(sourceId);
    selectedScores.push(result.score);
    currentTokens += chunkTokens;
  }

  // Calculate statistics
  const avgScore =
    selectedScores.length > 0
      ? selectedScores.reduce((a, b) => a + b, 0) / selectedScores.length
      : 0;

  const budgetUsed =
    cfg.maxTokens > 0 ? (currentTokens / cfg.maxTokens) * 100 : 0;

  return {
    chunks: selectedChunks,
    sources: Array.from(selectedSources),
    scores: selectedScores,
    estimatedTokens: currentTokens,
    filteredCount,
    stats: {
      totalCandidates: validResults.length,
      selectedCount: selectedChunks.length,
      uniqueSources: selectedSources.size,
      avgScore: parseFloat(avgScore.toFixed(4)),
      budgetUsed: parseFloat(budgetUsed.toFixed(1)),
    },
  };
}

/**
 * Calculate optimal chunk count based on available content and budget
 */
export function calculateOptimalTopK(
  averageChunkSize: number,
  config: Partial<ContextBudgetConfig> = {},
): number {
  const cfg = { ...DEFAULT_CONTEXT_BUDGET, ...config };

  const avgTokensPerChunk = estimateTokens(
    "x".repeat(averageChunkSize),
    cfg.tokensPerChar,
  );

  // Calculate how many chunks fit in budget with 20% safety margin
  const estimatedFit = Math.floor((cfg.maxTokens * 0.8) / avgTokensPerChunk);

  // Clamp between minChunks and maxChunks
  return Math.max(cfg.minChunks, Math.min(estimatedFit, cfg.maxChunks));
}

/**
 * Reorder chunks for better context flow
 * Groups chunks by source and orders by relevance within each group
 */
export function reorderChunksForContext(
  chunks: Array<string>,
  sources: Array<string>,
  scores: Array<number>,
  results: Array<VectorSearchResult>,
): { chunks: Array<string>; sources: Array<string>; scores: Array<number> } {
  if (chunks.length <= 1) {
    return { chunks, sources, scores };
  }

  // Create a map of content to full result info
  const contentToInfo = new Map<
    string,
    { source: string; score: number; chunkIndex?: number }
  >();

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    if (!chunk) continue;

    const result = results.find((r) => r.metadata?.content === chunk);
    const sourceFromArray = sources[i];
    const scoreFromArray = scores[i];

    contentToInfo.set(chunk, {
      source:
        (result?.metadata?.fileId as string) || sourceFromArray || "unknown",
      score: scoreFromArray ?? 0,
      chunkIndex: result?.metadata?.chunkIndex as number | undefined,
    });
  }

  // Group chunks by source
  const chunksBySource = new Map<
    string,
    Array<{ content: string; score: number; chunkIndex?: number }>
  >();

  for (const [content, info] of contentToInfo) {
    if (!chunksBySource.has(info.source)) {
      chunksBySource.set(info.source, []);
    }
    chunksBySource.get(info.source)!.push({
      content,
      score: info.score,
      chunkIndex: info.chunkIndex,
    });
  }

  // Sort chunks within each source by chunkIndex if available, otherwise by score
  for (const sourceChunks of chunksBySource.values()) {
    sourceChunks.sort((a, b) => {
      if (a.chunkIndex !== undefined && b.chunkIndex !== undefined) {
        return a.chunkIndex - b.chunkIndex;
      }
      return b.score - a.score;
    });
  }

  // Order sources by their highest-scoring chunk
  const sourcesWithMaxScore = Array.from(chunksBySource.entries()).map(
    ([source, chunks]) => ({
      source,
      maxScore: Math.max(...chunks.map((c) => c.score)),
      chunks,
    }),
  );

  sourcesWithMaxScore.sort((a, b) => b.maxScore - a.maxScore);

  // Flatten back to arrays
  const reorderedChunks: Array<string> = [];
  const reorderedSources: Array<string> = [];
  const reorderedScores: Array<number> = [];

  for (const { source, chunks: sourceChunks } of sourcesWithMaxScore) {
    for (const chunk of sourceChunks) {
      reorderedChunks.push(chunk.content);
      reorderedSources.push(source);
      reorderedScores.push(chunk.score);
    }
  }

  return {
    chunks: reorderedChunks,
    sources: reorderedSources,
    scores: reorderedScores,
  };
}
