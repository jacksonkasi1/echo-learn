import { apiClient } from "./client";
import type {
  TestConfiguration,
  TestSession,
  TestSessionHistoryEntry,
  TestSessionSummary,
} from "@repo/shared";

/**
 * Test session progress response
 */
export interface TestProgress {
  current: number;
  total: number;
  score: number;
  remaining: number;
  correctCount: number;
  incorrectCount: number;
  partialCount: number;
}

/**
 * Start test response
 */
export interface StartTestResponse {
  success: boolean;
  session: TestSession;
}

/**
 * Get session response
 */
export interface GetSessionResponse {
  success: boolean;
  hasActiveSession: boolean;
  session: TestSession | null;
  progress?: TestProgress | null;
}

/**
 * Complete test response
 */
export interface CompleteTestResponse {
  success: boolean;
  summary: TestSessionSummary;
}

/**
 * Get history response
 */
export interface GetHistoryResponse {
  success: boolean;
  history: Array<TestSessionHistoryEntry>;
  total: number;
}

/**
 * Get progress response
 */
export interface GetProgressResponse {
  success: boolean;
  hasActiveSession: boolean;
  progress: TestProgress | null;
}

/**
 * Test Mode API client
 */
export const testApi = {
  /**
   * Start a new test session with configuration
   */
  startTest: async (
    userId: string,
    config: TestConfiguration
  ): Promise<StartTestResponse> => {
    const response = await apiClient.post<StartTestResponse>(
      "/api/learning/test/start",
      {
        userId,
        config,
      }
    );
    return response.data;
  },

  /**
   * Get active test session for a user
   */
  getSession: async (userId: string): Promise<GetSessionResponse> => {
    const response = await apiClient.get<GetSessionResponse>(
      "/api/learning/test/session",
      {
        params: { userId },
      }
    );
    return response.data;
  },

  /**
   * Complete the active test session and get summary
   */
  completeTest: async (userId: string): Promise<CompleteTestResponse> => {
    const response = await apiClient.post<CompleteTestResponse>(
      "/api/learning/test/complete",
      {
        userId,
      }
    );
    return response.data;
  },

  /**
   * Abandon the active test session without completing
   */
  abandonTest: async (
    userId: string
  ): Promise<{ success: boolean; message: string }> => {
    const response = await apiClient.post<{
      success: boolean;
      message: string;
    }>("/api/learning/test/abandon", {
      userId,
    });
    return response.data;
  },

  /**
   * Get test session history for a user
   */
  getHistory: async (
    userId: string,
    limit: number = 20
  ): Promise<GetHistoryResponse> => {
    const response = await apiClient.get<GetHistoryResponse>(
      "/api/learning/test/history",
      {
        params: { userId, limit },
      }
    );
    return response.data;
  },

  /**
   * Get progress of active test session
   */
  getProgress: async (userId: string): Promise<GetProgressResponse> => {
    const response = await apiClient.get<GetProgressResponse>(
      "/api/learning/test/progress",
      {
        params: { userId },
      }
    );
    return response.data;
  },
};
