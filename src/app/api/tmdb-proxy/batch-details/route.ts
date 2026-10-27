import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, buildCacheKey, CACHE_TTL } from '@/lib/redis';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

const BACKEND_BASE_URL = process.env.API_URL || (process.env.NODE_ENV === 'production'
  ? 'https://server-nextjs-film.onrender.com/api/tmdb'
  : 'http://localhost:3001/api/tmdb');

interface BatchItem {
  type: 'movie' | 'tv';
  id: number;
}

/**
 * Fetch item details with direct TMDB first, then fallback to backend proxy
 */
async function fetchItemDetails(item: BatchItem): Promise<{ item: BatchItem; data: object } | null> {
  const endpoint = `/${item.type}/${item.id}`;

  // 1. Direct TMDB fetch
  if (TMDB_API_KEY) {
    try {
      const url = `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}`;
      const response = await fetch(url, {
        signal: AbortSignal.timeout(6000),
      });
      if (response.ok) {
        const data = (await response.json()) as object;
        return { item, data };
      }
    } catch {
      // Fall through to backend fallback
    }
  }

  // 2. Fallback to Backend proxy (e.g. Render / Singapore)
  try {
    const backendUrl = `${BACKEND_BASE_URL}?endpoint=${encodeURIComponent(endpoint)}`;
    const response = await fetch(backendUrl, {
      signal: AbortSignal.timeout(8000),
      headers: { 'Content-Type': 'application/json' },
    });
    if (response.ok) {
      const data = (await response.json()) as object;
      return { item, data };
    }
  } catch {
    // Both failed
  }

  return null;
}

/**
 * Batch fetch movie/TV details - checks Redis cache first, then fetches from TMDB.
 * Used by home page frames to pre-warm cache for CardWithHover.
 */
export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as { items: BatchItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Invalid items' }, { status: 400 });
    }

    // Limit batch size to prevent abuse
    const limitedItems = items.slice(0, 30);
    const redis = getRedisClient();
    const results: Record<string, object> = {};
    const uncachedItems: BatchItem[] = [];

    // --- Check Redis cache for all items ---
    if (redis) {
      const cacheChecks = await Promise.allSettled(
        limitedItems.map(async (item) => {
          const endpoint = `/${item.type}/${item.id}`;
          const cacheKey = buildCacheKey(endpoint);
          const cached = await redis.get<object>(cacheKey);
          return { item, cached, cacheKey };
        })
      );

      for (const result of cacheChecks) {
        if (result.status === 'fulfilled') {
          const { item, cached } = result.value;
          const key = `${item.type}-${item.id}`;
          if (cached) {
            results[key] = cached;
          } else {
            uncachedItems.push(item);
          }
        }
      }
    } else {
      uncachedItems.push(...limitedItems);
    }

    // --- Fetch uncached items with TMDB + Backend fallback ---
    if (uncachedItems.length > 0) {
      const fetchResults = await Promise.allSettled(
        uncachedItems.map((item) => fetchItemDetails(item))
      );

      for (const result of fetchResults) {
        if (result.status === 'fulfilled' && result.value) {
          const { item, data } = result.value;
          const key = `${item.type}-${item.id}`;
          results[key] = data;

          // Store in Redis (non-blocking)
          if (redis) {
            const endpoint = `/${item.type}/${item.id}`;
            const cacheKey = buildCacheKey(endpoint);
            redis
              .set(cacheKey, data, { ex: CACHE_TTL.DETAILS })
              .catch(() => {});
          }
        }
      }
    }

    return NextResponse.json(
      { results },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=3600, stale-while-revalidate=86400',
        },
      }
    );
  } catch (error) {
    console.error('💥 Batch details error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
