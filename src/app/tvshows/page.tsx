import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import TVShowsClient from './TVShowsClient';
import { getRedisClient, buildCacheKey, CACHE_TTL } from '@/lib/redis';

// TV Show type matching TMDB API response
interface TMDBTV {
  id: number;
  name: string;
  poster_path: string;
  vote_average: number;
  first_air_date?: string;
  original_language?: string;
  number_of_seasons?: number;
  number_of_episodes?: number;
  genre_ids?: number[];
}

interface TVShow {
  id: number;
  name: string;
  poster_path: string;
  image?: string;
  year?: number;
  genre?: string;
  first_air_date?: string;
  country?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
  vote_average?: number;
}

const countryMap: { [key: string]: string } = {
  'en': 'USA', 'ja': 'Japan', 'ko': 'Korea', 'zh': 'China',
  'hi': 'India', 'fr': 'France', 'de': 'Germany', 'es': 'Spain',
  'it': 'Italy', 'pt': 'Brazil', 'ru': 'Russia', 'ar': 'Egypt',
  'th': 'Thailand', 'vi': 'Vietnam', 'id': 'Indonesia', 'ms': 'Malaysia',
  'tl': 'Philippines', 'my': 'Myanmar', 'km': 'Cambodia', 'lo': 'Laos'
};

const mapTMDBToTVShow = (tvShow: TMDBTV): TVShow => ({
  id: tvShow.id,
  name: tvShow.name,
  poster_path: tvShow.poster_path,
  vote_average: tvShow.vote_average,
  year: tvShow.first_air_date ? Number(tvShow.first_air_date.slice(0, 4)) : undefined,
  // Tối ưu băng thông: Dùng w342 cho thẻ danh mục
  image: tvShow.poster_path ? `https://image.tmdb.org/t/p/w342${tvShow.poster_path}` : '',
  genre: '',
  first_air_date: tvShow.first_air_date,
  country: countryMap[tvShow.original_language || 'en'] || 'USA',
  totalSeasons: tvShow.number_of_seasons || 0,
  totalEpisodes: tvShow.number_of_episodes || 0,
});

/**
 * Server-side: Fetch first page of TV shows using Cache-Aside pattern.
 * 1. Checks Redis cache first.
 * 2. On Cache MISS, directly fetches from TMDB API server-side, warms Redis, and returns data.
 * Eliminates blank initial HTML and guarantees instant FCP with full SEO benefits.
 */
async function getInitialTVShows(): Promise<TVShow[]> {
  const cacheKey = buildCacheKey('/discover/tv', {
    sort_by: 'popularity.desc',
    page: '1'
  });

  const redis = getRedisClient();

  // 1. Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get<{ results: TMDBTV[] }>(cacheKey);
      if (cached?.results && cached.results.length > 0) {
        return cached.results.map(mapTMDBToTVShow);
      }
    } catch (redisErr) {
      console.warn('⚠️ SSR Redis GET failed, proceeding to direct TMDB fetch:', redisErr);
    }
  }

  // 2. Cache-Aside Fallback: Direct TMDB fetch server-side
  const tmdbKey = process.env.TMDB_API_KEY;
  if (tmdbKey) {
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/discover/tv?api_key=${tmdbKey}&sort_by=popularity.desc&page=1`,
        {
          next: { revalidate: 3600 },
          signal: AbortSignal.timeout(6000), // 6s timeout
        }
      );

      if (res.ok) {
        const json = await res.json();
        if (json?.results && json.results.length > 0) {
          // Warm Redis cache asynchronously in the background
          if (redis) {
            redis.set(cacheKey, json, { ex: CACHE_TTL.DISCOVER }).catch(() => {});
          }
          return json.results.map(mapTMDBToTVShow);
        }
      }
    } catch (fetchErr) {
      console.error('❌ SSR direct TMDB fetch failed:', fetchErr);
    }
  }

  return [];
}

export default async function TVShowsPage() {
  const [messages, initialTVShows] = await Promise.all([
    getMessages(),
    getInitialTVShows()
  ]);

  return (
    <NextIntlClientProvider messages={{ TVShows: messages.TVShows, Watchlist: messages.Watchlist, Filter: messages.Filter }}>
      <TVShowsClient initialTVShows={initialTVShows} />
    </NextIntlClientProvider>
  );
}
