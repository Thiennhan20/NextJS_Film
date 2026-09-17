'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import api from '@/lib/axios'
import {
  SignalIcon as Radio,
  UsersIcon as Users,
  ClockIcon as Clock,
  ArrowRightIcon as ArrowRight,
  ChevronLeftIcon as ChevronLeft,
  ChevronRightIcon as ChevronRight,
  FilmIcon as Film,
} from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'
import useAuthStore from '@/store/useAuthStore'

interface ActiveRoom {
  room_id: string
  title: string
  poster?: string
  host_name: string
  host_avatar: string
  host_id: string
  status: string
  member_count: number
  max_users: number
  created_at: number
  ttl_seconds: number
  content_type?: string
  season?: number | null
  current_episode?: number | null
  movie_id?: string | number
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

export default function ActiveStreamingRooms() {
  const [rooms, setRooms] = useState<ActiveRoom[]>([])
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const { dragScrollProps } = useHorizontalDragScroll(scrollRef)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const t = useTranslations('StreamingRooms')

  const user = useAuthStore((s) => s.user)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (user as any)?.id || (user as any)?._id || ''

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
    const amount = el.clientWidth * 0.75
    el.scrollBy({ left: dir === 'left' ? -amount : amount, behavior: 'smooth' })
  }

  // Don't render anything if no rooms and not loading
  if (!loading && rooms.length === 0) return null

