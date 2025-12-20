// ** import types
import type {
  KnowledgeGraph,
  GraphNode,
  GraphEdge,
  GraphMergeResult,
} from "@repo/shared";

// ** import lib
import { getKnowledgeGraph, saveKnowledgeGraph } from "@repo/storage";

// ** import utils
import { logger } from "@repo/logs";

/**
 * Merge a new graph into the user's main knowledge graph
 * Handles node deduplication and edge source tracking
 */
export async function mergeGraphIntoMain(
  userId: string,
  newGraph: KnowledgeGraph,
  fileId: string
): Promise<GraphMergeResult> {
  try {
    logger.info("Merging graph into main knowledge graph", {
      userId,
      fileId,
      newNodes: newGraph.nodes.length,
      newEdges: newGraph.edges.length,
    });

    // Fetch existing graph from Redis
    const existingGraph = await getKnowledgeGraph(userId);

    const result: GraphMergeResult = {
      nodesAdded: 0,
      nodesUpdated: 0,
      edgesAdded: 0,
      edgesUpdated: 0,
    };

    // Create lookup maps for existing data
    const nodeMap = new Map<string, GraphNode>();
    existingGraph.nodes.forEach((node) => nodeMap.set(node.id, node));

    const edgeMap = new Map<string, GraphEdge>();
    existingGraph.edges.forEach((edge) => {
      const key = createEdgeKey(edge);
      edgeMap.set(key, edge);
    });

    // Merge new nodes
    for (const newNode of newGraph.nodes) {
      const normalizedId = normalizeId(newNode.id);
      const existingNode = nodeMap.get(normalizedId);

      if (existingNode) {
        // Node exists - update it
        result.nodesUpdated++;

        // Merge fileIds
        const fileIds = new Set([
          ...(existingNode.fileIds || []),
          ...(newNode.fileIds || []),
          fileId,
        ]);
        existingNode.fileIds = Array.from(fileIds);

        // Optionally update description if new one is longer/better
        if (
          newNode.description &&
          (!existingNode.description ||
            newNode.description.length > existingNode.description.length)
        ) {
          existingNode.description = newNode.description;
        }
      } else {
        // New node
        const nodeToAdd: GraphNode = {
          ...newNode,
          id: normalizedId,
          fileIds: [...new Set([...(newNode.fileIds || []), fileId])],
        };
        nodeMap.set(normalizedId, nodeToAdd);
        result.nodesAdded++;
      }
    }

    // Merge new edges (with source tracking)
    for (const newEdge of newGraph.edges) {
      const normalizedSource = normalizeId(newEdge.source);
      const normalizedTarget = normalizeId(newEdge.target);

      // Ensure both nodes exist
      if (!nodeMap.has(normalizedSource) || !nodeMap.has(normalizedTarget)) {
        logger.warn("Skipping edge with missing node", {
          source: normalizedSource,
          target: normalizedTarget,
        });
        continue;
      }

      const normalizedEdge: GraphEdge = {
        ...newEdge,
        source: normalizedSource,
        target: normalizedTarget,
        sources: [...new Set([...newEdge.sources, fileId])],
      };

      const key = createEdgeKey(normalizedEdge);
      const existingEdge = edgeMap.get(key);

      if (existingEdge) {
        // Edge exists - add this file to sources
        if (!existingEdge.sources.includes(fileId)) {
          existingEdge.sources.push(fileId);
        }
        result.edgesUpdated++;
      } else {
        edgeMap.set(key, normalizedEdge);
        result.edgesAdded++;
      }
    }

    // Save merged graph
    const mergedGraph: KnowledgeGraph = {
      nodes: Array.from(nodeMap.values()),
      edges: Array.from(edgeMap.values()),
    };

    await saveKnowledgeGraph(userId, mergedGraph);

    logger.info("Graph merge completed", {
      userId,
      fileId,
      ...result,
      totalNodes: mergedGraph.nodes.length,
      totalEdges: mergedGraph.edges.length,
    });

    return result;
  } catch (error) {
    logger.error("Failed to merge graph", error);
    throw error;
  }
}

/**
 * Remove a file's contribution from the knowledge graph
 * Used when deleting a file
 */
