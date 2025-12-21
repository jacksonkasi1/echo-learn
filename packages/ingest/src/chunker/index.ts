// ** Export standard text chunker
export {
  chunkText,
  estimateTokenCount,
  getOptimalChunkSize,
} from "./text-chunker.js";

// ** Export semantic chunker (Phase 4)
export {
  semanticChunkText,
  estimateSemanticTokenCount,
  type SemanticChunkerOptions,
} from "./semantic-chunker.js";
