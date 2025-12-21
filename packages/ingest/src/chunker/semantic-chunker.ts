// ** Semantic Chunker for Phase 4: Advanced Chunking
// Detects topic changes using sentence similarity to create meaningful chunks

// ** import types
import type { TextChunk, ChunkerOptions, ChunkingResult } from "@repo/shared";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Semantic chunking configuration
 */
export interface SemanticChunkerOptions extends ChunkerOptions {
  /** Similarity threshold for topic change detection (0-1, lower = more splits) */
  similarityThreshold?: number;
  /** Minimum sentences per chunk */
  minSentencesPerChunk?: number;
  /** Maximum sentences per chunk */
  maxSentencesPerChunk?: number;
  /** Use structural hints (headers, paragraphs) */
  useStructuralHints?: boolean;
}

/**
 * Default semantic chunker options
 */
const DEFAULT_SEMANTIC_OPTIONS: Required<SemanticChunkerOptions> = {
  chunkSize: 1500,
  chunkOverlap: 200,
  separators: ["\n\n", "\n", ". ", "? ", "! "],
  preserveHeaders: true,
  similarityThreshold: 0.5,
  minSentencesPerChunk: 2,
  maxSentencesPerChunk: 15,
  useStructuralHints: true,
};

/**
 * Sentence with metadata
 */
interface SentenceInfo {
  text: string;
  index: number;
  isHeader: boolean;
  headerLevel?: number;
  isParagraphStart: boolean;
}

/**
 * Chunk candidate during processing
 */
interface ChunkCandidate {
  sentences: SentenceInfo[];
  header?: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Split text into semantic chunks based on topic changes
 * Uses structural hints and content analysis to create meaningful boundaries
 */
export function semanticChunkText(
  text: string,
  fileId: string,
  options: Partial<SemanticChunkerOptions> = {},
): ChunkingResult {
  const opts = { ...DEFAULT_SEMANTIC_OPTIONS, ...options };

  logger.info("Starting semantic chunking", {
    fileId,
    textLength: text.length,
    similarityThreshold: opts.similarityThreshold,
    useStructuralHints: opts.useStructuralHints,
  });

  // Step 1: Normalize and extract sentences with metadata
  const normalizedText = normalizeText(text);
  const sentences = extractSentencesWithMetadata(normalizedText);

  if (sentences.length === 0) {
    logger.warn("No sentences extracted from text", { fileId });
    return {
      chunks: [],
      totalChunks: 0,
      averageChunkSize: 0,
      fileId,
    };
  }

  // Step 2: Find natural break points using structural hints
  const breakPoints = opts.useStructuralHints
    ? findStructuralBreakPoints(sentences)
    : [];

  // Step 3: Find topic-based break points using content similarity
  const topicBreaks = findTopicBreakPoints(sentences, opts.similarityThreshold);

  // Step 4: Merge break points and create chunk candidates
  const allBreaks = mergeBreakPoints(
    breakPoints,
    topicBreaks,
    sentences.length,
  );
  const candidates = createChunkCandidates(sentences, allBreaks);

  // Step 5: Optimize chunks based on size constraints
  const optimizedCandidates = optimizeChunkSizes(
    candidates,
    opts.chunkSize,
    opts.minSentencesPerChunk,
    opts.maxSentencesPerChunk,
  );

  // Step 6: Build final chunks with metadata
  const chunks = buildFinalChunks(
    optimizedCandidates,
    fileId,
    opts.preserveHeaders,
  );

  // Calculate stats
  const totalLength = chunks.reduce(
    (sum, chunk) => sum + chunk.content.length,
    0,
  );
  const averageChunkSize =
    chunks.length > 0 ? Math.round(totalLength / chunks.length) : 0;

  logger.info("Semantic chunking completed", {
    fileId,
    totalChunks: chunks.length,
    averageChunkSize,
    breakPointsFound: allBreaks.length,
  });

  return {
    chunks,
    totalChunks: chunks.length,
    averageChunkSize,
    fileId,
  };
}

/**
 * Normalize text for processing
 */
function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

/**
 * Extract sentences with structural metadata
 */
function extractSentencesWithMetadata(text: string): SentenceInfo[] {
  const sentences: SentenceInfo[] = [];
  const lines = text.split("\n");

  let sentenceIndex = 0;
  let previousWasEmpty = true;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!trimmedLine) {
      previousWasEmpty = true;
      continue;
    }

