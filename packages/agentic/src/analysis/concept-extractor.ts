// ** Concept Extractor for Echo-Learn Passive Analysis Pipeline
// ** Extracts concepts mentioned in conversations by matching against user's knowledge graph

// ** import types
import type { KnowledgeGraph, GraphNode } from "@repo/shared";

// ** import storage
import { getKnowledgeGraph } from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Extracted concept from text
 */
export interface ExtractedConcept {
  conceptId: string;
  conceptLabel: string;
  nodeType: GraphNode["type"];
  matchedText: string;
  confidence: number; // 0.0 - 1.0
  position: number; // Character position in text
}

/**
 * Concept extraction result
 */
export interface ConceptExtractionResult {
  concepts: ExtractedConcept[];
  textLength: number;
  processingTimeMs: number;
}

/**
 * Options for concept extraction
 */
export interface ConceptExtractionOptions {
  /** Minimum confidence threshold (0.0 - 1.0) */
  minConfidence?: number;
  /** Maximum concepts to return */
  maxConcepts?: number;
  /** Whether to use fuzzy matching */
  fuzzyMatch?: boolean;
  /** Minimum word length for matching */
  minWordLength?: number;
}

/**
 * Default extraction options
 */
const DEFAULT_OPTIONS: Required<ConceptExtractionOptions> = {
  minConfidence: 0.5,
  maxConcepts: 20,
  fuzzyMatch: false,
  minWordLength: 3,
};

/**
 * Clean and normalize text for matching
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ") // Replace punctuation with spaces
    .replace(/\s+/g, " ") // Collapse multiple spaces
    .trim();
}

/**
 * Calculate match confidence based on various factors
 */
function calculateMatchConfidence(
  matchedText: string,
  nodeLabel: string,
  nodeType: GraphNode["type"],
  contextWords: string[]
): number {
  let confidence = 0.5; // Base confidence

  // Exact match bonus
  if (matchedText.toLowerCase() === nodeLabel.toLowerCase()) {
    confidence += 0.3;
  }

  // Node type weight (concepts are more important than examples)
  const typeWeights: Record<GraphNode["type"], number> = {
    concept: 0.15,
    process: 0.1,
    term: 0.1,
    definition: 0.05,
    fact: 0.05,
    detail: 0.03,
    example: 0.02,
  };
  confidence += typeWeights[nodeType] || 0;

  // Length bonus (longer matches are more specific)
  if (nodeLabel.length > 10) {
    confidence += 0.05;
  }

  // Context bonus (if related words are nearby)
  const relatedTerms = ["learn", "understand", "explain", "how", "what", "why"];
  const hasContext = contextWords.some((word) =>
    relatedTerms.includes(word.toLowerCase())
  );
  if (hasContext) {
    confidence += 0.05;
  }

  return Math.min(1.0, confidence);
}

/**
 * Find word boundaries around a position
 */
function getContextWords(
  text: string,
  position: number,
  windowSize: number = 50
): string[] {
  const start = Math.max(0, position - windowSize);
  const end = Math.min(text.length, position + windowSize);
  const context = text.slice(start, end);
  return context.split(/\s+/).filter((w) => w.length > 2);
}

/**
 * Extract concepts from text using graph matching
 *
 * This is the primary extraction method - fast and deterministic.
 * Matches text against known nodes in the user's knowledge graph.
 */
