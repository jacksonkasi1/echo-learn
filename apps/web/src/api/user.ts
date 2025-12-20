// User API module
// Handles user profile and analytics API calls

import { apiClient } from './client'

// Types for user profile
export interface UserProfile {
  userId: string
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  weakAreas: string[]
  strongAreas: string[]
  coveredTopics: string[]
  questionsAnswered: number
  lastInteraction: string
  createdAt: string
  updatedAt?: string
}

export interface UserAnalytics {
  totalQuestions: number
  topicsCovered: number
  strongAreas: string[]
  weakAreas: string[]
  level: string
  lastActive: string | null
}

export interface KnowledgeGraphStats {
  totalNodes: number
  totalEdges: number
  nodesByType: Record<string, number>
  topConnectedNodes: Array<{
    id: string
    label: string
    connections: number
  }>
}

export interface KnowledgeGraph {
  nodes: Array<{
    id: string
    label: string
    type: string
    description?: string
    fileIds?: string[]
  }>
  edges: Array<{
    source: string
    target: string
    relation: string
    sources: string[]
  }>
}

/**
 * Get user profile
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  const response = await apiClient.get<UserProfile>(`/api/users/${userId}/profile`)
  return response.data
}

/**
 * Get user analytics summary
 */
export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
  const response = await apiClient.get<UserAnalytics>(`/api/users/${userId}/analytics`)
  return response.data
}

/**
 * Get user's knowledge graph
 */
export async function getKnowledgeGraph(userId: string): Promise<KnowledgeGraph> {
  const response = await apiClient.get<KnowledgeGraph>(`/api/users/${userId}/graph`)
  return response.data
}

/**
 * Get knowledge graph statistics
 */
export async function getKnowledgeGraphStats(userId: string): Promise<KnowledgeGraphStats> {
  const response = await apiClient.get<KnowledgeGraphStats>(`/api/users/${userId}/graph/stats`)
  return response.data
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
): Promise<UserProfile> {
  const response = await apiClient.patch<UserProfile>(`/api/users/${userId}/profile`, updates)
  return response.data
}

// Export the user API as a namespace for cleaner imports
export const userApi = {
  getProfile: getUserProfile,
  getAnalytics: getUserAnalytics,
  getGraph: getKnowledgeGraph,
  getGraphStats: getKnowledgeGraphStats,
  updateProfile: updateUserProfile,
}

export default userApi
