// ** User Profile types for Echo-Learn

export type UserLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert'

export interface UserProfile {
  userId: string
  level: UserLevel
  weakAreas: string[]
  strongAreas: string[]
  coveredTopics: string[]
  questionsAnswered: number
  lastInteraction: string
  createdAt: string
  updatedAt?: string
}

export interface UserLearningState {
  userId: string
  currentTopic?: string
  sessionStartTime?: string
  messagesInSession: number
  topicsDiscussedInSession: string[]
}

export interface UserProfileUpdate {
  level?: UserLevel
  weakAreas?: string[]
  strongAreas?: string[]
  coveredTopics?: string[]
  questionsAnswered?: number
}

export interface UserAnalytics {
  userId: string
  totalQuestions: number
  totalSessions: number
  averageSessionLength: number
  topicsProgress: Record<string, TopicProgress>
  learningStreak: number
  lastActiveDate: string
}

export interface TopicProgress {
  topic: string
  questionsAsked: number
  correctAnswers: number
  lastDiscussed: string
  masteryLevel: number
}

export interface InteractionLog {
  userId: string
  timestamp: string
  query: string
  response: string
  topicsDiscussed: string[]
  retrievedChunks: string[]
  responseLength: number
  processingTimeMs?: number
}

export interface SessionSummary {
  sessionId: string
  userId: string
  startTime: string
  endTime: string
  duration: number
  messagesExchanged: number
  topicsCovered: string[]
  keyInsights?: string[]
}

export interface UserPreferences {
  userId: string
  voiceEnabled: boolean
  preferredVoiceId?: string
  responseVerbosity: 'concise' | 'normal' | 'detailed'
  learningPace: 'slow' | 'normal' | 'fast'
  notificationsEnabled: boolean
}

export interface AuthenticatedUser {
  userId: string
  email?: string
  name?: string
  avatarUrl?: string
  createdAt: string
}
