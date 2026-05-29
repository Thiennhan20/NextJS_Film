'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import axios from 'axios'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useApiCache } from '@/hooks/useApiCache'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'
import CardWithHover, { batchPrefetchDetails } from '@/components/common/CardWithHover'
import { useTranslations } from 'next-intl'

interface MovieItem {
  id: number;
  title?: string;
  name?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: 'movie' | 'tv';
}

const CATEGORY = {
  id: 'usuk',
  titleKey: 'usukMovies',
  defaultTitle: 'Phim US-UK',
  color: 'from-blue-600 to-indigo-600',
};

export default function USUKFrame() {
  const router = useRouter();
  const t = useTranslations('Frames');
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragScrollProps } = useHorizontalDragScroll(scrollRef);

  const fetchData = useCallback(async () => {
    const [moviesRes, tvRes] = await Promise.all([
      axios.get(`/api/tmdb-proxy?endpoint=${encodeURIComponent('/discover/movie?with_original_language=en&region=US&sort_by=popularity.desc')}`),
      axios.get(`/api/tmdb-proxy?endpoint=${encodeURIComponent('/discover/tv?with_original_language=en&with_origin_country=US|GB&sort_by=popularity.desc')}`)
    ]);
    
    const movies = moviesRes.data.results.slice(0, 8).map((m: MovieItem) => ({ ...m, media_type: 'movie' }));
    const tvShows = tvRes.data.results.slice(0, 7).map((t: MovieItem) => ({ ...t, media_type: 'tv' }));
    
    const combined = [];
    for (let i = 0; i < 8; i++) {
      if (movies[i]) combined.push(movies[i]);
      if (tvShows[i]) combined.push(tvShows[i]);
    }
    
    return combined as MovieItem[];
  }, []);

  const { data: items, loading, error } = useApiCache<MovieItem[]>(
    'home-usuk-frame',
    fetchData,
    8 * 60 * 60 * 1000 // 8 tiếng
  );

  // Batch prefetch details cho CardWithHover
  useEffect(() => {
    if (items && items.length > 0) {
      batchPrefetchDetails(
        items.map(item => ({ type: item.media_type || 'movie', id: item.id }))
      );
    }
  }, [items]);

  const scrollLeft = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
  };

  const scrollRight = () => {
    if (scrollRef.current) scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
  };

  const checkScrollPosition = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleScroll = () => checkScrollPosition();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    setTimeout(checkScrollPosition, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, [checkScrollPosition, items]);

  const getRoute = (item: MovieItem) => item.media_type === 'movie' ? `/movies/${item.id}` : `/tvshows/${item.id}`;
  const getTitle = (item: MovieItem) => item.title || item.name || 'Unknown';
  const getYear = (item: MovieItem) => {
    const date = item.release_date || item.first_air_date;
    return date ? date.slice(0, 4) : '';
  };

  if (error) return null;
  if (loading && !items) return null;
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-10 sm:mb-12">
      <div className="flex items-center gap-3 mb-4 px-3">
        <div className={`w-1.5 h-6 sm:h-8 rounded-full bg-gradient-to-b ${CATEGORY.color}`} />
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
          {t('usukTitle')}
        </h3>
      </div>
      
      <div className="relative group/row">
        {/* Navigation arrows */}
        <motion.button
          onClick={scrollLeft}
          className={`absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/80 text-white backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all duration-300 shadow-2xl ${
            canScrollLeft ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>
        
        <motion.button
          onClick={scrollRight}
          className={`absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/80 text-white backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all duration-300 shadow-2xl ${
            canScrollRight ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          <ChevronRightIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>

        <div
          ref={scrollRef}
          {...dragScrollProps}
          className="horizontal-scroll-container flex gap-3 sm:gap-4 overflow-x-auto overflow-y-visible pb-4 pt-2 scrollbar-none snap-x snap-proximity px-3"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {items.map((item) => (
            <div key={item.id} className="min-w-[140px] sm:min-w-[160px] md:min-w-[180px] max-w-[180px] snap-start">
              <CardWithHover
                id={item.id}
                type={item.media_type || 'movie'}
                title={getTitle(item)}
                posterPath={item.poster_path ? `https://image.tmdb.org/t/p/w400${item.poster_path}` : ''}
                onWatchClick={() => router.push(getRoute(item))}
                onDetailsClick={() => router.push(getRoute(item))}
              >
                <Link href={getRoute(item)}>
                  <motion.div
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="relative rounded-xl overflow-hidden shadow-lg cursor-pointer group bg-gray-900 border border-white/5"
                  >
                    <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center relative overflow-hidden">
                      {item.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w400${item.poster_path}`}
                          alt={getTitle(item)}
                          fill
                          sizes="(max-width: 640px) 140px, (max-width: 768px) 160px, 180px"
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                      ) : (
                        <div className="text-3xl text-gray-600">🎬</div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                      
                    </div>
                    
                    <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <h4 className="text-white font-semibold text-sm sm:text-base line-clamp-1 drop-shadow-md">
                        {getTitle(item)}
                      </h4>
                      <p className="text-gray-300 text-xs mt-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                        {getYear(item)} • {item.media_type === 'movie' ? t('movieLabel') : t('tvShowLabel')}
                      </p>
                    </div>
                  </motion.div>
                </Link>
              </CardWithHover>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
