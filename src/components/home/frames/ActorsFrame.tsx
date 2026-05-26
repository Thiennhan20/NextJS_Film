'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import axios from 'axios'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import apiCache, { useApiCache } from '@/hooks/useApiCache'

interface KnownForItem {
  id: number
  media_type?: 'movie' | 'tv'
  name?: string
  title?: string
}

interface ActorItem {
  id: number
  name: string
  profile_path?: string | null
  known_for_department?: string
  known_for?: KnownForItem[]
}

const ACTORS_CACHE_KEY = 'home-actors-frame'
const ACTORS_CACHE_TTL = 8 * 60 * 60 * 1000
const ACTORS_SECTION_MIN_HEIGHT = 'clamp(360px, 39vw, 470px)'
let actorsRequest: Promise<ActorItem[]> | null = null

async function fetchActors() {
  const response = await axios.get(
    `/api/tmdb-proxy?endpoint=${encodeURIComponent('/trending/person/week')}`,
  )

  return (response.data.results as ActorItem[])
    .filter((actor) => actor.profile_path && actor.known_for_department === 'Acting')
    .slice(0, 16)
}

export function preloadActorsFrameData() {
  const cachedActors = apiCache.get<ActorItem[]>(ACTORS_CACHE_KEY)
  if (cachedActors) return Promise.resolve(cachedActors)

  if (!actorsRequest) {
    actorsRequest = fetchActors()
      .then((actors) => {
        apiCache.set(ACTORS_CACHE_KEY, actors, ACTORS_CACHE_TTL)
        return actors
      })
      .finally(() => {
        actorsRequest = null
      })
  }

  return actorsRequest
}

function ActorsFrameLoading() {
  return <section aria-hidden="true" style={{ minHeight: ACTORS_SECTION_MIN_HEIGHT }} />
}

export default function ActorsFrame() {
  const t = useTranslations('Frames')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const fetchData = useCallback(() => preloadActorsFrameData(), [])

  const { data: actors, loading, error } = useApiCache<ActorItem[]>(
    ACTORS_CACHE_KEY,
    fetchData,
    ACTORS_CACHE_TTL,
  )

  const updateScrollButtons = useCallback(() => {
    const container = scrollRef.current
    if (!container) return

    setCanScrollLeft(container.scrollLeft > 2)
    setCanScrollRight(container.scrollLeft < container.scrollWidth - container.clientWidth - 2)
  }, [])

  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    updateScrollButtons()
    container.addEventListener('scroll', updateScrollButtons, { passive: true })
    const observer = new ResizeObserver(updateScrollButtons)
    observer.observe(container)

    return () => {
      container.removeEventListener('scroll', updateScrollButtons)
      observer.disconnect()
    }
  }, [actors, updateScrollButtons])

  const scrollByCards = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 560, behavior: 'smooth' })
  }

  const getKnownFor = (actor: ActorItem) => (
    actor.known_for
      ?.map((item) => item.title || item.name)
      .filter(Boolean)
      .slice(0, 2)
      .join(' / ') || t('actingLabel')
  )

  if (loading && !actors) return <ActorsFrameLoading />
  if (error || !actors?.length) return null

  return (
    <section className="mb-10 px-2 sm:mb-12 sm:px-3" aria-label={t('actorsTitle')}>
      <div className="mb-4 flex items-center gap-3 px-1 sm:mb-6">
        <div className="h-7 w-1.5 rounded-full bg-gradient-to-b from-violet-400 to-fuchsia-500 sm:h-8" />
        <h3 className="text-xl font-bold tracking-wide text-white sm:text-2xl">
          {t('actorsTitle')}
        </h3>
      </div>

      <div className="group/actors relative">
        <button
          type="button"
          aria-label="Previous actors"
          onClick={() => scrollByCards(-1)}
          className={`absolute -left-2 top-[42%] z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/75 p-3 text-white shadow-xl backdrop-blur transition-all hover:bg-white hover:text-black sm:flex ${
            canScrollLeft ? 'opacity-0 group-hover/actors:opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Next actors"
          onClick={() => scrollByCards(1)}
          className={`absolute -right-2 top-[42%] z-10 hidden -translate-y-1/2 rounded-full border border-white/10 bg-black/75 p-3 text-white shadow-xl backdrop-blur transition-all hover:bg-white hover:text-black sm:flex ${
            canScrollRight ? 'opacity-0 group-hover/actors:opacity-100' : 'pointer-events-none opacity-0'
          }`}
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>

        <div
          ref={scrollRef}
          className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4 pt-2 sm:gap-4"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {actors.map((actor) => (
            <article
              key={actor.id}
              className="group/actor w-[132px] min-w-[132px] snap-start sm:w-[152px] sm:min-w-[152px] md:w-[174px] md:min-w-[174px]"
            >
              <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/10 bg-zinc-900 shadow-xl transition duration-300 ease-out group-hover/actor:-translate-y-1 group-hover/actor:border-fuchsia-300/35 group-hover/actor:shadow-[0_14px_35px_rgba(217,70,239,0.15)]">
                <Image
                  src={`https://image.tmdb.org/t/p/w342${actor.profile_path}`}
                  alt={actor.name}
                  fill
                  sizes="(max-width: 640px) 132px, (max-width: 768px) 152px, 174px"
                  className="object-cover transition-transform duration-500 ease-out group-hover/actor:scale-[1.04]"
                />
                <div className="absolute inset-x-0 bottom-0 h-[44%] bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              </div>

              <div className="px-1 pt-3">
                <h4 className="truncate text-sm font-semibold text-white sm:text-base" title={actor.name}>
                  {actor.name}
                </h4>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-gray-400" title={getKnownFor(actor)}>
                  {getKnownFor(actor)}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
