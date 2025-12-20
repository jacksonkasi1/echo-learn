// ** import types
import type { OcrResult, OcrOptions } from "@repo/shared";

// ** import lib
import { Mistral } from "@mistralai/mistralai";

// ** import utils
import { logger } from "@repo/logs";

// Initialize Mistral client
const mistral = new Mistral({
  apiKey: process.env.MISTRAL_API_KEY!,
});

interface RetryOptions {
  maxAttempts: number;
  baseDelay: number; // milliseconds
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelay: 2000, // 2 seconds
};

const DEFAULT_OCR_OPTIONS: OcrOptions = {
  maxAttempts: 3,
  baseDelay: 2000,
  timeout: 300000, // 5 minutes
  includeImages: true,
};

/**
 * Extract text from document using Mistral OCR with retry logic
 * Supports: PDF, images, DOCX, PPTX
 */
export async function extractTextWithMistralOCR(
  fileUrl: string,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const opts = { ...DEFAULT_OCR_OPTIONS, ...options };
  const retryOptions: RetryOptions = {
    maxAttempts: opts.maxAttempts ?? DEFAULT_RETRY_OPTIONS.maxAttempts,
    baseDelay: opts.baseDelay ?? DEFAULT_RETRY_OPTIONS.baseDelay,
  };

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retryOptions.maxAttempts; attempt++) {
    try {
      logger.info(
        `Mistral OCR attempt ${attempt}/${retryOptions.maxAttempts}`,
        {
          fileUrl: fileUrl.substring(0, 50) + "...",
        },
      );

      const response = await mistral.chat.complete({
        model: "mistral-ocr-latest",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document_url",
                documentUrl: fileUrl,
              },
            ],
          },
        ],
        // @ts-expect-error - Mistral SDK types may not include these options
        includeImageBase64: opts.includeImages ?? true,
      });

      // Extract markdown from response
      const content = response.choices?.[0]?.message?.content;
      const markdown = typeof content === "string" ? content : "";

      if (!markdown) {
        throw new Error("No content returned from Mistral OCR");
      }

      // Calculate confidence score
      const confidence = calculateOCRConfidence(markdown, response);

      // Extract images if present
      const images = extractImagesFromResponse(response);

      const result: OcrResult = {
        markdown,
        confidence,
        pageCount: countPages(markdown),
        tokenUsage: {
          promptTokens: response.usage?.promptTokens || 0,
          completionTokens: response.usage?.completionTokens || 0,
        },
      };

      if (images.length > 0) {
        result.images = images;
      }

      logger.info("Mistral OCR completed successfully", {
        pageCount: result.pageCount,
        confidence: result.confidence,
        contentLength: markdown.length,
      });

      return result;
    } catch (error) {
      lastError = error as Error;
      logger.error(`Mistral OCR attempt ${attempt} failed`, error);

      // If not the last attempt, wait before retrying
      if (attempt < retryOptions.maxAttempts) {
        const delay = retryOptions.baseDelay * Math.pow(2, attempt - 1);
        logger.info(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All attempts failed
  throw new Error(
    `Mistral OCR failed after ${retryOptions.maxAttempts} attempts: ${lastError?.message}`,
  );
}

/**
 * Calculate OCR confidence score based on content quality indicators
 * Returns: 0-100 confidence score
 */
function calculateOCRConfidence(markdown: string, response: unknown): number {
  let confidence = 70; // Base confidence

  // Boost for technical terms (study materials often have specific terminology)
  const technicalTerms = /(\b[A-Z]{2,}\b|[a-z]+ology|[a-z]+tion)/g;
  const technicalMatches = markdown.match(technicalTerms);
  if (technicalMatches && technicalMatches.length > 10) {
    confidence += 5;
  }

  // Boost for structured content (checkboxes, dates, numbers)
  if (/\[\s*[xX✓]\s*\]/.test(markdown)) confidence += 3; // Checkboxes
  if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(markdown)) confidence += 2; // Dates
  if (/\d+\.?\d*\s*(mg|ml|g|kg|cm|mm|m|km)/.test(markdown)) confidence += 3; // Measurements

  // Boost for markdown formatting (indicates structure preservation)
  if (/^#{1,6}\s+/m.test(markdown)) confidence += 5; // Headers
  if (/\n-\s+|\n\d+\.\s+/.test(markdown)) confidence += 3; // Lists
  if (/\|.*\|.*\|/.test(markdown)) confidence += 3; // Tables

  // Boost for code blocks
  if (/```[\s\S]*?```/.test(markdown)) confidence += 3;

  // Token usage ratio (quality indicator)
  const typedResponse = response as {
    usage?: { completionTokens?: number; promptTokens?: number };
  };
  const tokenUsage = typedResponse?.usage;
  if (tokenUsage) {
    const ratio =
      (tokenUsage.completionTokens || 0) / (tokenUsage.promptTokens || 1);
    if (ratio > 0.5) confidence += 5;
  }

  // Penalties
  if (markdown.length < 100) confidence -= 20; // Too short
  if (markdown.length < 500) confidence -= 10; // Short
  if (/[�\uFFFD]/.test(markdown)) confidence -= 10; // Replacement characters (OCR artifacts)
  if (/[^\x00-\x7F]{10,}/.test(markdown)) confidence -= 5; // Lots of non-ASCII (possible garbled text)

  // Boost for reasonable length
  if (markdown.length > 1000) confidence += 5;
  if (markdown.length > 5000) confidence += 5;

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Count pages by looking for page break markers
 */
function countPages(markdown: string): number {
  // Look for various page break patterns
  const pageBreakPatterns = [
    /---\s*page\s*\d+\s*---/gi,
    /\[page\s*\d+\]/gi,
    /page\s*\d+\s*of\s*\d+/gi,
    /\n---\n/g,
  ];

  let maxPages = 1;

  for (const pattern of pageBreakPatterns) {
    const matches = markdown.match(pattern);
    if (matches && matches.length + 1 > maxPages) {
      maxPages = matches.length + 1;
    }
  }

  // Estimate pages based on content length if no explicit markers found
  if (maxPages === 1 && markdown.length > 3000) {
    // Rough estimate: ~3000 chars per page
    maxPages = Math.ceil(markdown.length / 3000);
  }

  return maxPages;
}

/**
 * Extract base64 images from response if present
 */
function extractImagesFromResponse(
  response: unknown,
): Array<{ pageNumber: number; base64: string; contentType: string }> {
  const images: Array<{
    pageNumber: number;
    base64: string;
    contentType: string;
  }> = [];

  try {
    const typedResponse = response as {
      choices?: Array<{
        message?: {
          content?: unknown;
        };
      }>;
    };

    const content = typedResponse?.choices?.[0]?.message?.content;

    // If content is an array (multimodal response), extract images
    if (Array.isArray(content)) {
      let pageNumber = 1;
      for (const item of content) {
        if (item && typeof item === "object" && "type" in item) {
          if (item.type === "image" && "data" in item) {
            images.push({
              pageNumber,
              base64: item.data as string,
              contentType:
                (item as { mediaType?: string }).mediaType || "image/png",
            });
            pageNumber++;
          }
        }
      }
    }
  } catch (error) {
    logger.warn(
      "Failed to extract images from OCR response",
      error instanceof Error ? { error: error.message } : {},
    );
  }

  return images;
}

/**
 * Check if a file type is supported by Mistral OCR
 */
export function isSupportedFileType(contentType: string): boolean {
  const supportedTypes = [
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/tiff",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // docx
    "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
    "application/msword", // doc
    "application/vnd.ms-powerpoint", // ppt
  ];

  return supportedTypes.includes(contentType);
}

/**
 * Get file extension from content type
 */
export function getExtensionFromContentType(contentType: string): string {
  const extensionMap: Record<string, string> = {
    "application/pdf": "pdf",
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/tiff": "tiff",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation":
      "pptx",
    "application/msword": "doc",
    "application/vnd.ms-powerpoint": "ppt",
    "text/plain": "txt",
    "text/markdown": "md",
  };

  return extensionMap[contentType] || "bin";
}
