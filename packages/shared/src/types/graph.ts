// ** Knowledge Graph types for Echo-Learn

/**
 * Learning relationship types for graph edges
 * Used for mastery propagation and learning path generation
 */
export type LearningRelationType =
  | "prerequisite" // Must know source before target
  | "corequisite" // Often learned together
  | "application" // Target applies source concept
  | "example" // Target is example of source
  | "opposite" // Contrasting concepts
  | "related"; // General relation

export type GraphNodeType =
  | "concept"
  | "process"
  | "detail"
  | "example"
  | "term"
  | "definition"
  | "fact";

export interface GraphNode {
  id: string;
  label: string;
  type: GraphNodeType;
  description?: string;
  importance?: number;
  fileIds?: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  sources: string[];
  weight?: number;
  /** Learning relationship type for mastery propagation */
  learningRelation?: LearningRelationType;
  /** How much mastery propagates through this edge (0.0 - 1.0) */
  propagationWeight?: number;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphGenerationResult {
  graph: KnowledgeGraph;
  fileId: string;
  nodesGenerated: number;
  edgesGenerated: number;
}

export interface GraphMergeResult {
  nodesAdded: number;
  nodesUpdated: number;
  edgesAdded: number;
  edgesUpdated: number;
}

export interface GraphSearchOptions {
  nodeTypes?: GraphNodeType[];
  maxDepth?: number;
  limit?: number;
}

export interface GraphSearchResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  relevanceScores?: Record<string, number>;
}

export interface GraphVisualizationNode {
  id: string;
  position: {
    x: number;
    y: number;
  };
  data: {
    label: string;
    type: GraphNodeType;
  };
  style?: Record<string, string | number>;
}

export interface GraphVisualizationEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
  style?: Record<string, string | number>;
}

export interface GraphVisualizationData {
  nodes: GraphVisualizationNode[];
  edges: GraphVisualizationEdge[];
}

export interface GraphStats {
  totalNodes: number;
  totalEdges: number;
  nodesByType: Record<GraphNodeType, number>;
  averageConnections: number;
  mostConnectedNodes: Array<{
    id: string;
    label: string;
    connections: number;
  }>;
}
