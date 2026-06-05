'use client'

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Play, Clock, Trash2, AlertCircle } from 'lucide-react'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import { useRecentlyWatchedStore } from '@/store/useRecentlyWatchedStore'
import api from '@/lib/axios'
import { useTranslations } from 'next-intl'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'

interface RecentlyWatchedItem {
  id: string
  server: string
  audio: string
  currentTime: number
  duration?: number
  title?: string
  poster?: string
  lastWatched?: string
  isTVShow?: boolean
  season?: number
  episode?: number
  watchUrl?: string
}

interface RecentlyWatchedProps {
  className?: string
}

// ✅ OPTIMIZATION 1: Cache localStorage parsing
const CACHE_DURATION = 5000 // 5s

let cachedData: { items: RecentlyWatchedItem[], timestamp: number } | null = null

// ✅ OPTIMIZATION 2: Respect user's motion preferences
const ContentCard = memo(({ item, index, onContinue, onRemove }: {
  item: RecentlyWatchedItem
  index: number
  onContinue: (item: RecentlyWatchedItem) => void
  onRemove: (item: RecentlyWatchedItem) => void
}) => {
  const shouldReduceMotion = useReducedMotion()

  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [])

  const formatLastWatched = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))

    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }, [])

  const progress = useMemo(() =>
    (item.currentTime / (item.duration || item.currentTime * 2)) * 100,
    [item.currentTime, item.duration]
  )

  const subtitle = useMemo(() => {
    if (item.isTVShow && item.season && item.episode) {
      return `S${item.season} E${item.episode}`
    }
    return null
  }, [item.isTVShow, item.season, item.episode])

  // ✅ Reduced animations for better performance
  const cardVariants = shouldReduceMotion ? {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 }
  } : {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -20 }
  }

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{
        duration: shouldReduceMotion ? 0.15 : 0.3,
        delay: shouldReduceMotion ? 0 : Math.min(index * 0.03, 0.2), // Giảm delay
        ease: [0.25, 0.1, 0.25, 1]
      }}
      onClick={() => onContinue(item)}
      className="group relative bg-gray-900/50 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-800/50 hover:border-red-500/50 transition-all duration-300 flex-shrink-0 snap-center cursor-pointer [&:hover_img]:scale-105"
      style={{
        width: 'clamp(180px, 25vw, 260px)',
        minWidth: '180px'
      }}
    >
      <div className="aspect-[16/9] bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
        {item.poster && (
          <Image
            src={item.poster}
            alt={item.title || `Content ${item.id}`}
            fill
            className="object-cover transition-transform duration-300"
            style={{ transform: 'scale(1)' }}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            priority={index < 3} // Chỉ priority 3 items đầu
            quality={70} // Giảm quality từ 75 xuống 70
            loading={index < 3 ? 'eager' : 'lazy'}
          />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />

        <div className="absolute bottom-0 left-0 right-0 z-20">
          <div className="w-full h-1 bg-gray-700">
            <div
              className="h-full bg-red-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none">
          <div className="bg-red-600 text-white p-3 rounded-full shadow-2xl">
            <Play className="w-5 h-5 ml-0.5" fill="currentColor" />
          </div>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(item);
          }}
          className="absolute top-2 right-2 z-40 bg-black/50 hover:bg-red-600/80 text-white p-1.5 rounded-full transition-colors duration-300"
          aria-label="Remove from history"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3">
        <h3 className="font-semibold text-white mb-1.5 text-sm truncate" title={item.title || `Content ${item.id}`}>
          {item.title || `Content ${item.id}`}
        </h3>
        {subtitle && (
          <p className="text-xs text-gray-400 mb-1">{subtitle}</p>
        )}

        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{formatTime(item.currentTime)}</span>
          </div>
          <span>{formatLastWatched(item.lastWatched || '')}</span>
        </div>

        <div className="mt-1.5 flex items-center gap-1.5">
          <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
            {item.server}
          </span>
          <span className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
            {item.audio}
          </span>
        </div>
      </div>
    </motion.div>
  )
})

ContentCard.displayName = 'ContentCard'

