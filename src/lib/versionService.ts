export interface VersionInfo {
  hash: string;
  changelog: string[];
  description: string;
  updatedAt?: string;
}

export const CURRENT_HASH = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev';

let _versionPromise: Promise<VersionInfo | null> | null = null;
let _cachedVersionData: VersionInfo | null = null;
let _lastFetchTime = 0;

/**
 * Fetch version information from /api/version with request deduplication
 * and in-memory throttling (10 mins) to prevent duplicate calls.
 * Returns null immediately in development environments.
 */
export async function fetchVersionInfo(): Promise<VersionInfo | null> {
  // Do not run check in dev environment to avoid noise and excessive requests
  if (process.env.NODE_ENV === 'development' || CURRENT_HASH === 'dev') {
    return null;
  }

  const now = Date.now();
  // Return memory cached data if checked within 10 minutes
  if (_cachedVersionData && now - _lastFetchTime < 10 * 60 * 1000) {
    return _cachedVersionData;
  }

  // Deduplicate concurrent calls: return existing active promise
  if (_versionPromise) {
    return _versionPromise;
  }

  _versionPromise = (async () => {
    try {
      const res = await fetch('/api/version', { cache: 'no-store' });
      if (!res.ok) return null;
      const data: VersionInfo = await res.json();
      _cachedVersionData = data;
      _lastFetchTime = Date.now();
      return data;
    } catch {
      return null;
    } finally {
      _versionPromise = null;
    }
  })();

  return _versionPromise;
}
