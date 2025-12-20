// ** import types
import type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphNodeType,
} from "@repo/shared";

// ** import lib
import { google } from "@ai-sdk/google";
import { generateObject } from "ai";
import { z } from "zod";

// ** import utils
import { logger } from "@repo/logs";
import { env } from "../../env";

// Schema for graph generation response
const graphNodeSchema = z.object({
  id: z.string().describe("Lowercase, normalized concept ID using underscores"),
  label: z.string().describe("Human-readable label for the concept"),
  type: z
    .enum([
      "concept",
      "process",
      "detail",
      "example",
      "term",
      "definition",
      "fact",
    ])
    .describe("Type of knowledge node"),
  description: z
    .string()
    .optional()
    .describe("Brief description of the concept"),
});

const graphEdgeSchema = z.object({
  source: z.string().describe("Source node ID"),
  target: z.string().describe("Target node ID"),
  relation: z
    .string()
    .describe(
      'Relationship type: "is a", "includes", "causes", "requires", "relates to", etc.',
    ),
});

const graphSchema = z.object({
  nodes: z.array(graphNodeSchema),
  edges: z.array(graphEdgeSchema),
});

// Types inferred from schema
type GeneratedNode = z.infer<typeof graphNodeSchema>;
type GeneratedEdge = z.infer<typeof graphEdgeSchema>;
type GeneratedGraph = z.infer<typeof graphSchema>;

/**
 * Generate a knowledge graph from text using Gemini LLM
 * Extracts concepts, terms, and their relationships
 */
export async function generateGraphFromText(
  text: string,
  fileId: string,
): Promise<KnowledgeGraph> {
  try {
    logger.info("Generating knowledge graph from text", {
      fileId,
      textLength: text.length,
    });

    const result = await generateObject({
      model: google(env.GEMINI_MODEL),
      schema: graphSchema,
      output: "object",
      prompt: `
        Analyze the following study material and extract a knowledge graph.

        RULES:
        1. Node IDs must be lowercase with underscores (e.g., "cell_division", "photosynthesis")
        2. Keep nodes focused on key concepts, terms, and important details
        3. Create meaningful edges that show clear relationships between concepts
        4. Use appropriate node types:
           - "concept": Main ideas or theories
           - "process": Procedures, workflows, or sequences
           - "detail": Supporting information or specifics
           - "example": Concrete examples or instances
           - "term": Technical vocabulary or definitions
           - "definition": Formal definitions
           - "fact": Factual statements or data points
        5. Limit to 10-20 nodes per chunk for clarity
        6. Ensure all edges connect existing nodes
        7. Use descriptive relation types like "is a", "includes", "causes", "requires", "leads to", "part of", "example of"

        TEXT:
        ${text}
      `,
    });

    const object: GeneratedGraph = result.object;

    // Normalize all node IDs to lowercase with underscores
    const normalizedNodes: GraphNode[] = object.nodes.map(
      (node: GeneratedNode) => ({
        id: normalizeId(node.id),
        label: node.label,
        type: node.type as GraphNodeType,
        description: node.description,
        fileIds: [fileId],
      }),
    );

    // Create a set of valid node IDs for validation
    const validNodeIds = new Set(normalizedNodes.map((n) => n.id));

    // Normalize edges and filter out invalid ones
    const normalizedEdges: GraphEdge[] = object.edges
      .map((edge: GeneratedEdge) => ({
        source: normalizeId(edge.source),
        target: normalizeId(edge.target),
        relation: edge.relation,
        sources: [fileId],
      }))
      .filter((edge: GraphEdge) => {
        // Only keep edges where both source and target exist
        const valid =
          validNodeIds.has(edge.source) && validNodeIds.has(edge.target);
        if (!valid) {
          logger.warn("Filtered out invalid edge", {
            source: edge.source,
            target: edge.target,
          });
        }
        return valid;
      });

    const graph: KnowledgeGraph = {
      nodes: normalizedNodes,
      edges: normalizedEdges,
    };

    logger.info("Knowledge graph generated successfully", {
      fileId,
      nodeCount: graph.nodes.length,
      edgeCount: graph.edges.length,
    });

    return graph;
  } catch (error) {
    logger.error("Failed to generate knowledge graph", error);
    throw error;
  }
}

