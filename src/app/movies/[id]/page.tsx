import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import MovieDetailClient from './MovieDetailClient';
import { Metadata } from 'next';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getMovieData(id: string) {
  if (!TMDB_API_KEY) return null;
  try {
    const res = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}`, {
      next: { revalidate: 3600 } // cache for 1 hour
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error fetching movie metadata:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const movie = await getMovieData(resolvedParams.id);
  
  if (!movie) {
    return {
      title: 'Xem Phim HD Vietsub',
      description: 'Xem phim HD Vietsub online chất lượng cao, cập nhật liên tục các bộ phim mới nhất.'
    };
  }

  const title = `${movie.title || movie.original_title} - Xem Phim HD Vietsub`;
  const overview = movie.overview || 'Xem phim HD Vietsub online chất lượng cao.';
  const posterUrl = movie.poster_path 
    ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` 
    : '';

  return {
    title,
    description: overview,
    openGraph: {
      title,
      description: overview,
      images: posterUrl ? [{ url: posterUrl }] : [],
      type: 'video.movie',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: overview,
      images: posterUrl ? [posterUrl] : [],
    }
  };
}

export default async function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ Movies: messages.Movies, Watch: messages.Watch, Comments: messages.Comments, Watchlist: messages.Watchlist, StreamingLobby: messages.StreamingLobby }}>
      <MovieDetailClient params={params} />
    </NextIntlClientProvider>
  );
}

