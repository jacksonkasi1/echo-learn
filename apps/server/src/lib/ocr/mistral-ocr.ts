// ** import types
import type { OcrResult, OcrOptions } from "@repo/shared";

// ** import core packages
import { Mistral } from "@mistralai/mistralai";

// ** import utils
import { logger } from "@repo/logs";

interface MistralOCRPage {
  pageNumber: number;
  markdown: string;
  images?: Array < {
    type: string;
    data: string;
  } > ;
  dimensions?: {
    width: number;
    height: number;
  };
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract text from document using Mistral OCR with retry logic
 */
export async function extractTextWithMistralOCR(
  fileUrl: string,
  options: OcrOptions = {}
): Promise<OcrResult> {
  const startTime = Date.now();
  // Extract filename for logging
  const fileName = fileUrl.split('/').pop() || 'unknown-file';

  try {
    logger.info("Starting OCR processing with Mistral AI", {
      fileName,
      fileUrl: fileUrl.substring(0, 50) + "...",
      startTime: new Date(startTime).toISOString(),
    });

    if (!process.env.MISTRAL_API_KEY) {
      throw new Error("MISTRAL_API_KEY environment variable is not configured");
    }

    // Initialize Mistral client with extended timeout (5 minutes for large files)
    const client = new Mistral({
      apiKey: process.env.MISTRAL_API_KEY,
      timeoutMs: options.timeout || 300000, // 5 minutes timeout
    });

    // Determine if the file is an image or document based on extension
    const cleanFileName = fileName.split('?')[0];
    const fileExtension = cleanFileName.toLowerCase().split('.').pop();
    const imageExtensions = ['png', 'jpeg', 'jpg', 'avif', 'gif', 'bmp', 'webp', 'tiff', 'tif', 'svg'];
    const documentExtensions = ['pdf', 'pptx', 'docx', 'doc', 'ppt'];
    const isImage = imageExtensions.includes(fileExtension || '');
    const isDocument = documentExtensions.includes(fileExtension || '');

    if (!isImage && !isDocument) {
      logger.warn("Unknown file format, defaulting to document processing", {
        fileName,
        extension: fileExtension,
      });
    }

    const maxRetries = options.maxAttempts || 3;
    let lastError: Error | null = null;
    let ocrResponse: any = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`OCR attempt ${attempt} of ${maxRetries}`, {
          fileName,
          attempt,
        });

        // Use the specific OCR endpoint
        ocrResponse = await client.ocr.process({
          model: "mistral-ocr-latest",
          document: isImage ? {
            type: "image_url",
            imageUrl: fileUrl
          } : {
            type: "document_url",
            documentUrl: fileUrl
          },
          includeImageBase64: options.includeImages ?? true
        });

        if (ocrResponse && ocrResponse.pages && ocrResponse.pages.length > 0) {
          logger.info("Mistral OCR API response received successfully", {
            fileName,
            attempt,
            pagesReturned: ocrResponse.pages.length,
            hasUsageInfo: !!ocrResponse.usageInfo,
          });
          break; // Success! 
        } else {
          throw new Error("No OCR result returned from Mistral API");
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        logger.warn(`OCR attempt ${attempt} failed`, {
          fileName,
          attempt,
          maxRetries,
          error: lastError.message,
          errorName: lastError.name,
        });

        if (attempt < maxRetries) {
          const delayMs = Math.pow(2, attempt) * 1000; // Exponential backoff
          logger.info(`Retrying OCR in ${delayMs}ms`, {
             fileName,
             nextAttempt: attempt + 1,
          });
          await sleep(delayMs);
        }
      }
    }

    if (!ocrResponse || !ocrResponse.pages || ocrResponse.pages.length === 0) {
      throw new Error(
        `Failed to process OCR after ${maxRetries} attempts. ` +
        `Last error: ${lastError?.message || 'Unknown error'}`
      );
    }

