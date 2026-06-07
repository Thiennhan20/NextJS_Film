'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { BookmarkIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { PlayIcon, BookmarkIcon as BookmarkSolidIcon } from '@heroicons/react/24/solid'
import { useApiCache } from '@/hooks/useApiCache'
import { useTranslations } from 'next-intl'
import { useWatchlistStore } from '@/store/store'
import useAuthStore from '@/store/useAuthStore'
import { toast } from 'react-hot-toast'
import api from '@/lib/axios'
import FrameLoadingPlaceholder from './FrameLoadingPlaceholder'

interface MovieItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string;
  backdrop_path?: string;
  vote_average?: number;
  release_date?: string;
  first_air_date?: string;
  overview?: string;
  media_type?: 'movie' | 'tv';
}


export default function AnimeFrame() {
  const router = useRouter();
  const t = useTranslations('Frames');
  const tHome = useTranslations('HomePage');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showTrailer, setShowTrailer] = useState(false);
  const [currentTrailer, setCurrentTrailer] = useState('');

  const { addToWatchlist, removeFromWatchlist, isInWatchlist, fetchWatchlistFromServer } = useWatchlistStore();
  const { isAuthenticated, token } = useAuthStore();

  // Fetch watchlist on mount
  useEffect(() => {
    if (isAuthenticated && token) {
      fetchWatchlistFromServer(token);
    }
  }, [isAuthenticated, token, fetchWatchlistFromServer]);

  // Handle toggle watchlist
  const handleToggleWatchlist = async (item: MovieItem) => {
    if (!isAuthenticated) {
      toast.error(tHome('needLogin'));
      return;
    }
    try {
      const movieData = {
        id: item.id,
        title: item.title || item.name || '',
        poster_path: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : '',
        type: (item.media_type === 'movie' ? 'movie' : 'tv') as 'movie' | 'tv',
      };
      if (isInWatchlist(item.id)) {
        await api.delete('/auth/watchlist', { data: { id: item.id } });
        removeFromWatchlist(item.id);
        toast.success(tHome('removedWatchlist'));
      } else {
        await api.post('/auth/watchlist', movieData);
        addToWatchlist(movieData);
        toast.success(tHome('addedWatchlist'));
      }
      if (token) await fetchWatchlistFromServer(token);
    } catch {
      toast.error(tHome('errorOccurred'));
    }
  };

  // Handle trailer
  const handleTrailerClick = async (item: MovieItem) => {
    try {
      const type = item.media_type === 'movie' ? 'movie' : 'tv';
      const response = await axios.get(`/api/tmdb-proxy?endpoint=/${type}/${item.id}/videos`);
      const trailers = response.data.results.filter(
        (video: { type: string; site: string }) => video.type === 'Trailer' && video.site === 'YouTube'
      );
      if (trailers.length > 0) {
        setCurrentTrailer(`https://www.youtube.com/embed/${trailers[0].key}?autoplay=1&rel=0&modestbranding=1`);
        setShowTrailer(true);
      } else {
        toast.error(tHome('noTrailer'));
      }
    } catch {
      toast.error(tHome('failedTrailer'));
    }
  };


  const fetchData = useCallback(async () => {
    const [moviesRes, tvRes] = await Promise.all([
      axios.get(`/api/tmdb-proxy?endpoint=${encodeURIComponent('/discover/movie?with_genres=16&with_original_language=ja&sort_by=popularity.desc')}`),
      axios.get(`/api/tmdb-proxy?endpoint=${encodeURIComponent('/discover/tv?with_genres=16&with_original_language=ja&sort_by=popularity.desc')}`)
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
    'home-anime-frame',
    fetchData,
    8 * 60 * 60 * 1000 // 8 tiếng
  );

  // Auto-play timer
  useEffect(() => {
    if (!items || items.length === 0) return;
    const timer = setInterval(() => {
      setSelectedIndex((prev) => (prev + 1) % items.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [items, selectedIndex]);

  // Swipe gestures
  const touchStartX = useRef(0);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEndX = e.changedTouches[0].clientX;
    if (touchStartX.current - touchEndX > 50) {
      // Swipe left -> next
      setSelectedIndex((prev) => (prev + 1) % (items?.length || 1));
    } else if (touchStartX.current - touchEndX < -50) {
      // Swipe right -> prev
      setSelectedIndex((prev) => (prev - 1 + (items?.length || 1)) % (items?.length || 1));
    }
  };


  const getRoute = (item: MovieItem) => item.media_type === 'movie' ? `/movies/${item.id}` : `/tvshows/${item.id}`;
  const getTitle = (item: MovieItem) => item.title || item.name || 'Unknown';
  const getYear = (item: MovieItem) => {
    const date = item.release_date || item.first_air_date;
    return date ? date.slice(0, 4) : '';
  };

  if (error) return null;
  if (loading && !items) return <FrameLoadingPlaceholder variant="hero" />;
  if (!items || items.length === 0) return null;

  const selectedItem = items[selectedIndex] || items[0];

  return (
    <div className="mb-10 sm:mb-12 px-2 sm:px-3">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6 px-1">
          <div className="w-1.5 h-6 sm:h-8 rounded-full bg-gradient-to-b from-pink-500 to-rose-500" />
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-wide">
            {t('animeTitle')}
          </h2>
        </div>
        
        {/* Main Hero Container */}
        <div 
          className="relative w-full h-[500px] md:h-[550px] rounded-2xl sm:rounded-3xl overflow-hidden bg-[#2a2b36] shadow-2xl"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Subtle dot pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:16px_16px] z-0" />
          
          <AnimatePresence>
            <motion.div
              key={selectedItem.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.8, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {/* Background image - Top half on mobile, Right side on desktop */}
              {selectedItem.backdrop_path && (
                <div className="absolute top-0 inset-x-0 h-[45%] sm:h-auto sm:inset-y-0 sm:right-0 sm:left-auto sm:w-[65%] z-0">
                  <Image 
                    src={`https://image.tmdb.org/t/p/w1280${selectedItem.backdrop_path}`} 
                    alt={getTitle(selectedItem)} 
                    fill 
                    className="object-cover object-center opacity-80 sm:opacity-100"
                    priority
                  />
                  {/* Mobile gradient to blend image with bottom content */}
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#2a2b36] to-transparent sm:hidden" />
                  
                  {/* Desktop Gradients to blend image with solid background */}
                  <div className="hidden sm:block absolute inset-y-0 left-0 w-24 sm:w-48 bg-gradient-to-r from-[#2a2b36] to-transparent" />
                  <div className="hidden sm:block absolute inset-x-0 bottom-0 h-48 sm:h-64 bg-gradient-to-t from-[#2a2b36] via-[#2a2b36]/80 to-transparent" />
                </div>
              )}

              {/* Left side content */}
              <div className="relative z-10 w-full sm:w-[55%] p-5 sm:p-10 pt-[42%] sm:pt-10 flex flex-col justify-start h-full pb-6 sm:pb-32">
                <h3 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-2 pb-1 truncate drop-shadow-lg" title={getTitle(selectedItem)}>
                  {getTitle(selectedItem)}
                </h3>
                
                <p className="text-yellow-500 text-sm sm:text-base mb-4 font-medium drop-shadow-md">
                  {selectedItem.original_name || selectedItem.original_title || getTitle(selectedItem)}
                </p>

                {/* Info Badges */}
                <div className="flex flex-wrap items-center gap-2 mb-4 text-[10px] sm:text-xs font-semibold">
                  {selectedItem.vote_average && selectedItem.vote_average > 0 ? (
                    <span className="border border-yellow-500 text-yellow-500 px-2 py-0.5 rounded">
                      IMDb {selectedItem.vote_average.toFixed(1)}
                    </span>
                  ) : null}
                  <span className="border border-gray-400/60 text-gray-200 px-2 py-0.5 rounded bg-black/20 backdrop-blur-sm">
                    T16
                  </span>
                  {getYear(selectedItem) && (
                    <span className="border border-gray-400/60 text-gray-200 px-2 py-0.5 rounded bg-black/20 backdrop-blur-sm">
                      {getYear(selectedItem)}
                    </span>
                  )}
                  <span className="border border-gray-400/60 text-gray-200 px-2 py-0.5 rounded bg-black/20 backdrop-blur-sm">
                    {t('season1')}
                  </span>
                </div>

                {/* Genre Tag */}
                <div className="mb-4 sm:mb-6 flex gap-2">
                  <span className="bg-white/10 text-gray-200 px-3 py-1 rounded-md text-xs backdrop-blur-sm inline-block">
                    {t('animation')}
                  </span>
                  <span className="bg-indigo-500/80 text-white px-3 py-1 rounded-md text-xs backdrop-blur-sm inline-block capitalize font-semibold shadow-lg">
                    {selectedItem.media_type === 'movie' ? t('movieLabel') : t('tvShowLabel')}
                  </span>
                </div>

                {/* Overview */}
                <p className="text-gray-300 text-sm sm:text-base line-clamp-2 md:line-clamp-4 mb-6 sm:mb-8 pr-2 sm:pr-8 max-w-xl shrink-0">
                  {selectedItem.overview || t('updatingOverview')}
                </p>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 sm:gap-4 mt-0">
                  <button 
                    onClick={() => router.push(getRoute(selectedItem))}
                    className="w-10 h-10 sm:w-14 sm:h-14 bg-[#fcd53f] rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-[0_0_15px_rgba(252,213,63,0.3)]"
                  >
                    <PlayIcon className="w-5 h-5 sm:w-6 sm:h-6 ml-1" />
                  </button>
                  <button 
                    onClick={() => handleToggleWatchlist(selectedItem)}
                    className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-colors backdrop-blur-md ${
                      isInWatchlist(selectedItem.id)
                        ? 'bg-amber-600/80 text-white hover:bg-amber-700/80'
                        : 'bg-white/10 text-white hover:bg-white/20'
                    }`}
                  >
                    {isInWatchlist(selectedItem.id) ? (
                      <BookmarkSolidIcon className="w-4 h-4 sm:w-6 sm:h-6" />
                    ) : (
                      <BookmarkIcon className="w-4 h-4 sm:w-6 sm:h-6" />
                    )}
                  </button>
                  <button 
                    onClick={() => handleTrailerClick(selectedItem)}
                    className="h-9 sm:h-12 px-4 sm:px-5 bg-white/10 rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-semibold hover:bg-white/20 transition-colors backdrop-blur-md tracking-wide"
                  >
                    Trailer
                  </button>
                </div>

                {/* Dot Indicators - Mobile only */}
                <div className="mt-6 md:hidden flex justify-center gap-2 flex-wrap w-full">
                  {items.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        idx === selectedIndex 
                          ? 'bg-yellow-500 w-4' 
                          : 'bg-white/40 hover:bg-white/60'
                      }`}
                      aria-label={`Select item ${idx + 1}`}
                    />
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom Carousel (Selector) - Desktop/Tablet */}
          <div className="absolute bottom-4 left-0 right-0 px-6 sm:px-10 z-20 hidden md:block">
            <div className="flex gap-1 lg:gap-2 justify-center w-full pb-2 pt-2">
              {items.map((item, idx) => (
                <div 
                  key={item.id} 
                  onClick={() => setSelectedIndex(idx)}
                  className={`relative flex-1 aspect-[2/3] max-w-[55px] lg:max-w-[65px] cursor-pointer rounded-md overflow-hidden transition-all duration-300 transform-gpu ${
                    idx === selectedIndex 
                      ? 'border-2 border-white scale-110 shadow-[0_4px_12px_rgba(0,0,0,0.5)] z-10' 
                      : 'border border-transparent opacity-60 hover:opacity-100 hover:scale-105'
                  }`}
                >
                  {item.poster_path ? (
                    <Image 
                      src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
                      alt={getTitle(item)}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 60px, 80px"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1e2029] flex items-center justify-center">
                      <span className="text-xl sm:text-2xl drop-shadow-md">🎬</span>
                    </div>
                  )}
                  {/* Subtle bottom gradient on cards for contrast if needed */}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Trailer Modal */}
      <AnimatePresence>
        {showTrailer && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => { setShowTrailer(false); setCurrentTrailer(''); }}
          >
            <motion.div
              className="relative w-[90vw] max-w-4xl aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => { setShowTrailer(false); setCurrentTrailer(''); }}
                className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 rounded-full flex items-center justify-center text-white transition-colors"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
              <iframe
                src={currentTrailer}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Trailer"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
