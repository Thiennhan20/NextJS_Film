'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { PlayIcon as Play, ClockIcon as Clock, TrashIcon as Trash2, ExclamationCircleIcon as AlertCircle, ArrowPathIcon as Loader2 } from '@heroicons/react/24/outline'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import { useRecentlyWatchedStore } from '@/store/useRecentlyWatchedStore'
import api from '@/lib/axios'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

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

const ITEMS_PER_PAGE = 20

export default function RecentlyWatchedClient() {
  const [items, setItems] = useState<RecentlyWatchedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const router = useRouter()
  const t = useTranslations('RecentlyWatched')
  const observerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = useAuthStore((s) => (s.user as any)?.id || (s.user as any)?._id)
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked)

  // Format time helper
  const formatTime = useCallback((seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }, [])

  // Format relative time
  const formatLastWatched = useCallback((dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    if (diffInHours < 1) return 'Just now'
    if (diffInHours < 24) return `${diffInHours}h ago`
    return `${Math.floor(diffInHours / 24)}d ago`
  }, [])

  // Fetch items from server (logged-in user) — true server-side pagination
  const fetchServerItems = useCallback(async (pageNum: number) => {
    const resp = await api.get('/recently-watched', {
      params: { page: pageNum, limit: ITEMS_PER_PAGE }
    })
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

    return { items: srvItems, hasMore: !!resp.data?.hasMore }
  }, [])

  // Fetch items from localStorage (guest user)
  const fetchLocalItems = useCallback((pageNum: number) => {
    const allItems: RecentlyWatchedItem[] = []
    const allKeys = Object.keys(localStorage)

    for (const key of allKeys) {
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
        const id = key.replace('movie-progress-', '')
        allItems.push({
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
      } else if (isTVShow) {
        const keyParts = key.replace('tvshow-progress-', '').split('-')
        if (keyParts.length < 3) continue
        const [id, season, episode] = keyParts
        allItems.push({
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
      }
    }

    // Sort by last watched
    allItems.sort((a, b) =>
      new Date(b.lastWatched || 0).getTime() - new Date(a.lastWatched || 0).getTime()
    )

    const startIdx = (pageNum - 1) * ITEMS_PER_PAGE
    const endIdx = startIdx + ITEMS_PER_PAGE
    const pageItems = allItems.slice(startIdx, endIdx)
    const more = endIdx < allItems.length

    return { items: pageItems, hasMore: more }
  }, [])

  // Initial load — use Zustand cache if available, then prefetch page 2
  useEffect(() => {
    if (!isAuthChecked) return

    const loadInitial = async () => {
      try {
        setLoading(true)

        if (userId) {
          const store = useRecentlyWatchedStore.getState()
          const cached = store.cachedItems

          if (cached.length > 0) {
            // Show first 20 from cache instantly (preview while API loads)
            setItems(cached.slice(0, ITEMS_PER_PAGE))
            setLoading(false)
          }

          // Always fetch fresh page 1 + page 2 from API
          const [page1, page2] = await Promise.all([
            fetchServerItems(1),
            fetchServerItems(2),
          ])
          const allItems = [...page1.items, ...page2.items]
          setItems(allItems)
          store.setCachedItems(page1.items)
          setHasMore(page2.hasMore)
          setPage(2)
        } else {
          // Guest: fetch 2 pages from localStorage
          const page1 = fetchLocalItems(1)
          const page2 = fetchLocalItems(2)
          const allItems = [...page1.items, ...page2.items]
          setItems(allItems)
          setHasMore(page2.hasMore)
          setPage(2)
        }
      } catch (error) {
        console.error('Error fetching recently watched:', error)
      } finally {
        setLoading(false)
      }
    }

    loadInitial()
  }, [userId, isAuthChecked, fetchServerItems, fetchLocalItems])

  // Load more
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1

    try {
      setLoadingMore(true)
      let result: { items: RecentlyWatchedItem[]; hasMore: boolean }

      if (userId) {
        result = await fetchServerItems(nextPage)
      } else {
        result = fetchLocalItems(nextPage)
      }

      setItems(prev => [...prev, ...result.items])
      setHasMore(result.hasMore)
      setPage(nextPage)
    } catch (error) {
      console.error('Error loading more:', error)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, page, userId, fetchServerItems, fetchLocalItems])

  // Intersection Observer for infinite scroll — triggers early (800px before sentinel)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loadingMore) {
          loadMore()
        }
      },
      { threshold: 0.1, rootMargin: '0px 0px 800px 0px' }
    )

    const currentRef = observerRef.current
    if (currentRef) observer.observe(currentRef)

    return () => {
      if (currentRef) observer.unobserve(currentRef)
    }
  }, [hasMore, loadingMore, loadMore])

  // Navigate to watch
  const handleContinue = useCallback((item: RecentlyWatchedItem) => {
    if (item.isTVShow && item.season && item.episode) {
      router.push(`/tvshows/${item.id}?season=${item.season}&episode=${item.episode}&server=${item.server}&audio=${item.audio}`)
    } else {
      router.push(`/movies/${item.id}?server=${item.server}&audio=${item.audio}`)
    }
  }, [router])

  // Remove item
  const handleRemove = useCallback(async (item: RecentlyWatchedItem) => {
    // Optimistic update
    setItems(prev => prev.filter(i =>
      !(i.id === item.id && i.isTVShow === item.isTVShow && i.season === item.season && i.episode === item.episode)
    ))

    if (userId) {
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
        console.error('Failed to delete:', error)
      }
    } else {
      const key = item.isTVShow && item.season && item.episode
        ? `tvshow-progress-${item.id}-${item.season}-${item.episode}`
        : `movie-progress-${item.id}`
      localStorage.removeItem(key)
    }
  }, [userId])

  // Compute the item count for display
  const itemCount = useMemo(() => items.length, [items])

  if (loading || !isAuthChecked) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10 pt-6 sm:pt-10 lg:pt-14 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="animate-pulse space-y-4">
              <div className="flex items-center gap-3 mb-8">
                <div className="p-2 rounded-lg bg-gray-800 w-9 h-9" />
                <div className="space-y-2">
                  <div className="h-8 bg-gray-800 rounded-lg w-40" />
                  <div className="h-4 bg-gray-800 rounded-lg w-20" />
                </div>
                <div className="h-5 bg-gray-800 rounded w-20 ml-auto" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="bg-gray-800 rounded-xl aspect-[2/3]" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <section className="pt-6 sm:pt-10 lg:pt-14 pb-10 sm:pb-16 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 mb-6 sm:mb-8"
            >
              <Link
                href="/"
                className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-300" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-red-500 to-pink-500 text-transparent bg-clip-text">
                  {t('title')}
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </p>
              </div>
              {userId ? (
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-300 border border-emerald-600/40">{t('savedForever')}</span>
              ) : (
                <span className="ml-auto text-xs px-2 py-0.5 rounded bg-yellow-600/20 text-yellow-300 border border-yellow-600/40">{t('storage24h')}</span>
              )}
            </motion.div>

            {/* Guest warning */}
            {!userId && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 mb-4 sm:mb-6 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20"
              >
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                <span className="text-xs sm:text-sm text-yellow-300">{t('signInSave')}</span>
              </motion.div>
            )}

            {/* Grid of items */}
            {items.length > 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4"
              >
                <AnimatePresence mode="popLayout">
                  {items.map((item, index) => (
                    <motion.div
                      key={`${item.isTVShow ? 'tv' : 'movie'}-${item.id}-${item.season || ''}-${item.episode || ''}`}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                      onClick={() => handleContinue(item)}
                      className="group relative bg-gray-900/60 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-800/50 hover:border-red-500/50 transition-all duration-300 cursor-pointer"
                    >
                      {/* Poster */}
                      <div className="aspect-[2/3] bg-gradient-to-br from-gray-800 to-gray-900 relative overflow-hidden">
                        {item.poster ? (
                          <Image
                            src={item.poster}
                            alt={item.title || `Content ${item.id}`}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-105"
                            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 20vw"
                            loading={index < 10 ? 'eager' : 'lazy'}
                            quality={70}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Play className="w-10 h-10 text-gray-600" />
                          </div>
                        )}

                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />

                        {/* Progress bar */}
                        <div className="absolute bottom-0 left-0 right-0 z-20">
                          <div className="w-full h-1 bg-gray-700/80">
                            <div
                              className="h-full bg-red-500 transition-all"
                              style={{ width: `${Math.min((item.currentTime / (item.duration || item.currentTime * 2)) * 100, 100)}%` }}
                            />
                          </div>
                        </div>

                        {/* Play button overlay */}
                        <div className="absolute inset-0 flex items-center justify-center z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                          <div className="bg-red-600/90 text-white p-3 sm:p-4 rounded-full shadow-2xl backdrop-blur-sm">
                            <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5" fill="currentColor" />
                          </div>
                        </div>

                        {/* Remove button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleRemove(item)
                          }}
                          className="absolute top-2 right-2 z-40 bg-black/50 hover:bg-red-600/80 text-white p-1.5 rounded-full transition-colors duration-200 opacity-0 group-hover:opacity-100"
                          aria-label="Remove from history"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Episode badge */}
                        {item.isTVShow && item.season && item.episode && (
                          <div className="absolute top-2 left-2 z-30 bg-purple-600/90 text-white text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded backdrop-blur-sm">
                            S{item.season} E{item.episode}
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="p-2.5 sm:p-3">
                        <h3
                          className="font-semibold text-white text-xs sm:text-sm truncate mb-1"
                          title={item.title || `Content ${item.id}`}
                        >
                          {item.title || `Content ${item.id}`}
                        </h3>

                        <div className="flex items-center justify-between text-[10px] sm:text-xs text-gray-400">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(item.currentTime)}</span>
                          </div>
                          <span>{formatLastWatched(item.lastWatched || '')}</span>
                        </div>

                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] bg-gray-700/80 text-gray-300 px-1.5 py-0.5 rounded">
                            {item.server}
                          </span>
                          <span className="text-[10px] bg-gray-700/80 text-gray-300 px-1.5 py-0.5 rounded">
                            {item.audio}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 text-center"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gray-800/50 flex items-center justify-center mb-6 border border-gray-700/50">
                  <Clock className="w-10 h-10 sm:w-12 sm:h-12 text-gray-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">{t('noMovies')}</h3>
                <p className="text-sm text-gray-400 mb-6">{t('exploreButton')}</p>
                <Link
                  href="/"
                  className="bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 shadow-lg hover:shadow-xl"
                >
                  Browse Movies
                </Link>
              </motion.div>
            )}

            {/* Infinite scroll sentinel + loading indicator */}
            {items.length > 0 && (
              <div className="py-6 flex flex-col items-center">
                {hasMore && (
                  <>
                    {/* Sentinel — observed with 800px rootMargin to trigger early */}
                    <div ref={observerRef} className="h-1 w-full" />
                    {loadingMore && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex items-center gap-2 text-gray-400 mt-4"
                      >
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm">Loading more...</span>
                      </motion.div>
                    )}
                  </>
                )}
                {!hasMore && items.length > ITEMS_PER_PAGE && (
                  <p className="text-sm text-gray-500">You&apos;ve reached the end</p>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
