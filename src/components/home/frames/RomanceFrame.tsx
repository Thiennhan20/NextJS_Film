'use client'

import { useCallback, useMemo, useState } from 'react'
import axios from 'axios'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HeartIcon } from '@heroicons/react/24/solid'
import apiCache, { useApiCache } from '@/hooks/useApiCache'
import ThreeDImageRing from '@/components/ui/ThreeDImageRing'

interface MovieItem {
  id: number
  title?: string
  name?: string
  poster_path?: string
  vote_average?: number
  release_date?: string
  first_air_date?: string
  media_type?: 'movie' | 'tv'
}

const ROMANCE_CACHE_KEY = 'home-romance-frame'
const ROMANCE_CACHE_TTL = 8 * 60 * 60 * 1000
const ROMANCE_SECTION_MIN_HEIGHT = 'clamp(490px, 55vw, 650px)'
let romanceRequest: Promise<MovieItem[]> | null = null

const getRoute = (item: MovieItem) => (
  item.media_type === 'movie' ? `/movies/${item.id}` : `/tvshows/${item.id}`
)

const getTitle = (item: MovieItem) => item.title || item.name || 'Unknown'

const getYear = (item: MovieItem) => {
  const date = item.release_date || item.first_air_date
  return date ? date.slice(0, 4) : ''
}

async function fetchRomanceItems() {
  const [moviesRes, tvRes] = await Promise.all([
    axios.get(`/api/tmdb-proxy?endpoint=${encodeURIComponent('/discover/movie?with_genres=10749&sort_by=popularity.desc')}`),
    axios.get(`/api/tmdb-proxy?endpoint=${encodeURIComponent('/discover/tv?with_genres=10749&sort_by=popularity.desc')}`),
  ])

  const movies = moviesRes.data.results
    .slice(0, 8)
    .map((movie: MovieItem) => ({ ...movie, media_type: 'movie' as const }))
  const tvShows = tvRes.data.results
    .slice(0, 7)
    .map((show: MovieItem) => ({ ...show, media_type: 'tv' as const }))

  const combined: MovieItem[] = []
  const length = Math.max(movies.length, tvShows.length)
  for (let index = 0; index < length; index += 1) {
    if (movies[index]) combined.push(movies[index])
    if (tvShows[index]) combined.push(tvShows[index])
  }
  return combined
}

export function preloadRomanceFrameData() {
  const cachedItems = apiCache.get<MovieItem[]>(ROMANCE_CACHE_KEY)
  if (cachedItems) return Promise.resolve(cachedItems)

  if (!romanceRequest) {
    romanceRequest = fetchRomanceItems()
      .then((items) => {
        apiCache.set(ROMANCE_CACHE_KEY, items, ROMANCE_CACHE_TTL)
        return items
      })
      .finally(() => {
        romanceRequest = null
      })
  }

  return romanceRequest
}

function RomanceFrameLoading() {
  return <section aria-hidden="true" style={{ minHeight: ROMANCE_SECTION_MIN_HEIGHT }} />
}

