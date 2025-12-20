// ** import types
import type { TextChunk, ChunkerOptions, ChunkingResult } from "@repo/shared";

// ** import utils
import { logger } from "@repo/logs";

const DEFAULT_OPTIONS: ChunkerOptions = {
  chunkSize: 1000,
  chunkOverlap: 200,
  separators: ["\n## ", "\n### ", "\n#### ", "\n\n", "\n", ". ", " "],
  preserveHeaders: true,
};

/**
 * Split text into semantic chunks for embedding
 * Respects markdown structure and maintains context overlap
 */
export function chunkText(
  text: string,
  fileId: string,
  options: Partial<ChunkerOptions> = {}
): ChunkingResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const chunks: TextChunk[] = [];

  logger.info("Starting text chunking", {
    fileId,
    textLength: text.length,
    chunkSize: opts.chunkSize,
    chunkOverlap: opts.chunkOverlap,
  });

  // Normalize text
  const normalizedText = normalizeText(text);

  // Split by major headers first to preserve topic structure
  const sections = splitByHeaders(normalizedText, opts.preserveHeaders ?? true);

  let chunkIndex = 0;

  for (const section of sections) {
    const sectionHeader = section.header;
    const sectionContent = section.content;

    if (sectionContent.length <= opts.chunkSize) {
      // Section fits in a single chunk
      chunks.push({
        id: `${fileId}_chunk_${chunkIndex}`,
        content: combineHeaderAndContent(sectionHeader, sectionContent),
        fileId,
        chunkIndex,
        metadata: {
          section: sectionHeader,
          headings: sectionHeader ? [sectionHeader] : undefined,
        },
      });
      chunkIndex++;
    } else {
      // Section needs to be split further
      const subChunks = splitRecursively(
        sectionContent,
        opts.chunkSize,
        opts.chunkOverlap,
        opts.separators
      );

      for (const subChunk of subChunks) {
        const content =
          opts.preserveHeaders && sectionHeader
            ? `${sectionHeader}\n\n${subChunk}`
            : subChunk;

        chunks.push({
          id: `${fileId}_chunk_${chunkIndex}`,
          content: content.trim(),
          fileId,
          chunkIndex,
          metadata: {
            section: sectionHeader,
            headings: sectionHeader ? [sectionHeader] : undefined,
          },
        });
        chunkIndex++;
      }
    }
  }

  // Calculate average chunk size
  const totalLength = chunks.reduce(
    (sum, chunk) => sum + chunk.content.length,
    0
  );
  const averageChunkSize =
    chunks.length > 0 ? Math.round(totalLength / chunks.length) : 0;

  logger.info("Text chunking completed", {
    fileId,
    totalChunks: chunks.length,
    averageChunkSize,
  });

  return {
    chunks,
    totalChunks: chunks.length,
    averageChunkSize,
    fileId,
  };
}

/**
 * Normalize text by cleaning up whitespace and formatting
 */
function normalizeText(text: string): string {
  return (
    text
      // Normalize line endings
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      // Remove excessive blank lines (more than 2 consecutive)
      .replace(/\n{4,}/g, "\n\n\n")
      // Trim each line
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim()
  );
}

interface Section {
  header: string | undefined;
  content: string;
}

/**
 * Split text by markdown headers to preserve topic structure
 */
function splitByHeaders(text: string, preserveHeaders: boolean): Section[] {
  const sections: Section[] = [];

  // Match headers (# through ####)
  const headerPattern = /^(#{1,4}\s+.+)$/gm;
  const matches = [...text.matchAll(headerPattern)];

  if (matches.length === 0) {
    // No headers found, treat entire text as one section
    return [{ header: undefined, content: text }];
  }

  // Handle content before first header
  const firstMatch = matches[0];
  if (firstMatch && firstMatch.index && firstMatch.index > 0) {
    const preHeaderContent = text.slice(0, firstMatch.index).trim();
    if (preHeaderContent) {
      sections.push({ header: undefined, content: preHeaderContent });
    }
  }

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]!;
    const nextMatch = matches[i + 1];
    const header = match[1]!;
    const startIndex = match.index! + match[0].length;

    // Get content until next header or end of text
    const endIndex = nextMatch ? nextMatch.index! : text.length;
    const content = text.slice(startIndex, endIndex).trim();

    if (content || preserveHeaders) {
      sections.push({
        header: preserveHeaders ? header : undefined,
        content: content,
      });
    }
  }

  return sections.filter((s) => s.content.length > 0);
}

