/**
 * Redis client singleton for Upstash (cache-tmdb instance)
 * Used for caching TMDB API responses to bypass slow Render server
 */
import { Redis } from '@upstash/redis'

// Singleton pattern - reuse across requests
let redis: Redis | null = null

export function getRedisClient(): Redis | null {
  if (redis) return redis

  const url = process.env.UPSTASH_REDIS_REST_CACHE_URL
  const token = process.env.UPSTASH_REDIS_REST_CACHE_TOKEN

  if (!url || !token) {
    console.warn('⚠️ Redis cache not configured: Missing UPSTASH_REDIS_REST_CACHE_URL or UPSTASH_REDIS_REST_CACHE_TOKEN')
    return null
  }

  redis = new Redis({ url, token })
  return redis
}

/**
 * Cache TTL presets (in seconds)
 * Designed to minimize Redis commands while keeping data fresh
 */
export const CACHE_TTL = {
  /** Trending/Popular data - cache 8h */
  TRENDING: 8 * 60 * 60,
  /** Discover data (genre/country filters) - cache 8h */
  DISCOVER: 8 * 60 * 60,
  /** Movie/TV details - cache 8h */
  DETAILS: 8 * 60 * 60,
  /** Coming soon - cache 8h */
  COMING_SOON: 8 * 60 * 60,
  // Search results are NOT cached — high cardinality, low HIT rate
} as const

/**
 * Generate a clean Redis cache key from TMDB endpoint + params
 */
export function buildCacheKey(endpoint: string, params: Record<string, string> = {}): string {
  // Sort params for consistent keys
  const sortedParams = Object.entries(params)
    .filter(([key]) => key !== 'endpoint') // endpoint is already part of the key
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')

  const key = sortedParams ? `tmdb:${endpoint}:${sortedParams}` : `tmdb:${endpoint}`
  return key
}

/**
 * Determine TTL based on the TMDB endpoint type
 */
export function getTTLForEndpoint(endpoint: string): number {
  if (/\/trending\//.test(endpoint)) return CACHE_TTL.TRENDING
  if (/\/discover\//.test(endpoint)) return CACHE_TTL.DISCOVER
  if (/\/(movie|tv)\/\d+$/.test(endpoint)) return CACHE_TTL.DETAILS
  // Search endpoints are NOT cached (high cardinality, low HIT rate)
  // Default for unknown endpoints
  return CACHE_TTL.TRENDING
}
