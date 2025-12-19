// ** Knowledge Graph types for Echo-Learn

export type GraphNodeType =
  | 'concept'
  | 'process'
  | 'detail'
  | 'example'
  | 'term'
  | 'definition'
  | 'fact'

export interface GraphNode {
  id: string
  label: string
  type: GraphNodeType
  description?: string
  importance?: number
  fileIds?: string[]
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
  sources: string[]
  weight?: number
}

export interface KnowledgeGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

export interface GraphGenerationResult {
  graph: KnowledgeGraph
  fileId: string
  nodesGenerated: number
  edgesGenerated: number
}

export interface GraphMergeResult {
  nodesAdded: number
  nodesUpdated: number
  edgesAdded: number
  edgesUpdated: number
}

export interface GraphSearchOptions {
  nodeTypes?: GraphNodeType[]
  maxDepth?: number
  limit?: number
}

export interface GraphSearchResult {
  nodes: GraphNode[]
  edges: GraphEdge[]
  relevanceScores?: Record<string, number>
}

export interface GraphVisualizationNode {
  id: string
  position: {
    x: number
    y: number
  }
  data: {
    label: string
    type: GraphNodeType
  }
  style?: Record<string, string | number>
}

export interface GraphVisualizationEdge {
  id: string
  source: string
  target: string
  label?: string
  animated?: boolean
  style?: Record<string, string | number>
}

export interface GraphVisualizationData {
  nodes: GraphVisualizationNode[]
  edges: GraphVisualizationEdge[]
}

export interface GraphStats {
  totalNodes: number
  totalEdges: number
  nodesByType: Record<GraphNodeType, number>
  averageConnections: number
  mostConnectedNodes: Array<{
    id: string
    label: string
    connections: number
  }>
}