    // Check if line is a header
    const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
    if (headerMatch && headerMatch[1]) {
      sentences.push({
        text: trimmedLine,
        index: sentenceIndex++,
        isHeader: true,
        headerLevel: headerMatch[1].length,
        isParagraphStart: true,
      });
      previousWasEmpty = true;
      continue;
    }

    // Split line into sentences
    const lineSentences = splitIntoSentences(trimmedLine);

    for (let i = 0; i < lineSentences.length; i++) {
      const sentenceText = lineSentences[i]?.trim();
      if (sentenceText) {
        sentences.push({
          text: sentenceText,
          index: sentenceIndex++,
          isHeader: false,
          isParagraphStart: previousWasEmpty && i === 0,
        });
      }
    }

    previousWasEmpty = false;
  }

  return sentences;
}

/**
 * Split text into sentences using punctuation
 */
function splitIntoSentences(text: string): string[] {
  // Handle common abbreviations to avoid false splits
  const protected_text = text
    .replace(/Mr\./g, "Mr\u0000")
    .replace(/Mrs\./g, "Mrs\u0000")
    .replace(/Dr\./g, "Dr\u0000")
    .replace(/vs\./g, "vs\u0000")
    .replace(/e\.g\./g, "e\u0000g\u0000")
    .replace(/i\.e\./g, "i\u0000e\u0000")
    .replace(/etc\./g, "etc\u0000");

  // Split on sentence-ending punctuation
  const parts = protected_text.split(/(?<=[.!?])\s+/);

  // Restore protected abbreviations
  return parts.map((part) => part.replace(/\u0000/g, "."));
}

/**
 * Find break points based on structural elements (headers, paragraphs)
 */
function findStructuralBreakPoints(sentences: SentenceInfo[]): number[] {
  const breakPoints: number[] = [];

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];
    if (!sentence) continue;

    // Break before headers
    if (sentence.isHeader && i > 0) {
      breakPoints.push(i);
    }

    // Break at paragraph starts (after significant content)
    if (sentence.isParagraphStart && !sentence.isHeader && i > 2) {
      const prevSentence = sentences[i - 1];
      if (prevSentence && !prevSentence.isHeader) {
        breakPoints.push(i);
      }
    }
  }

  return breakPoints;
}

/**
 * Find break points based on topic changes using word overlap similarity
 * Uses a sliding window approach to detect topic shifts
 */
function findTopicBreakPoints(
  sentences: SentenceInfo[],
  threshold: number,
): number[] {
  const breakPoints: number[] = [];

  if (sentences.length < 4) {
    return breakPoints;
  }

  // Use a window of 2 sentences before and after to detect topic changes
  for (let i = 2; i < sentences.length - 1; i++) {
    const sentence = sentences[i];
    if (!sentence) continue;

    // Skip headers - they're already handled structurally
    if (sentence.isHeader) continue;

    // Calculate similarity between previous context and upcoming context
    const prevContext = getCombinedText(sentences, Math.max(0, i - 2), i);
    const nextContext = getCombinedText(
      sentences,
      i,
      Math.min(sentences.length, i + 2),
    );

    const similarity = calculateTextSimilarity(prevContext, nextContext);

    // If similarity drops below threshold, mark as potential break point
    if (similarity < threshold) {
      breakPoints.push(i);
    }
  }

  return breakPoints;
}

/**
 * Get combined text from a range of sentences
 */
function getCombinedText(
  sentences: SentenceInfo[],
  startIdx: number,
  endIdx: number,
): string {
  return sentences
    .slice(startIdx, endIdx)
    .filter((s) => !s.isHeader)
    .map((s) => s.text)
    .join(" ");
}

