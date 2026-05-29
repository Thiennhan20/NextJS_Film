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

interface Movie {
  id: number;
  title: string;
  poster_path: string;
  year?: number;
  poster?: string;
  description?: string;
  genre?: string;
  director?: string;
  cast?: string[];
  trailer?: string;
}

interface TVShow {
  id: number;
  name: string;
  poster_path: string;
  year?: number;
  poster?: string;
  description?: string;
  genre?: string;
  director?: string;
  cast?: string[];
  trailer?: string;
}

type TrendingItem = (Movie | TVShow) & { 
  image: string; 
  type: 'movie' | 'tv';
  status?: string;
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
};

// Type for TMDB API responses
interface TMDBMovie {
  id: number;
  title: string;
  poster_path?: string;
  vote_average: number;
  release_date?: string;
  original_language?: string;
}

interface TMDBTVShow {
  id: number;
  name: string;
  poster_path?: string;
  vote_average: number;
  first_air_date?: string;
  original_language?: string;
}

// Hàm chuyển đổi language code thành tên quốc gia
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getCountryName = (languageCode?: string): string => {
  const countryMap: { [key: string]: string } = {
    'en': 'USA',
    'ja': 'Japan',
    'ko': 'Korea',
    'zh': 'China',
    'hi': 'India',
    'fr': 'France',
    'de': 'Germany',
    'es': 'Spain',
    'it': 'Italy',
    'pt': 'Brazil',
    'ru': 'Russia',
    'ar': 'Egypt',
    'th': 'Thailand',
    'vi': 'Vietnam',
    'id': 'Indonesia',
    'ms': 'Malaysia',
    'tl': 'Philippines',
    'my': 'Myanmar',
    'km': 'Cambodia',
    'lo': 'Laos'
  };
  return countryMap[languageCode || 'en'] || 'USA';
};

