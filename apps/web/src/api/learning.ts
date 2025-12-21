import { apiClient } from './client'

export interface LearningAnalytics {
  summary: {
    totalConcepts: number
    masteredConcepts: number
    learningConcepts: number
    weakConcepts: number
    averageMastery: number
    conceptsDueForReview: number
  }
  strengths: Array<{
    conceptId: string
    conceptLabel: string
    mastery: number
    streak: number
  }>
  weaknesses: Array<{
    conceptId: string
    conceptLabel: string
    mastery: number
    totalAttempts: number
  }>
  upcomingReviews: Array<{
    conceptId: string
    conceptLabel: string
    mastery: number
    nextReviewDate: string
  }>
  lastUpdated: string
}

export const learningApi = {
  getAnalytics: async (userId: string) => {
    const response = await apiClient.get<LearningAnalytics>(
      `/api/learning/analytics`,
      {
        params: { userId },
      },
    )
    return response.data
  },
}
