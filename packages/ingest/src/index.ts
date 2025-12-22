// ** Export OCR functions (Gemini 2.0 Flash - primary)
export {
  extractTextWithGeminiOCR,
  isSupportedFileType,
  getExtensionFromContentType,
  getSupportedFileTypes,
  getSupportedExtensions,
} from "./ocr/index.js";

// ** Export legacy OCR (Mistral - fallback)
export { extractTextWithMistralOCR } from "./ocr/index.js";

// ** Re-export Gemini OCR as default extraction method
export { extractTextWithGeminiOCR as extractText } from "./ocr/index.js";

// ** Export chunker functions
export {
  // Standard chunker
  chunkText,
  estimateTokenCount,
  getOptimalChunkSize,
  // Semantic chunker (Phase 4)
  semanticChunkText,
  estimateSemanticTokenCount,
  type SemanticChunkerOptions,
} from "./chunker/index.js";