    // Extract pages
    const pages: MistralOCRPage[] = ocrResponse.pages.map((page: any, index: number) => ({
      pageNumber: index + 1,
      markdown: page.markdown || '',
      images: page.images?.map((img: any) => ({
        type: img.type || 'base64',
        data: img.data || '',
      })) || [],
      dimensions: page.dimensions || undefined,
    }));

    // Combine text
    const ocrText = pages
      .map((page) => {
        const pageHeader = `

=== PAGE ${page.pageNumber} ===
`;
        return pageHeader + page.markdown;
      })
      .join('\n\n--- END OF PAGE ---\n\n').trim();

    // Map usage
    const tokenUsage = ocrResponse.usageInfo ? {
        promptTokens: (ocrResponse.usageInfo as any).promptTokens || 0,
        completionTokens: (ocrResponse.usageInfo as any).completionTokens || 0,
      } : { promptTokens: 0, completionTokens: 0 };

    // Calculate confidence
    const confidence = calculateOCRConfidence(ocrText, { usage: tokenUsage });

    // Extract images for OcrResult
    const images: OcrResult['images'] = [];
    pages.forEach(page => {
      if (page.images) {
        page.images.forEach(img => {
           images.push({
             pageNumber: page.pageNumber,
             base64: img.data,
             contentType: 'image/png' // Default assumption as API may not return mime type in 'data' field directly
           });
        });
      }
    });

    const result: OcrResult = {
      markdown: ocrText,
      confidence,
      pageCount: pages.length,
      tokenUsage,
      images: images.length > 0 ? images : undefined,
    };

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;

    logger.info("Mistral OCR processing completed successfully", {
      fileName,
      totalTextLength: ocrText.length,
      confidence,
      totalPages: pages.length,
      processingTimeMs,
    });

    return result;

  } catch (error) {
     const endTime = Date.now();
     const processingTimeMs = endTime - startTime;
     logger.error("Mistral OCR processing failed", {
       fileName,
       fileUrl: fileUrl.substring(0, 50) + "...",
       processingTimeMs,
       error: error instanceof Error ? error.message : String(error)
     });
     throw error;
  }
}

/**
 * Calculate OCR confidence score based on content quality indicators
 */
function calculateOCRConfidence(markdown: string, response: unknown): number {
  let confidence = 70; // Base confidence

  // Boost for technical terms
  const technicalTerms = /(\b[A-Z]{2,}\b|[a-z]+ology|[a-z]+tion)/g;
  const technicalMatches = markdown.match(technicalTerms);
  if (technicalMatches && technicalMatches.length > 10) {
    confidence += 5;
  }

  // Boost for structured content
  if (/[\[\s*[xX✓]\s*\]]/.test(markdown)) confidence += 3;
  if (/\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/.test(markdown)) confidence += 2;
  if (/\d+\.?\d*\s*(mg|ml|g|kg|cm|mm|m|km)/.test(markdown)) confidence += 3;

  // Boost for markdown formatting
  if (/^#{1,6}\s+/m.test(markdown)) confidence += 5;
  if (/\n-\s+|\n\d+\.\s+/.test(markdown)) confidence += 3;
  if (/\|.*\|.*\|/.test(markdown)) confidence += 3;

  if (/```[\s\S]*?```/.test(markdown)) confidence += 3;

  const typedResponse = response as {
    usage?: { completionTokens?: number; promptTokens?: number };
  };
  const tokenUsage = typedResponse?.usage;
  if (tokenUsage) {
    const ratio =
      (tokenUsage.completionTokens || 0) / (tokenUsage.promptTokens || 1);
    if (ratio > 0.5) confidence += 5;
  }

  if (markdown.length < 100) confidence -= 20;
  if (markdown.length < 500) confidence -= 10;
  if (/[�]/.test(markdown)) confidence -= 10;
  if (/[^\x00-\x7F]{10,}/.test(markdown)) confidence -= 5;

  if (markdown.length > 1000) confidence += 5;
  if (markdown.length > 5000) confidence += 5;

  return Math.min(100, Math.max(0, confidence));
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