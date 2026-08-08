'use client'

import { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import axios from 'axios'
import Link from 'next/link'
import { PlayIcon, BookmarkIcon, XMarkIcon, ArrowUpRightIcon } from '@heroicons/react/24/outline'
import { BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { useWatchlistStore } from '@/store/store'
import useAuthStore from '@/store/useAuthStore'
import { toast } from 'react-hot-toast'
import api from '@/lib/axios'
import { ChevronDownIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useApiCache } from '@/hooks/useApiCache'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'

interface Movie {
  id: number;
  title: string;
  poster_path: string;
  backdrop_path?: string;
  year?: number;
  poster?: string;
  description?: string;
  genre?: string;
  director?: string;
  cast?: string[];
  trailer?: string;
  vote_average?: number;
}

interface TVShow {
  id: number;
  name: string;
  poster_path: string;
  backdrop_path?: string;
  year?: number;
  poster?: string;
  description?: string;
  genre?: string;
  director?: string;
  cast?: string[];
  trailer?: string;
  vote_average?: number;
}

export type HeroItem = (Movie | TVShow) & {
  image: string; 
  backdrop: string;
  type: 'movie' | 'tv';
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  vote_average?: number;
};

// Type for TMDB API responses
interface TMDBMovie {
  id: number;
  title: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average: number;
  release_date?: string;
  original_language?: string;
  overview?: string;
}

interface TMDBTVShow {
  id: number;
  name: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average: number;
  first_air_date?: string;
  original_language?: string;
  overview?: string;
}

// Hàm chuyển đổi language code thành tên quốc gia
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

// Hàm format ngày tháng năm
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Debounce function
const debounce = (func: (...args: unknown[]) => void, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: unknown[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Component cho mũi tên và hướng dẫn trên Mobile
const MobileTrailerHint = () => {
  const t = useTranslations('HomePage');
  return (
    <motion.div
      className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <ArrowUpRightIcon className="w-3.5 h-3.5 text-white/80" />
      <span className="text-[11px] text-white/80 font-light">{t('tapTrailer')}</span>
    </motion.div>
  );
};

// Component cho mũi tên và hướng dẫn trên Desktop
const DesktopTrailerHint = () => {
  const t = useTranslations('HomePage');
  return (
    <motion.div
      className="absolute bottom-2.5 left-1/2 transform -translate-x-1/2 flex items-center gap-1.5 bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full pointer-events-none transition-all duration-200 group-hover:bg-black/80 group-hover:scale-105 border border-white/10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      <ArrowUpRightIcon className="w-3.5 h-3.5 text-white/90" />
      <span className="text-xs text-white/90 font-medium whitespace-nowrap">{t('clickTrailer')}</span>
    </motion.div>
  );
};

export default function HeroMovies({ initialItems = null }: { initialItems?: HeroItem[] | null }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showTrailer, setShowTrailer] = useState(false);
  const [currentTrailer, setCurrentTrailer] = useState<string>('');
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isMobile, setIsMobile] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const mobileThumbnailsRef = useRef<HTMLDivElement>(null);
  const desktopThumbnailsRef = useRef<HTMLDivElement>(null);
  const { dragScrollProps: mobileThumbnailDragScrollProps } = useHorizontalDragScroll(mobileThumbnailsRef);
  const { dragScrollProps: desktopThumbnailDragScrollProps } = useHorizontalDragScroll(desktopThumbnailsRef);

  const { addToWatchlist, removeFromWatchlist, isInWatchlist, fetchWatchlistFromServer } = useWatchlistStore();
  const { isAuthenticated, token } = useAuthStore();
  const t = useTranslations('HomePage');

  // Fetch hero data with useApiCache (cached 8h, instant on revisit)
  const fetchHeroData = useCallback(async () => {
    const [moviesResponse, tvShowsResponse] = await Promise.all([
      axios.get('/api/tmdb-proxy?endpoint=/trending/movie/week'),
      axios.get('/api/tmdb-proxy?endpoint=/trending/tv/week')
    ]);

    const movies = moviesResponse.data.results.slice(0, 3).map((movie: TMDBMovie) => ({
      id: movie.id,
      title: movie.title,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : '',
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : 0,
      type: 'movie' as const,
      release_date: movie.release_date || '',
      original_language: movie.original_language || 'en',
      description: movie.overview || '',
      vote_average: movie.vote_average || 0
    }));

    const tvShows = tvShowsResponse.data.results.slice(0, 2).map((tvShow: TMDBTVShow) => ({
      id: tvShow.id,
      name: tvShow.name,
      image: tvShow.poster_path ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}` : '',
      backdrop: tvShow.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tvShow.backdrop_path}` : '',
      year: tvShow.first_air_date ? Number(tvShow.first_air_date.slice(0, 4)) : 0,
      type: 'tv' as const,
      first_air_date: tvShow.first_air_date || '',
      original_language: tvShow.original_language || 'en',
      description: tvShow.overview || '',
      vote_average: tvShow.vote_average || 0
    }));

    return [...movies, ...tvShows] as HeroItem[];
  }, []);

  const { data: cachedHeroItems, loading } = useApiCache<HeroItem[]>(
    'home-hero-movies',
    fetchHeroData,
    8 * 60 * 60 * 1000, // 8 tiếng
    initialItems && initialItems.length > 0 ? initialItems : null
  );
  const heroItems = useMemo(() => cachedHeroItems || [], [cachedHeroItems]);

  // Enhanced slider functions with smooth transitions
  const nextSlide = useCallback(() => {
    if (isTransitioning || heroItems.length === 0 || showTrailer) return;
    
    setIsTransitioning(true);
    setCurrentIndex(prev => (prev + 1) % heroItems.length);
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
  }, [heroItems.length, isTransitioning, showTrailer]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || index === currentIndex || showTrailer) return;
    
    setIsTransitioning(true);
    setCurrentIndex(index);
    
    setTimeout(() => {
      setIsTransitioning(false);
    }, 600);
  }, [currentIndex, isTransitioning, showTrailer]);

  // Auto-play functionality - 10s interval
  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(() => {
      if (!isTransitioning && !showTrailer && heroItems.length > 0) {
        nextSlide();
      }
    }, 10000);
  }, [isTransitioning, nextSlide, showTrailer, heroItems.length]);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
  }, []);

  // Mobile detection with debounce
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    const debouncedResize = debounce(checkMobile, 100);
    
    checkMobile();
    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  // Start auto-play when component mounts and items are loaded
  useEffect(() => {
    if (heroItems.length > 0 && !showTrailer) {
      startAutoPlay();
    }
    return () => stopAutoPlay();
  }, [heroItems, startAutoPlay, stopAutoPlay, showTrailer]);

  // Fetch watchlist when component mounts and user is authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchWatchlistFromServer(token);
    }
  }, [isAuthenticated, token, fetchWatchlistFromServer]);

  // Stop auto-play when trailer is shown and restart when closed
  useEffect(() => {
    if (showTrailer) {
      stopAutoPlay();
    } else if (heroItems.length > 0) {
      startAutoPlay();
    }
  }, [showTrailer, heroItems.length, startAutoPlay, stopAutoPlay]);

  // Helper function to get title for both movies and TV shows
  const getTitle = (item: HeroItem) => {
    return 'title' in item ? item.title : item.name;
  };

  // Helper function to get route for both movies and TV shows
  const getRoute = (item: HeroItem) => {
    return item.type === 'movie' ? `/movies/${item.id}` : `/tvshows/${item.id}`;
  };

  // Handle toggle watchlist
  const handleToggleWatchlist = async (item: HeroItem) => {
    if (!isAuthenticated) {
      toast.error(t('needLogin'));
      return;
    }

    try {
      const movieData = {
        id: item.id,
        title: 'title' in item ? item.title : item.name,
        poster_path: item.image,
        type: item.type,
      };

      if (isInWatchlist(item.id)) {
        await api.delete('/auth/watchlist', {
          data: { id: item.id },
        });
        removeFromWatchlist(item.id);
        toast.success(t('removedWatchlist'));
      } else {
        await api.post('/auth/watchlist', movieData);
        addToWatchlist(movieData);
        toast.success(t('addedWatchlist'));
      }
      
      // Đồng bộ lại watchlist từ server
      if (token) await fetchWatchlistFromServer(token);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('errorOccurred'));
      } else {
        toast.error(t('errorOccurred'));
      }
    }
  };

  // Handle trailer functionality
  const handleTrailerClick = async (item: HeroItem) => {
    try {
      // Stop auto-play immediately when trailer is clicked
      stopAutoPlay();
      
      // Fetch trailer from TMDB API
      const response = await axios.get(
        `/api/tmdb-proxy?endpoint=/${item.type}/${item.id}/videos`
      );
      
      const trailers = response.data.results.filter((video: { type: string; site: string }) => 
        video.type === 'Trailer' && video.site === 'YouTube'
      );
      
      if (trailers.length > 0) {
        const trailerKey = trailers[0].key;
        const trailerUrl = `https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0&modestbranding=1`;
        setCurrentTrailer(trailerUrl);
        setShowTrailer(true);
      } else {
        toast.error(t('noTrailer'));
      }
    } catch (error) {
      console.error('Error fetching trailer:', error);
      toast.error(t('failedTrailer'));
    }
  };

  const closeTrailer = () => {
    setShowTrailer(false);
    setCurrentTrailer('');
    // Restart auto-play when trailer is closed
    if (heroItems.length > 0) {
      startAutoPlay();
    }
  };

  if (loading) {
    return (
      <section 
        className="relative min-h-[50vh] md:min-h-[550px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800"
      >
        <motion.div
          className="flex flex-col items-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            <motion.div
              className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <motion.p
            className="text-gray-400 text-base font-medium"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {t('loadingContent')}
          </motion.p>
        </motion.div>
      </section>
    );
  }

  if (!heroItems.length) {
    return (
      <section 
        className="relative min-h-[50vh] md:min-h-[550px] flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800"
      >
        <div className="text-center">
          <h2 className="text-xl text-gray-300 mb-2">{t('noContent')}</h2>
          <p className="text-gray-500 text-sm">{t('checkApi')}</p>
        </div>
      </section>
    );
  }

  const currentItem = heroItems[currentIndex];
  const visibleItems = heroItems; // Show all 5 items in thumbnail row
  const isFirstSlide = currentIndex === 0;
  const currentBackdropUrl = currentItem.backdrop || currentItem.image || '';

  return (
    <section 
      className="relative w-full min-h-[85vh] sm:min-h-screen overflow-hidden flex items-center justify-center pt-16 sm:pt-0"
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}
    >
      {/* Dynamic Background - Pure Opacity Fade Only (NO SCALING/ZOOMING) */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        >
          {currentBackdropUrl ? (
            <Image
              src={currentBackdropUrl}
              alt=""
              fill
              priority={isFirstSlide}
              loading={isFirstSlide ? 'eager' : 'lazy'}
              sizes="100vw"
              className="object-cover object-top sm:object-center"
            />
          ) : (
            <div className="h-full w-full bg-gray-900" />
          )}
          {/* Side shadow for text readability */}
          <div className="absolute inset-y-0 left-0 w-full sm:w-2/3 bg-gradient-to-r from-black/60 via-black/30 to-transparent pointer-events-none" />
          {/* Bottom fade to black */}
          <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-black via-black/40 to-transparent pointer-events-none" />
        </motion.div>
      </AnimatePresence>
      
      <div className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 py-2 overflow-x-hidden">
        {/* Custom CSS to hide scrollbars */}
        <style jsx>{`
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        
        {/* Mobile Layout */}
        <div className="block lg:hidden">
          <motion.div
            className="text-white text-center space-y-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5 }}
                className="space-y-2"
              >
                <h1
                  className="text-lg sm:text-xl font-bold uppercase tracking-tight leading-snug px-4 min-h-[2.25rem] flex items-center justify-center text-center max-w-sm mx-auto [text-wrap:balance]"
                  style={{
                    background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 50%, #ddd 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {getTitle(currentItem)}
                </h1>

                {/* Mobile Meta */}
                <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs flex-wrap mt-0.5">
                  <span className="text-gray-300 text-center">
                    {formatDate(currentItem.release_date || currentItem.first_air_date || '')}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-300 text-center">
                    {getCountryName(currentItem.original_language)}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-300 text-center">
                    {currentItem.type === 'movie' ? `🎬 ${t('movie')}` : `📺 ${t('tvShow')}`}
                  </span>
                </div>

                {/* Mobile Poster (Fixed size, pure opacity fade) */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    className="relative group flex justify-center my-2.5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                  >
                    <div 
                      className="w-32 h-48 sm:w-40 sm:h-56 rounded-xl overflow-hidden shadow-2xl relative cursor-pointer"
                      onClick={() => handleTrailerClick(currentItem)}
                    >
                      <Image
                        src={currentItem.image || '/placeholder-poster.jpg'}
                        alt={getTitle(currentItem)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 128px, 160px"
                        priority={isFirstSlide}
                        loading={isFirstSlide ? 'eager' : 'lazy'}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      <MobileTrailerHint />
                    </div>
                  </motion.div>
                </AnimatePresence>

                <div className="flex items-center justify-center gap-2 px-4 pt-1">
                  <Link href={getRoute(currentItem)} className="w-auto">
                    <button className="flex items-center justify-center gap-1.5 px-3.5 py-1.5 bg-yellow-500 hover:bg-yellow-600 rounded-full font-bold text-black text-xs sm:text-sm shadow-lg transition-colors">
                      <PlayIcon className="w-3.5 h-3.5" />
                      {t('watch')}
                    </button>
                  </Link>
                  <button
                    onClick={() => handleToggleWatchlist(currentItem)}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-full font-semibold text-xs sm:text-sm transition-colors ${
                      isInWatchlist(currentItem.id)
                        ? 'bg-amber-700 text-white hover:bg-amber-800'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {isInWatchlist(currentItem.id) ? (
                      <BookmarkSolidIcon className="w-3.5 h-3.5" />
                    ) : (
                      <BookmarkIcon className="w-3.5 h-3.5" />
                    )}
                    {isInWatchlist(currentItem.id) ? t('added') : t('save')}
                  </button>
                </div>

                {/* Mobile Thumbnails - Circular Avatars */}
                <div
                  ref={mobileThumbnailsRef}
                  {...mobileThumbnailDragScrollProps}
                  className="horizontal-scroll-container flex items-center justify-center gap-3 px-4 py-4 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
                >
                  {visibleItems.map((item, index) => (
                    <button
                      key={item.id}
                      className={`relative flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full transition-all duration-300 snap-center snap-always cursor-pointer p-0.5 ${
                        index === currentIndex 
                          ? 'ring-1.5 ring-red-500/60 scale-105 shadow-[0_0_10px_rgba(239,68,68,0.35)] z-10' 
                          : 'opacity-60 hover:opacity-90 hover:scale-105'
                      }`}
                      onClick={() => goToSlide(index)}
                    >
                      <div className={`relative w-full h-full rounded-full overflow-hidden transition-colors ${
                        index === currentIndex ? 'border border-red-500/40' : 'border border-white/20'
                      }`}>
                        <Image
                          src={item.image || '/placeholder-poster.jpg'}
                          alt={getTitle(item)}
                          fill
                          className="object-cover"
                          sizes="64px"
                          loading="lazy"
                        />
                        {index === currentIndex && (
                          <div className="absolute inset-0 bg-red-500/5 rounded-full" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Desktop Layout - Sleek, Compact & Fixed (NO AUTO SCALING) */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-6 items-center min-h-[380px] lg:min-h-[420px]">
          
          {/* Left Side - Main Content */}
          <motion.div
            className="text-white space-y-2.5 lg:pl-10"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.5 }}
                className="space-y-2"
              >
                {/* Title - Compact & Sleek */}
                <h1
                  className="text-xl sm:text-2xl lg:text-3xl font-bold uppercase tracking-tight leading-snug max-w-md flex items-center [text-wrap:balance]"
                  style={{
                    background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 50%, #ddd 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}
                >
                  {getTitle(currentItem)}
                </h1>

                {/* Meta Info */}
                <div className="flex items-center gap-2.5 text-xs sm:text-sm text-gray-300">
                  <span>
                    {formatDate(currentItem.release_date || currentItem.first_air_date || '')}
                  </span>
                  <span>•</span>
                  <span>
                    {getCountryName(currentItem.original_language)}
                  </span>
                  <span>•</span>
                  <span>
                    {currentItem.type === 'movie' ? `🎬 ${t('movie')}` : `📺 ${t('tvShow')}`}
                  </span>
                </div>

                {/* Action Buttons - Compact */}
                <div className="flex items-center gap-2.5 pt-1">
                  <Link href={getRoute(currentItem)}>
                    <button className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-full font-bold text-black text-xs sm:text-sm shadow-md transition-colors">
                      <PlayIcon className="w-4 h-4" />
                      {t('watchNow')}
                    </button>
                  </Link>
                  
                  <button
                    onClick={() => handleToggleWatchlist(currentItem)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-xs sm:text-sm transition-colors ${
                      isInWatchlist(currentItem.id)
                        ? 'bg-amber-700 text-white hover:bg-amber-800'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                  >
                    {isInWatchlist(currentItem.id) ? (
                      <BookmarkSolidIcon className="w-4 h-4" />
                    ) : (
                      <BookmarkIcon className="w-4 h-4" />
                    )}
                    {isInWatchlist(currentItem.id) ? t('addedToList') : t('saveToList')}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Right Side - Compact Poster & Thumbnails (Pure Opacity Fade Only, NO Scale Zooming) */}
          <div className="flex flex-col items-center space-y-3">
            {/* Main Poster - Sleek & Compact */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                className="relative group"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.5 }}
              >
                <div 
                  className="w-44 h-60 lg:w-48 lg:h-64 xl:w-52 xl:h-70 rounded-xl overflow-hidden shadow-2xl relative cursor-pointer border border-white/10"
                  onClick={() => handleTrailerClick(currentItem)}
                >
                  <Image
                    src={currentItem.image || '/placeholder-poster.jpg'}
                    alt={getTitle(currentItem)}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, 220px"
                    priority={isFirstSlide}
                    loading={isFirstSlide ? 'eager' : 'lazy'}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  {/* Desktop Trailer Hint */}
                  <DesktopTrailerHint />
                </div>
                
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-red-500/15 to-pink-500/15 blur-lg -z-10 opacity-50" />
              </motion.div>
            </AnimatePresence>

            {/* Circular Story-Style Thumbnail Navigation */}
            <div
              ref={desktopThumbnailsRef}
              {...desktopThumbnailDragScrollProps}
              className="horizontal-scroll-container flex items-center gap-3.5 max-w-full overflow-x-auto py-4 px-3 scrollbar-hide snap-x snap-mandatory"
            >
              {visibleItems.map((item, index) => (
                <button
                  key={item.id}
                  className={`relative flex-shrink-0 w-14 h-14 lg:w-16 lg:h-16 rounded-full transition-all duration-300 snap-center snap-always cursor-pointer p-0.5 ${
                    index === currentIndex 
                      ? 'ring-1.5 ring-red-500/60 scale-105 shadow-[0_0_12px_rgba(239,68,68,0.35)] z-10' 
                      : 'opacity-60 hover:opacity-90 hover:scale-105'
                  }`}
                  onClick={() => goToSlide(index)}
                >
                  <div className={`relative w-full h-full rounded-full overflow-hidden transition-colors ${
                    index === currentIndex ? 'border border-red-500/40' : 'border border-white/20'
                  }`}>
                    <Image
                      src={item.image || '/placeholder-poster.jpg'}
                      alt={getTitle(item)}
                      fill
                      className="object-cover"
                      sizes="64px"
                      loading="lazy"
                    />
                    {index === currentIndex && (
                      <div className="absolute inset-0 bg-red-500/5 rounded-full" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Mobile Scroll Down Indicator */}
        <div
          className="lg:hidden flex flex-col items-center gap-0.5 cursor-pointer mt-3"
          onClick={() => {
            window.scrollTo({ 
              top: window.innerHeight, 
              behavior: 'smooth' 
            });
          }}
        >
          <p className="text-gray-400 text-[10px] font-light">
            {t('scrollExplore')}
          </p>
          <div className="flex flex-col items-center -space-y-1.5 animate-bounce">
            <ChevronDownIcon className="w-3.5 h-3.5 text-red-500" />
            <ChevronDownIcon className="w-3.5 h-3.5 text-red-500" />
          </div>
        </div>
      </div>
      
      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={closeTrailer}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="relative w-full max-w-4xl mx-4 aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={closeTrailer}
                className="absolute top-4 right-4 z-10 w-9 h-9 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              
              <iframe
                src={currentTrailer}
                title="Movie Trailer"
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}