export default function RecentlyWatched({ className = '' }: RecentlyWatchedProps) {
  const [recentItems, setRecentItems] = useState<RecentlyWatchedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const router = useRouter()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const { dragScrollProps } = useHorizontalDragScroll(scrollContainerRef)
  const shouldReduceMotion = useReducedMotion()
  const t = useTranslations('RecentlyWatched')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = useAuthStore((s) => (s.user as any)?.id || (s.user as any)?._id)

  // Check scroll position to show/hide buttons
  const checkScrollPosition = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current
      setCanScrollLeft(scrollLeft > 5)
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 5)
    }
  }, [])

  // Check scroll position on mount, resize, scroll, and when items change
  useEffect(() => {
    checkScrollPosition()
    const timeoutId = setTimeout(checkScrollPosition, 350)

    const container = scrollContainerRef.current
    if (container) {
      container.addEventListener('scroll', checkScrollPosition)
    }
    window.addEventListener('resize', checkScrollPosition)

    return () => {
      clearTimeout(timeoutId)
      if (container) {
        container.removeEventListener('scroll', checkScrollPosition)
      }
      window.removeEventListener('resize', checkScrollPosition)
    }
  }, [checkScrollPosition, recentItems])

  // ✅ OPTIMIZATION 3: Cached localStorage parsing
  const fetchRecentItems = useCallback(async () => {
    try {
      const now = Date.now()
      // Logged-in: fetch from server and return
      if (userId) {
        const resp = await api.get('/recently-watched', { params: { page: 1, limit: 20 } })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const srvItems: RecentlyWatchedItem[] = (resp.data?.items || []).map((it: any) => ({
          id: String(it.contentId),
          server: it.server,
          audio: it.audio,
          currentTime: it.currentTime,
          duration: it.duration,
          title: it.title,
          poster: it.poster,
          lastWatched: it.lastWatched,
          isTVShow: !!it.isTVShow,
          season: it.season ?? undefined,
          episode: it.episode ?? undefined,
          watchUrl: it.watchUrl ?? undefined,
        }))
        setRecentItems(srvItems)
        // Populate shared Zustand store for /recently-watched page
        useRecentlyWatchedStore.getState().setCachedItems(srvItems)
        setLoading(false)
        return
      }

      // Guest: parse localStorage with cache
      if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
        setRecentItems(cachedData.items)
        setLoading(false)
        return
      }

      const items: RecentlyWatchedItem[] = []
      const allKeys = Object.keys(localStorage)
      let processedCount = 0
      const MAX_PROCESS = 30 // Giảm từ 50 xuống 30

      for (const key of allKeys) {
        if (processedCount >= MAX_PROCESS) break

        const isMovie = key.startsWith('movie-progress-')
        const isTVShow = key.startsWith('tvshow-progress-')

        if (!isMovie && !isTVShow) continue

        const value = localStorage.getItem(key)
        if (!value) continue

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let progressData: any
        try {
          progressData = JSON.parse(value)
        } catch {
          continue
        }

        if (!progressData.currentTime || progressData.currentTime <= 0) continue

        if (isMovie) {
          const keyParts = key.replace('movie-progress-', '')
          const id = keyParts

          items.push({
            id,
            server: progressData.server || 'server1',
            audio: progressData.audio || 'vietsub',
            currentTime: progressData.currentTime,
            duration: progressData.duration,
            title: progressData.title,
            poster: progressData.poster,
            lastWatched: progressData.lastWatched || new Date().toISOString(),
            isTVShow: false,
            watchUrl: progressData.watchUrl || undefined,
          })
          processedCount++
        } else if (isTVShow) {
          const keyParts = key.replace('tvshow-progress-', '').split('-')
          if (keyParts.length < 3) continue

          const [id, season, episode] = keyParts

          items.push({
            id,
            server: progressData.server || 'server1',
            audio: progressData.audio || 'vietsub',
            currentTime: progressData.currentTime,
            duration: progressData.duration,
            title: progressData.title,
            poster: progressData.poster,
            lastWatched: progressData.lastWatched || new Date().toISOString(),
            isTVShow: true,
            season: parseInt(season),
            episode: parseInt(episode),
            watchUrl: progressData.watchUrl || undefined,
          })
          processedCount++
        }
      }

      const sortedItems = items.sort((a, b) =>
        new Date(b.lastWatched || 0).getTime() - new Date(a.lastWatched || 0).getTime()
      ).slice(0, 10) // Giảm từ 12 xuống 10 items

      cachedData = { items: sortedItems, timestamp: now }

      setRecentItems(sortedItems)
    } catch (error) {
      console.error('Error fetching recent items:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchRecentItems()

    let timeoutId: NodeJS.Timeout
    const handleStorageChange = () => {
      cachedData = null // Invalidate cache
      clearTimeout(timeoutId)
      timeoutId = setTimeout(fetchRecentItems, 500) // Tăng từ 300ms lên 500ms
    }

    window.addEventListener('storage', handleStorageChange)
    return () => {
      clearTimeout(timeoutId)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [fetchRecentItems, userId])

  const handleContinueWatching = useCallback((item: RecentlyWatchedItem) => {
    if (item.isTVShow && item.season && item.episode) {
      router.push(`/tvshows/${item.id}?season=${item.season}&episode=${item.episode}&server=${item.server}&audio=${item.audio}`)
    } else {
      router.push(`/movies/${item.id}?server=${item.server}&audio=${item.audio}`)
    }
  }, [router])

  const handleRemoveFromRecent = useCallback(async (item: RecentlyWatchedItem) => {
    // Optimistic update: remove from UI immediately
    setRecentItems(prev => prev.filter(i =>
      !(i.id === item.id && i.isTVShow === item.isTVShow && i.season === item.season && i.episode === item.episode)
    ))

    if (userId) {
      // Logged-in: delete from database
      try {
        await api.delete('/recently-watched', {
          data: {
            contentId: item.id,
            isTVShow: item.isTVShow || false,
            season: item.season ?? null,
            episode: item.episode ?? null,
          },
        })
      } catch (error) {
        console.error('Failed to delete from database:', error)
        // Re-fetch to restore UI state if delete failed
        fetchRecentItems()
      }
    } else {
      // Guest: delete from localStorage
      const key = item.isTVShow && item.season && item.episode
        ? `tvshow-progress-${item.id}-${item.season}-${item.episode}`
        : `movie-progress-${item.id}`
      localStorage.removeItem(key)
      cachedData = null // Invalidate cache
    }
  }, [userId, fetchRecentItems])

  if (loading) {
    return (
      <section className={`py-16 px-4 sm:px-6 lg:px-8 ${className}`}>
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-800 rounded-lg w-64 mb-8"></div>
            <div className="flex gap-4 overflow-x-hidden">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="bg-gray-800 rounded-xl flex-shrink-0"
                  style={{ width: 'clamp(180px, 25vw, 260px)', aspectRatio: '16/10' }}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className={`py-12 px-4 sm:px-6 lg:px-8 ${className}`}>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: shouldReduceMotion ? 0.15 : 0.4 }}
          viewport={{ once: true, margin: "-50px" }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-red-500 to-pink-500 text-transparent bg-clip-text">
              {t('title')}
            </h2>
            {userId ? (
              <span className="ml-3 text-xs px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-600/40">{t('savedForever')}</span>
            ) : (
              <span className="ml-3 text-xs px-2 py-0.5 rounded bg-yellow-600/20 text-yellow-300 border border-yellow-600/40">{t('storage24h')}</span>
            )}
          </div>
          {!userId && (
            <div className="flex items-center gap-2 ml-8 -mt-2 mb-2 text-yellow-300">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs sm:text-sm">{t('signInSave')}</span>
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: shouldReduceMotion ? 0.15 : 0.5 }}
          viewport={{ once: true, margin: "-50px" }}
          className="relative group"
        >
          <div
            ref={scrollContainerRef}
            {...dragScrollProps}
            className="horizontal-scroll-container flex gap-4 overflow-x-auto pb-4 snap-x snap-proximity scrollbar-hide"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
              WebkitOverflowScrolling: 'touch'
            }}
          >
            <AnimatePresence mode="popLayout">
              {recentItems.length > 0 ? recentItems.map((item, index) => (
                <ContentCard
                  key={`${item.isTVShow ? 'tv' : 'movie'}-${item.id}-${item.season || ''}-${item.episode || ''}`}
                  item={item}
                  index={index}
                  onContinue={handleContinueWatching}
                  onRemove={handleRemoveFromRecent}
                />
              )) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: shouldReduceMotion ? 0 : -20 }}
                  transition={{ duration: shouldReduceMotion ? 0.15 : 0.4 }}
                  className="flex items-center justify-center py-16 px-8 w-full"
                >
                  <div className="text-center w-full max-w-md mx-auto">
                    <motion.h3
                      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: shouldReduceMotion ? 0 : 0.1 }}
                      className="text-xl font-semibold text-white"
                    >
                      {t('noMovies')}
                    </motion.h3>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {recentItems.length > 0 && (
            <>
              {canScrollLeft && (
                <motion.button
                  onClick={() => {
                    if (scrollContainerRef.current) {
                      scrollContainerRef.current.scrollBy({ left: -300, behavior: 'smooth' });
                    }
                  }}
                  className="absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full border border-white/10 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-md opacity-0 transition-all duration-300 hover:bg-white hover:text-black group-hover:opacity-100 sm:p-3"
                  aria-label="Scroll left"
                  whileHover={{ scale: shouldReduceMotion ? 1 : 1.1 }}
                  whileTap={{ scale: shouldReduceMotion ? 1 : 0.9 }}
                >
                  <ChevronLeftIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </motion.button>
              )}
              {canScrollRight && (
                <motion.button
                  onClick={() => {
                    if (scrollContainerRef.current) {
                      scrollContainerRef.current.scrollBy({ left: 300, behavior: 'smooth' });
                    }
                  }}
                  className="absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-20 flex items-center justify-center rounded-full border border-white/10 bg-black/80 p-2 text-white shadow-2xl backdrop-blur-md opacity-0 transition-all duration-300 hover:bg-white hover:text-black group-hover:opacity-100 sm:p-3"
                  aria-label="Scroll right"
                  whileHover={{ scale: shouldReduceMotion ? 1 : 1.1 }}
                  whileTap={{ scale: shouldReduceMotion ? 1 : 0.9 }}
                >
                  <ChevronRightIcon className="h-5 w-5 sm:h-6 sm:w-6" />
                </motion.button>
              )}
            </>
          )}
        </motion.div>

        {recentItems.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0.15 : 0.4, delay: shouldReduceMotion ? 0 : 0.2 }}
            viewport={{ once: true }}
            className="mt-6 text-center"
          >
            <motion.button
              whileHover={{ scale: shouldReduceMotion ? 1 : 1.05 }}
              whileTap={{ scale: shouldReduceMotion ? 1 : 0.95 }}
              onClick={() => router.push('/recently-watched')}
              className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {t('viewHistory')}
            </motion.button>
          </motion.div>
        )}
      </div>
    </section>
  )
}
