import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import HomePageClient from './HomePageClient';
import type { HeroItem } from '@/components/home/HeroMovies';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

// ISR: Cache trang chủ 5 phút trên Vercel CDN
// Dữ liệu trending cần cập nhật thường xuyên hơn trang chi tiết phim
export const revalidate = 300;

interface TMDBMovie {
  id: number;
  title: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  original_language?: string;
  overview?: string;
}

interface TMDBTVShow {
  id: number;
  name: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  first_air_date?: string;
  original_language?: string;
  overview?: string;
}

interface TMDBListResponse<T> {
  results?: T[];
}

import dns from 'node:dns';

let isSinkholed: boolean | null = null;
async function isTmdbBlocked(): Promise<boolean> {
  if (isSinkholed !== null) return isSinkholed;
  return new Promise((resolve) => {
    dns.lookup('api.themoviedb.org', (err, address) => {
      isSinkholed = !!err || address === '127.0.0.1' || address === '::1';
      resolve(isSinkholed);
    });
  });
}

const BACKEND_TMDB_URL = 'https://server-nextjs-film.onrender.com/api/tmdb';

async function fetchTMDB<T>(endpoint: string): Promise<T | null> {
  const blocked = await isTmdbBlocked();

  // 1. Try direct TMDB first (only if not sinkholed by local ISP)
  if (TMDB_API_KEY && !blocked) {
    try {
      const response = await fetch(`${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(3000),
      });

      if (response.ok) return (await response.json()) as T;
    } catch {
      // Direct TMDB unreachable -> proceed to backend proxy
    }
  }

  // 2. Fallback to Render backend TMDB proxy
  try {
    const response = await fetch(`${BACKEND_TMDB_URL}?endpoint=${encodeURIComponent(endpoint)}`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(8000),
    });

    if (response.ok) return (await response.json()) as T;
  } catch {
    return null;
  }

  return null;
}

async function getInitialHeroItems(): Promise<HeroItem[]> {
  const [moviesResponse, tvShowsResponse] = await Promise.all([
    fetchTMDB<TMDBListResponse<TMDBMovie>>('/trending/movie/week'),
    fetchTMDB<TMDBListResponse<TMDBTVShow>>('/trending/tv/week'),
  ]);

  const movies = (moviesResponse?.results ?? []).slice(0, 3).map((movie) => ({
    id: movie.id,
    title: movie.title,
    image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
    backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : '',
    year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : 0,
    type: 'movie' as const,
    release_date: movie.release_date || '',
    original_language: movie.original_language || 'en',
    description: movie.overview || '',
    vote_average: movie.vote_average || 0,
  }));

  const tvShows = (tvShowsResponse?.results ?? []).slice(0, 2).map((tvShow) => ({
    id: tvShow.id,
    name: tvShow.name,
    image: tvShow.poster_path ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}` : '',
    backdrop: tvShow.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}` : '',
    year: tvShow.first_air_date ? Number(tvShow.first_air_date.slice(0, 4)) : 0,
    type: 'tv' as const,
    first_air_date: tvShow.first_air_date || '',
    original_language: tvShow.original_language || 'en',
    description: tvShow.overview || '',
    vote_average: tvShow.vote_average || 0,
  }));

  return [...movies, ...tvShows] as HeroItem[];
}

export default async function Home() {
  const [messages, initialHeroItems] = await Promise.all([
    getMessages(),
    getInitialHeroItems(),
  ]);
  
  // Only pass translations needed for the home page to the client
  const homeMessages = {
    HomePage: messages.HomePage,
    RecentlyWatched: messages.RecentlyWatched,
    Trending: messages.Trending,
    ComingSoonSection: messages.ComingSoonSection,
    StreamingRooms: messages.StreamingRooms,
    StreamingLobby: messages.StreamingLobby,
    Entertainment: messages.Entertainment,
    Comments: messages.Comments,
    Watchlist: messages.Watchlist,
    Frames: messages.Frames
  };

  return (
    <NextIntlClientProvider messages={homeMessages}>
      <HomePageClient initialHeroItems={initialHeroItems.length ? initialHeroItems : null} />
    </NextIntlClientProvider>
  );
}
