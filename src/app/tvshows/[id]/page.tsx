import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import TVShowDetailClient from './TVShowDetailClient';
import { Metadata } from 'next';

const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function getTVShowData(id: string) {
  if (!TMDB_API_KEY) return null;
  try {
    const res = await fetch(`${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}`, {
      next: { revalidate: 3600 } // cache for 1 hour
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (error) {
    console.error('Error fetching TV show metadata:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const resolvedParams = await params;
  const show = await getTVShowData(resolvedParams.id);
  
  if (!show) {
    return {
      title: 'Xem Phim HD Vietsub',
      description: 'Xem phim truyền hình HD Vietsub online chất lượng cao, cập nhật liên tục.'
    };
  }

  const title = `${show.name || show.original_name} - Xem Phim HD Vietsub`;
  const overview = show.overview || 'Xem phim truyền hình HD Vietsub online chất lượng cao.';
  const posterUrl = show.poster_path 
    ? `https://image.tmdb.org/t/p/w500${show.poster_path}` 
    : '';

  return {
    title,
    description: overview,
    openGraph: {
      title,
      description: overview,
      images: posterUrl ? [{ url: posterUrl }] : [],
      type: 'video.tv_show',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: overview,
      images: posterUrl ? [posterUrl] : [],
    }
  };
}

export default async function TVShowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={{ TVShows: messages.TVShows, Watch: messages.Watch, Comments: messages.Comments, Watchlist: messages.Watchlist, StreamingLobby: messages.StreamingLobby }}>
      <TVShowDetailClient params={params} />
    </NextIntlClientProvider>
  );
}

