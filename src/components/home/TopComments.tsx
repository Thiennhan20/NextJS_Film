'use client'

import { motion } from 'framer-motion'
import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import {
  StarIcon,
  HeartIcon,
  ChatBubbleLeftIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  TrophyIcon,
  FireIcon,
  SparklesIcon,
} from '@heroicons/react/24/solid'
import Link from 'next/link'
import Image from 'next/image'
import { useTopComments, useRecentComments } from '@/hooks/useCommentsOptimized'
import { useTranslations } from 'next-intl'

interface RankingItem {
  id: number
  title: string
  poster: string
  trend: 'up' | 'down' | 'same'
  rating?: number
  change?: number
  type?: 'movie' | 'tv'
}

// Mock data arrays removed – state versions are used instead

const NEW_COMMENTS_VISIBLE_COUNT = 5
const NEW_COMMENT_ROW_HEIGHT = 90
const NEW_COMMENT_ROW_GAP = 10
const NEW_COMMENT_SCROLL_INTERVAL = 3600
const NEW_COMMENT_SCROLL_DURATION = 1.35

// Custom avatar generator function
const generateAvatar = (name: string) => {
  const colors = [
    'from-purple-500 to-pink-500',
    'from-blue-500 to-cyan-500',
    'from-green-500 to-emerald-500',
    'from-orange-500 to-red-500',
    'from-indigo-500 to-purple-500',
    'from-teal-500 to-blue-500'
  ]
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase()
  const color = colors[name.length % colors.length]

  return (
    <div className={`w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br ${color} rounded-full flex items-center justify-center shadow-md`}>
      <span className="text-white font-semibold text-xs sm:text-sm">{initials}</span>
    </div>
  )
}

