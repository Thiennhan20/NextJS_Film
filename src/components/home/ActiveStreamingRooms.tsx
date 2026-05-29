'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import api from '@/lib/axios'
import { Radio, Users, Clock, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'

interface ActiveRoom {
  room_id: string
  title: string
  host_name: string
  host_avatar: string
  host_id: string
  status: string
  member_count: number
  max_users: number
  created_at: number
  ttl_seconds: number
}

const getAvatarGradient = (id: string) => {
  const gradients = [
    'from-rose-500 to-pink-500',
    'from-violet-500 to-purple-500',
    'from-blue-500 to-cyan-500',
    'from-emerald-500 to-teal-500',
    'from-amber-500 to-orange-500',
    'from-red-500 to-rose-500',
    'from-indigo-500 to-blue-500',
    'from-fuchsia-500 to-pink-500',
  ]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash)
  return gradients[Math.abs(hash) % gradients.length]
}

const formatTimeLeft = (ttlSeconds: number) => {
  const h = Math.floor(ttlSeconds / 3600)
  const m = Math.floor((ttlSeconds % 3600) / 60)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

const statusConfig = {
  PLAYING: { color: 'bg-green-400', badge: 'bg-green-500/20 text-green-400', labelKey: 'playing' },
  PAUSED: { color: 'bg-yellow-400', badge: 'bg-yellow-500/20 text-yellow-400', labelKey: 'paused' },
  WAITING: { color: 'bg-blue-400', badge: 'bg-blue-500/20 text-blue-400', labelKey: 'waiting' },
} as const

export default function ActiveStreamingRooms() {
  const [rooms, setRooms] = useState<ActiveRoom[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { dragScrollProps } = useHorizontalDragScroll(scrollRef)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const t = useTranslations('StreamingRooms')

  const fetchRooms = useCallback(async () => {
    try {
      const res = await api.get('/rooms/public')
      setRooms(res.data.rooms || [])
    } catch {
      // Silently fail - section just won't show
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchRooms()
    const interval = setInterval(fetchRooms, 30000)
    return () => clearInterval(interval)
  }, [fetchRooms])

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }, [])

  useEffect(() => {
    checkScroll()
    const el = scrollRef.current
    if (el) {
      el.addEventListener('scroll', checkScroll, { passive: true })
      window.addEventListener('resize', checkScroll)
      return () => {
        el.removeEventListener('scroll', checkScroll)
        window.removeEventListener('resize', checkScroll)
      }
    }
  }, [checkScroll, rooms])

  const scroll = (dir: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const amount = el.clientWidth * 0.7
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  // Don't render anything if no rooms and not loading
  if (!loading && rooms.length === 0) return null

  const status = (s: string) => statusConfig[s as keyof typeof statusConfig] || statusConfig.WAITING

  return (
    <section className="py-6 sm:py-8 lg:py-10">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 sm:mb-5 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <Radio className="h-5 w-5 text-yellow-400" />
              {rooms.length > 0 && (
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </div>
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white">
              {t('title')}
            </h2>
            {rooms.length > 0 && (
              <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 font-semibold tabular-nums">
                {rooms.length}
              </span>
            )}
          </div>
          <Link
            href="/streaming-lobby"
            className="flex items-center gap-1 text-xs sm:text-sm text-yellow-400/80 hover:text-yellow-300 transition-colors font-medium"
          >
            <span className="hidden sm:inline">{t('viewAll')}</span>
            <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Link>
        </div>

        {/* ── Scrollable Room Cards ───────────────────────── */}
        <div className="relative group/scroll">
          {/* Scroll Buttons — hidden on mobile, visible on hover for desktop */}
          {canScrollLeft && (
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 border border-gray-700/60 items-center justify-center text-white opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-black/90 shadow-lg"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          )}
          {canScrollRight && (
            <button
              onClick={() => scroll('right')}
              className="hidden md:flex absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-black/70 border border-gray-700/60 items-center justify-center text-white opacity-0 group-hover/scroll:opacity-100 transition-opacity hover:bg-black/90 shadow-lg"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          )}

          <div
            ref={scrollRef}
            {...dragScrollProps}
            className="horizontal-scroll-container flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth px-4 sm:px-6 lg:px-8 pb-1"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Loading skeletons */}
            {loading && [1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="shrink-0 w-[260px] sm:w-[280px] bg-gray-800/40 rounded-xl p-3.5 border border-gray-700/30 animate-pulse"
              >
                <div className="flex items-center gap-2.5 mb-2.5">
                  <div className="w-8 h-8 rounded-full bg-gray-700" />
                  <div className="flex-1">
                    <div className="h-2.5 w-16 bg-gray-700 rounded mb-1.5" />
                    <div className="h-3.5 w-28 bg-gray-700 rounded" />
                  </div>
                </div>
                <div className="h-7 bg-gray-700/60 rounded-lg" />
              </div>
            ))}

            {/* Room cards */}
            {!loading && (
              <AnimatePresence>
                {rooms.map((room, index) => {
                  const s = status(room.status)
                  return (
                    <motion.div
                      key={room.room_id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.04 }}
                      className="shrink-0 w-[260px] sm:w-[280px]"
                    >
                      <Link
                        href={`/streaming-lobby`}
                        className="block bg-gradient-to-br from-gray-800/50 to-gray-900/50 backdrop-blur-sm rounded-xl p-3.5 border border-gray-700/30 hover:border-yellow-500/25 transition-all duration-300 hover:shadow-md hover:shadow-yellow-500/5 group"
                      >
                        {/* Top row: Avatar + Info + Status dot */}
                        <div className="flex items-center gap-2.5 mb-2.5">
                          {/* Avatar */}
                          <div className="relative shrink-0">
                            {room.host_avatar ? (
                              <Image
                                src={room.host_avatar}
                                alt={room.host_name}
                                width={32}
                                height={32}
                                unoptimized
                                className="w-8 h-8 rounded-full object-cover border border-gray-600/40"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none'
                                  const next = (e.target as HTMLImageElement).nextElementSibling
                                  if (next) next.classList.remove('hidden')
                                }}
                              />
                            ) : null}
                            <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${getAvatarGradient(room.host_id)} flex items-center justify-center text-white text-xs font-bold ${room.host_avatar ? 'hidden' : ''}`}>
                              {room.host_name?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                            {/* Status indicator */}
                            <span className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 ${s.color} rounded-full border-2 border-gray-900`} />
                          </div>

                          {/* Title & Host */}
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-white font-semibold truncate leading-tight" title={room.title}>
                              {room.title || t('untitled')}
                            </p>
                            <p className="text-[11px] text-gray-500 truncate">{room.host_name}</p>
                          </div>
                        </div>

                        {/* Bottom row: Meta + Join */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px] text-gray-500">
                            <span className={`px-1.5 py-0.5 font-bold rounded-full ${s.badge}`}>
                              {t(s.labelKey)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Users className="h-2.5 w-2.5" />
                              {room.member_count}/{room.max_users}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {formatTimeLeft(room.ttl_seconds)}
                            </span>
                          </div>
                          <span className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all ${
                            room.member_count >= room.max_users
                              ? 'bg-gray-700/60 text-gray-500'
                              : 'bg-yellow-500/15 text-yellow-400 group-hover:bg-yellow-500/25'
                          }`}>
                            {room.member_count >= room.max_users ? t('full') : t('join')}
                          </span>
                        </div>
                      </Link>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