/**
 * Calculate similarity between two text segments using word overlap (Jaccard similarity)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = extractSignificantWords(text1);
  const words2 = extractSignificantWords(text2);

  if (words1.size === 0 || words2.size === 0) {
    return 0;
  }

  // Calculate Jaccard similarity
  let intersection = 0;
  for (const word of words1) {
    if (words2.has(word)) {
      intersection++;
    }
  }

  const union = words1.size + words2.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * Extract significant words from text (filter stop words)
 */
function extractSignificantWords(text: string): Set<string> {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "of",
    "with",
    "by",
    "from",
    "as",
    "is",
    "was",
    "are",
    "were",
    "been",
    "be",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "could",
    "should",
    "may",
    "might",
    "must",
    "shall",
    "can",
    "need",
    "it",
    "its",
    "this",
    "that",
    "these",
    "those",
    "i",
    "you",
    "he",
    "she",
    "we",
    "they",
    "what",
    "which",
    "who",
    "whom",
    "when",
    "where",
    "why",
    "how",
    "all",
    "each",
    "every",
    "both",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
    "no",
    "not",
    "only",
    "same",
    "so",
    "than",
    "too",
    "very",
    "just",
    "also",
    "now",
    "here",
    "there",
    "then",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));

  return new Set(words);
}

/**
 * Merge structural and topic break points, removing duplicates and close neighbors
 */
function mergeBreakPoints(
  structural: number[],
  topic: number[],
  totalSentences: number,
): number[] {
  const allBreaks = new Set([...structural, ...topic]);
  const sortedBreaks = Array.from(allBreaks).sort((a, b) => a - b);

  // Remove break points that are too close together (within 2 sentences)
  const mergedBreaks: number[] = [];
  let lastBreak = -3;

  for (const breakPoint of sortedBreaks) {
    if (breakPoint - lastBreak >= 2) {
      mergedBreaks.push(breakPoint);
      lastBreak = breakPoint;
    }
  }

  return mergedBreaks;
}

/**
 * Create chunk candidates from break points
 */
function createChunkCandidates(
  sentences: SentenceInfo[],
  breakPoints: number[],
): ChunkCandidate[] {
  const candidates: ChunkCandidate[] = [];

  // Add start point if not present
  const allPoints = [0, ...breakPoints.filter((p) => p > 0)];

  for (let i = 0; i < allPoints.length; i++) {
    const startIdx = allPoints[i]!;
    const endIdx = allPoints[i + 1] ?? sentences.length;

    const chunkSentences = sentences.slice(startIdx, endIdx);
    if (chunkSentences.length === 0) continue;

    // Find header for this chunk
    const header = chunkSentences.find((s) => s.isHeader)?.text;

    candidates.push({
      sentences: chunkSentences,
      header,
      startIndex: startIdx,
      endIndex: endIdx,
    });
  }

  return candidates;
}

/**
 * Optimize chunk sizes by merging small chunks and splitting large ones
 */
