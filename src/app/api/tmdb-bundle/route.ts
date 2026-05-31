import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, buildCacheKey, CACHE_TTL } from '@/lib/redis';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const BACKEND_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://server-nextjs-firm.onrender.com/api/tmdb'
  : 'http://localhost:3001/api/tmdb';

/**
 * Fetch a single TMDB endpoint directly
 */
async function fetchTMDBDirect(endpoint: string): Promise<object | null> {
  if (!TMDB_API_KEY) return null;
  try {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch a single TMDB endpoint via Render backend (fallback)
 */
async function fetchFromBackend(endpoint: string): Promise<object | null> {
  try {
    const backendUrl = `${BACKEND_BASE_URL}?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * Fetch with Redis cache check, TMDB direct, then Render fallback
 */
async function fetchWithCache(endpoint: string, redis: ReturnType<typeof getRedisClient>): Promise<object | null> {
  const cacheKey = buildCacheKey(endpoint);

  // Check Redis cache
  if (redis) {
    try {
      const cached = await redis.get<object>(cacheKey);
      if (cached) return cached;
    } catch {
      // Redis error, continue to fetch
    }
  }

  // Try TMDB direct
  let data = await fetchTMDBDirect(endpoint);

  // Fallback to Render backend
  if (!data) {
    data = await fetchFromBackend(endpoint);
  }

  // Store in Redis (non-blocking)
  if (data && redis) {
    const ttl = CACHE_TTL.DETAILS;
    redis.set(cacheKey, data, { ex: ttl }).catch(() => {});
  }

  return data;
}

/**
 * Bundle API: Fetch detail + images + videos + credits in one invocation
 * 
 * Usage: /api/tmdb-bundle?type=movie&id=550
 *        /api/tmdb-bundle?type=tv&id=1396
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'movie' or 'tv'
    const id = searchParams.get('id');

    if (!type || !id || !['movie', 'tv'].includes(type)) {
      return NextResponse.json(
        { error: 'Missing or invalid type/id. Use ?type=movie&id=123 or ?type=tv&id=123' },
        { status: 400 }
      );
    }

    const redis = getRedisClient();

    // Check for a combined bundle cache first
    const bundleCacheKey = `tmdb:bundle:${type}:${id}`;
    if (redis) {
      try {
        const cachedBundle = await redis.get<object>(bundleCacheKey);
        if (cachedBundle) {
          return NextResponse.json(cachedBundle, {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
              'X-Cache': 'HIT',
              'X-Cache-Source': 'redis-bundle',
            },
          });
        }
      } catch {
        // Redis error, continue
      }
    }

    // Fetch all 4 endpoints in parallel
    const [detail, images, videos, credits] = await Promise.allSettled([
      fetchWithCache(`/${type}/${id}`, redis),
      fetchWithCache(`/${type}/${id}/images`, redis),
      fetchWithCache(`/${type}/${id}/videos`, redis),
      fetchWithCache(`/${type}/${id}/credits`, redis),
    ]);

    const bundle = {
      detail: detail.status === 'fulfilled' ? detail.value : null,
      images: images.status === 'fulfilled' ? images.value : null,
      videos: videos.status === 'fulfilled' ? videos.value : null,
      credits: credits.status === 'fulfilled' ? credits.value : null,
    };

    if (!bundle.detail) {
      return NextResponse.json(
        { error: 'Failed to fetch detail data' },
        { status: 502 }
      );
    }

    // Cache the combined bundle in Redis (non-blocking)
    if (redis) {
      redis.set(bundleCacheKey, bundle, { ex: CACHE_TTL.DETAILS }).catch(() => {});
    }

    return NextResponse.json(bundle, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        'X-Cache': 'MISS',
        'X-Cache-Source': 'tmdb-bundle',
      },
    });
  } catch (error) {
    console.error('💥 Bundle proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
