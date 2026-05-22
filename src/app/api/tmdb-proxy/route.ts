import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, buildCacheKey, getTTLForEndpoint } from '@/lib/redis';

const BACKEND_BASE_URL = process.env.NODE_ENV === 'production'
  ? 'https://server-nextjs-firm.onrender.com/api/tmdb'
  : 'http://localhost:3001/api/tmdb';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

/**
 * Fetch data directly from TMDB API (bypasses Render server)
 * Used when Redis has no cached data
 */
async function fetchFromTMDBDirect(endpoint: string, params: Record<string, string>): Promise<object | null> {
  if (!TMDB_API_KEY) return null;

  try {
    const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
    url.searchParams.set('api_key', TMDB_API_KEY);
    
    for (const [key, value] of Object.entries(params)) {
      if (key !== 'endpoint' && value) {
        url.searchParams.set(key, value);
      }
    }

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!response.ok) return null;
    return await response.json();
  } catch (error) {
    console.error('❌ Direct TMDB fetch failed:', error);
    return null;
  }
}

/**
 * Fetch data from Render backend (fallback)
 */
async function fetchFromBackend(searchParams: URLSearchParams): Promise<{ data: object | null; xCache: string }> {
  try {
    const backendUrl = `${BACKEND_BASE_URL}?${searchParams.toString()}`;
    const response = await fetch(backendUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(15000), // 15s timeout for Render cold start
    });

    if (!response.ok) return { data: null, xCache: 'MISS' };

    const data = await response.json();
    const xCache = response.headers.get('X-Cache') || 'MISS';
    return { data, xCache };
  } catch {
    return { data: null, xCache: 'MISS' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get('endpoint');

    if (!endpoint) {
      return NextResponse.json({ error: 'Missing endpoint parameter' }, { status: 400 });
    }

    // Build params object (exclude 'endpoint' key)
    const params: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      if (key !== 'endpoint') params[key] = value;
    });

    // --- LAYER 1: Check Redis Cache ---
    // Skip Redis for search (high cardinality, low HIT rate) and discover pages > 1
    const redis = getRedisClient();
    const cacheKey = buildCacheKey(endpoint, params);
    const isSearch = /\/search\//.test(endpoint);
    const isDiscover = /\/discover\//.test(endpoint);
    const reqPage = Number(params['page'] || '1');
    const useRedisCache = !isSearch && (!isDiscover || reqPage <= 1);

    if (redis && useRedisCache) {
      try {
        const cached = await redis.get<object>(cacheKey);
        if (cached) {
          return NextResponse.json(cached, {
            headers: {
              'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
              'X-Cache': 'HIT',
              'X-Cache-Source': 'redis',
            }
          });
        }
      } catch (redisErr) {
        console.warn('⚠️ Redis GET failed, falling through:', redisErr);
      }
    }

    // --- LAYER 2: Fetch fresh data ---
    let data: object | null = null;
    let cacheSource = 'tmdb-direct';

    // Try direct TMDB first (faster than going through Render)
    data = await fetchFromTMDBDirect(endpoint, params);

    // Fallback to Render backend if direct TMDB fails
    if (!data) {
      const backendResult = await fetchFromBackend(searchParams);
      data = backendResult.data;
      cacheSource = 'backend';
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Failed to fetch data from all sources' },
        { status: 502 }
      );
    }

    // --- LAYER 3: Store in Redis (non-blocking) ---
    // Skip caching discover pages > 1 to save Redis storage (only page 1 is SSR-cached)
    if (redis && useRedisCache) {
      const ttl = getTTLForEndpoint(endpoint);
      // Fire and forget - don't block the response
      redis.set(cacheKey, data, { ex: ttl }).catch((err: unknown) => {
        console.warn('⚠️ Redis SET failed:', err);
      });
    }

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
        'X-Cache': 'MISS',
        'X-Cache-Source': cacheSource,
      }
    });
  } catch (error) {
    console.error('💥 Proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}