// ** import types
import type {
  FileMetadata,
  UserProfile,
  InteractionLog,
  KnowledgeGraph,
} from "@repo/shared";

// ** import lib
import { Redis } from "@upstash/redis";

// ** import utils
import { logger } from "@repo/logs";

// ===========================================
// In-Memory Cache for User Profiles
// ===========================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const profileCache = new Map<string, CacheEntry<UserProfile>>();
const CACHE_TTL = 30000; // 30 seconds cache TTL

/**
 * Clear expired cache entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of profileCache.entries()) {
    if (now - entry.timestamp > CACHE_TTL) {
      profileCache.delete(key);
    }
  }
}, 60000); // Clean every minute

// Initialize Upstash Redis client
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// ===========================================
// File Metadata Operations
// ===========================================

/**
 * Store file metadata in Redis
 */
export async function setFileMetadata(
  fileId: string,
  metadata: FileMetadata,
): Promise<void> {
  try {
    await redis.set(`file:${fileId}:metadata`, JSON.stringify(metadata));
    logger.info(`Stored metadata for file: ${fileId}`);
  } catch (error) {
    logger.error(`Failed to store file metadata: ${fileId}`, error);
    throw error;
  }
}

/**
 * Get file metadata from Redis
 */
export async function getFileMetadata(
  fileId: string,
): Promise<FileMetadata | null> {
  try {
    const data = await redis.get<string>(`file:${fileId}:metadata`);
    if (!data) return null;
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch (error) {
    logger.error(`Failed to get file metadata: ${fileId}`, error);
    throw error;
  }
}

/**
 * Update file metadata status
 */
export async function updateFileStatus(
  fileId: string,
  status: FileMetadata["status"],
  error?: string,
): Promise<void> {
  try {
    const metadata = await getFileMetadata(fileId);
    if (!metadata) {
      throw new Error(`File metadata not found: ${fileId}`);
    }

    metadata.status = status;
    metadata.updatedAt = new Date().toISOString();
    if (error) {
      metadata.error = error;
    }
    if (status === "processed") {
      metadata.processedAt = new Date().toISOString();
    }

    await setFileMetadata(fileId, metadata);
  } catch (error) {
    logger.error(`Failed to update file status: ${fileId}`, error);
    throw error;
  }
}

/**
 * Delete file metadata
 */
export async function deleteFileMetadata(fileId: string): Promise<void> {
  try {
    await redis.del(`file:${fileId}:metadata`);
    logger.info(`Deleted metadata for file: ${fileId}`);
  } catch (error) {
    logger.error(`Failed to delete file metadata: ${fileId}`, error);
    throw error;
  }
}

// ===========================================
// User File List Operations
// ===========================================

/**
 * Add a file to user's file list
 */
export async function addFileToUser(
  userId: string,
  fileId: string,
): Promise<void> {
  try {
    await redis.sadd(`user:${userId}:files`, fileId);
    logger.info(`Added file ${fileId} to user ${userId}`);
  } catch (error) {
    logger.error(`Failed to add file to user: ${userId}/${fileId}`, error);
    throw error;
  }
}

/**
 * Remove a file from user's file list
 */
export async function removeFileFromUser(
  userId: string,
  fileId: string,
): Promise<void> {
  try {
    await redis.srem(`user:${userId}:files`, fileId);
    logger.info(`Removed file ${fileId} from user ${userId}`);
  } catch (error) {
    logger.error(`Failed to remove file from user: ${userId}/${fileId}`, error);
    throw error;
  }
}

/**
 * Get all file IDs for a user
 */
export async function getUserFileIds(userId: string): Promise<string[]> {
  try {
    const fileIds = await redis.smembers(`user:${userId}:files`);
    return fileIds;
  } catch (error) {
    logger.error(`Failed to get user files: ${userId}`, error);
    throw error;
  }
}

/**
 * Get all file metadata for a user
 */
export async function getUserFiles(userId: string): Promise<FileMetadata[]> {
  try {
    const fileIds = await getUserFileIds(userId);
    const files: FileMetadata[] = [];

    for (const fileId of fileIds) {
      const metadata = await getFileMetadata(fileId);
      if (metadata) {
        files.push(metadata);
      }
    }

    return files;
  } catch (error) {
    logger.error(`Failed to get user files: ${userId}`, error);
    throw error;
  }
}

// ===========================================
// User Profile Operations
// ===========================================

const DEFAULT_PROFILE: Omit<UserProfile, "userId" | "createdAt"> = {
  level: "beginner",
  weakAreas: [],
  strongAreas: [],
  coveredTopics: [],
  questionsAnswered: 0,
  lastInteraction: new Date().toISOString(),
};

/**
 * Get user profile, creating default if not exists
 * Uses in-memory cache with 30s TTL to reduce Redis calls
 */
export async function getUserProfile(userId: string): Promise<UserProfile> {
  try {
    // Check in-memory cache first
    const cached = profileCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Fetch from Redis
    const data = await redis.get<string>(`user:${userId}:profile`);
    if (data) {
      const profile = typeof data === "string" ? JSON.parse(data) : data;
      // Cache the result
      profileCache.set(userId, { data: profile, timestamp: Date.now() });
      return profile;
    }

    // Create default profile
    const profile: UserProfile = {
      ...DEFAULT_PROFILE,
      userId,
      createdAt: new Date().toISOString(),
      lastInteraction: new Date().toISOString(),
    };

    await redis.set(`user:${userId}:profile`, JSON.stringify(profile));
    // Cache the new profile
    profileCache.set(userId, { data: profile, timestamp: Date.now() });
    return profile;
  } catch (error) {
    logger.error(`Failed to get user profile: ${userId}`, error);
    throw error;
  }
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<UserProfile>,
): Promise<UserProfile> {
  try {
    const current = await getUserProfile(userId);
    const updated: UserProfile = {
      ...current,
      ...updates,
      userId, // Ensure userId is not overwritten
      updatedAt: new Date().toISOString(),
    };

    await redis.set(`user:${userId}:profile`, JSON.stringify(updated));

    // Invalidate cache so next read gets fresh data
    profileCache.delete(userId);

    return updated;
  } catch (error) {
    logger.error(`Failed to update user profile: ${userId}`, error);
    throw error;
  }
}

/**
 * Mark a topic as covered
 */
export async function markTopicCovered(
  userId: string,
  topic: string,
): Promise<void> {
  try {
    const profile = await getUserProfile(userId);
    if (!profile.coveredTopics.includes(topic)) {
      profile.coveredTopics.push(topic);
      await updateUserProfile(userId, { coveredTopics: profile.coveredTopics });
    }
  } catch (error) {
    logger.error(`Failed to mark topic covered: ${userId}/${topic}`, error);
    throw error;
  }
}

// ===========================================
// Knowledge Graph Operations
// ===========================================

/**
 * Get user's knowledge graph
 */
export async function getKnowledgeGraph(
  userId: string,
): Promise<KnowledgeGraph> {
  try {
    const data = await redis.get<string>(`user:${userId}:graph`);
    if (data) {
      return typeof data === "string" ? JSON.parse(data) : data;
    }
    return { nodes: [], edges: [] };
  } catch (error) {
    logger.error(`Failed to get knowledge graph: ${userId}`, error);
    throw error;
  }
}

/**
 * Save user's knowledge graph
 */
export async function saveKnowledgeGraph(
  userId: string,
  graph: KnowledgeGraph,
): Promise<void> {
  try {
    await redis.set(`user:${userId}:graph`, JSON.stringify(graph));
    logger.info(`Saved knowledge graph for user: ${userId}`);
  } catch (error) {
    logger.error(`Failed to save knowledge graph: ${userId}`, error);
    throw error;
  }
}

// ===========================================
// Interaction Log Operations
// ===========================================

/**
 * Log an interaction
 */
export async function logInteraction(log: InteractionLog): Promise<void> {
  try {
    const key = `user:${log.userId}:interactions`;
    // Store as a sorted set with timestamp as score for easy retrieval
    await redis.zadd(key, {
      score: Date.now(),
      member: JSON.stringify(log),
    });

    // Keep only last 1000 interactions
    await redis.zremrangebyrank(key, 0, -1001);

    logger.info(`Logged interaction for user: ${log.userId}`);
  } catch (error) {
    logger.error(`Failed to log interaction: ${log.userId}`, error);
    throw error;
  }
}

/**
 * Get recent interactions for a user
 */
export async function getRecentInteractions(
  userId: string,
  limit = 50,
): Promise<InteractionLog[]> {
  try {
    const key = `user:${userId}:interactions`;
    const results = await redis.zrange(key, -limit, -1);

    return results.map((item) =>
      typeof item === "string" ? JSON.parse(item) : item,
    );
  } catch (error) {
    logger.error(`Failed to get recent interactions: ${userId}`, error);
    throw error;
  }
}

// ===========================================
// Cache Operations
// ===========================================

/**
 * Cache OCR result temporarily
 */
export async function cacheOcrResult(
  fileId: string,
  result: unknown,
  ttlSeconds = 3600,
): Promise<void> {
  try {
    await redis.setex(
      `cache:ocr:${fileId}`,
      ttlSeconds,
      JSON.stringify(result),
    );
  } catch (error) {
    logger.error(`Failed to cache OCR result: ${fileId}`, error);
    // Don't throw - caching is not critical
  }
}

/**
 * Get cached OCR result
 */
export async function getCachedOcrResult<T>(fileId: string): Promise<T | null> {
  try {
    const data = await redis.get<string>(`cache:ocr:${fileId}`);
    if (data) {
      return typeof data === "string" ? JSON.parse(data) : data;
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get cached OCR result: ${fileId}`, error);
    return null;
  }
}

/**
 * Generic cache set with TTL
 */
export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds = 3600,
): Promise<void> {
  try {
    await redis.setex(`cache:${key}`, ttlSeconds, JSON.stringify(value));
  } catch (error) {
    logger.error(`Failed to set cache: ${key}`, error);
  }
}

/**
 * Generic cache get
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const data = await redis.get<string>(`cache:${key}`);
    if (data) {
      return typeof data === "string" ? JSON.parse(data) : data;
    }
    return null;
  } catch (error) {
    logger.error(`Failed to get cache: ${key}`, error);
    return null;
  }
}

/**
 * Delete cache key
 */
export async function deleteCache(key: string): Promise<void> {
  try {
    await redis.del(`cache:${key}`);
  } catch (error) {
    logger.error(`Failed to delete cache: ${key}`, error);
  }
}

/**
 * Flush all data from Redis (DANGER: USE ONLY IN DEV)
 */
export async function flushRedis(): Promise<void> {
  try {
    await redis.flushdb();
    logger.info("Flushed Redis database");
    // Clear in-memory cache as well
    profileCache.clear();
  } catch (error) {
    logger.error("Failed to flush Redis", error);
    throw error;
  }
}