export async function extractConceptsFromGraph(
  text: string,
  userId: string,
  options: ConceptExtractionOptions = {}
): Promise<ConceptExtractionResult> {
  const startTime = Date.now();
  const opts = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Get user's knowledge graph
    const graph = await getKnowledgeGraph(userId);

    if (!graph || graph.nodes.length === 0) {
      logger.info("No knowledge graph found for concept extraction", {
        userId,
      });
      return {
        concepts: [],
        textLength: text.length,
        processingTimeMs: Date.now() - startTime,
      };
    }

    const normalizedText = normalizeText(text);
    const concepts: ExtractedConcept[] = [];
    const seenConcepts = new Set<string>();

    // Sort nodes by label length (longer first) to match specific concepts before general ones
    const sortedNodes = [...graph.nodes].sort(
      (a, b) => b.label.length - a.label.length
    );

    for (const node of sortedNodes) {
      // Skip if already found this concept
      if (seenConcepts.has(node.id)) continue;

      // Skip very short labels
      if (node.label.length < opts.minWordLength) continue;

      const normalizedLabel = normalizeText(node.label);

      // Find all occurrences
      let searchIndex = 0;
      while (true) {
        const position = normalizedText.indexOf(normalizedLabel, searchIndex);
        if (position === -1) break;

        // Check word boundaries (avoid partial matches)
        const charBefore = position > 0 ? normalizedText[position - 1] : " ";
        const charAfter =
          position + normalizedLabel.length < normalizedText.length
            ? normalizedText[position + normalizedLabel.length]
            : " ";

        const isWordBoundary =
          (charBefore === " " || charBefore === "-") &&
          (charAfter === " " || charAfter === "-");

        if (isWordBoundary) {
          const contextWords = getContextWords(normalizedText, position);
          const confidence = calculateMatchConfidence(
            normalizedLabel,
            node.label,
            node.type,
            contextWords
          );

          if (confidence >= opts.minConfidence) {
            concepts.push({
              conceptId: node.id,
              conceptLabel: node.label,
              nodeType: node.type,
              matchedText: text.slice(position, position + normalizedLabel.length),
              confidence,
              position,
            });
            seenConcepts.add(node.id);
            break; // Only count each concept once
          }
        }

        searchIndex = position + 1;
      }

      // Stop if we've found enough concepts
      if (concepts.length >= opts.maxConcepts) break;
    }

    // Sort by confidence (highest first)
    concepts.sort((a, b) => b.confidence - a.confidence);

    const processingTimeMs = Date.now() - startTime;

    logger.info("Concept extraction completed", {
      userId,
      textLength: text.length,
      conceptsFound: concepts.length,
      processingTimeMs,
    });

    return {
      concepts: concepts.slice(0, opts.maxConcepts),
      textLength: text.length,
      processingTimeMs,
    };
  } catch (error) {
    logger.error("Concept extraction failed", {
      userId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      concepts: [],
      textLength: text.length,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Extract concepts from both user message and assistant response
 */
export async function extractConceptsFromInteraction(
  userId: string,
  userMessage: string,
  assistantResponse: string,
  options: ConceptExtractionOptions = {}
): Promise<{
  userConcepts: ExtractedConcept[];
  responseConcepts: ExtractedConcept[];
  allConcepts: ExtractedConcept[];
  processingTimeMs: number;
}> {
  const startTime = Date.now();

  // Extract from both messages
  const [userResult, responseResult] = await Promise.all([
    extractConceptsFromGraph(userMessage, userId, options),
    extractConceptsFromGraph(assistantResponse, userId, options),
  ]);

  // Merge and dedupe concepts (prefer higher confidence)
  const conceptMap = new Map<string, ExtractedConcept>();

  for (const concept of [...userResult.concepts, ...responseResult.concepts]) {
    const existing = conceptMap.get(concept.conceptId);
    if (!existing || concept.confidence > existing.confidence) {
      conceptMap.set(concept.conceptId, concept);
    }
  }

  const allConcepts = Array.from(conceptMap.values()).sort(
    (a, b) => b.confidence - a.confidence
  );

  return {
    userConcepts: userResult.concepts,
    responseConcepts: responseResult.concepts,
    allConcepts,
    processingTimeMs: Date.now() - startTime,
  };
}

/**
 * Quick check if text likely contains any concepts
 * Used to skip expensive extraction for simple messages
 */
export async function mightContainConcepts(
  text: string,
  userId: string
): Promise<boolean> {
  // Skip very short messages
  if (text.length < 20) return false;

  // Skip greetings and simple phrases
  const simplePatterns = [
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|great)[\s!.]*$/i,
    /^(how are you|what's up|good morning|good night)[\s!.?]*$/i,
  ];

  const normalized = text.trim();
  for (const pattern of simplePatterns) {
    if (pattern.test(normalized)) return false;
  }

  // Check if user has any graph nodes
  try {
    const graph = await getKnowledgeGraph(userId);
    return graph && graph.nodes.length > 0;
  } catch {
    return false;
  }
}
