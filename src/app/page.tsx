import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import HomePageClient from './HomePageClient';
import type { HeroItem } from '@/components/home/HeroMovies';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

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

async function fetchTMDB<T>(endpoint: string): Promise<T | null> {
  if (!TMDB_API_KEY) return null;

  try {
    const response = await fetch(`${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) return null;
    return response.json() as Promise<T>;
  } catch {
    return null;
  }
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
