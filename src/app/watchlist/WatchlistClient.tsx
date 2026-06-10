'use client';

import { useWatchlistStore } from '@/store/store';
import useAuthStore from '@/store/useAuthStore';
import useAuthHydrated from '@/store/useAuthHydrated';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { FaBookmark } from 'react-icons/fa';
import { useRouter } from 'next/navigation';
import { memo, useMemo } from 'react';
import { useTranslations } from 'next-intl';

// Lazy load components để giảm initial bundle size
const CardWithHover = dynamic(() => import('@/components/common/CardWithHover'), {
  ssr: false,
  loading: () => <div className="aspect-[2/3] bg-gray-800 animate-pulse rounded-lg" />
});

const MotionDiv = dynamic(() => import('framer-motion').then(mod => mod.motion.div), { 
  ssr: false,
  loading: () => <div />
});

// Memoized WatchlistItem để tránh re-render không cần thiết
const WatchlistItem = memo(function WatchlistItem({ 
  movie, 
  onWatchClick 
}: { 
  movie: { id: number; title: string; poster_path: string; type?: 'movie' | 'tv' }
  onWatchClick: () => void 
}) {
  const itemType = movie.type || 'movie';
  
  return (
    <MotionDiv
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <CardWithHover
        id={movie.id}
        type={itemType}
        title={movie.title}
        posterPath={movie.poster_path}
        onWatchClick={onWatchClick}
      >
        <Link href={itemType === 'tv' ? `/tvshows/${movie.id}` : `/movies/${movie.id}`} className="block">
          <div className="relative group bg-gray-800 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 border border-yellow-700/50 overflow-hidden cursor-pointer">
            <div className="aspect-[2/3] relative rounded-t-lg overflow-hidden">
              <Image
                src={movie.poster_path}
                alt={movie.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-110"
                loading="lazy"
                quality={75}
                sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 20vw, (max-width: 1280px) 16vw, (max-width: 1536px) 14vw, 12vw"
              />
              {movie.type === 'tv' && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  TV
                </div>
              )}
            </div>
            <div className="p-2">
              <h3 className="text-yellow-300 font-medium truncate text-xs text-center">{movie.title}</h3>
            </div>
          </div>
        </Link>
      </CardWithHover>
    </MotionDiv>
  );
});

export default function WatchlistPage() {
  const hydrated = useAuthHydrated();
  const { watchlist } = useWatchlistStore();
  const { isAuthenticated, isAuthChecked } = useAuthStore();
  const router = useRouter();
  const t = useTranslations('WatchlistPage');

  // Memoize handlers để tránh tạo function mới mỗi lần render
  const handleWatchClick = useMemo(() => {
    return (id: number, type: 'movie' | 'tv') => {
      const route = type === 'tv' ? `/tvshows/${id}` : `/movies/${id}`;
      router.push(route);
    };
  }, [router]);

  if (!hydrated || !isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-pulse">
          <div className="h-8 w-48 bg-gray-800 rounded mb-4" />
          <div className="h-4 w-32 bg-gray-800 rounded" />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center p-8 rounded-xl shadow-2xl bg-gradient-to-br from-red-900/80 to-black/80 border border-yellow-600">
          <h1 className="text-2xl font-bold text-yellow-400 mb-4">{t('loginRequired')}</h1>
          <Link
            href="/login"
            className="inline-block bg-yellow-600 text-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-700 transition-colors transform hover:scale-105 shadow-lg"
          >
            {t('login')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 md:p-8 bg-black">
      {watchlist.length === 0 ? (
        <div className="text-center text-gray-400 p-6 rounded-xl shadow-xl bg-gradient-to-br from-red-900/60 to-black/60 border border-yellow-700 mx-auto max-w-md">
          <FaBookmark className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
          <p className="text-lg text-yellow-200">{t('emptyWatchlist')}</p>
          <p className="text-sm text-gray-300 mt-2">{t('emptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2 sm:gap-3 md:gap-4">
          {watchlist.map((movie) => (
            <WatchlistItem
              key={movie.id}
              movie={movie}
              onWatchClick={() => handleWatchClick(movie.id, movie.type || 'movie')}
            />
          ))}
        </div>
      )}
    </div>
  );
} 