/**
 * Generate a knowledge graph from multiple text chunks
 * Combines graphs from each chunk into a single graph
 */
export async function generateGraphFromChunks(
  chunks: Array<{ content: string; id: string }>,
  fileId: string,
): Promise<KnowledgeGraph> {
  logger.info("Generating knowledge graph from chunks", {
    fileId,
    chunkCount: chunks.length,
  });

  const allNodes: GraphNode[] = [];
  const allEdges: GraphEdge[] = [];

  // Process chunks in sequence to avoid rate limits
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!;

    try {
      logger.info(`Processing chunk ${i + 1}/${chunks.length}`);

      const chunkGraph = await generateGraphFromText(chunk.content, fileId);

      allNodes.push(...chunkGraph.nodes);
      allEdges.push(...chunkGraph.edges);

      // Small delay between chunks to respect rate limits
      if (i < chunks.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    } catch (error) {
      logger.error(`Failed to process chunk ${i + 1}`, error);
      // Continue with other chunks
    }
  }

  // Deduplicate nodes by ID, merging fileIds
  const nodeMap = new Map<string, GraphNode>();
  for (const node of allNodes) {
    const existing = nodeMap.get(node.id);
    if (existing) {
      // Merge fileIds
      existing.fileIds = [
        ...new Set([...(existing.fileIds || []), ...(node.fileIds || [])]),
      ];
    } else {
      nodeMap.set(node.id, node);
    }
  }

  // Deduplicate edges, merging sources
  const edgeMap = new Map<string, GraphEdge>();
  for (const edge of allEdges) {
    const key = `${edge.source}|${edge.target}|${edge.relation}`;
    const existing = edgeMap.get(key);
    if (existing) {
      // Merge sources
      existing.sources = [...new Set([...existing.sources, ...edge.sources])];
    } else {
      edgeMap.set(key, edge);
    }
  }

  const combinedGraph: KnowledgeGraph = {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };

  logger.info("Combined knowledge graph created", {
    fileId,
    totalNodes: combinedGraph.nodes.length,
    totalEdges: combinedGraph.edges.length,
  });

  return combinedGraph;
}

/**
 * Normalize an ID to lowercase with underscores
 */
function normalizeId(id: string): string {
  return id
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

/**
 * Extract key topics from text without full graph generation
 * Useful for quick topic extraction
 */
export async function extractTopics(text: string): Promise<string[]> {
  try {
    const topicsSchema = z.object({
      topics: z.array(z.string()).describe("List of key topics or concepts"),
    });

    const result = await generateObject({
      model: google(env.GEMINI_MODEL),
      schema: topicsSchema,
      output: "object",
      prompt: `
        Extract the 5-10 most important topics or concepts from this text.
        Return simple, concise topic names.

        TEXT:
        ${text.slice(0, 2000)}
      `,
    });

    const topics = result.object.topics as string[];
    return topics.map((topic: string) => normalizeId(topic));
  } catch (error) {
    logger.error("Failed to extract topics", error);
    return [];
  }
}

/**
 * Validate a knowledge graph structure
 */
export function validateGraph(graph: KnowledgeGraph): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // Check for duplicate node IDs
  if (nodeIds.size !== graph.nodes.length) {
    errors.push("Duplicate node IDs found");
  }

  // Check that all edges reference valid nodes
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge source "${edge.source}" not found in nodes`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge target "${edge.target}" not found in nodes`);
    }
  }

  // Check for self-referencing edges
  for (const edge of graph.edges) {
    if (edge.source === edge.target) {
      errors.push(`Self-referencing edge found: ${edge.source}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
