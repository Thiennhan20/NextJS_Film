import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import MoviesClient from './MoviesClient';
import { getRedisClient, buildCacheKey, CACHE_TTL } from '@/lib/redis';

// Movie type matching TMDB API response
interface TMDBMovie {
  id: number;
  title: string;
  poster_path: string;
  vote_average: number;
  release_date?: string;
  original_language?: string;
  genre_ids?: number[];
}

interface Movie {
  id: number;
  title: string;
  poster_path: string;
  image?: string;
  year?: number;
  genre?: string;
  release_date?: string;
  country?: string;
  vote_average?: number;
}

const countryMap: { [key: string]: string } = {
  'en': 'USA', 'ja': 'Japan', 'ko': 'Korea', 'zh': 'China',
  'hi': 'India', 'fr': 'France', 'de': 'Germany', 'es': 'Spain',
  'it': 'Italy', 'pt': 'Brazil', 'ru': 'Russia', 'ar': 'Egypt',
  'th': 'Thailand', 'vi': 'Vietnam', 'id': 'Indonesia', 'ms': 'Malaysia',
  'tl': 'Philippines', 'my': 'Myanmar', 'km': 'Cambodia', 'lo': 'Laos'
};

const mapTMDBToMovie = (movie: TMDBMovie): Movie => ({
  id: movie.id,
  title: movie.title,
  poster_path: movie.poster_path,
  vote_average: movie.vote_average,
  year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : undefined,
  // Tối ưu băng thông: Dùng w342 cho thẻ danh mục
  image: movie.poster_path ? `https://image.tmdb.org/t/p/w342${movie.poster_path}` : '',
  genre: '',
  release_date: movie.release_date,
  country: countryMap[movie.original_language || 'en'] || 'USA',
});

/**
 * Server-side: Fetch first page of movies using Cache-Aside pattern.
 * 1. Checks Redis cache first.
 * 2. On Cache MISS, directly fetches from TMDB API server-side, warms Redis, and returns data.
 * Eliminates blank initial HTML and guarantees instant FCP with full SEO benefits.
 */
async function getInitialMovies(): Promise<Movie[]> {
  const cacheKey = buildCacheKey('/discover/movie', {
    sort_by: 'popularity.desc',
    page: '1'
  });

  const redis = getRedisClient();

  // 1. Try Redis cache first
  if (redis) {
    try {
      const cached = await redis.get<{ results: TMDBMovie[] }>(cacheKey);
      if (cached?.results && cached.results.length > 0) {
        return cached.results.map(mapTMDBToMovie);
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
        `https://api.themoviedb.org/3/discover/movie?api_key=${tmdbKey}&sort_by=popularity.desc&page=1`,
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
          return json.results.map(mapTMDBToMovie);
        }
      }
    } catch (fetchErr) {
      console.error('❌ SSR direct TMDB fetch failed:', fetchErr);
    }
  }

  return [];
}

export default async function MoviesPage() {
  const [messages, initialMovies] = await Promise.all([
    getMessages(),
    getInitialMovies()
  ]);

  return (
    <NextIntlClientProvider messages={{ Movies: messages.Movies, Watchlist: messages.Watchlist, Filter: messages.Filter }}>
      <MoviesClient initialMovies={initialMovies} />
    </NextIntlClientProvider>
  );
}