function optimizeChunkSizes(
  candidates: ChunkCandidate[],
  maxChunkSize: number,
  minSentences: number,
  maxSentences: number,
): ChunkCandidate[] {
  const optimized: ChunkCandidate[] = [];

  let pendingCandidate: ChunkCandidate | null = null;

  for (const candidate of candidates) {
    const candidateSize = getCandidateSize(candidate);
    const candidateSentenceCount = candidate.sentences.filter(
      (s) => !s.isHeader,
    ).length;

    // If candidate is too small, try to merge with pending
    if (candidateSentenceCount < minSentences && pendingCandidate) {
      pendingCandidate = mergeCandidates(pendingCandidate, candidate);
      continue;
    }

    // If we have a pending candidate, decide whether to output it or merge
    if (pendingCandidate) {
      const pendingSize = getCandidateSize(pendingCandidate);
      const combinedSize = pendingSize + candidateSize;

      if (
        combinedSize <= maxChunkSize &&
        pendingCandidate.sentences.length + candidate.sentences.length <=
          maxSentences
      ) {
        // Merge if combined size is acceptable
        pendingCandidate = mergeCandidates(pendingCandidate, candidate);
      } else {
        // Output pending and start new
        optimized.push(pendingCandidate);
        pendingCandidate = candidate;
      }
    } else {
      pendingCandidate = candidate;
    }

    // If pending is large enough, output it
    if (pendingCandidate) {
      const pendingSize = getCandidateSize(pendingCandidate);
      const pendingSentenceCount = pendingCandidate.sentences.filter(
        (s) => !s.isHeader,
      ).length;

      if (
        pendingSentenceCount >= maxSentences ||
        pendingSize >= maxChunkSize * 0.8
      ) {
        // Split if too large
        if (pendingSentenceCount > maxSentences) {
          const split = splitCandidate(pendingCandidate, maxSentences);
          optimized.push(...split.slice(0, -1));
          pendingCandidate = split[split.length - 1] || null;
        } else {
          optimized.push(pendingCandidate);
          pendingCandidate = null;
        }
      }
    }
  }

  // Don't forget the last pending candidate
  if (pendingCandidate) {
    optimized.push(pendingCandidate);
  }

  return optimized;
}

/**
 * Get approximate character size of a candidate
 */
function getCandidateSize(candidate: ChunkCandidate): number {
  return candidate.sentences.reduce((sum, s) => sum + s.text.length + 1, 0);
}

/**
 * Merge two candidates into one
 */
function mergeCandidates(
  first: ChunkCandidate,
  second: ChunkCandidate,
): ChunkCandidate {
  return {
    sentences: [...first.sentences, ...second.sentences],
    header: first.header || second.header,
    startIndex: first.startIndex,
    endIndex: second.endIndex,
  };
}

/**
 * Split a candidate into smaller chunks
 */
function splitCandidate(
  candidate: ChunkCandidate,
  maxSentences: number,
): ChunkCandidate[] {
  const result: ChunkCandidate[] = [];
  const sentences = candidate.sentences;

  for (let i = 0; i < sentences.length; i += maxSentences) {
    const chunk = sentences.slice(i, i + maxSentences);
    result.push({
      sentences: chunk,
      header: i === 0 ? candidate.header : undefined,
      startIndex: candidate.startIndex + i,
      endIndex: candidate.startIndex + i + chunk.length,
    });
  }

  return result;
}

/**
 * Build final TextChunk objects from candidates
 */
function buildFinalChunks(
  candidates: ChunkCandidate[],
  fileId: string,
  preserveHeaders: boolean,
): TextChunk[] {
  return candidates.map((candidate, index) => {
    // Combine sentences into content
    const contentParts: string[] = [];

    if (preserveHeaders && candidate.header) {
      contentParts.push(candidate.header);
      contentParts.push(""); // Empty line after header
    }

    for (const sentence of candidate.sentences) {
      if (sentence.isHeader && preserveHeaders) {
        // Header already added above for first header
        if (sentence.text !== candidate.header) {
          contentParts.push("");
          contentParts.push(sentence.text);
        }
      } else if (!sentence.isHeader) {
        // Add sentence, starting new paragraph if needed
        if (sentence.isParagraphStart && contentParts.length > 0) {
          contentParts.push("");
        }
        contentParts.push(sentence.text);
      }
    }

    const content = contentParts.join("\n").trim();

    return {
      id: `${fileId}_chunk_${index}`,
      content,
      fileId,
      chunkIndex: index,
      metadata: {
        section: candidate.header,
        headings: candidate.header ? [candidate.header] : undefined,
        sentenceCount: candidate.sentences.filter((s) => !s.isHeader).length,
        isSemanticChunk: true,
      },
    };
  });
}

/**
 * Estimate token count for semantic chunker
 */
export function estimateSemanticTokenCount(text: string): number {
  // Average ~4 characters per token for English text
  return Math.ceil(text.length / 4);
}