export default function RomanceFrame() {
  const router = useRouter()
  const t = useTranslations('Frames')
  const prefersReducedMotion = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isDetailsFocused, setIsDetailsFocused] = useState(false)

  const fetchData = useCallback(() => preloadRomanceFrameData(), [])

  const { data: items, loading, error } = useApiCache<MovieItem[]>(
    ROMANCE_CACHE_KEY,
    fetchData,
    ROMANCE_CACHE_TTL,
  )

  const filteredItems = useMemo(
    () => (items ?? []).filter((item) => Boolean(item.poster_path)),
    [items],
  )

  const ringImages = useMemo(
    () => filteredItems.map((item) => `https://image.tmdb.org/t/p/w500${item.poster_path}`),
    [filteredItems],
  )

  const handleImageClick = useCallback((index: number) => {
    const item = filteredItems[index]
    if (item) router.push(getRoute(item))
  }, [filteredItems, router])

  if (loading && !items) return <RomanceFrameLoading />
  if (error || !filteredItems.length) return null

  const activeItem = filteredItems[activeIndex] || filteredItems[0]

  return (
    <section className="relative mb-10 px-2 sm:mb-12 sm:px-3" aria-label={t('romanceTitle')}>
      <div className="mb-5 flex items-center gap-3 px-1 sm:mb-6">
        <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-pink-500 to-rose-500 sm:h-8" />
        <h3 className="flex items-center gap-2 text-xl font-bold tracking-wide text-white sm:text-2xl">
          {t('romanceTitle')}
          <motion.span
            aria-hidden="true"
            animate={prefersReducedMotion ? undefined : { scale: [1, 1.14, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          >
            <HeartIcon className="h-5 w-5 text-pink-500 sm:h-6 sm:w-6" />
          </motion.span>
        </h3>
      </div>

      <div className="relative mx-auto max-w-[1280px]">
        <div
          className="pointer-events-none absolute inset-x-[5%] inset-y-0 opacity-60 blur-3xl"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(244, 114, 182, 0.3), rgba(236, 72, 153, 0.1) 46%, transparent 72%)',
          }}
        />

        <div
          className="relative w-full overflow-hidden rounded-[clamp(18px,3vw,34px)] border border-pink-300/10"
          style={{
            height: 'clamp(370px, 47vw, 560px)',
            background: 'linear-gradient(180deg, rgba(30,10,25,0.76), rgba(45,15,35,0.9) 42%, rgba(25,5,20,0.96))',
            boxShadow: 'inset 0 0 70px rgba(244, 114, 182, 0.08), 0 16px 48px rgba(12, 3, 10, 0.32)',
            contain: 'layout paint',
          }}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-[12%] bg-gradient-to-r from-pink-400/10 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-[12%] bg-gradient-to-l from-pink-400/10 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-pink-200/35 to-transparent" />

          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <span className="absolute left-[12%] top-[20%] text-lg text-pink-300/10">{'\u2665'}</span>
            <span className="absolute right-[16%] top-[28%] text-2xl text-pink-300/[0.08]">{'\u2665'}</span>
            <span className="absolute bottom-[20%] left-[23%] text-sm text-rose-300/10">{'\u2665'}</span>
          </div>

          <ThreeDImageRing
            images={ringImages}
            onImageClick={handleImageClick}
            onActiveIndexChange={setActiveIndex}
            width={260}
            perspective={1250}
            imageDistance={700}
            animationDuration={0.42}
            staggerDelay={0.028}
            hoverOpacity={0.52}
            draggable
            mobileBreakpoint={768}
            mobileScaleFactor={0.68}
            inertiaPower={0.72}
            inertiaTimeConstant={260}
            inertiaVelocityMultiplier={17}
            posterGap={26}
            autoRotate
            autoRotateDelay={5000}
            autoRotateInterval={5000}
            autoRotateDuration={0.9}
            resetWhenOutOfView
            pauseAutoRotate={isDetailsFocused}
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-t from-[rgba(25,5,20,0.96)] to-transparent" />

          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-20 px-3 text-center sm:bottom-5">
            <AnimatePresence mode="wait">
              <motion.button
                key={activeItem.id}
                type="button"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 7 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -7 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: 'easeOut' }}
                className="pointer-events-auto inline-block max-w-[min(88vw,480px)] cursor-pointer rounded-full border border-pink-500/20 bg-black/55 px-4 py-1.5 text-white shadow-[0_4px_18px_rgba(236,72,153,0.14)] backdrop-blur-md transition-colors hover:border-pink-400/50 hover:bg-black/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400 sm:px-5 sm:py-2"
                onFocus={() => setIsDetailsFocused(true)}
                onBlur={() => setIsDetailsFocused(false)}
                onClick={() => handleImageClick(activeIndex)}
              >
                <span className="block truncate bg-gradient-to-r from-white via-pink-100 to-rose-200 bg-clip-text text-xs font-bold tracking-wide text-transparent sm:text-sm md:text-base">
                  {getTitle(activeItem)}
                </span>
                <span className="mt-0.5 flex items-center justify-center gap-1.5 text-[10px] font-medium text-pink-300/85 sm:text-xs">
                  {getYear(activeItem)}
                  <span aria-hidden="true">&bull;</span>
                  {activeItem.media_type === 'movie' ? t('movieLabel') : t('tvShowLabel')}
                </span>
              </motion.button>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