/**
 * Combine header and content into a single string
 */
function combineHeaderAndContent(
  header: string | undefined,
  content: string
): string {
  if (header) {
    return `${header}\n\n${content}`.trim();
  }
  return content.trim();
}

/**
 * Recursively split text using a hierarchy of separators
 * Returns chunks that are under the target size
 */
function splitRecursively(
  text: string,
  chunkSize: number,
  overlap: number,
  separators: string[]
): string[] {
  // If text is already small enough, return it
  if (text.length <= chunkSize) {
    return [text];
  }

  // Try each separator in order
  for (const separator of separators) {
    const parts = text.split(separator);

    // If this separator creates useful splits
    if (parts.length > 1) {
      const chunks: string[] = [];
      let currentChunk = "";

      for (const part of parts) {
        const partWithSeparator = currentChunk ? separator + part : part;

        // Check if adding this part would exceed chunk size
        if (currentChunk.length + partWithSeparator.length <= chunkSize) {
          currentChunk = currentChunk + partWithSeparator;
        } else {
          // Save current chunk if it has content
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }

          // Start new chunk, potentially with overlap from previous chunk
          if (overlap > 0 && chunks.length > 0) {
            const lastChunk = chunks[chunks.length - 1]!;
            const overlapText = getOverlapText(lastChunk, overlap);
            currentChunk =
              overlapText + (overlapText ? separator : "") + part;
          } else {
            currentChunk = part;
          }

          // If this single part is too large, recursively split it
          if (currentChunk.length > chunkSize) {
            const remainingSeparators = separators.slice(
              separators.indexOf(separator) + 1
            );
            if (remainingSeparators.length > 0) {
              const subChunks = splitRecursively(
                currentChunk,
                chunkSize,
                overlap,
                remainingSeparators
              );
              chunks.push(...subChunks.slice(0, -1));
              currentChunk = subChunks[subChunks.length - 1] || "";
            } else {
              // No more separators, force split by character count
              const forceSplit = forceSplitBySize(currentChunk, chunkSize, overlap);
              chunks.push(...forceSplit.slice(0, -1));
              currentChunk = forceSplit[forceSplit.length - 1] || "";
            }
          }
        }
      }

      // Don't forget the last chunk
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }

      return chunks.filter((chunk) => chunk.length > 0);
    }
  }

  // No separators worked, force split by character count
  return forceSplitBySize(text, chunkSize, overlap);
}

/**
 * Get overlap text from the end of a chunk
 */
function getOverlapText(text: string, overlapSize: number): string {
  if (text.length <= overlapSize) {
    return text;
  }

  // Try to find a good break point (word boundary)
  const overlapStart = text.length - overlapSize;
  const searchStart = Math.max(0, overlapStart - 50); // Look back a bit for a better break

  // Find the first space after the overlap start point
  for (let i = overlapStart; i >= searchStart; i--) {
    if (text[i] === " " || text[i] === "\n") {
      return text.slice(i + 1).trim();
    }
  }

  // No good break point found, just use the overlap size
  return text.slice(overlapStart);
}

/**
 * Force split text by character count when no separators work
 * Tries to break at word boundaries
 */
function forceSplitBySize(
  text: string,
  chunkSize: number,
  overlap: number
): string[] {
  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    let endIndex = Math.min(startIndex + chunkSize, text.length);

    // Try to find a word boundary
    if (endIndex < text.length) {
      // Look back for a space or newline
      for (let i = endIndex; i > startIndex + chunkSize * 0.8; i--) {
        if (text[i] === " " || text[i] === "\n") {
          endIndex = i;
          break;
        }
      }
    }

    const chunk = text.slice(startIndex, endIndex).trim();
    if (chunk) {
      chunks.push(chunk);
    }

    // Move start index, accounting for overlap
    startIndex = endIndex - overlap;
    if (startIndex <= startIndex - overlap) {
      // Prevent infinite loop
      startIndex = endIndex;
    }
  }

  return chunks;
}

/**
 * Estimate the number of tokens in a text
 * Rough estimate: ~4 characters per token on average
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Get optimal chunk size based on embedding model constraints
 */
export function getOptimalChunkSize(modelMaxTokens = 2048): number {
  // Leave some margin for safety
  const targetTokens = Math.floor(modelMaxTokens * 0.8);
  // Convert tokens to characters (rough estimate)
  return targetTokens * 4;
}
