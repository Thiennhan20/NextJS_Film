import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient, buildCacheKey, getTTLForEndpoint } from '@/lib/redis';

const BACKEND_BASE_URL = process.env.API_URL || (process.env.NODE_ENV === 'production'
  ? 'https://server-nextjs-film.onrender.com/api/tmdb'
  : 'http://localhost:3001/api/tmdb');

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// Delay helper for rate-limit backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses Retry-After header or calculates exponential backoff with full jitter (api-rate-limit-handler)
 */
function getRetryDelay(response: Response, attempt: number, maxDelayMs = 4000): number {
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, maxDelayMs);
    }
  }
  // Full jitter exponential backoff: (300ms * 2^attempt) + random jitter
  const cap = Math.min(300 * 2 ** attempt, maxDelayMs);
  return Math.floor(Math.random() * cap) + 150;
}

interface TmdbResultItem {
  id?: number | string;
  title?: string;
  name?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  origin_country?: string[];
  genre_ids?: number[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  [key: string]: unknown;
}

interface TmdbResponsePayload {
  results?: TmdbResultItem[];
  [key: string]: unknown;
}

/**
 * Fetch data directly from TMDB API with rate-limiting resilience & exponential backoff
 */
async function fetchFromTMDBDirect(endpoint: string, params: Record<string, string>): Promise<TmdbResponsePayload | null> {
  if (!TMDB_API_KEY) return null;

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', TMDB_API_KEY);
  for (const [key, value] of Object.entries(params)) {
    if (key !== 'endpoint' && value) {
      url.searchParams.set(key, value);
    }
  }

  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url.toString(), {
        signal: AbortSignal.timeout(8000), // 8s timeout
      });

      if (response.ok) {
        return await response.json();
      }

      // Check for rate limit (429) or transient server error (503)
      if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
        const delay = getRetryDelay(response, attempt);
        console.warn(`⚠️ TMDB ${response.status} Rate Limit on ${endpoint}. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(delay);
        continue;
      }

      return null;
    } catch (error) {
      if (attempt < maxRetries) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      console.error('❌ Direct TMDB fetch failed after retries:', error);
      return null;
    }
  }

  return null;
}

/**
 * Fetch data from Render backend (fallback)
 */
async function fetchFromBackend(searchParams: URLSearchParams): Promise<{ data: TmdbResponsePayload | null; xCache: string }> {
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

/**
 * Trims heavy unnecessary fields from discover/trending results to optimize bandwidth and Redis storage
 */
function trimPayload(endpoint: string, data: TmdbResponsePayload | null | undefined): TmdbResponsePayload | null | undefined {
  if (!data || !Array.isArray(data.results)) return data;

  if (/\/discover\//.test(endpoint) || /\/trending\//.test(endpoint)) {
    const trimmedResults = data.results.map((item: TmdbResultItem) => ({
      id: item.id,
      title: item.title,
      name: item.name,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      vote_average: item.vote_average,
      release_date: item.release_date,
      first_air_date: item.first_air_date,
      original_language: item.original_language,
      origin_country: item.origin_country,
      genre_ids: item.genre_ids,
      number_of_seasons: item.number_of_seasons,
      number_of_episodes: item.number_of_episodes,
    }));

    return {
      ...data,
      results: trimmedResults,
    };
  }

  return data;
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
    // Mở rộng cache Redis: Hỗ trợ cả discover đến trang 5 để giảm tải TMDB
    const redis = getRedisClient();
    const cacheKey = buildCacheKey(endpoint, params);
    const isSearch = /\/search\//.test(endpoint);
    const isDiscover = /\/discover\//.test(endpoint);
    const reqPage = Number(params['page'] || '1');
    const useRedisCache = !isSearch && (!isDiscover || reqPage <= 5);

    if (redis && useRedisCache) {
      try {
        const cached = await redis.get<TmdbResponsePayload>(cacheKey);
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

    // --- LAYER 2: Fetch fresh data with rate-limiting resilience ---
    let data: TmdbResponsePayload | null = null;
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

    // Tối ưu băng thông: Cắt tỉa các trường không cần thiết trước khi cache và gửi về client
    const optimizedData = trimPayload(endpoint, data);

    // --- LAYER 3: Store in Redis (non-blocking) ---
    if (redis && useRedisCache) {
      // 4 hours for discover pages 2-5, default 8h for page 1
      const ttl = isDiscover && reqPage > 1 ? 4 * 60 * 60 : getTTLForEndpoint(endpoint);
      redis.set(cacheKey, optimizedData, { ex: ttl }).catch((err: unknown) => {
        console.warn('⚠️ Redis SET failed:', err);
      });
    }

    return NextResponse.json(optimizedData, {
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