export default function TrendingMovies() {
  const router = useRouter();
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragScrollProps } = useHorizontalDragScroll(scrollRef);
  const t = useTranslations('Trending');

  // Optimized API call with caching
  const fetchTrendingData = useCallback(async () => {
    const [moviesResponse, tvShowsResponse] = await Promise.all([
      axios.get('/api/tmdb-proxy?endpoint=/trending/movie/week'),
      axios.get('/api/tmdb-proxy?endpoint=/trending/tv/week')
    ]);

    const movies = moviesResponse.data.results.slice(0, 10).map((movie: TMDBMovie) => ({
      id: movie.id,
      title: movie.title,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w400${movie.poster_path}` : '',
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : 0,
      type: 'movie' as const,
      status: 'Trending',
      release_date: movie.release_date || '',
      original_language: movie.original_language || 'en'
    }));

    const tvShows = tvShowsResponse.data.results.slice(0, 5).map((tvShow: TMDBTVShow) => ({
      id: tvShow.id,
      name: tvShow.name,
      image: tvShow.poster_path ? `https://image.tmdb.org/t/p/w400${tvShow.poster_path}` : '',
      year: tvShow.first_air_date ? Number(tvShow.first_air_date.slice(0, 4)) : 0,
      type: 'tv' as const,
      status: 'Trending',
      first_air_date: tvShow.first_air_date || '',
      original_language: tvShow.original_language || 'en'
    }));

    return [...movies, ...tvShows];
  }, []);

  const { data: trending = [], loading, error } = useApiCache(
    'trending-movies-tv',
    fetchTrendingData,
    8 * 60 * 60 * 1000 // 8 tiếng
  );

  // Batch prefetch details cho CardWithHover
  useEffect(() => {
    if (trending && trending.length > 0) {
      batchPrefetchDetails(
        trending.map(item => ({ type: item.type, id: item.id }))
      );
    }
  }, [trending]);


  // Scroll functions
  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Optimized scroll position checking with throttling
  const checkScrollPosition = useCallback(() => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  // Optimized scroll position checking with throttling
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledCheckScroll = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        checkScrollPosition();
        throttleTimeout = null;
      }, 16); // ~60fps
    };

    checkScrollPosition();
    container.addEventListener('scroll', throttledCheckScroll, { passive: true });
    window.addEventListener('resize', throttledCheckScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', throttledCheckScroll);
      window.removeEventListener('resize', throttledCheckScroll);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [trending, checkScrollPosition]);


  // Helper function to get title for both movies and TV shows
  const getTitle = (item: TrendingItem) => {
    return 'title' in item ? item.title : item.name;
  };

  // Helper function to get route for both movies and TV shows
  const getRoute = (item: TrendingItem) => {
    return item.type === 'movie' ? `/movies/${item.id}` : `/tvshows/${item.id}`;
  };

  return (
    <section className="py-6 sm:py-8 md:py-10 px-2 sm:px-3 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold mb-3 sm:mb-5 md:mb-6 bg-gradient-to-r from-yellow-400 to-pink-500 text-transparent bg-clip-text text-center leading-tight px-3">
          {t('title')}
        </h2>
        <div className="relative">
          
          {/* Navigation arrows */}
          <motion.button
            onClick={scrollLeft}
            className={`absolute left-1.5 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition-all duration-200 ${
              canScrollLeft ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeftIcon className="w-5 h-5" />
          </motion.button>
          
          <motion.button
            onClick={scrollRight}
            className={`absolute right-1.5 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-black/70 text-white hover:bg-black/90 transition-all duration-200 ${
              canScrollRight ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRightIcon className="w-5 h-5" />
          </motion.button>
        
          {/* Scroll indicator */}
          <div className={`absolute -bottom-2 sm:-bottom-4 md:-bottom-8 left-1/2 transform -translate-x-1/2 z-20 transition-opacity duration-300 ${
            canScrollLeft ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}>
            <div className="flex items-center space-x-1 sm:space-x-2 text-white/60">
              <svg className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="text-xs sm:text-sm font-medium">{t('swipeHint')}</span>
              <svg className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
          
          <div
            ref={scrollRef}
            {...dragScrollProps}
            className="flex gap-4 overflow-x-auto overflow-y-visible pb-3 scrollbar-none snap-x snap-proximity relative horizontal-scroll-container"
            style={{ 
              WebkitOverflowScrolling: 'touch', 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              scrollBehavior: 'smooth'
            }}
          >
            {loading ? (
              <div className="text-gray-400 text-center py-8">{t('loading')}</div>
            ) : error ? (
              <div className="text-red-400 text-center py-8">{t('error')}</div>
            ) : (
              trending?.map((item) => (
                <div key={item.id} className="min-w-[150px] sm:min-w-[190px] md:min-w-[220px] max-w-[220px]">
                  <CardWithHover
                    id={item.id}
                    type={item.type}
                    title={getTitle(item)}
                    posterPath={item.image}
                    onWatchClick={() => router.push(getRoute(item))}
                    onDetailsClick={() => router.push(getRoute(item))}
                  >
                    <Link href={getRoute(item)}>
                      <motion.div
                        whileHover={{ scale: 1.06 }}
                        className="bg-gray-800 rounded-xl overflow-hidden shadow-lg snap-center cursor-pointer group relative"
                      >
                        <div className="w-full h-48 sm:h-60 bg-black flex items-center justify-center overflow-hidden">
                          {item.image ? (
                            <Image
                              src={item.image}
                              alt={getTitle(item)}
                              width={400}
                              height={600}
                              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            />
                          ) : (
                            <div className="text-3xl sm:text-4xl text-gray-500">🎬</div>
                          )}
                        </div>
                        <div className="absolute inset-x-0 bottom-0">
                          <div className="bg-black/70 backdrop-blur-sm px-2 py-1.5 sm:px-3 sm:py-2">
                            <div className="font-medium text-[13px] sm:text-sm text-white truncate">{getTitle(item)}</div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  </CardWithHover>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