  return (
    <section className="py-6 sm:py-8 lg:py-10">
      <div className="max-w-7xl mx-auto">
        {/* ── Header ──────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4 sm:mb-5 px-4 sm:px-6 lg:px-8">
          {/* Left: Live Indicator & Title */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center justify-center">
              <Radio className="h-5 w-5 text-yellow-400" />
              {rooms.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg lg:text-xl font-bold text-white tracking-tight">
              {t('title')}
            </h2>
            {rooms.length > 0 && (
              <span className="text-[10px] sm:text-xs px-2 py-0.5 rounded-full bg-red-500/15 border border-red-500/20 text-red-400 font-semibold tabular-nums">
                {rooms.length}
              </span>
            )}
          </div>

          {/* Right: Scroll Carousel Buttons + View All link */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Carousel navigation buttons (placed cleanly in header, not covering cards) */}
            <div className="hidden sm:flex items-center gap-1.5 mr-1">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                aria-label="Scroll left"
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                  canScrollLeft
                    ? 'border-white/10 bg-zinc-900/80 hover:bg-zinc-800 text-white hover:border-yellow-500/40 active:scale-95 cursor-pointer shadow-sm'
                    : 'border-white/5 bg-zinc-900/20 text-zinc-600 cursor-not-allowed opacity-35'
                }`}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => scroll('right')}
                disabled={!canScrollRight}
                aria-label="Scroll right"
                className={`w-7 h-7 rounded-lg border flex items-center justify-center transition-all ${
                  canScrollRight
                    ? 'border-white/10 bg-zinc-900/80 hover:bg-zinc-800 text-white hover:border-yellow-500/40 active:scale-95 cursor-pointer shadow-sm'
                    : 'border-white/5 bg-zinc-900/20 text-zinc-600 cursor-not-allowed opacity-35'
                }`}
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <Link
              href="/streaming-lobby"
              className="group/link flex items-center gap-1 text-xs sm:text-sm text-yellow-400/90 hover:text-yellow-300 transition-colors font-medium px-2 py-1 rounded-md hover:bg-yellow-400/5"
            >
              <span>{t('viewAll')}</span>
              <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 transition-transform duration-200 group-hover/link:translate-x-0.5" />
            </Link>
          </div>
        </div>

        {/* ── Scrollable Room Cards ───────────────────────── */}
        <div className="relative">
          <div
            ref={scrollRef}
            {...dragScrollProps}
            className="horizontal-scroll-container flex gap-3.5 overflow-x-auto scrollbar-hide scroll-smooth snap-x snap-mandatory px-4 sm:px-6 lg:px-8 pb-2 pt-0.5"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {/* Loading skeletons */}
            {loading &&
              [1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="shrink-0 w-[290px] sm:w-[315px] snap-start snap-always bg-zinc-900/50 rounded-2xl p-3.5 border border-white/5 animate-pulse"
                >
                  <div className="flex gap-3 mb-3">
                    <div className="w-14 h-20 rounded-xl bg-zinc-800 shrink-0" />
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="h-4 w-3/4 bg-zinc-800 rounded mb-2" />
                      <div className="h-3 w-1/2 bg-zinc-800/70 rounded mb-3" />
                      <div className="h-4 w-16 bg-zinc-800/50 rounded-full" />
                    </div>
                  </div>
                  <div className="border-t border-white/5 pt-2 flex items-center justify-between">
                    <div className="h-3.5 w-20 bg-zinc-800/60 rounded" />
                    <div className="h-6 w-16 bg-zinc-800 rounded-lg" />
                  </div>
                </div>
              ))}

            {/* Room cards */}
            {!loading && (
              <AnimatePresence>
                {rooms.map((room, index) => {
                  const isFull = room.member_count >= room.max_users && userId !== room.host_id
                  const isPlaying = room.status === 'PLAYING'
                  const isPaused = room.status === 'PAUSED'

                  return (
                    <motion.div
                      key={room.room_id}
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.96 }}
                      transition={{ delay: index * 0.04 }}
                      className="shrink-0 w-[290px] sm:w-[315px] snap-start snap-always"
                    >
                      <Link
                        href={`/streaming-room?room=${encodeURIComponent(room.room_id)}`}
                        onClick={(e) => {
                          if (isFull) {
                            e.preventDefault()
                          }
                        }}
                        aria-disabled={isFull}
                        className={`relative block rounded-2xl p-3.5 bg-gradient-to-b from-zinc-900/90 to-zinc-950/95 backdrop-blur-md border border-white/10 transition-all duration-300 group overflow-hidden shadow-lg shadow-black/40 ${
                          isFull
                            ? 'opacity-60 cursor-not-allowed'
                            : 'hover:border-yellow-500/40 hover:shadow-xl hover:shadow-yellow-500/5 hover:-translate-y-0.5 cursor-pointer'
                        }`}
                      >
                        {/* Subtle top-right ambient hover glow */}
                        <div className="absolute -top-10 -right-10 w-24 h-24 bg-yellow-500/0 group-hover:bg-yellow-500/10 rounded-full blur-xl pointer-events-none transition-all duration-500" />

                        {/* Top Area: Mini Poster + Info */}
                        <div className="flex gap-3 mb-3">
                          {/* Mini Poster */}
                          <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 bg-zinc-900 border border-white/10 shadow-md group-hover:border-yellow-500/30 transition-all">
                            {room.poster ? (
                              <Image
                                src={room.poster}
                                alt={room.title}
                                fill
                                sizes="56px"
                                unoptimized
                                className="object-cover transition-transform duration-500 group-hover:scale-105"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none'
                                  const fallback = (e.target as HTMLElement).nextElementSibling
                                  if (fallback) fallback.classList.remove('hidden')
                                }}
                              />
                            ) : null}

                            {/* Fallback film card when poster is empty or fails */}
                            <div
                              className={`absolute inset-0 bg-gradient-to-br from-zinc-800 to-zinc-950 flex flex-col items-center justify-center text-zinc-500 p-1 text-center ${
                                room.poster ? 'hidden' : ''
                              }`}
                            >
                              <Film className="w-5 h-5 mb-0.5 text-zinc-400" />
                              <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-wider">
                                {room.content_type === 'tvshow' ? 'Series' : 'Cinema'}
                              </span>
                            </div>

                            {/* Series/Episode badge over poster */}
                            {room.content_type === 'tvshow' && (
                              <span className="absolute bottom-0 inset-x-0 text-center text-[9px] font-semibold bg-black/80 text-yellow-400 px-1 py-0.5 backdrop-blur-xs truncate">
                                {room.season && room.current_episode
                                  ? `S${room.season} E${room.current_episode}`
                                  : 'TV'}
                              </span>
                            )}
                          </div>

                          {/* Info Column */}
                          <div className="min-w-0 flex-1 flex flex-col justify-between pt-0.5">
                            <div>
                              {/* Title */}
                              <p
                                className="text-sm font-semibold text-white/95 truncate leading-tight group-hover:text-yellow-400 transition-colors"
                                title={room.title}
                              >
                                {room.title || t('untitled')}
                              </p>

                              {/* Host Info */}
                              <div className="flex items-center gap-1.5 mt-1.5">
                                <div className="relative shrink-0">
                                  {room.host_avatar ? (
                                    <Image
                                      src={room.host_avatar}
                                      alt={room.host_name}
                                      width={18}
                                      height={18}
                                      unoptimized
                                      className="w-4.5 h-4.5 rounded-full object-cover border border-white/15"
                                      onError={(e) => {
                                        (e.target as HTMLImageElement).style.display = 'none'
                                        const next = (e.target as HTMLImageElement).nextElementSibling
                                        if (next) next.classList.remove('hidden')
                                      }}
                                    />
                                  ) : null}
                                  <div
                                    className={`w-4.5 h-4.5 rounded-full bg-gradient-to-br ${getAvatarGradient(
                                      room.host_id
                                    )} flex items-center justify-center text-[10px] text-white font-bold ${
                                      room.host_avatar ? 'hidden' : ''
                                    }`}
                                  >
                                    {room.host_name?.charAt(0)?.toUpperCase() || '?'}
                                  </div>
                                </div>
                                <span
                                  className="text-[11px] text-zinc-400 truncate max-w-[135px]"
                                  title={room.host_name}
                                >
                                  {room.host_name}
                                </span>
                              </div>
                            </div>

                            {/* Status Indicator with Animated Soundwave */}
                            <div className="mt-1.5 flex items-center">
                              {isPlaying ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400">
                                  {/* Dynamic Live Audio Bars */}
                                  <div
                                    className="flex items-end gap-[2px] h-2.5 shrink-0"
                                    aria-hidden="true"
                                  >
                                    {[0, 1, 2].map((i) => (
                                      <motion.span
                                        key={i}
                                        className="w-0.5 bg-emerald-400 rounded-full"
                                        animate={{
                                          height: ['25%', '100%', '35%'],
                                        }}
                                        transition={{
                                          duration: 0.65,
                                          repeat: Infinity,
                                          repeatType: 'reverse',
                                          delay: i * 0.18,
                                          ease: 'easeInOut',
                                        }}
                                      />
                                    ))}
                                  </div>
                                  <span>{t('playing')}</span>
                                </span>
                              ) : isPaused ? (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/15 border border-amber-500/25 text-amber-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                  <span>{t('paused')}</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 border border-blue-500/25 text-blue-400">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                                  <span>{t('waiting')}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row: Metadata + Join CTA */}
                        <div className="border-t border-white/5 pt-2.5 flex items-center justify-between">
                          <div className="flex items-center gap-2.5 text-[11px] text-zinc-400">
                            {/* Member count */}
                            <span className="flex items-center gap-1 font-medium">
                              <Users className="h-3 w-3 text-zinc-400 shrink-0" />
                              <span>
                                {room.member_count}/{room.max_users}
                              </span>
                            </span>

                            {/* TTL time */}
                            <span className="flex items-center gap-1 text-zinc-500">
                              <Clock className="h-3 w-3 text-zinc-500 shrink-0" />
                              <span>{formatTimeLeft(room.ttl_seconds)}</span>
                            </span>
                          </div>

                          {/* CTA Button */}
                          <span
                            className={`px-3 py-1 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-1 ${
                              isFull
                                ? 'bg-zinc-800/80 text-zinc-500 border border-white/5 cursor-not-allowed'
                                : 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30 group-hover:bg-yellow-400 group-hover:text-black group-hover:border-yellow-400 group-hover:shadow-md group-hover:shadow-yellow-500/20'
                            }`}
                          >
                            {isFull ? (
                              t('full')
                            ) : (
                              <>
                                <span>{t('join')}</span>
                                <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
                              </>
                            )}
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
