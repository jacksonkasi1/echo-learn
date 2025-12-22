// ** import types
import type { OcrResult, OcrOptions } from "@repo/shared";

// ** import lib
import { GoogleGenerativeAI } from "@google/generative-ai";

// ** import utils
import { logger } from "@repo/logs";

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY!);

// Default model for OCR - Gemini 2.0 Flash has excellent multimodal capabilities
const OCR_MODEL = "gemini-2.0-flash";

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine content type from file extension or URL
 */
function getMimeType(fileUrl: string): string {
  const cleanUrl = fileUrl.split("?")[0]?.toLowerCase() ?? "";
  const parts = cleanUrl.split(".");
  const lastPart = parts[parts.length - 1];
  const extension = parts.length > 1 && lastPart ? lastPart : "";

  const mimeTypes: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    tiff: "image/tiff",
    tif: "image/tiff",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    txt: "text/plain",
    md: "text/markdown",
  };

  return mimeTypes[extension || ""] || "application/octet-stream";
}

/**
 * Check if file type is an image
 */
function isImageType(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Check if file type is plain text (no OCR needed)
 */
function isPlainTextType(mimeType: string): boolean {
  return mimeType === "text/plain" || mimeType === "text/markdown";
}

/**
 * Fetch file and convert to base64 for inline data
 */
async function fetchFileAsBase64(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch file: ${response.status} ${response.statusText}`,
    );
  }
  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

/**
 * Fetch plain text file content directly
 */
async function fetchTextContent(fileUrl: string): Promise<string> {
  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch file: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

/**
 * Build the OCR extraction prompt based on file type
 */
function buildOcrPrompt(mimeType: string): string {
  const isImage = isImageType(mimeType);

  if (isImage) {
    return `
You are an expert OCR system. Extract ALL text content from this image with high accuracy.

OUTPUT FORMAT:
- Return the extracted text as clean Markdown
- Preserve the visual hierarchy using Markdown headers (# ## ###)
- Preserve lists, tables, and formatting where possible
- If there are diagrams or charts, describe them in [brackets]
- For handwritten text, do your best to transcribe accurately
- Mark uncertain text with [?]

IMPORTANT:
- Extract EVERY piece of text visible in the image
- Maintain the logical reading order
- Preserve paragraph breaks
- Do not add any commentary or explanations, only the extracted content
`.trim();
  }

  return `
You are an expert document OCR and extraction system. Extract ALL text content from this document with high accuracy.

OUTPUT FORMAT:
- Return the extracted text as clean Markdown
- Preserve document structure with appropriate Markdown headers
- Maintain the original hierarchy (titles, sections, subsections)
- Preserve lists (bulleted and numbered)
- Preserve tables in Markdown table format
- Mark page breaks with: --- PAGE BREAK ---
- For images/figures in the document, add: [Figure: brief description]
- For charts/diagrams, add: [Chart: brief description]

IMPORTANT:
- Extract EVERY piece of text from the document
- Maintain the logical reading order
- Preserve all formatting cues
- Do not add any commentary, only the extracted content
- If multiple pages, process all pages
`.trim();
}

/**
 * Extract text from document using Gemini 2.0 Flash with multimodal capabilities
 * Supports: PDF, images (PNG, JPEG, WEBP, GIF, TIFF), DOCX, PPTX, TXT, MD
 */
export async function extractTextWithGeminiOCR(
  fileUrl: string,
  options: OcrOptions = {},
): Promise<OcrResult> {
  const startTime = Date.now();
  const fileName = fileUrl.split("/").pop()?.split("?")[0] || "unknown-file";
  const mimeType = getMimeType(fileUrl);

  try {
    logger.info("Starting OCR processing with Gemini 2.0 Flash", {
      fileName,
      mimeType,
      fileUrl: fileUrl.substring(0, 50) + "...",
    });

    // Handle plain text files directly (no OCR needed)
    if (isPlainTextType(mimeType)) {
      logger.info("Plain text file detected, fetching content directly", {
        fileName,
        mimeType,
      });

      const textContent = await fetchTextContent(fileUrl);
      const processingTimeMs = Date.now() - startTime;

      logger.info("Plain text file processed successfully", {
        fileName,
        textLength: textContent.length,
        processingTimeMs,
      });

      return {
        markdown: textContent,
        confidence: 100, // Direct text, no OCR uncertainty
        pageCount: 1,
        tokenUsage: {
          promptTokens: 0,
          completionTokens: 0,
        },
      };
    }

    const maxRetries = options.maxAttempts || 3;
    const baseDelay = options.baseDelay || 2000;
    let lastError: Error | null = null;
    let extractedText = "";

    // Get the model with configuration
    const model = genAI.getGenerativeModel({
      model: OCR_MODEL,
      generationConfig: {
        temperature: 0.1, // Low temperature for accurate extraction
        maxOutputTokens: 8192,
      },
    });

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`OCR attempt ${attempt} of ${maxRetries}`, {
          fileName,
          attempt,
        });

        // Fetch file content as base64
        const base64Data = await fetchFileAsBase64(fileUrl);

        // Build the content parts for multimodal input
        const parts = [
          {
            inlineData: {
              mimeType,
              data: base64Data,
            },
          },
          {
            text: buildOcrPrompt(mimeType),
          },
        ];

        // Generate content with multimodal input
        const result = await model.generateContent(parts);
        const response = result.response;
        extractedText = response.text();

        if (extractedText && extractedText.length > 0) {
          logger.info("Gemini OCR extraction successful", {
            fileName,
            attempt,
            textLength: extractedText.length,
          });
          break;
        } else {
          throw new Error("No text extracted from document");
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(`OCR attempt ${attempt} failed`, {
          fileName,
          attempt,
          maxRetries,
          error: lastError.message,
        });

        if (attempt < maxRetries) {
          const delayMs = baseDelay * Math.pow(2, attempt - 1);
          logger.info(`Retrying OCR in ${delayMs}ms`, { fileName });
          await sleep(delayMs);
        }
      }
    }

    if (!extractedText || extractedText.length === 0) {
      throw new Error(
        `Failed to extract text after ${maxRetries} attempts. ` +
          `Last error: ${lastError?.message || "Unknown error"}`,
      );
    }

    // Calculate page count from page break markers
    const pageBreaks = extractedText.match(/---\s*PAGE\s*BREAK\s*---/gi);
    const pageCount = pageBreaks ? pageBreaks.length + 1 : 1;

    // Calculate confidence score
    const confidence = calculateOCRConfidence(extractedText, mimeType);

    // Build result
    const result: OcrResult = {
      markdown: extractedText,
      confidence,
      pageCount,
      tokenUsage: {
        promptTokens: 0, // Gemini doesn't expose this in basic API
        completionTokens: 0,
      },
    };

    const processingTimeMs = Date.now() - startTime;

    logger.info("Gemini OCR processing completed successfully", {
      fileName,
      mimeType,
      textLength: extractedText.length,
      confidence,
      pageCount,
      processingTimeMs,
    });

    return result;
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    logger.error("Gemini OCR processing failed", {
      fileName,
      mimeType,
      processingTimeMs,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

/**
 * Calculate OCR confidence score based on content quality indicators
 */
function calculateOCRConfidence(markdown: string, mimeType: string): number {
  let confidence = 70; // Base confidence

  // Boost for technical terms (study materials often have specific terminology)
  const technicalTerms = /(\b[A-Z]{2,}\b|[a-z]+ology|[a-z]+tion)/g;
  const technicalMatches = markdown.match(technicalTerms);
  if (technicalMatches && technicalMatches.length > 10) {
    confidence += 5;
  }

  // Boost for structured content
  if (/\[\s*[xX✓]\s*\]/.test(markdown)) confidence += 3; // Checkboxes
  if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(markdown)) confidence += 2; // Dates
  if (/\d+\.?\d*\s*(mg|ml|g|kg|cm|mm|m|km)/.test(markdown)) confidence += 3; // Measurements

  // Boost for markdown formatting (indicates structure preservation)
  if (/^#{1,6}\s+/m.test(markdown)) confidence += 5; // Headers
  if (/\n-\s+|\n\d+\.\s+/.test(markdown)) confidence += 3; // Lists
  if (/\|.*\|.*\|/.test(markdown)) confidence += 3; // Tables
  if (/```[\s\S]*?```/.test(markdown)) confidence += 3; // Code blocks

  // Content length checks
  if (markdown.length < 100) confidence -= 20; // Too short
  if (markdown.length < 500) confidence -= 10;
  if (markdown.length > 1000) confidence += 5;
  if (markdown.length > 5000) confidence += 5;

  // Penalties for OCR artifacts
  if (/[�]/.test(markdown)) confidence -= 10; // Replacement characters
  if (/[^\x00-\x7F]{10,}/.test(markdown)) confidence -= 5; // Long non-ASCII sequences

  // Bonus for images (Gemini excels at image understanding)
  if (isImageType(mimeType)) {
    confidence += 5;
  }

  return Math.min(100, Math.max(0, confidence));
}

/**
 * Check if a file type is supported by Gemini multimodal OCR
 */
export function isSupportedFileType(contentType: string): boolean {
  const supportedTypes = [
    // Documents
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Images
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/tiff",
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
    "text/plain": "txt",
    "text/markdown": "md",
  };

  return extensionMap[contentType] || "bin";
}

/**
 * Get supported file types list
 */
export function getSupportedFileTypes(): string[] {
  return [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "image/tiff",
  ];
}

/**
 * Get human-readable list of supported extensions
 */
export function getSupportedExtensions(): string[] {
  return [
    "pdf",
    "txt",
    "md",
    "docx",
    "pptx",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "gif",
    "tiff",
  ];
}
