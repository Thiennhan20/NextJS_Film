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
    className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex items-center gap-1 bg-black/60 backdrop-blur-sm px-2 py-1 rounded-full"
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
  >
    <ArrowUpRightIcon className="w-4 h-4 text-white/80" />
    <span className="text-xs text-white/80 font-light">{t('tapTrailer')}</span>
  </motion.div>
);
};

// Component cho mũi tên và hướng dẫn trên Desktop
const DesktopTrailerHint = () => {
  const t = useTranslations('HomePage');
  return (
  <motion.div
    className="absolute left-full ml-4 top-1/2 -translate-y-1/2 flex items-center gap-2"
    initial={{ opacity: 0, x: 10 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.5, delay: 0.3 }}
  >
    <ArrowUpRightIcon className="w-5 h-5 text-white/80" />
    <span className="text-sm text-white/80 font-light">{t('clickTrailer')}</span>
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
  const [contentScale, setContentScale] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
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

  // Auto-play functionality - Increased interval to 10s
  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(() => {
      if (!isTransitioning && !showTrailer && heroItems.length > 0) {
        nextSlide();
      }
    }, 10000); // Increased from 8s to 10s for better performance
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
    
    // Debounced resize handler
    const debouncedResize = debounce(checkMobile, 100);
    
    checkMobile();
    window.addEventListener('resize', debouncedResize);
    
    return () => {
      window.removeEventListener('resize', debouncedResize);
    };
  }, []);

  // Auto-scale content when it gets close to header
  useEffect(() => {
    const checkContentOverflow = () => {
      if (!contentRef.current) return;

      const contentRect = contentRef.current.getBoundingClientRect();
      const headerHeight = 64; // 4rem = 64px (navigation height)
      const safeZone = 20; // 20px buffer zone
      const minTopPosition = headerHeight + safeZone;

      // Calculate how much content is overlapping with header
      if (contentRect.top < minTopPosition) {
        // Calculate scale factor based on overlap
        const overlap = minTopPosition - contentRect.top;
        const maxOverlap = 100; // Maximum expected overlap
        const scaleReduction = Math.min(overlap / maxOverlap, 0.15); // Max 15% reduction
        const newScale = 1 - scaleReduction;
        setContentScale(Math.max(newScale, 0.85)); // Minimum scale 85%
      } else {
        setContentScale(0.85); // Keep at 85% instead of resetting to full scale
      }
    };

    // Check on mount and resize (increased debounce to reduce layout thrashing)
    checkContentOverflow();
    const debouncedCheck = debounce(checkContentOverflow, 200);
    
    window.addEventListener('resize', debouncedCheck);
    window.addEventListener('scroll', debouncedCheck, { passive: true } as AddEventListenerOptions);

    return () => {
      window.removeEventListener('resize', debouncedCheck);
      window.removeEventListener('scroll', debouncedCheck);
    };
  }, [currentIndex, heroItems]);


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
        className="relative min-h-[60vh] md:min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800"
      >
        <motion.div
          className="flex flex-col items-center space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="relative">
            <motion.div
              className="w-16 h-16 border-4 border-red-500/20 border-t-red-500 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
          <motion.p
            className="text-gray-400 text-lg font-medium"
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
        className="relative min-h-[60vh] md:min-h-[calc(100vh-4rem)] flex items-center justify-center overflow-hidden bg-gradient-to-br from-gray-900 via-black to-gray-800"
      >
        <div className="text-center">
          <h2 className="text-2xl text-gray-300 mb-4">{t('noContent')}</h2>
          <p className="text-gray-500">{t('checkApi')}</p>
        </div>
      </section>
    );
  }

  const currentItem = heroItems[currentIndex];
  const visibleItems = heroItems; // Show all 5 items in thumbnail row
  const isFirstSlide = currentIndex === 0;
  const currentBackdropUrl = currentItem.backdrop || currentItem.image || '';

  return (
    <>
    <section 
      className="relative w-full min-h-[60vh] max-h-[60vh] md:min-h-[calc(100vh-4rem)] md:max-h-[calc(100vh-4rem)] overflow-hidden flex items-center justify-center"
      onMouseEnter={stopAutoPlay}
      onMouseLeave={startAutoPlay}
    >
      {/* Dynamic Background with Parallax Effect */}
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          className="absolute inset-0"
          initial={{ opacity: 0, scale: 1.02 }}
          animate={{ opacity: 1, scale: 1.0 }}
          exit={{ opacity: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: "easeInOut" }}
        >
          {currentBackdropUrl ? (
            <Image
              src={currentBackdropUrl}
              alt=""
              fill
              priority={isFirstSlide}
              loading={isFirstSlide ? 'eager' : 'lazy'}
              sizes="100vw"
              className="object-cover object-center"
            />
          ) : (
            <div className="h-full w-full bg-gray-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40" />
        </motion.div>
      </AnimatePresence>
      
      <div 
        ref={contentRef}
        className="relative z-10 w-full max-w-7xl mx-auto px-4 py-2 sm:py-4 overflow-x-hidden transition-transform duration-300 ease-out"
        style={{ 
          transform: `scale(${contentScale})`,
          transformOrigin: 'center center'
        }}
      >
        {/* Custom CSS to hide scrollbars */}
        <style jsx>{`
          .scrollbar-hide {
            -ms-overflow-style: none;  /* Internet Explorer 10+ */
            scrollbar-width: none;  /* Firefox */
          }
          .scrollbar-hide::-webkit-scrollbar {
            display: none;  /* Safari and Chrome */
          }
        `}</style>
        
        {/* Mobile Layout */}
        <div className="block lg:hidden">
          <motion.div
            className="text-white text-center space-y-4"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6 }}
                className="space-y-2"
              >
                <motion.h1
                  className="text-lg sm:text-xl md:text-2xl font-bold uppercase tracking-tight leading-tight px-4 min-h-[2.5rem] sm:min-h-[3rem] flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 50%, #ddd 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  {getTitle(currentItem)}
                </motion.h1>

                {/* Mobile Meta */}
                <div className="flex items-center justify-center gap-2 text-[11px] sm:text-xs flex-wrap mt-1">
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

                {/* Mobile Poster */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentIndex}
                    className="relative group flex justify-center my-3"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div 
                      className="w-36 h-52 sm:w-44 sm:h-60 md:w-56 md:h-72 rounded-2xl overflow-hidden shadow-2xl relative cursor-pointer transition-transform duration-300 hover:scale-105"
                      onClick={() => handleTrailerClick(currentItem)}
                    >
                      <Image
                        src={currentItem.image || '/placeholder-poster.jpg'}
                        alt={getTitle(currentItem)}
                        fill
                        className="object-cover"
                        sizes="(max-width: 640px) 144px, (max-width: 768px) 176px, 224px"
                        priority={isFirstSlide}
                        loading={isFirstSlide ? 'eager' : 'lazy'}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                      {/* Mobile Trailer Hint */}
                      <MobileTrailerHint />
                    </div>
                  </motion.div>
                </AnimatePresence>

                <motion.div
                  className="flex items-center justify-center gap-2.5 px-4 pt-1"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.4 }}
                >
                  <Link href={getRoute(currentItem)} className="w-auto">
                    <motion.button
                      className="flex items-center justify-center gap-1.5 px-3.5 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-full font-bold text-black text-sm shadow-lg transition-all duration-300"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <PlayIcon className="w-4 h-4" />
                      {t('watch')}
                    </motion.button>
                  </Link>
                  
                  <motion.button
                    onClick={() => handleToggleWatchlist(currentItem)}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full font-semibold text-sm transition-all duration-300 ${
                      isInWatchlist(currentItem.id)
                        ? 'bg-amber-700 text-white hover:bg-amber-800'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {isInWatchlist(currentItem.id) ? (
                      <BookmarkSolidIcon className="w-4 h-4" />
                    ) : (
                      <BookmarkIcon className="w-4 h-4" />
                    )}
                    {isInWatchlist(currentItem.id) ? t('added') : t('save')}
                  </motion.button>
                </motion.div>

                {/* Mobile Thumbnails */}
                <div
                  ref={mobileThumbnailsRef}
                  {...mobileThumbnailDragScrollProps}
                  className="horizontal-scroll-container flex items-center justify-center gap-1.5 px-4 pt-1.5 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory"
                >
                  {visibleItems.map((item, index) => (
                    <motion.button
                      key={item.id}
                      className={`relative flex-shrink-0 w-10 h-14 sm:w-12 sm:h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 snap-center snap-always ${
                        index === currentIndex 
                          ? 'border-red-500 shadow-lg shadow-red-500/30' 
                          : 'border-white/20'
                      }`}
                      onClick={() => goToSlide(index)}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Image
                        src={item.image || '/placeholder-poster.jpg'}
                        alt={getTitle(item)}
                        fill
                        className="object-cover"
                        sizes="48px"
                        loading="lazy"
                      />
                      {index === currentIndex && (
                        <motion.div
                          className="absolute inset-0 bg-red-500/20"
                          layoutId="activeThumbMobile"
                        />
                      )}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-2 gap-8 items-center min-h-[600px]">
          
          {/* Left Side - Main Content */}
          <motion.div
            className="text-white space-y-4"
            initial={{ opacity: 0, x: -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -30 }}
                transition={{ duration: 0.6 }}
                className="space-y-3"
              >
                {/* Title */}
                <motion.h1
                  className="text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold uppercase tracking-tight leading-tight min-h-[5rem] lg:min-h-[6rem] xl:min-h-[7rem] 2xl:min-h-[8rem] flex items-center"
                  style={{
                    background: 'linear-gradient(135deg, #fff 0%, #f0f0f0 50%, #ddd 100%)',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
                  }}
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.3 }}
                >
                  {getTitle(currentItem)}
                </motion.h1>

                {/* Meta Info */}
                <div className="flex items-center gap-4 text-sm mt-2">
                  <span className="text-gray-300">
                    {formatDate(currentItem.release_date || currentItem.first_air_date || '')}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-300">
                    {getCountryName(currentItem.original_language)}
                  </span>
                  <span className="text-gray-300">•</span>
                  <span className="text-gray-300">
                    {currentItem.type === 'movie' ? `🎬 ${t('movie')}` : `📺 ${t('tvShow')}`}
                  </span>
                </div>


                {/* Action Buttons */}
                <motion.div
                  className="flex items-center gap-4 pt-2"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.8, delay: 0.5 }}
                >
                  <Link href={getRoute(currentItem)}>
                    <motion.button
                      className="flex items-center gap-3 px-6 py-3 bg-yellow-500 hover:bg-yellow-600 rounded-full font-bold text-black shadow-xl transition-all duration-300"
                      whileHover={{ scale: 1.05}}
                      whileTap={{ scale: 0.95 }}
                    >
                      <PlayIcon className="w-5 h-5" />
                      {t('watchNow')}
                    </motion.button>
                  </Link>
                  
                  <motion.button
                    onClick={() => handleToggleWatchlist(currentItem)}
                    className={`flex items-center gap-3 px-6 py-3 rounded-full font-semibold text-base transition-all duration-300 ${
                      isInWatchlist(currentItem.id)
                        ? 'bg-amber-700 text-white hover:bg-amber-800'
                        : 'bg-gray-700 hover:bg-gray-600 text-white'
                    }`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isInWatchlist(currentItem.id) ? (
                      <BookmarkSolidIcon className="w-5 h-5" />
                    ) : (
                      <BookmarkIcon className="w-5 h-5" />
                    )}
                    {isInWatchlist(currentItem.id) ? t('addedToList') : t('saveToList')}
                  </motion.button>
                </motion.div>
              </motion.div>
            </AnimatePresence>
          </motion.div>

          {/* Right Side - Poster and Thumbnails */}
          <motion.div
            className="flex flex-col items-center space-y-4"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            {/* Main Poster */}
            <AnimatePresence mode="wait">
              <motion.div
                key={currentIndex}
                className="relative group"
                initial={{ opacity: 0, rotateY: 90 }}
                animate={{ opacity: 1, rotateY: 0 }}
                exit={{ opacity: 0, rotateY: -90 }}
                transition={{ duration: 0.6 }}
                whileHover={{ scale: 1.02 }}
              >
                <div 
                  className="w-80 h-96 rounded-2xl overflow-hidden shadow-2xl relative cursor-pointer transition-transform duration-300 hover:scale-102"
                  onClick={() => handleTrailerClick(currentItem)}
                >
                  <Image
                    src={currentItem.image || '/placeholder-poster.jpg'}
                    alt={getTitle(currentItem)}
                    fill
                    className="object-cover"
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    priority={isFirstSlide}
                    loading={isFirstSlide ? 'eager' : 'lazy'}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                
                {/* Glow effect */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-red-500/20 to-pink-500/20 blur-xl -z-10 opacity-60" />
                
                {/* Desktop Trailer Hint */}
                <DesktopTrailerHint />
              </motion.div>
            </AnimatePresence>

            {/* Thumbnail Navigation */}
            <div
              ref={desktopThumbnailsRef}
              {...desktopThumbnailDragScrollProps}
              className="horizontal-scroll-container flex items-center gap-3 max-w-full overflow-x-auto pb-2 scrollbar-hide snap-x snap-mandatory"
            >
              {visibleItems.map((item, index) => (
                <motion.button
                  key={item.id}
                  className={`relative flex-shrink-0 w-16 h-20 rounded-lg overflow-hidden border-2 transition-all duration-300 snap-center snap-always ${
                    index === currentIndex 
                      ? 'border-red-500 shadow-lg shadow-red-500/30' 
                      : 'border-white/20 hover:border-white/40'
                  }`}
                  onClick={() => goToSlide(index)}
                  whileTap={{ scale: 0.95 }}
                >
                  <Image
                    src={item.image || '/placeholder-poster.jpg'}
                    alt={getTitle(item)}
                    fill
                    className="object-cover"
                    sizes="64px"
                    loading="lazy"
                  />
                  {index === currentIndex && (
                    <motion.div
                      className="absolute inset-0 bg-red-500/20"
                      layoutId="activeThumb"
                    />
                  )}
                </motion.button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Mobile Scroll Down Indicator */}
        <motion.div
          className="lg:hidden flex flex-col items-center gap-0.5 cursor-pointer mt-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1 }}
          onClick={() => {
            window.scrollTo({ 
              top: window.innerHeight, 
              behavior: 'smooth' 
            });
          }}
        >
          <motion.p
            className="text-gray-400 text-[10px] font-light"
            animate={{ opacity: [0.4, 0.8, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            {t('scrollExplore')}
          </motion.p>
          <motion.div
            className="flex flex-col items-center -space-y-1.5"
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDownIcon className="w-4 h-4 text-red-500" />
            <ChevronDownIcon className="w-4 h-4 text-red-500" />
          </motion.div>
        </motion.div>
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
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-4xl mx-4 aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <motion.button
                onClick={closeTrailer}
                className="absolute top-4 right-4 z-10 w-10 h-10 bg-black/70 hover:bg-black/90 rounded-full flex items-center justify-center text-white transition-all duration-300 hover:scale-110"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <XMarkIcon className="w-6 h-6" />
              </motion.button>
              
              {/* YouTube Embed */}
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
    </>
  )
}