export async function removeFileFromGraph(
  userId: string,
  fileId: string
): Promise<{
  nodesRemoved: number;
  edgesRemoved: number;
}> {
  try {
    logger.info("Removing file contribution from graph", { userId, fileId });

    const graph = await getKnowledgeGraph(userId);

    if (graph.nodes.length === 0 && graph.edges.length === 0) {
      logger.info("Graph is empty, nothing to remove");
      return { nodesRemoved: 0, edgesRemoved: 0 };
    }

    const originalNodeCount = graph.nodes.length;
    const originalEdgeCount = graph.edges.length;

    // Remove file from edge sources, and remove edges with no sources
    const updatedEdges = graph.edges
      .map((edge) => ({
        ...edge,
        sources: edge.sources.filter((s) => s !== fileId),
      }))
      .filter((edge) => edge.sources.length > 0);

    // Find nodes that still have connections
    const connectedNodes = new Set<string>();
    updatedEdges.forEach((edge) => {
      connectedNodes.add(edge.source);
      connectedNodes.add(edge.target);
    });

    // Update nodes: remove file from fileIds, keep nodes that have other files or connections
    const updatedNodes = graph.nodes
      .map((node) => ({
        ...node,
        fileIds: (node.fileIds || []).filter((f) => f !== fileId),
      }))
      .filter((node) => {
        // Keep node if it has other file references or still has connections
        return (
          (node.fileIds && node.fileIds.length > 0) ||
          connectedNodes.has(node.id)
        );
      });

    // Save updated graph
    await saveKnowledgeGraph(userId, {
      nodes: updatedNodes,
      edges: updatedEdges,
    });

    const result = {
      nodesRemoved: originalNodeCount - updatedNodes.length,
      edgesRemoved: originalEdgeCount - updatedEdges.length,
    };

    logger.info("File contribution removed from graph", {
      userId,
      fileId,
      ...result,
    });

    return result;
  } catch (error) {
    logger.error("Failed to remove file from graph", error);
    throw error;
  }
}

/**
 * Get graph statistics for a user
 */
export async function getGraphStats(userId: string): Promise<{
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<string, number>;
  topConnectedNodes: Array<{ id: string; label: string; connections: number }>;
}> {
  try {
    const graph = await getKnowledgeGraph(userId);

    // Count nodes by type
    const nodesByType: Record<string, number> = {};
    for (const node of graph.nodes) {
      nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    // Count connections per node
    const connectionCount = new Map<string, number>();
    for (const edge of graph.edges) {
      connectionCount.set(
        edge.source,
        (connectionCount.get(edge.source) || 0) + 1
      );
      connectionCount.set(
        edge.target,
        (connectionCount.get(edge.target) || 0) + 1
      );
    }

    // Get top connected nodes
    const nodeConnections = graph.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      connections: connectionCount.get(node.id) || 0,
    }));

    nodeConnections.sort((a, b) => b.connections - a.connections);

    return {
      totalNodes: graph.nodes.length,
      totalEdges: graph.edges.length,
      nodesByType,
      topConnectedNodes: nodeConnections.slice(0, 10),
    };
  } catch (error) {
    logger.error("Failed to get graph stats", error);
    throw error;
  }
}

/**
 * Find related nodes in the graph based on a starting node
 */
export async function findRelatedNodes(
  userId: string,
  nodeId: string,
  maxDepth = 2
): Promise<KnowledgeGraph> {
  try {
    const graph = await getKnowledgeGraph(userId);
    const normalizedNodeId = normalizeId(nodeId);

    // BFS to find related nodes
    const visited = new Set<string>();
    const queue: Array<{ id: string; depth: number }> = [
      { id: normalizedNodeId, depth: 0 },
    ];
    const relatedNodeIds = new Set<string>();
    const relatedEdges: GraphEdge[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (visited.has(current.id) || current.depth > maxDepth) {
        continue;
      }

      visited.add(current.id);
      relatedNodeIds.add(current.id);

      // Find connected edges
      for (const edge of graph.edges) {
        if (edge.source === current.id || edge.target === current.id) {
          const neighborId =
            edge.source === current.id ? edge.target : edge.source;

          if (!visited.has(neighborId)) {
            queue.push({ id: neighborId, depth: current.depth + 1 });
            relatedEdges.push(edge);
          }
        }
      }
    }

    // Get the actual node objects
    const relatedNodes = graph.nodes.filter((node) =>
      relatedNodeIds.has(node.id)
    );

    return {
      nodes: relatedNodes,
      edges: relatedEdges,
    };
  } catch (error) {
    logger.error("Failed to find related nodes", error);
    throw error;
  }
}

/**
 * Search for nodes matching a query
 */
export async function searchNodes(
  userId: string,
  query: string,
  limit = 10
): Promise<GraphNode[]> {
  try {
    const graph = await getKnowledgeGraph(userId);
    const normalizedQuery = query.toLowerCase();

    // Simple text search on node labels and descriptions
    const matches = graph.nodes
      .map((node) => {
        let score = 0;

        // Check label match
        if (node.label.toLowerCase().includes(normalizedQuery)) {
          score += 10;
        }
        if (node.label.toLowerCase() === normalizedQuery) {
          score += 20;
        }

        // Check ID match
        if (node.id.includes(normalizedQuery.replace(/\s+/g, "_"))) {
          score += 5;
        }

        // Check description match
        if (node.description?.toLowerCase().includes(normalizedQuery)) {
          score += 3;
        }

        return { node, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((item) => item.node);

    return matches;
  } catch (error) {
    logger.error("Failed to search nodes", error);
    throw error;
  }
}

/**
 * Create a unique key for an edge based on source, target, and relation
 */
function createEdgeKey(edge: GraphEdge): string {
  return `${edge.source}|${edge.target}|${edge.relation.toLowerCase()}`;
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
