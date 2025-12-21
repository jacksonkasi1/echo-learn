// ** Mastery Propagation for Echo-Learn Graph-Aware Learning
// ** Propagates mastery changes through the knowledge graph

// ** import types
import type {
  KnowledgeGraph,
  GraphEdge,
  LearningRelationType,
  ConceptWithEffectiveMastery,
} from "@repo/shared";

// ** import storage
import { redis } from "./client.js";
import {
  getMastery,
  getEffectiveMastery,
  saveMastery,
  createMastery,
} from "./mastery.js";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Propagation result for a single concept
 */
export interface PropagationResult {
  conceptId: string;
  conceptLabel: string;
  previousMastery: number;
  newMastery: number;
  propagationSource: string;
  propagationType: LearningRelationType;
}

/**
 * Full propagation result
 */
export interface MasteryPropagationResult {
  sourceConceptId: string;
  sourceMasteryChange: number;
  propagatedTo: PropagationResult[];
  totalAffected: number;
  processingTimeMs: number;
}

/**
 * Prerequisite check result
 */
export interface PrerequisiteCheckResult {
  conceptId: string;
  conceptLabel: string;
  prerequisites: Array<{
    conceptId: string;
    conceptLabel: string;
    mastery: number;
    effectiveMastery: number;
    isWeak: boolean;
    recommendation?: string;
  }>;
  allPrerequisitesMet: boolean;
  weakPrerequisites: string[];
}

/**
 * Learning path suggestion
 */
export interface LearningPathSuggestion {
  conceptId: string;
  conceptLabel: string;
  currentMastery: number;
  reason: string;
  priority: number;
}

/**
 * Propagation weights by relationship type
 */
const PROPAGATION_WEIGHTS: Record<LearningRelationType, number> = {
  prerequisite: 0.1, // When you master X, your prereqs get small credit
  corequisite: 0.05, // Related concepts get slight boost
  application: 0.02, // Applications become slightly easier
  example: 0.01, // Examples are loosely connected
  opposite: 0.0, // Opposite concepts don't propagate
  related: 0.03, // General relations get small propagation
};

/**
 * Infer learning relation type from edge relation string
 */
function inferLearningRelation(
  relation: string,
  existingType?: LearningRelationType
): LearningRelationType {
  // Use existing type if available
  if (existingType) return existingType;

  // Infer from relation string
  const relationLower = relation.toLowerCase();

  if (
    relationLower.includes("prerequisite") ||
    relationLower.includes("requires") ||
    relationLower.includes("depends")
  ) {
    return "prerequisite";
  }

  if (
    relationLower.includes("example") ||
    relationLower.includes("instance")
  ) {
    return "example";
  }

  if (
    relationLower.includes("applies") ||
    relationLower.includes("uses") ||
    relationLower.includes("application")
  ) {
    return "application";
  }

  if (
    relationLower.includes("opposite") ||
    relationLower.includes("contrast")
  ) {
    return "opposite";
  }

  if (
    relationLower.includes("similar") ||
    relationLower.includes("related")
  ) {
    return "corequisite";
  }

  return "related";
}

/**
 * Get user's knowledge graph
 */
async function getKnowledgeGraph(userId: string): Promise<KnowledgeGraph> {
  try {
    const data = await redis.get<string>(`user:${userId}:graph`);
    if (data) {
      return typeof data === "string" ? JSON.parse(data) : data;
    }
    return { nodes: [], edges: [] };
  } catch (error) {
    logger.error("Failed to get knowledge graph", { userId, error });
    return { nodes: [], edges: [] };
  }
}

/**
 * Find edges connected to a concept
 */
function findConnectedEdges(
  graph: KnowledgeGraph,
  conceptId: string
): {
  incoming: GraphEdge[];
  outgoing: GraphEdge[];
} {
  const incoming = graph.edges.filter((e) => e.target === conceptId);
  const outgoing = graph.edges.filter((e) => e.source === conceptId);
  return { incoming, outgoing };
}