export default function TopComments() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isMobile, setIsMobile] = useState(false)
  const [isTablet, setIsTablet] = useState(false)
  const carouselRef = useRef<HTMLDivElement>(null)
  const newCommentsRef = useRef<HTMLDivElement>(null)
  const [trendingMovies, setTrendingMovies] = useState<RankingItem[]>([])
  const [mostLikedMovies, setMostLikedMovies] = useState<RankingItem[]>([])
  const [newCommentStartIndex, setNewCommentStartIndex] = useState(0)
  const [newCommentsTransitionEnabled, setNewCommentsTransitionEnabled] = useState(true)
  const [newCommentsInView, setNewCommentsInView] = useState(false)

  // Use optimized hooks with SWR caching and batch fetching
  const { comments: topComments, isLoading: loading, isError: error } = useTopComments(9)
  const { comments: newComments, isLoading: newCommentsLoading } = useRecentComments(10)
  const t = useTranslations('Comments')
  const firstNewCommentId = newComments[0]?.id

  // Fetch trending and top rated movies from TMDB
  useEffect(() => {
    const fetchTMDBData = async () => {
      try {
        const [trendingRes, topRatedRes] = await Promise.all([
          axios.get('/api/tmdb-proxy?endpoint=/trending/movie/week'),
          axios.get('/api/tmdb-proxy?endpoint=/movie/top_rated')
        ]);

        // Process trending movies
        const trending = trendingRes.data.results.slice(0, 7).map((movie: { id: number; title: string; poster_path?: string }, index: number) => ({
          id: movie.id,
          title: movie.title,
          poster: movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : '',
          trend: index < 3 ? 'up' as const : 'down' as const,
          change: Math.floor(Math.random() * 20) + 5,
          type: 'movie' as const
        }));

        // Process top rated movies
        const topRated = topRatedRes.data.results.slice(0, 7).map((movie: { id: number; title: string; poster_path?: string; vote_average?: number }, index: number) => ({
          id: movie.id,
          title: movie.title,
          poster: movie.poster_path ? `https://image.tmdb.org/t/p/w92${movie.poster_path}` : '',
          trend: index % 2 === 0 ? 'up' as const : 'same' as const,
          rating: movie.vote_average ? Number((movie.vote_average / 2).toFixed(1)) : 0,
          type: 'movie' as const
        }));

        setTrendingMovies(trending);
        setMostLikedMovies(topRated);
      } catch (error) {
        console.error('Error fetching TMDB data:', error);
      }
    };

    fetchTMDBData();
  }, []);

  // Helper function to build movie/TV URL with comment anchor
  const getCommentUrl = (movieId: number, type: 'movie' | 'tvshow', commentId: string | number) => {
    const basePath = type === 'movie' ? '/movies' : '/tvshows'
    return `${basePath}/${movieId}#comment-${commentId}`
  }

  useEffect(() => {
    let resizeTimer: NodeJS.Timeout
    const checkScreenSize = () => {
      const width = window.innerWidth
      setIsMobile(width < 768)
      setIsTablet(width >= 768 && width < 1024)
    }

    const handleResize = () => {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(checkScreenSize, 150)
    }

    checkScreenSize()
    window.addEventListener('resize', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      clearTimeout(resizeTimer)
    }
  }, [])

  useEffect(() => {
    const target = newCommentsRef.current
    if (!target) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.isIntersecting
        setNewCommentsInView(visible)

        if (!visible) {
          setNewCommentsTransitionEnabled(false)
          setNewCommentStartIndex(0)
          window.setTimeout(() => setNewCommentsTransitionEnabled(true), 50)
        }
      },
      { threshold: 0.35 }
    )

    observer.observe(target)
    return () => observer.disconnect()
  }, [newCommentsLoading, newComments.length])

  useEffect(() => {
    setNewCommentsTransitionEnabled(false)
    setNewCommentStartIndex(0)
    const timer = window.setTimeout(() => setNewCommentsTransitionEnabled(true), 50)
    return () => window.clearTimeout(timer)
  }, [newComments.length, firstNewCommentId])

  const shouldCycleNewComments = newComments.length > NEW_COMMENTS_VISIBLE_COUNT

  useEffect(() => {
    if (!shouldCycleNewComments || !newCommentsInView) return

    const interval = window.setInterval(() => {
      setNewCommentsTransitionEnabled(true)
      setNewCommentStartIndex((prev) => prev + 1)
    }, NEW_COMMENT_SCROLL_INTERVAL)

    return () => window.clearInterval(interval)
  }, [shouldCycleNewComments, newCommentsInView])

  useEffect(() => {
    if (!shouldCycleNewComments || newCommentStartIndex !== newComments.length) return

    const resetTimer = window.setTimeout(() => {
      setNewCommentsTransitionEnabled(false)
      setNewCommentStartIndex(0)
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => setNewCommentsTransitionEnabled(true))
      })
    }, NEW_COMMENT_SCROLL_DURATION * 1000)

    return () => window.clearTimeout(resetTimer)
  }, [shouldCycleNewComments, newCommentStartIndex, newComments.length])

  const getItemsPerSlide = () => {
    if (isMobile) return 1
    if (isTablet) return 2
    return 3
  }

  const itemsPerSlide = getItemsPerSlide()
  const totalSlides = Math.ceil(topComments.length / itemsPerSlide)

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % totalSlides)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + totalSlides) % totalSlides)
  }

  const getCurrentComments = () => {
    const start = currentSlide * itemsPerSlide
    return topComments.slice(start, start + itemsPerSlide)
  }

  const newCommentsTrack = shouldCycleNewComments
    ? [...newComments, ...newComments.slice(0, NEW_COMMENTS_VISIBLE_COUNT)]
    : newComments.slice(0, NEW_COMMENTS_VISIBLE_COUNT)

  const getTrendIcon = (trend: 'up' | 'down' | 'same') => {
    switch (trend) {
      case 'up':
        return <span className="text-green-400 text-sm">↑</span>
      case 'down':
        return <span className="text-red-400 text-sm">↓</span>
      default:
        return <span className="text-gray-400 text-sm">→</span>
    }
  }

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return "text-green-400"
    if (rating >= 4.0) return "text-yellow-400"
    if (rating >= 3.0) return "text-orange-400"
    return "text-red-400"
  }

  return (
    <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-gray-900 to-black relative overflow-hidden">
      {/* Enhanced Background Effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Purple/Pink Glow (Top Right) */}
        <div className="hidden md:block absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-br from-purple-500/15 to-pink-500/15 rounded-full blur-[100px] opacity-70" />
        {/* Blue/Cyan Glow (Bottom Left) */}
        <div className="hidden md:block absolute -bottom-40 -left-40 w-96 h-96 bg-gradient-to-tr from-blue-500/15 to-cyan-500/15 rounded-full blur-[100px] opacity-70" />
        {/* Yellow/Amber Glow (Center Left) */}
        <div className="hidden md:block absolute top-1/4 left-1/12 w-80 h-80 bg-yellow-500/5 rounded-full blur-[120px] opacity-50" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        {/* Top Comments Carousel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12 lg:mb-16"
        >
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 bg-gradient-to-br from-yellow-500 to-amber-600 rounded-lg shadow-lg flex-shrink-0">
                <TrophyIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-white truncate">{t('topComments')}</h2>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-400">
                <span>{currentSlide + 1}</span>
                <span className="text-gray-600">/</span>
                <span>{totalSlides}</span>
              </div>
              <div className="flex items-center gap-1 sm:gap-2">
                <motion.button
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(55, 65, 81, 0.7)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={prevSlide}
                  className="p-1.5 sm:p-2 bg-gray-800/50 rounded-full transition-colors border border-gray-700/50"
                  aria-label="Previous comments"
                >
                  <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05, backgroundColor: "rgba(55, 65, 81, 0.7)" }}
                  whileTap={{ scale: 0.95 }}
                  onClick={nextSlide}
                  className="p-1.5 sm:p-2 bg-gray-800/50 rounded-full transition-colors border border-gray-700/50"
                  aria-label="Next comments"
                >
                  <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </motion.button>
              </div>
            </div>
          </div>

          <div
            ref={carouselRef}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 transition-all duration-500"
          >
            {loading ? (
              // Loading skeleton
              Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="bg-gray-800/60 backdrop-blur-sm rounded-xl p-4 sm:p-5 border border-gray-700/50 animate-pulse">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-gray-700 rounded-full" />
                    <div className="flex-1">
                      <div className="h-4 bg-gray-700 rounded w-24 mb-2" />
                      <div className="h-3 bg-gray-700 rounded w-16" />
                    </div>
                  </div>
                  <div className="h-16 bg-gray-700 rounded mb-4" />
                  <div className="h-4 bg-gray-700 rounded w-full mb-2" />
                  <div className="h-4 bg-gray-700 rounded w-3/4" />
                </div>
              ))
            ) : error ? (
              // Error state
              <div className="col-span-full flex flex-col items-center justify-center py-12">
                <p className="text-red-400 mb-2">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="text-sm text-blue-400 hover:text-blue-300 underline"
                >
                  {t('retry')}
                </button>
              </div>
            ) : topComments.length === 0 ? (
              // Empty state
              <div className="col-span-full flex flex-col items-center justify-center py-12">
                <ChatBubbleLeftIcon className="w-16 h-16 text-gray-600 mb-4" />
                <p className="text-gray-400 text-lg">{t('noComments')}</p>
                <p className="text-gray-500 text-sm">{t('beFirst')}</p>
              </div>
            ) : (
              getCurrentComments().map((comment, index) => (
                <Link
                  key={comment.id}
                  href={getCommentUrl(comment.movieId, comment.type, comment.id)}
                  className="block h-full"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ y: -4, transition: { duration: 0.2 } }}
                    className="bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-xl rounded-xl p-4 sm:p-5 border border-white/[0.06] hover:border-white/[0.15] hover:shadow-[0_0_30px_rgba(255,255,255,0.02)] hover:bg-white/[0.04] transition-all duration-500 flex flex-col h-full group cursor-pointer shadow-[0_8px_32px_rgba(0,0,0,0.3)] relative overflow-hidden"
                  >
                    {/* Subtle Top Shiny Border */}
                    <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    {/* User Info */}
                    <div className="flex items-center gap-2 sm:gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        {comment.user.avatar ? (
                          <Image
                            src={comment.user.avatar}
                            alt={comment.user.name}
                            width={40}
                            height={40}
                            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full object-cover border border-gray-600"
                          />
                        ) : (
                          generateAvatar(comment.user.name)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white text-sm sm:text-base truncate">{comment.user.name}</h3>
                        </div>
                        <p className="text-gray-400 text-xs">{comment.timestamp}</p>
                      </div>
                    </div>

                    {/* Movie Info */}
                    <div className="flex items-start gap-2 sm:gap-3 mb-3">
                      <div className="relative flex-shrink-0">
                        {comment.movie.poster ? (
                          <Image
                            src={comment.movie.poster}
                            alt={comment.movie.title}
                            width={40}
                            height={56}
                            className="w-10 h-14 sm:w-12 sm:h-16 object-cover rounded-lg shadow-lg border border-white/10 transition-transform duration-300 group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-10 h-14 sm:w-12 sm:h-16 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-lg flex items-center justify-center shadow-inner">
                            <span className="text-white text-[10px] font-bold">MOVIE</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-white font-semibold text-xs sm:text-sm truncate group-hover:text-blue-400 transition-colors">
                           {comment.movie.title}
                        </h4>
                        <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mt-1 line-clamp-2">
                          {comment.content}
                        </p>
                      </div>
                    </div>

                    {/* Engagement Stats */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-700/50">
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <motion.span
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.85 }}
                          className="flex items-center gap-1.5 hover:text-red-400 transition-colors cursor-pointer group/like"
                        >
                          <HeartIcon className="w-4 h-4 group-hover/like:fill-red-400 group-hover/like:scale-110 transition-all duration-300" />
                          <span>{comment.likes}</span>
                        </motion.span>
                        <motion.span
                          whileHover={{ scale: 1.15 }}
                          whileTap={{ scale: 0.85 }}
                          className="flex items-center gap-1.5 hover:text-blue-400 transition-colors cursor-pointer group/reply"
                        >
                          <ChatBubbleLeftIcon className="w-4 h-4 group-hover/reply:fill-blue-400 group-hover/reply:scale-110 transition-all duration-300" />
                          <span>{comment.replies}</span>
                        </motion.span>
                      </div>
                      <motion.button
                        whileHover={{ 
                          scale: 1.05,
                          boxShadow: "0 0 12px rgba(96, 165, 250, 0.4)" 
                        }}
                        whileTap={{ scale: 0.95 }}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-all duration-300 font-semibold bg-blue-400/10 hover:bg-blue-400/20 px-3.5 py-1.5 rounded-full border border-blue-400/20 hover:border-blue-400/40 relative overflow-hidden"
                      >
                        {t('reply')}
                      </motion.button>
                    </div>
                  </motion.div>
                </Link>
              ))
            )}
          </div>
        </motion.div>

        {/* Three Column Layout - Unified Pane */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-gradient-to-br from-gray-900/60 to-black/60 backdrop-blur-2xl rounded-2xl border border-white/[0.08] shadow-[0_16px_48px_rgba(0,0,0,0.5)] overflow-hidden"
        >
          <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-white/[0.06]">
            {/* Trending Now */}
            <div className="p-3 sm:p-4 lg:p-6 flex flex-col h-full hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-md flex-shrink-0">
                  <FireIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white truncate">{t('trendingNow')}</h3>
              </div>
              <div className="space-y-2.5">
                {trendingMovies.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">{t('loadingTrending')}</p>
                  </div>
                ) : (
                  trendingMovies.map((movie, index) => (
                    <Link key={movie.id} href={`/movies/${movie.id}`} className={index >= 5 ? "hidden lg:block" : "block"}>
                      <motion.div
                        whileHover={{ x: 4, backgroundColor: "rgba(55, 65, 81, 0.4)" }}
                        className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer group/trending"
                      >
                        <span className={`text-base font-bold w-5 text-center ${index === 0 ? "text-yellow-400" :
                          index === 1 ? "text-gray-300" :
                            index === 2 ? "text-amber-700" : "text-gray-500"
                          }`}>
                          {index + 1}
                        </span>
                        {getTrendIcon(movie.trend)}
                        {movie.poster ? (
                          <Image
                            src={movie.poster}
                            alt={movie.title}
                            width={32}
                            height={48}
                            className="w-8 h-12 object-cover rounded-md shadow-md border border-white/5 flex-shrink-0 group-hover/trending:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-8 h-12 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded flex items-center justify-center shadow-inner flex-shrink-0">
                            <span className="text-white text-xs font-bold">M</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-white text-xs sm:text-sm font-medium truncate block group-hover/trending:text-orange-400 transition-colors">
                            {movie.title}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 sm:mt-1">
                            <span className={`text-[10px] sm:text-xs font-semibold ${movie.trend === 'up' ? 'text-green-400' : movie.trend === 'down' ? 'text-red-400' : 'text-gray-400'}`}>
                              {movie.trend === 'up' ? '+' : ''}{movie.change}%
                            </span>
                            <span className="text-gray-500 text-[10px] sm:text-xs">{t('thisWeek')}</span>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* Most Liked */}
            <div className="p-3 sm:p-4 lg:p-6 flex flex-col h-full hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-gradient-to-br from-red-500 to-pink-500 rounded-lg shadow-md flex-shrink-0">
                  <HeartIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white truncate">{t('mostLiked')}</h3>
              </div>
              <div className="space-y-2.5">
                {mostLikedMovies.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">{t('loadingTopRated')}</p>
                  </div>
                ) : (
                  mostLikedMovies.map((movie, index) => (
                    <Link key={movie.id} href={`/movies/${movie.id}`} className={index >= 5 ? "hidden lg:block" : "block"}>
                      <motion.div
                        whileHover={{ x: 4, backgroundColor: "rgba(55, 65, 81, 0.4)" }}
                        className="flex items-center gap-2 p-1.5 sm:p-2 rounded-lg transition-all cursor-pointer group/liked"
                      >
                        <span className={`text-base font-bold w-5 text-center ${index === 0 ? "text-yellow-400" :
                          index === 1 ? "text-gray-300" :
                            index === 2 ? "text-amber-700" : "text-gray-500"
                          }`}>
                          {index + 1}
                        </span>
                        {getTrendIcon(movie.trend)}
                        {movie.poster ? (
                          <Image
                            src={movie.poster}
                            alt={movie.title}
                            width={32}
                            height={48}
                            className="w-8 h-12 object-cover rounded-md shadow-md border border-white/5 flex-shrink-0 group-hover/liked:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <div className="w-8 h-12 bg-gradient-to-br from-red-500/20 to-pink-500/20 rounded flex items-center justify-center shadow-inner flex-shrink-0">
                            <span className="text-white text-xs font-bold">M</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-white text-xs sm:text-sm font-medium truncate block group-hover/liked:text-pink-400 transition-colors">
                            {movie.title}
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5 sm:mt-1">
                            <StarIcon className={`w-3 h-3 ${getRatingColor(movie.rating || 0)}`} />
                            <span className={`text-[10px] sm:text-xs font-semibold ${getRatingColor(movie.rating || 0)}`}>
                              {movie.rating}
                            </span>
                            <span className="text-gray-500 text-[10px] sm:text-xs">{t('rating')}</span>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                  ))
                )}
              </div>
            </div>

            {/* New Comments */}
            <div className="p-3 sm:p-4 lg:p-6 flex flex-col h-full hover:bg-white/[0.02] transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg shadow-md flex-shrink-0">
                  <SparklesIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white truncate">{t('newComments')}</h3>
              </div>
              <div className="space-y-2.5">
                {newCommentsLoading ? (
                  // Loading skeleton for new comments
                  Array.from({ length: 5 }).map((_, index) => (
                    <div key={index} className="p-3 rounded-lg animate-pulse">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-gray-700 rounded-full flex-shrink-0" />
                        <div className="flex-1">
                          <div className="h-3 bg-gray-700 rounded w-24 mb-2" />
                          <div className="h-3 bg-gray-700 rounded w-full mb-1" />
                          <div className="h-3 bg-gray-700 rounded w-3/4" />
                        </div>
                      </div>
                    </div>
                  ))
                ) : newComments.length === 0 ? (
                  <div className="text-center py-4">
                    <p className="text-gray-500 text-sm">{t('noRecentComments')}</p>
                  </div>
                ) : (
                  <motion.div
                    ref={newCommentsRef}
                    className="relative rounded-xl border border-cyan-400/10 bg-cyan-400/[0.025] p-2 shadow-inner shadow-cyan-500/5 overflow-hidden"
                    animate={shouldCycleNewComments ? {
                      borderColor: ['rgba(34, 211, 238, 0.10)', 'rgba(34, 211, 238, 0.22)', 'rgba(34, 211, 238, 0.10)'],
                      boxShadow: [
                        'inset 0 1px 8px rgba(6, 182, 212, 0.05), 0 0 0 rgba(34, 211, 238, 0)',
                        'inset 0 1px 12px rgba(6, 182, 212, 0.09), 0 0 18px rgba(34, 211, 238, 0.10)',
                        'inset 0 1px 8px rgba(6, 182, 212, 0.05), 0 0 0 rgba(34, 211, 238, 0)'
                      ]
                    } : undefined}
                    transition={{ duration: NEW_COMMENT_SCROLL_INTERVAL / 1000, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    {shouldCycleNewComments && (
                      <div className="pointer-events-none absolute left-1 top-2 bottom-2 z-30 w-px bg-cyan-300/15">
                        <div
                          className="absolute -left-1 h-6 w-2 rounded-full bg-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.85)]"
                          style={{
                            transform: `translateY(${(newCommentStartIndex % NEW_COMMENTS_VISIBLE_COUNT) * (NEW_COMMENT_ROW_HEIGHT + NEW_COMMENT_ROW_GAP)}px)`,
                            transition: newCommentsTransitionEnabled
                              ? `transform ${NEW_COMMENT_SCROLL_DURATION}s cubic-bezier(0.22, 1, 0.36, 1)`
                              : 'none',
                            willChange: 'transform'
                          }}
                        />
                      </div>
                    )}
                    <div
                      className="overflow-hidden"
                      style={{
                        height: shouldCycleNewComments
                          ? NEW_COMMENTS_VISIBLE_COUNT * NEW_COMMENT_ROW_HEIGHT + (NEW_COMMENTS_VISIBLE_COUNT - 1) * NEW_COMMENT_ROW_GAP
                          : undefined
                      }}
                    >
                    <div
                      className="relative z-10 flex flex-col gap-2.5"
                      style={{
                        transform: `translateY(${
                          shouldCycleNewComments
                            ? -newCommentStartIndex * (NEW_COMMENT_ROW_HEIGHT + NEW_COMMENT_ROW_GAP)
                            : 0
                        }px)`,
                        transition: newCommentsTransitionEnabled
                          ? `transform ${NEW_COMMENT_SCROLL_DURATION}s cubic-bezier(0.22, 1, 0.36, 1)`
                          : 'none',
                        willChange: 'transform'
                      }}
                    >
                      {newCommentsTrack.map((comment, index) => (
                    <Link
                      key={`${comment.id}-${index}`}
                      href={getCommentUrl(comment.movieId, comment.type, comment.id)}
                      className="block shrink-0"
                      style={{ height: NEW_COMMENT_ROW_HEIGHT }}
                    >
                      <motion.div
                        whileHover={{ scale: 1.01 }}
                        className={`h-full p-1.5 sm:p-2 rounded-lg transition-all border group/comment cursor-pointer ${
                          index % 2 === 0
                            ? 'bg-white/[0.035] border-white/10 hover:bg-cyan-400/[0.08] hover:border-cyan-300/25'
                            : 'bg-blue-950/20 border-blue-300/10 hover:bg-blue-500/[0.08] hover:border-blue-300/25'
                        }`}
                      >
                        <div className="flex items-start gap-2 h-full">
                          <div className="relative flex-shrink-0">
                            {comment.user.avatar ? (
                              <Image
                                src={comment.user.avatar}
                                alt={comment.user.name}
                                width={32}
                                height={32}
                                className="w-8 h-8 rounded-full object-cover border border-gray-600"
                              />
                            ) : (
                              generateAvatar(comment.user.name)
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-semibold text-white text-xs sm:text-sm group-hover/comment:text-blue-400 transition-colors">
                                {comment.user.name}
                              </span>
                            </div>
                            <p className="text-gray-300 text-xs sm:text-sm leading-relaxed mb-1.5 line-clamp-1">
                              {comment.content}
                            </p>
                            <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400">
                              <span className="text-blue-400 font-medium truncate max-w-[120px] bg-blue-400/10 px-1.5 py-0.5 rounded">
                                ▶ {comment.movie}
                              </span>
                              <span className="bg-gray-700/50 px-1.5 py-0.5 rounded">{comment.timestamp}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </Link>
                      ))}
                    </div>
                    </div>
                  </motion.div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
