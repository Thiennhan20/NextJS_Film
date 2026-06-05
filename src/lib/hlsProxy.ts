/**
 * HLS Proxy Helper
 * Wrap m3u8 URLs through Cloudflare Workers proxy to bypass CORS
 */

const HLS_PROXY_URL = process.env.NEXT_PUBLIC_HLS_PROXY_URL || '';
const SERVER1_CLEAN_HLS_PATH = '/api/server1/hls-clean/playlist.m3u8';

/**
 * Wrap an m3u8 URL through the HLS proxy.
 * If no proxy URL is configured, returns the original URL.
 * Only proxies URLs that look like m3u8/HLS streams.
 */
export function proxyHlsUrl(originalUrl: string): string {
  if (!originalUrl || !HLS_PROXY_URL) return originalUrl;

  // Server 1 clean playlists are already rewritten by our API. Keep them direct
  // so the web player does not route the lightweight playlist through another proxy.
  if (originalUrl.includes(SERVER1_CLEAN_HLS_PATH)) return originalUrl;

  // Only proxy m3u8 URLs (not embed/iframe URLs)
  const isHlsUrl = originalUrl.includes('.m3u8');

  if (!isHlsUrl) return originalUrl;

  // Don't double-proxy
  if (originalUrl.includes(HLS_PROXY_URL)) return originalUrl;

  return `${HLS_PROXY_URL}/?url=${encodeURIComponent(originalUrl)}`;
}

function safeDecodeUrl(val: string): string {
  try {
    return decodeURIComponent(val);
  } catch {
    return val;
  }
}

/**
 * Extract the original HLS URL from a proxy wrapper (?url= or ?source=) and normalize it.
 */
export function extractOriginalUrl(value?: string): string {
  let current = (value || '').trim().replace(/&amp;/g, '&');
  if (!current) return '';

  for (let i = 0; i < 2; i += 1) {
    const decoded = safeDecodeUrl(current).trim().replace(/&amp;/g, '&');
    if (/^https?:\/\//i.test(decoded)) {
      current = decoded;
    }

    try {
      const url = new URL(current);
      const wrappedUrl = url.searchParams.get('url') || url.searchParams.get('source');
      if (wrappedUrl && /^https?:\/\//i.test(safeDecodeUrl(wrappedUrl))) {
        current = safeDecodeUrl(wrappedUrl).trim().replace(/&amp;/g, '&');
        continue;
      }

      url.hash = '';
      const sortedParams = Array.from(url.searchParams.entries())
        .sort(([keyA, valueA], [keyB, valueB]) => keyA === keyB
          ? valueA.localeCompare(valueB)
          : keyA.localeCompare(keyB));

      url.search = '';
      for (const [key, paramValue] of sortedParams) {
        url.searchParams.append(key, paramValue);
      }

      return url.toString();
    } catch {
      return current;
    }
  }

  return current;
}

/**
 * Wrap a raw HLS URL with the Server 1 ad-cleaning proxy.
 * If already wrapped, returns the URL as-is.
 */
export function getCleanPlaylistUrl(originalUrl: string): string {
  if (!originalUrl) return '';

  // If it's already a clean playlist URL, return it as-is
  if (originalUrl.includes(SERVER1_CLEAN_HLS_PATH)) return originalUrl;

  // Only wrap m3u8 URLs
  if (!originalUrl.includes('.m3u8')) return originalUrl;

  let apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    apiUrl = 'http://localhost:3001/api';
  }

  const cleanApiUrl = apiUrl.replace(/\/$/, '');
  return `${cleanApiUrl}/server1/hls-clean/playlist.m3u8?source=${encodeURIComponent(originalUrl)}`;
}
