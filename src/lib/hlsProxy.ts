/**
 * HLS Proxy Helper
 * Wrap m3u8 URLs through Cloudflare Workers proxy to bypass CORS
 */

const HLS_PROXY_URL = process.env.NEXT_PUBLIC_HLS_PROXY_URL || '';

/**
 * Wrap an m3u8 URL through the HLS proxy.
 * If no proxy URL is configured, returns the original URL.
 * Only proxies URLs that look like m3u8/HLS streams.
 */
export function proxyHlsUrl(originalUrl: string): string {
  if (!originalUrl || !HLS_PROXY_URL) return originalUrl;

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

export type PreparedClientHlsSource = {
  url: string;
  cleanup: () => void;
};

export type PreparedHlsPlayerSource = {
  src: string;
  watchUrl: string;
  cleanHlsInBrowser: boolean;
};

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function resolveUrl(baseUrl: string, value: string): string {
  return new URL(value, baseUrl).toString();
}

function directoryUrl(url: string): string {
  const parsed = new URL(url);
  parsed.pathname = parsed.pathname.replace(/[^/]*$/, '');
  parsed.search = '';
  parsed.hash = '';
  return parsed.toString();
}

function looksLikeHlsUrl(value: string): boolean {
  return /\.m3u8(?:$|[?#])/i.test(value);
}

export function shouldCleanHlsInBrowser(originalUrl?: string): boolean {
  const rawUrl = extractOriginalUrl(originalUrl);
  return !!rawUrl && looksLikeHlsUrl(rawUrl) && isHttpUrl(rawUrl);
}

export function prepareHlsPlayerSource(originalUrl?: string): PreparedHlsPlayerSource {
  const rawUrl = extractOriginalUrl(originalUrl);

  return {
    src: rawUrl ? proxyHlsUrl(rawUrl) : '',
    watchUrl: rawUrl,
    cleanHlsInBrowser: shouldCleanHlsInBrowser(rawUrl),
  };
}

function rewriteUriAttributes(line: string, playlistUrl: string): string {
  return line.replace(/URI="([^"]+)"/g, (match, uri) => {
    if (!uri || /^(data|skd):/i.test(uri)) return match;
    return `URI="${resolveUrl(playlistUrl, uri)}"`;
  });
}

async function rewriteUriAttributesForMaster(
  line: string,
  playlistUrl: string,
  cleanPlaylist: (playlistUrl: string) => Promise<string>
): Promise<string> {
  let output = line;
  const matches = Array.from(line.matchAll(/URI="([^"]+)"/g));

  for (const match of matches) {
    const uri = match[1];
    if (!uri || /^(data|skd):/i.test(uri)) continue;

    const resolved = resolveUrl(playlistUrl, uri);
    const rewritten = looksLikeHlsUrl(resolved) ? await cleanPlaylist(resolved) : resolved;
    output = output.replace(match[0], `URI="${rewritten}"`);
  }

  return output;
}

function isMasterPlaylist(lines: string[]): boolean {
  return lines.some((line) => line.startsWith('#EXT-X-STREAM-INF'));
}

function isSegmentScopedTag(line: string): boolean {
  return (
    line.startsWith('#EXTINF') ||
    line.startsWith('#EXT-X-BYTERANGE') ||
    line.startsWith('#EXT-X-DISCONTINUITY') ||
    line.startsWith('#EXT-X-PROGRAM-DATE-TIME') ||
    line.startsWith('#EXT-X-KEY') ||
    line.startsWith('#EXT-X-MAP') ||
    line.startsWith('#EXT-X-DATERANGE') ||
    line.startsWith('#EXT-X-GAP') ||
    line.startsWith('#EXT-X-PART') ||
    line.startsWith('#EXT-X-PRELOAD-HINT')
  );
}

function collectSegments(lines: string[], playlistUrl: string): string[] {
  return lines
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => resolveUrl(playlistUrl, line));
}

function getRootPrefix(playlistUrl: string, segments: string[]): string {
  const playlistDirectory = directoryUrl(playlistUrl);
  const firstSegmentUrl = segments[0];

  if (!firstSegmentUrl) return playlistDirectory;
  if (firstSegmentUrl.startsWith(playlistDirectory)) return playlistDirectory;

  return directoryUrl(firstSegmentUrl);
}

