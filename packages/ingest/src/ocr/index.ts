// ** Primary OCR - Gemini 2.0 Flash (multimodal)
export {
  extractTextWithGeminiOCR,
  isSupportedFileType,
  getExtensionFromContentType,
  getSupportedFileTypes,
  getSupportedExtensions,
} from "./gemini-ocr.js";

// ** Legacy OCR - Mistral (kept for fallback/comparison)
export { extractTextWithMistralOCR } from "./mistral-ocr.js";

// ** Re-export Gemini OCR as default extraction method
export { extractTextWithGeminiOCR as extractText } from "./gemini-ocr.js";
