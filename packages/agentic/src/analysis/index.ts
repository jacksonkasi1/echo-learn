// ** Analysis Pipeline Index for Echo-Learn
// ** Exports all components for passive learning analysis

// ** Concept Extractor
export {
  extractConceptsFromGraph,
  extractConceptsFromInteraction,
  mightContainConcepts,
  type ExtractedConcept,
  type ConceptExtractionResult,
  type ConceptExtractionOptions,
} from "./concept-extractor.js";

// ** Signal Detector
export {
  detectSignals,
  filterSignalsByConfidence,
  aggregateSignals,
  type SignalDetectionResult,
  type ConversationContext,
} from "./signal-detector.js";

// ** Background Analyzer
export {
  runAnalysisPipeline,
  analyzeInteractionAsync,
  analyzeInteractionSync,
  isAnalysisPipelineEnabled,
  DEFAULT_ANALYSIS_OPTIONS,
  type AnalysisPipelineResult,
  type AnalysisOptions,
} from "./background-analyzer.js";