async function fetchPlaylistText(playlistUrl: string): Promise<string> {
  const response = await fetch(playlistUrl, {
    cache: 'no-store',
    headers: {
      Accept: '*/*',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch HLS playlist: ${response.status}`);
  }

  const text = await response.text();
  if (!text.includes('#EXTM3U')) {
    throw new Error('The URL does not return a valid M3U8 playlist.');
  }

  return text;
}

function createPlaylistObjectUrl(body: string, objectUrls: string[]): string {
  const blob = new Blob([body], { type: 'application/vnd.apple.mpegurl;charset=utf-8' });
  const objectUrl = URL.createObjectURL(blob);
  objectUrls.push(objectUrl);
  return objectUrl;
}

function rewriteMediaPlaylist(lines: string[], playlistUrl: string): string {
  const segments = collectSegments(lines, playlistUrl);
  const rootPrefix = getRootPrefix(playlistUrl, segments);
  const output: string[] = [];
  let segmentIndex = 0;
  let pendingSegmentLines: string[] = [];
  let pendingExtinf = false;
  let previousWasSkipped = false;
  let outputSegmentCount = 0;
  let hasEndList = false;

  const pushTag = (line: string) => {
    if (line.startsWith('#EXT-X-MEDIA-SEQUENCE')) {
      output.push('#EXT-X-MEDIA-SEQUENCE:0');
      return;
    }

    output.push(rewriteUriAttributes(line, playlistUrl));
  };

  for (const line of lines) {
    if (!line) continue;

    if (line === '#EXT-X-ENDLIST') {
      hasEndList = true;
      continue;
    }

    if (line.startsWith('#')) {
      if (isSegmentScopedTag(line) || pendingExtinf) {
        pendingSegmentLines.push(line);
        if (line.startsWith('#EXTINF')) pendingExtinf = true;
      } else {
        pushTag(line);
      }
      continue;
    }

    const segmentUrl = segments[segmentIndex];
    segmentIndex += 1;

    if (!segmentUrl) {
      pendingSegmentLines = [];
      pendingExtinf = false;
      continue;
    }

    const shouldSkip = segmentUrl.includes('/adjump/') || !segmentUrl.startsWith(rootPrefix);
    if (shouldSkip) {
      pendingSegmentLines = [];
      pendingExtinf = false;
      previousWasSkipped = outputSegmentCount > 0;
      continue;
    }

    if (previousWasSkipped && !pendingSegmentLines.some((item) => item.startsWith('#EXT-X-DISCONTINUITY'))) {
      output.push('#EXT-X-DISCONTINUITY');
    }

    for (const pendingLine of pendingSegmentLines) {
      pushTag(pendingLine);
    }

    pendingSegmentLines = [];
    pendingExtinf = false;
    previousWasSkipped = false;
    output.push(segmentUrl);
    outputSegmentCount += 1;
  }

  if (!outputSegmentCount) {
    throw new Error('All HLS segments were filtered out.');
  }

  if (hasEndList) {
    output.push('#EXT-X-ENDLIST');
  }

  return `${output.join('\n')}\n`;
}

/**
 * Fetch and clean Server 1 HLS playlists in the browser.
 * This avoids Render/Worker outbound IP blocks from phim1280 while still removing ad segments.
 */
export async function createClientCleanPlaylistUrl(originalUrl: string): Promise<PreparedClientHlsSource> {
  const rawUrl = extractOriginalUrl(originalUrl);
  const objectUrls: string[] = [];
  const playlistCache = new Map<string, Promise<string>>();

  const cleanup = () => {
    for (const objectUrl of objectUrls) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrls.length = 0;
  };

  if (typeof window === 'undefined' || !rawUrl || !looksLikeHlsUrl(rawUrl) || !isHttpUrl(rawUrl)) {
    return { url: rawUrl, cleanup };
  }

  const cleanPlaylist = (playlistUrl: string): Promise<string> => {
    const normalizedUrl = new URL(playlistUrl).toString();
    const cached = playlistCache.get(normalizedUrl);
    if (cached) return cached;

    const task = (async () => {
      const text = await fetchPlaylistText(normalizedUrl);
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      if (isMasterPlaylist(lines)) {
        const output: string[] = [];
        for (const line of lines) {
          if (line.startsWith('#')) {
            output.push(await rewriteUriAttributesForMaster(line, normalizedUrl, cleanPlaylist));
          } else {
            output.push(await cleanPlaylist(resolveUrl(normalizedUrl, line)));
          }
        }
        return createPlaylistObjectUrl(`${output.join('\n')}\n`, objectUrls);
      }

      return createPlaylistObjectUrl(rewriteMediaPlaylist(lines, normalizedUrl), objectUrls);
    })();

    playlistCache.set(normalizedUrl, task);
    return task;
  };

  try {
    return { url: await cleanPlaylist(rawUrl), cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}
