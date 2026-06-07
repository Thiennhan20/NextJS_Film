import { useState, useEffect, useRef, useCallback } from 'react';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const BROWSER_CACHE_PREFIX = 'api-cache:';

function readBrowserCache<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(`${BROWSER_CACHE_PREFIX}${key}`);
    if (!raw) return null;

    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (!entry || Date.now() > entry.expiry) {
      window.sessionStorage.removeItem(`${BROWSER_CACHE_PREFIX}${key}`);
      return null;
    }

    return entry.data;
  } catch {
    return null;
  }
}

function writeBrowserCache<T>(key: string, data: T, ttl: number): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(`${BROWSER_CACHE_PREFIX}${key}`, JSON.stringify({
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl,
    }));
  } catch {
    // Storage can fail in private mode or when quota is full.
  }
}

function removeBrowserCache(key: string): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(`${BROWSER_CACHE_PREFIX}${key}`);
  } catch {
    // Ignore storage errors.
  }
}

class ApiCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, data: T, ttl: number = DEFAULT_CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + ttl
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

const apiCache = new ApiCache();

export function useApiCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl?: number,
  initialData?: T | null
): { data: T | null; loading: boolean; error: Error | null; refetch: () => void } {
  const initialCachedData = initialData ?? readBrowserCache<T>(key);
  const effectiveTtl = ttl ?? DEFAULT_CACHE_TTL;
  const [data, setData] = useState<T | null>(initialCachedData);
  const [loading, setLoading] = useState(!initialCachedData);
  const [error, setError] = useState<Error | null>(null);
  const fetcherRef = useRef(fetcher);
  const initialDataRef = useRef<T | null>(initialData ?? null);

  // Update fetcher ref when it changes
  useEffect(() => {
    fetcherRef.current = fetcher;
  }, [fetcher]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      if (initialDataRef.current !== null) {
        const serverData = initialDataRef.current;
        initialDataRef.current = null;
        apiCache.set(key, serverData, effectiveTtl);
        writeBrowserCache(key, serverData, effectiveTtl);
        setData(serverData);
        setLoading(false);
        return;
      }

      // Check cache first
      const cachedData = apiCache.get<T>(key);
      if (cachedData) {
        setData(cachedData);
        setLoading(false);
        return;
      }

      const browserCachedData = readBrowserCache<T>(key);
      if (browserCachedData) {
        apiCache.set(key, browserCachedData, effectiveTtl);
        setData(browserCachedData);
        setLoading(false);
        return;
      }

      // Fetch new data
      const newData = await fetcherRef.current();
      apiCache.set(key, newData, effectiveTtl);
      writeBrowserCache(key, newData, effectiveTtl);
      setData(newData);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [key, effectiveTtl]);

  useEffect(() => {
    fetchData();
  }, [key, fetchData]);

  const refetch = () => {
    apiCache.clear(); // Clear cache for this key
    removeBrowserCache(key);
    fetchData();
  };

  return { data, loading, error, refetch };
}

export default apiCache;
