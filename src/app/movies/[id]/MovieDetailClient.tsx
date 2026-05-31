'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { ClockIcon, CalendarIcon, PlayIcon } from '@heroicons/react/24/solid'
import { BookmarkIcon } from '@heroicons/react/24/outline'
import { useWatchlistStore } from '@/store/store'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useSearchParams, useRouter } from 'next/navigation'
import useAuthStore from '@/store/useAuthStore'
import api from '@/lib/axios'
import Comments from '@/components/Comments';
import WatchNowMovies from '@/components/watch/WatchNowMovies';
import RelatedContent from '@/components/RelatedContent';
import { useTranslations } from 'next-intl';

interface CastMember {
  name: string;
  character: string;
  profilePath: string;
}

// Định nghĩa kiểu Movie rõ ràng
interface Movie {
  id: number;
  title: string;

  duration: string;
  year: number | '';
  releaseDate?: string;
  director: string;
  cast: CastMember[];
  genre: string;
  description: string;
  poster: string;
  backdrop: string;
  trailer: string;
  movieUrl: string;
  scenes: string[];
}





export default function MovieDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('');
  
  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const searchParams = useSearchParams();
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter();
  const [movie, setMovie] = useState<Movie | null>(null);
  const t = useTranslations('Movies');


  const [loading, setLoading] = useState<boolean>(true);
  const [activeScene, setActiveScene] = useState<number | null>(null)
  const [showTrailer, setShowTrailer] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  });


  const y = useTransform(scrollYProgress, [0, 1], [0, -100])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])

  const { addToWatchlist, removeFromWatchlist, isInWatchlist, fetchWatchlistFromServer } = useWatchlistStore();
  const { isAuthenticated, token } = useAuthStore();
  const isBookmarked = movie ? isInWatchlist(movie.id) : false;
  const [isCastExpanded, setIsCastExpanded] = useState(false);
  const [isDescExpanded, setIsDescExpanded] = useState(false);
  const [posterLoaded, setPosterLoaded] = useState(false);

  const handleToggleWatchlist = async () => {
    if (!movie) return;
    if (!isAuthenticated) {
      toast.error(t('loginRequired'));
      return;
    }
    try {
      if (isBookmarked) {
        await api.delete('/auth/watchlist', {
          data: { id: movie.id },
        });
        removeFromWatchlist(movie.id);
        toast.success(t('removedFromWatchlist'));
        if (token) await fetchWatchlistFromServer(token);
      } else {
        await api.post('/auth/watchlist', {
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster,
          type: 'movie',
        });
        addToWatchlist({
          id: movie.id,
          title: movie.title,
          poster_path: movie.poster,
          type: 'movie',
        });
        toast.success(t('addedToWatchlist'));
        if (token) await fetchWatchlistFromServer(token);
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('errorOccurred'));
      } else {
        toast.error(t('errorOccurred'));
      }
    }
  };



  useEffect(() => {
    if (!id) return;
    const fetchMovie = async () => {
      setLoading(true);
      try {
        // Fetch all TMDB data in parallel for faster loading
        const [detailResult, imgResult, videoResult, creditsResult] = await Promise.allSettled([
          axios.get(`/api/tmdb-proxy?endpoint=/movie/${id}`),
          axios.get(`/api/tmdb-proxy?endpoint=/movie/${id}/images`),
          axios.get(`/api/tmdb-proxy?endpoint=/movie/${id}/videos`),
          axios.get(`/api/tmdb-proxy?endpoint=/movie/${id}/credits`),
        ]);

        // Detail is required - if it fails, throw
        if (detailResult.status === 'rejected') throw detailResult.reason;
        const data = detailResult.value.data;

        // Images - optional, graceful fallback
        let scenes: string[] = [];
        if (imgResult.status === 'fulfilled') {
          const backdrops: { file_path: string }[] = imgResult.value.data.backdrops || [];
          scenes = backdrops.slice(0, 3).map((img) => `https://image.tmdb.org/t/p/w780${img.file_path}`);
        }
        if (scenes.length < 3) {
          if (data.backdrop_path) scenes.push(`https://image.tmdb.org/t/p/w780${data.backdrop_path}`);
          if (data.poster_path) scenes.push(`https://image.tmdb.org/t/p/w500${data.poster_path}`);
        }
        scenes = scenes.slice(0, 3);

        // Videos - optional, graceful fallback
        let trailer = '';
        if (videoResult.status === 'fulfilled') {
          const videos: { type: string; site: string; key: string }[] = videoResult.value.data.results || [];
          const ytTrailer = videos.find((v) => v.type === 'Trailer' && v.site === 'YouTube');
          if (ytTrailer) {
            trailer = `https://www.youtube.com/embed/${ytTrailer.key}`;
          }
        }

        // Credits - graceful fallback
        const credits = creditsResult.status === 'fulfilled' ? creditsResult.value.data : { crew: [], cast: [] };

        const movieData = {
          id: data.id,
          title: data.title,

          duration: data.runtime ? `${Math.floor(data.runtime / 60)}h ${data.runtime % 60}m` : '',
          year: data.release_date ? Number(data.release_date.slice(0, 4)) : '' as number | '',
          releaseDate: data.release_date || '',
          director: credits.crew?.find((person: { job: string; name: string }) => person.job === 'Director')?.name || '',
          cast: credits.cast?.slice(0, 10).map((person: { name: string; character?: string; profile_path?: string }) => ({
            name: person.name,
            character: person.character || '',
            profilePath: person.profile_path ? `https://image.tmdb.org/t/p/w185${person.profile_path}` : ''
          })) || [],
          genre: data.genres ? data.genres.map((g: { name: string }) => g.name).join(', ') : '',
          description: data.overview,
          poster: data.poster_path ? `https://image.tmdb.org/t/p/w342${data.poster_path}` : '',
          backdrop: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : '',
          trailer,
          movieUrl: '',
          scenes,
        };
        setMovie(movieData);
      } catch {
        setMovie(null);
      }
      setLoading(false);
    };
    fetchMovie();
  }, [id]);

  // Helper to format date as dd/mm/yyyy (Vietnam locale)
  const formatDate = (dateStr?: string) => {
    try {
      if (!dateStr) return '';
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
      return dateStr || '';
    }
  };

  if (loading || !movie) {
    return (
      <div ref={containerRef} className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const { title, backdrop, poster, duration, year, genre, director, cast, description, scenes, trailer, releaseDate } = movie;
  const heroHeightClass = poster
    ? 'h-[30vh] sm:h-[35vh] md:h-[50vh] lg:h-[60vh]'
    : 'h-[20vh] sm:h-[24vh] md:h-[28vh] lg:h-[32vh]';

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="relative w-full overflow-hidden py-10 sm:py-14 lg:py-0 min-h-[60vh] md:min-h-screen flex items-center">
        <div className="absolute inset-0">
          <Image
            src={backdrop}
            alt={title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black" />
        </div>

        <motion.div
          style={{ y, opacity }}
          className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-center"
        >
          <div className={`relative ${heroHeightClass} w-full flex items-center justify-center mb-4 sm:mb-6 lg:mb-0`}>
            {poster ? (
              <div className="flex items-center justify-center w-full h-full" style={{ perspective: '1000px' }}>
                <div
                  className="relative w-[140px] h-[210px] sm:w-[150px] sm:h-[225px] md:w-[170px] md:h-[255px] lg:w-[190px] lg:h-[285px] rounded-xl overflow-hidden shadow-2xl"
                  style={{
                    transformStyle: 'preserve-3d',
                    animation: 'posterFloat 6s ease-in-out infinite',
                  }}
                >
                  {/* Loading skeleton */}
                  {!posterLoaded && (
                    <div className="absolute inset-0 bg-gray-700 animate-pulse rounded-xl flex items-center justify-center">
                      <div className="w-8 h-8 border-3 border-red-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <Image
                    src={`/api/cache-image?id=${id}&url=${encodeURIComponent(poster ?? '')}`}
                    alt={title}
                    fill
                    className={`object-cover transition-opacity duration-300 ${posterLoaded ? 'opacity-100' : 'opacity-0'}`}
                    sizes="(max-width: 640px) 160px, (max-width: 768px) 200px, 280px"
                    priority
                    unoptimized
                    onLoad={() => setPosterLoaded(true)}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
                </div>
              </div>
            ) : (
              <div className="bg-gray-700/70 rounded-lg flex items-center justify-center shadow-inner border border-gray-600 w-[96px] h-[144px] sm:w-[128px] sm:h-[192px] md:w-[160px] md:h-[240px] lg:w-[192px] lg:h-[288px]">
                <span className="text-2xl sm:text-3xl">🎬</span>
              </div>
            )}
          </div>

          <div className="text-white space-y-3 sm:space-y-4 lg:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-xl sm:text-2xl md:text-3xl lg:text-5xl font-bold leading-tight"
              >
                {title}
              </motion.h1>

            </div>

            <div className="flex flex-wrap gap-3">

              <div className="flex items-center space-x-1.5">
                <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-gray-400" />
                <span className="text-gray-400 text-sm sm:text-base">{duration}</span>
              </div>
              <div className="flex items-center space-x-1.5">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-gray-400" />
                <span className="text-gray-400 text-sm sm:text-base">{releaseDate ? formatDate(releaseDate) : year}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-300 text-sm sm:text-base">{genre}</p>
              {director && (
                <p className="text-gray-300">{t('director')}: {director}</p>
              )}
              {/* Cast: collapsed to a single line with Show more */}
              <div className="min-h-[36px]">
                <AnimatePresence mode="wait">
                  {!isCastExpanded ? (
                    <motion.div
                      key="cast-collapsed"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="flex items-center w-full"
                    >
                      <div className="min-w-0 overflow-hidden flex-1">
                        <div className="flex flex-nowrap gap-2 whitespace-nowrap py-1">
                          {cast.map((actor: CastMember, index: number) => (
                            <span key={index} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm bg-gray-900/60 border border-white/15 text-white shadow-sm backdrop-blur-[2px]">
                              {actor.profilePath ? (
                                <div className="relative w-5 h-5 rounded-full overflow-hidden shrink-0 border border-white/20">
                                  <Image
                                    src={actor.profilePath}
                                    alt={actor.name}
                                    fill
                                    className="object-cover"
                                    unoptimized
                                  />
                                </div>
                              ) : (
                                <div className="w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center text-[10px] shrink-0 text-gray-400">
                                  👤
                                </div>
                              )}
                              <span className="max-w-[100px] truncate">{actor.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex-none flex items-center gap-2 pl-2">
                        <span className="px-2 py-0.5 rounded-full bg-gray-900/60 border border-white/15 text-white text-xs shadow-sm backdrop-blur-[2px] select-none">…</span>
                        <button
                          onClick={() => setIsCastExpanded(true)}
                          className="text-xs px-2.5 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm transition-colors"
                        >
                          {t('showMore')}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="cast-expanded"
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.2 }}
                      className="w-full"
                    >
                      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 py-2">
                        {cast.map((actor: CastMember, index: number) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.03, duration: 0.2 }}
                            whileHover={{ y: -4 }}
                            className="flex flex-col items-center text-center group"
                          >
                            <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/10 group-hover:border-red-500 transition-colors duration-300 shadow-md">
                              {actor.profilePath ? (
                                <Image
                                  src={actor.profilePath}
                                  alt={actor.name}
                                  fill
                                  className="object-cover transition-transform duration-300 group-hover:scale-110"
                                  unoptimized
                                />
                              ) : (
                                <div className="w-full h-full bg-gray-800 flex items-center justify-center text-xl text-gray-500">
                                  👤
                                </div>
                              )}
                            </div>
                            <span className="mt-2 text-xs font-semibold text-white group-hover:text-red-400 transition-colors line-clamp-1 w-full px-1">
                              {actor.name}
                            </span>
                            <span className="text-[10px] text-gray-400 line-clamp-1 w-full px-1">
                              {actor.character}
                            </span>
                          </motion.div>
                        ))}

                        {/* Beautiful circular Show Less action card directly inside the grid */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: cast.length * 0.03, duration: 0.2 }}
                          whileHover={{ y: -4 }}
                          onClick={() => setIsCastExpanded(false)}
                          className="flex flex-col items-center text-center group cursor-pointer"
                        >
                          <div className="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full overflow-hidden border-2 border-white/15 bg-white/10 group-hover:bg-red-600/20 group-hover:border-red-500 transition-all duration-300 shadow-md flex items-center justify-center backdrop-blur-sm">
                            <svg className="w-5 h-5 text-white group-hover:text-red-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 15l7-7 7 7" />
                            </svg>
                          </div>
                          <span className="mt-2 text-xs font-semibold text-white group-hover:text-red-400 transition-colors line-clamp-1 w-full px-1">
                            {t('showLess')}
                          </span>
                          <span className="text-[10px] text-gray-400 line-clamp-1 w-full px-1">
                            Collapse
                          </span>
                        </motion.div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Description: collapsed to a single line with Show more */}
            <div className="min-h-[24px]">
              <AnimatePresence mode="wait">
                {!isDescExpanded ? (
                  <motion.div
                    key="desc-collapsed"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="relative"
                  >
                    <p className="text-gray-300 leading-relaxed text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis pr-24">
                      {description}
                    </p>
                    <div className="absolute inset-y-0 right-0 flex items-center pl-6">
                      <button
                        onClick={() => setIsDescExpanded(true)}
                        className="relative z-10 text-xs px-2 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white border border-white/20 backdrop-blur-sm transition-colors"
                      >
                        {t('readMore')}
                      </button>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="desc-expanded"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="space-y-2"
                  >
                    <p className="text-gray-300 leading-relaxed text-sm sm:text-base">{description}</p>
                    <button
                      onClick={() => setIsDescExpanded(false)}
                      className="text-xs px-2 py-1 rounded-md bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
                    >
                      {t('showLess')}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex flex-wrap gap-2 sm:gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowTrailer(true)}
                className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
              >
                <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                {t('trailer')}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleToggleWatchlist}
                className={`flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 text-sm sm:text-base ${isBookmarked
                  ? 'bg-amber-700 text-white hover:bg-amber-800'
                  : 'bg-gray-700 text-white hover:bg-gray-600'
                  }`}
              >
                <BookmarkIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden xs:inline">{isBookmarked ? t('added') : t('save')}</span>
                <span className="xs:hidden">{isBookmarked ? '✓' : t('save')}</span>
              </motion.button>

              {scenes.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setActiveScene(0)}
                  className="flex-1 sm:flex-none px-4 sm:px-6 py-2 sm:py-3 bg-gray-700 text-white rounded-lg font-semibold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                >
                  <svg className="h-4 w-4 sm:h-5 sm:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="hidden sm:inline">{t('scenes')}</span>
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Watch Now Section */}
      {movie && <WatchNowMovies movie={movie} />}

      <AnimatePresence>
        {showTrailer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
            onClick={() => setShowTrailer(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full max-w-4xl aspect-video"
              onClick={e => e.stopPropagation()}
            >
              <iframe
                src={trailer}
                className="w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
              <button
                className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors"
                onClick={() => setShowTrailer(false)}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legacy server modal removed */}
      {/*
      {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
             onClick={() => {}}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full max-w-md bg-gray-800 rounded-lg p-6"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-medium text-white mb-4 text-center">Select a video server</h3>
              <div className="flex flex-col gap-4">
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                   onClick={() => { handleServerChange('server1'); }}
                >
                  Server 1
                </button>
                <button
                  className={`px-4 py-2 rounded-lg transition-colors relative flex flex-col items-center ${
                    server2Status === 'checking' 
                      ? 'bg-gray-600 text-gray-300 cursor-not-allowed' 
                      : server2Status === 'available'
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-red-600 text-white cursor-not-allowed'
                  }`}
                   onClick={() => { if (server2Status === 'available') { handleServerChange('server2'); } }}
                  disabled={server2Status !== 'available'}
                >
                  <div className="flex items-center gap-2">
                    {server2Status === 'checking' && (
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                        className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full"
                      />
                    )}
                    Server 2
                    {server2Status === 'checking' && <span className="text-xs">(Checking...)</span>}
                    {server2Status === 'unavailable' && <span className="text-xs">(Unavailable)</span>}
                  </div>
                  <span className="mt-2 flex items-center gap-1 text-yellow-900 bg-yellow-200 rounded px-2 py-1 text-xs font-semibold">
                    <svg className="w-4 h-4 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Note: This server has many ads, please close ads to watch the movie.
                  </span>
                </button>
                <button
                  className="mt-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  onClick={() => {}}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      )}
      */}



      {/* Legacy full-screen player modal removed */}
      {/*
      {false && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-50 flex items-center justify-center"
             onClick={() => {}}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              className="relative w-full h-full max-w-7xl max-h-screen p-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-4">
                <div className="flex items-center gap-3">
                  <h3 className="text-white text-xl font-semibold">{title}</h3>
                  {selectedAudio && (
                    <span className={`px-2 py-1 text-xs font-semibold rounded ${
                      selectedAudio === 'vietsub' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-green-600 text-white'
                    }`}>
                      {selectedAudio === 'vietsub' ? 'Vietsub' : 'Vietnamese Dubbed'}
                    </span>
                  )}
                  {selectedAudio && (
                    <button
                      className="text-white bg-gray-600 rounded-full p-1 hover:bg-gray-700 transition-colors"
                  onClick={() => setSelectedAudio(null)}
                      title="Change audio version"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                    </button>
                  )}
                </div>
                <button
                  className="text-white bg-black/50 rounded-full p-2 hover:bg-black/80 transition-colors"
                  onClick={() => { handleServerChange('server1'); setSelectedAudio(null); }}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="w-full h-[calc(100%-4rem)] rounded-lg overflow-hidden">
                {selectedServer === 'server1' && (
                  (() => {
                    // Show loading if API search is still in progress
                    if (!apiSearchCompleted || movieLinksLoading) {
                      return (
                        <div className="flex items-center justify-center h-full text-white">
                          <div className="flex flex-col items-center gap-4">
                            <motion.div 
                              animate={{ rotate: 360 }}
                              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                              className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full"
                            />
                            <p className="text-sm text-gray-400">Please wait a moment</p>
                          </div>
                        </div>
                      );
                    }

                    // Check if we have any video source available
                    const hasVideoSource = movieLinks.vietsub || movieLinks.dubbed || movieLinks.m3u8;
                    
                    if (!hasVideoSource) {
                      return (
                        <div className="flex items-center justify-center h-full text-white">
                          <div className="flex flex-col items-center gap-4">
                            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-lg font-semibold">No video source available</p>
                            <p className="text-sm text-gray-400">Please try another server</p>
                          </div>
                        </div>
                      );
                    }

                    // If we have multiple audio options, show audio selection
                    if (movieLinks.vietsub && movieLinks.dubbed && !selectedAudio) {
                      return (
                        <div className="flex items-center justify-center h-full text-white">
                          <div className="flex flex-col items-center gap-6 max-w-md">
                            <h3 className="text-xl font-semibold">Select Audio Version</h3>
                            <div className="flex flex-col gap-4 w-full">
                              <button
                                className="px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-3"
                                onClick={() => setSelectedAudio('vietsub')}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                                </svg>
                                Vietsub (Vietnamese Subtitles)
                              </button>
                              <button
                                className="px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-3"
                                onClick={() => setSelectedAudio('dubbed')}
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                                </svg>
                                Vietnamese Dubbed (Dubbed/Narrated)
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // Determine which link to use based on selected audio or availability
                    let videoSrc = '';
                    if (selectedAudio === 'vietsub' && movieLinks.vietsub) {
                      videoSrc = movieLinks.vietsub;
                    } else if (selectedAudio === 'dubbed' && movieLinks.dubbed) {
                      videoSrc = movieLinks.dubbed;
                    } else if (movieLinks.vietsub) {
                      videoSrc = movieLinks.vietsub; // Default to vietsub if available
                    } else if (movieLinks.dubbed) {
                      videoSrc = movieLinks.dubbed; // Fallback to dubbed
                    } else {
                      videoSrc = movieLinks.m3u8; // Fallback to original m3u8
                    }
                    
                    return videoSrc ? (
                      <MoviePlayer
                        ref={videoRef}
                        src={videoSrc}
                        poster={poster}
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-white text-lg font-semibold">
                        No video source available
                      </div>
                    );
                  })()
                )}
                {selectedServer === 'server2' && (
                  <iframe
                    src={server2Link}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    title={title + ' - Server 2'}
                    referrerPolicy="origin"
                  />
                )}
                {!selectedServer && (
                  <div className="flex items-center justify-center h-full text-white">Please select a server to watch the movie.</div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      )}
      */}

      {/* Comments Section */}
      <Comments
        movieId={movie.id}
        type="movie"
        title={movie.title}
      />

      {/* Related Movies */}
      <RelatedContent
        id={movie.id}
        type="movie"
        title={movie.title}
      />

      {/* Scenes Modal */}
      <AnimatePresence>
        {activeScene !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-4"
            onClick={() => setActiveScene(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-5xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white text-lg font-semibold">{t('movieScenes')} ({activeScene + 1}/{scenes.length})</h3>
                <button
                  className="text-white bg-gray-800 hover:bg-gray-700 rounded-full p-2 transition-colors"
                  onClick={() => setActiveScene(null)}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Main Image */}
              <div className="relative aspect-video rounded-lg overflow-hidden bg-gray-900">
                <Image
                  src={scenes[activeScene]}
                  alt={`Scene ${activeScene + 1}`}
                  fill
                  className="object-contain"
                />
              </div>

              {/* Navigation */}
              <div className="flex items-center justify-center gap-4 mt-4">
                <button
                  onClick={() => setActiveScene(prev => prev !== null && prev > 0 ? prev - 1 : scenes.length - 1)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>

                {/* Thumbnails */}
                <div className="flex gap-2">
                  {scenes.map((scene, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveScene(index)}
                      className={`relative w-16 h-10 rounded overflow-hidden transition-all ${activeScene === index ? 'ring-2 ring-red-500 scale-110' : 'opacity-60 hover:opacity-100'
                        }`}
                    >
                      <Image src={scene} alt={`Thumb ${index + 1}`} fill className="object-cover" />
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setActiveScene(prev => prev !== null && prev < scenes.length - 1 ? prev + 1 : 0)}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-full transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