/**
 * Propagate mastery change through the knowledge graph
 *
 * When a user masters concept X:
 * 1. Prerequisites of X get credit (you clearly understood them)
 * 2. Concepts that X is prerequisite for become "ready to learn"
 * 3. Related concepts get a small boost
 */
export async function propagateMastery(
  userId: string,
  conceptId: string,
  masteryChange: number,
  maxDepth: number = 1
): Promise<MasteryPropagationResult> {
  const startTime = Date.now();
  const propagatedTo: PropagationResult[] = [];
  const visited = new Set<string>([conceptId]);

  try {
    // Get the knowledge graph
    const graph = await getKnowledgeGraph(userId);

    if (graph.nodes.length === 0) {
      return {
        sourceConceptId: conceptId,
        sourceMasteryChange: masteryChange,
        propagatedTo: [],
        totalAffected: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }

    // Find connected concepts
    const { incoming, outgoing } = findConnectedEdges(graph, conceptId);

    // Process incoming edges (prerequisites of this concept)
    // If user mastered X, they understood its prerequisites
    if (masteryChange > 0) {
      for (const edge of incoming) {
        if (visited.has(edge.source)) continue;
        visited.add(edge.source);

        const learningRelation = inferLearningRelation(
          edge.relation,
          edge.learningRelation
        );
        const weight =
          edge.propagationWeight ?? PROPAGATION_WEIGHTS[learningRelation];

        if (weight > 0) {
          const propagatedChange = masteryChange * weight;
          const result = await applyPropagatedMastery(
            userId,
            edge.source,
            propagatedChange,
            conceptId,
            learningRelation,
            graph
          );

          if (result) {
            propagatedTo.push(result);
          }
        }
      }
    }

    // Process outgoing edges (concepts that depend on this one)
    // If user struggles with X, check if they should review related concepts
    for (const edge of outgoing) {
      if (visited.has(edge.target)) continue;
      visited.add(edge.target);

      const learningRelation = inferLearningRelation(
        edge.relation,
        edge.learningRelation
      );

      // Only propagate positive changes to dependents
      if (masteryChange > 0) {
        const weight =
          edge.propagationWeight ?? PROPAGATION_WEIGHTS[learningRelation] * 0.5;

        if (weight > 0) {
          const propagatedChange = masteryChange * weight;
          const result = await applyPropagatedMastery(
            userId,
            edge.target,
            propagatedChange,
            conceptId,
            learningRelation,
            graph
          );

          if (result) {
            propagatedTo.push(result);
          }
        }
      }
    }

    const processingTimeMs = Date.now() - startTime;

    logger.info("Mastery propagation completed", {
      userId,
      sourceConceptId: conceptId,
      sourceMasteryChange: masteryChange,
      conceptsAffected: propagatedTo.length,
      processingTimeMs,
    });

    return {
      sourceConceptId: conceptId,
      sourceMasteryChange: masteryChange,
      propagatedTo,
      totalAffected: propagatedTo.length,
      processingTimeMs,
    };
  } catch (error) {
    logger.error("Mastery propagation failed", {
      userId,
      conceptId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      sourceConceptId: conceptId,
      sourceMasteryChange: masteryChange,
      propagatedTo: [],
      totalAffected: 0,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Apply propagated mastery change to a concept
 */
async function applyPropagatedMastery(
  userId: string,
  conceptId: string,
  change: number,
  sourceConceptId: string,
  propagationType: LearningRelationType,
  graph: KnowledgeGraph
): Promise<PropagationResult | null> {
  try {
    // Get current mastery
    let mastery = await getMastery(userId, conceptId);
    const node = graph.nodes.find((n) => n.id === conceptId);

    if (!mastery && node) {
      // Create new mastery entry if concept exists in graph
      mastery = await createMastery(userId, conceptId, node.label);
    }

    if (!mastery) return null;

    const previousMastery = mastery.masteryScore;

    // Apply change with bounds
    const newMastery = Math.max(
      0,
      Math.min(1, mastery.masteryScore + change)
    );

    // Only update if meaningful change
    if (Math.abs(newMastery - previousMastery) < 0.001) {
      return null;
    }

    // Update mastery
    mastery.masteryScore = Math.round(newMastery * 1000) / 1000;
    await saveMastery(userId, mastery);

    return {
      conceptId,
      conceptLabel: mastery.conceptLabel,
      previousMastery,
      newMastery: mastery.masteryScore,
      propagationSource: sourceConceptId,
      propagationType,
    };
  } catch (error) {
    logger.warn("Failed to apply propagated mastery", {
      userId,
      conceptId,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return null;
  }
}

/**
 * Check prerequisites for a concept
 *
 * Before learning concept X, check if the user knows its prerequisites.
 * Returns weak prerequisites that should be reviewed first.
 */
export async function checkPrerequisites(
  userId: string,
  conceptId: string,
  weaknessThreshold: number = 0.5
): Promise<PrerequisiteCheckResult> {
  try {
    const graph = await getKnowledgeGraph(userId);

    // Find the concept
    const node = graph.nodes.find((n) => n.id === conceptId);
    if (!node) {
      return {
        conceptId,
        conceptLabel: conceptId,
        prerequisites: [],
        allPrerequisitesMet: true,
        weakPrerequisites: [],
      };
    }

    // Find prerequisite edges (edges where this concept is the target)
    const prereqEdges = graph.edges.filter((e) => {
      if (e.target !== conceptId) return false;
      const relation = inferLearningRelation(e.relation, e.learningRelation);
      return relation === "prerequisite";
    });

    const prerequisites: PrerequisiteCheckResult["prerequisites"] = [];
    const weakPrerequisites: string[] = [];

    for (const edge of prereqEdges) {
      const prereqNode = graph.nodes.find((n) => n.id === edge.source);
      if (!prereqNode) continue;

      const mastery = await getEffectiveMastery(userId, edge.source);
      const effectiveMastery = mastery?.effectiveMastery ?? 0;
      const rawMastery = mastery?.masteryScore ?? 0;
      const isWeak = effectiveMastery < weaknessThreshold;

      if (isWeak) {
        weakPrerequisites.push(edge.source);
      }

      prerequisites.push({
        conceptId: edge.source,
        conceptLabel: prereqNode.label,
        mastery: rawMastery,
        effectiveMastery,
        isWeak,
        recommendation: isWeak
          ? `Review "${prereqNode.label}" before learning "${node.label}"`
          : undefined,
      });
    }

    return {
      conceptId,
      conceptLabel: node.label,
      prerequisites,
      allPrerequisitesMet: weakPrerequisites.length === 0,
      weakPrerequisites,
    };
  } catch (error) {
    logger.error("Failed to check prerequisites", {
      userId,
      conceptId,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return {
      conceptId,
      conceptLabel: conceptId,
      prerequisites: [],
      allPrerequisitesMet: true,
      weakPrerequisites: [],
    };
  }
}

/**
 * Get a suggested learning path based on current mastery
 *
 * Returns concepts to learn in optimal order based on:
 * 1. Prerequisites are learned first
 * 2. Weak concepts are prioritized
 * 3. Due-for-review concepts are included
 */
export async function getLearningPath(
  userId: string,
  targetConceptId?: string,
  maxSuggestions: number = 5
): Promise<LearningPathSuggestion[]> {
  try {
    const graph = await getKnowledgeGraph(userId);
    const suggestions: LearningPathSuggestion[] = [];

    if (graph.nodes.length === 0) {
      return [];
    }

    // If target concept specified, build path to it
    if (targetConceptId) {
      const prereqCheck = await checkPrerequisites(userId, targetConceptId);

      // Add weak prerequisites first
      for (const prereq of prereqCheck.prerequisites) {
        if (prereq.isWeak) {
          suggestions.push({
            conceptId: prereq.conceptId,
            conceptLabel: prereq.conceptLabel,
            currentMastery: prereq.effectiveMastery,
            reason: `Prerequisite for "${prereqCheck.conceptLabel}"`,
            priority: 1.0 - prereq.effectiveMastery,
          });
        }
      }

      // Add the target concept
      const targetMastery = await getEffectiveMastery(userId, targetConceptId);
      const targetNode = graph.nodes.find((n) => n.id === targetConceptId);

      if (targetNode) {
        suggestions.push({
          conceptId: targetConceptId,
          conceptLabel: targetNode.label,
          currentMastery: targetMastery?.effectiveMastery ?? 0,
          reason: "Target concept",
          priority: 0.9,
        });
      }
    } else {
      // General learning path - find weakest concepts
      for (const node of graph.nodes) {
        const mastery = await getEffectiveMastery(userId, node.id);
        const effectiveMastery = mastery?.effectiveMastery ?? 0;

        // Include weak concepts
        if (effectiveMastery < 0.5) {
          suggestions.push({
            conceptId: node.id,
            conceptLabel: node.label,
            currentMastery: effectiveMastery,
            reason:
              effectiveMastery < 0.2 ? "Needs learning" : "Needs strengthening",
            priority: 1.0 - effectiveMastery,
          });
        }

        // Include concepts due for review
        if (mastery?.isDueForReview) {
          // Avoid duplicates
          const existing = suggestions.find((s) => s.conceptId === node.id);
          if (!existing) {
            suggestions.push({
              conceptId: node.id,
              conceptLabel: node.label,
              currentMastery: effectiveMastery,
              reason: "Due for review",
              priority: 0.8,
            });
          }
        }
      }
    }

    // Sort by priority and limit
    suggestions.sort((a, b) => b.priority - a.priority);
    return suggestions.slice(0, maxSuggestions);
  } catch (error) {
    logger.error("Failed to get learning path", {
      userId,
      targetConceptId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}

/**
 * Find related concepts for a given concept
 */
export async function getRelatedConcepts(
  userId: string,
  conceptId: string,
  maxDepth: number = 2,
  relationTypes?: LearningRelationType[]
): Promise<
  Array<{
    conceptId: string;
    conceptLabel: string;
    relation: LearningRelationType;
    mastery?: number;
    depth: number;
  }>
> {
  try {
    const graph = await getKnowledgeGraph(userId);
    const results: Array<{
      conceptId: string;
      conceptLabel: string;
      relation: LearningRelationType;
      mastery?: number;
      depth: number;
    }> = [];

    const visited = new Set<string>([conceptId]);
    const queue: Array<{ id: string; depth: number }> = [
      { id: conceptId, depth: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.depth >= maxDepth) continue;

      const { incoming, outgoing } = findConnectedEdges(graph, current.id);

      for (const edge of [...incoming, ...outgoing]) {
        const relatedId =
          edge.source === current.id ? edge.target : edge.source;

        if (visited.has(relatedId)) continue;
        visited.add(relatedId);

        const relation = inferLearningRelation(
          edge.relation,
          edge.learningRelation
        );

        // Filter by relation types if specified
        if (relationTypes && !relationTypes.includes(relation)) continue;

        const node = graph.nodes.find((n) => n.id === relatedId);
        if (!node) continue;

        const mastery = await getEffectiveMastery(userId, relatedId);

        results.push({
          conceptId: relatedId,
          conceptLabel: node.label,
          relation,
          mastery: mastery?.effectiveMastery,
          depth: current.depth + 1,
        });

        // Add to queue for further exploration
        queue.push({ id: relatedId, depth: current.depth + 1 });
      }
    }

    return results;
  } catch (error) {
    logger.error("Failed to get related concepts", {
      userId,
      conceptId,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return [];
  }
}
