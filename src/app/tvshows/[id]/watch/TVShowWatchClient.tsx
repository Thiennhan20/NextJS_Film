'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  Bars3Icon,
  CheckIcon,
  ChevronDownIcon,
  FilmIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline'
import { PlayIcon } from '@heroicons/react/24/solid'
import Comments from '@/components/Comments'
import RelatedContent from '@/components/RelatedContent'
import MediaPageLoading from '@/components/common/MediaPageLoading'
import WatchNowMovies from '@/components/watch/WatchNowMovies'
import WatchNowTVShows from '@/components/watch/WatchNowTVShows'
import {
  fetchSeasonEpisodes,
  type MediaEpisode,
  type MediaType,
  useMediaDetails,
} from '../tvshow-data'

interface TVShowWatchClientProps {
  id: string
}

export default function TVShowWatchClient({ id }: TVShowWatchClientProps) {
  const type = 'tv' as MediaType
  const tCinema = useTranslations('CinemaWatch')
  const text = {
    quickEpisodes: tCinema('quickEpisodes'),
    season: tCinema('season'),
    episode: tCinema('episode'),
    episodeShort: tCinema('episodeShort'),
    episodes: tCinema('episodes'),
    loading: tCinema('loading'),
    notFound: tCinema('notFound'),
    expand: tCinema('expand'),
    compact: tCinema('compact'),
    noOverview: tCinema('noOverview'),
  }
  const { media, loading, error } = useMediaDetails(type, id)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [selectedEpisode, setSelectedEpisode] = useState(1)
  const [episodes, setEpisodes] = useState<MediaEpisode[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [seasonOptionList, setSeasonOptionList] = useState<{ id: number; seasonNumber: number }[]>([])
  const [isSeasonMenuOpen, setIsSeasonMenuOpen] = useState(false)
  const seasonPickerRef = useRef<HTMLDivElement>(null)

  const [isMounted, setIsMounted] = useState(false)
  const [seasonCoords, setSeasonCoords] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 0 })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const updateSeasonCoords = () => {
    if (seasonPickerRef.current) {
      const rect = seasonPickerRef.current.getBoundingClientRect()
      setSeasonCoords({
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: Math.max(rect.width, 140),
      })
    }
  }

  useEffect(() => {
    if (!isSeasonMenuOpen) return
    function handleScrollOrResize() {
      if (isSeasonMenuOpen) updateSeasonCoords()
    }
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isSeasonMenuOpen])
  const [episodeRange, setEpisodeRange] = useState(0)
  const [isEpisodesCompact, setIsEpisodesCompact] = useState(true)

  useEffect(() => {
    const season = Number(searchParams.get('season') || 1)
    const episode = Number(searchParams.get('episode') || 1)
    setSelectedSeason(Number.isFinite(season) && season > 0 ? season : 1)
    setSelectedEpisode(Number.isFinite(episode) && episode > 0 ? episode : 1)
  }, [searchParams])

  useEffect(() => {
    if (!media?.seasons.length) {
      setSeasonOptionList([{ id: 1, seasonNumber: 1 }])
      return
    }
    setSeasonOptionList(media.seasons.map((s) => ({ id: s.id, seasonNumber: s.seasonNumber })))
  }, [media?.seasons])

  const seasonPortalRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isSeasonMenuOpen) return

    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node
      if (
        seasonPickerRef.current && !seasonPickerRef.current.contains(target) &&
        seasonPortalRef.current && !seasonPortalRef.current.contains(target)
      ) {
        setIsSeasonMenuOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsSeasonMenuOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isSeasonMenuOpen])

  useEffect(() => {
    if (!media || type !== 'tv') return
    let cancelled = false
    setEpisodesLoading(true)
    setEpisodeRange(0)
    fetchSeasonEpisodes(media.id, selectedSeason)
      .then((res) => {
        if (!cancelled) setEpisodes(res.episodes)
      })
      .catch(() => {
        if (!cancelled) setEpisodes([])
      })
      .finally(() => {
        if (!cancelled) setEpisodesLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [media, selectedSeason, type])

  const seasonEpisodeCount = useMemo(() => {
    if (!media) return 0
    return media.seasons.find((season) => season.seasonNumber === selectedSeason)?.episodeCount || episodes.length
  }, [episodes.length, media, selectedSeason])

  const episodeNumbers = useMemo(() => {
    if (episodes.length > 0) return episodes.map((episode) => episode.episode_number)
    return Array.from({ length: seasonEpisodeCount }, (_, index) => index + 1)
  }, [episodes, seasonEpisodeCount])

  const episodeRanges = useMemo(() => {
    const maxEpisode = Math.max(seasonEpisodeCount, ...episodeNumbers, 0)
    if (maxEpisode === 0) return []
    return Array.from({ length: Math.ceil(maxEpisode / 100) }, (_, index) => ({
      start: index * 100 + 1,
      end: Math.min((index + 1) * 100, maxEpisode),
    }))
  }, [episodeNumbers, seasonEpisodeCount])

  const visibleEpisodeNumbers = useMemo(() => {
    const range = episodeRanges[episodeRange]
    if (!range) return episodeNumbers
    return episodeNumbers.filter((episode) => episode >= range.start && episode <= range.end)
  }, [episodeNumbers, episodeRange, episodeRanges])

  const episodeByNumber = useMemo(
    () => new Map(episodes.map((episode) => [episode.episode_number, episode])),
    [episodes],
  )

  function updateSelection(season: number, episode: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('season', String(season))
    params.set('episode', String(episode))
    router.push(`/tvshows/${id}/watch?${params.toString()}`, { scroll: false })
  }

  if (loading) {
    return <MediaPageLoading label={text.loading} fullScreen />
  }

  if (error || !media) {
    return <main className="flex min-h-screen items-center justify-center bg-[#050607] text-white/60">{text.notFound}</main>
  }

  const playerMovie = {
    id: media.id,
    title: media.title,
    duration: media.duration,
    year: media.year,
    releaseDate: media.releaseDate,
    director: media.creator,
    cast: media.cast,
    genre: media.genres.join(', '),
    description: media.description,
    poster: media.poster,
    backdrop: media.backdrop,
    trailer: media.trailer,
    movieUrl: '',
    scenes: media.scenes,
  }
  const playerTVShow = {
    id: media.id,
    name: media.title,
    duration: media.duration,
    year: media.year,
    firstAirDate: media.releaseDate,
    creator: media.creator,
    cast: media.cast,
    genre: media.genres.join(', '),
    description: media.description,
    poster: media.poster,
    backdrop: media.backdrop,
    trailer: media.trailer,
    tvShowUrl: '',
    scenes: media.scenes,
    totalSeasons: media.totalSeasons,
    totalEpisodes: media.totalEpisodes,
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050607] pb-10 text-white">
      <div className="relative z-10 mx-auto max-w-[1440px] px-4 pb-4 pt-16 sm:px-6 lg:px-8">
        <div>
          {type === 'movie' ? (
            <WatchNowMovies movie={playerMovie} />
          ) : (
            <WatchNowTVShows
              tvShow={playerTVShow}
              selectedSeason={selectedSeason}
              selectedEpisode={selectedEpisode}
              episodes={episodes}
            />
          )}
        </div>

        {type === 'tv' && (
          <section className="mt-5 rounded-2xl border border-white/[0.08] bg-[#111318] p-3 shadow-2xl shadow-black/20 sm:rounded-3xl sm:p-6">
            <div className="flex items-center justify-between gap-2 border-b border-white/[0.07] pb-4 sm:gap-3 sm:pb-5">
              <div className="flex items-center gap-2.5 shrink-0">
                <ListBulletIcon className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-300" />
                <h2 className="text-sm font-black text-white sm:text-lg whitespace-nowrap">{text.quickEpisodes}</h2>
              </div>

              <div className="flex items-center gap-2">
                <div ref={seasonPickerRef} data-testid="season-picker" className="relative">
                  <button
                    type="button"
                    data-testid="season-picker-trigger"
                    aria-haspopup="listbox"
                    aria-expanded={isSeasonMenuOpen}
                    onClick={() => {
                      if (!isSeasonMenuOpen) updateSeasonCoords()
                      setIsSeasonMenuOpen((current) => !current)
                    }}
                    className={`inline-flex min-w-[105px] sm:min-w-[148px] items-center justify-between gap-1.5 sm:gap-3 rounded-xl border px-2.5 py-1.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-black text-white shadow-lg shadow-black/15 outline-none transition ${
                      isSeasonMenuOpen
                        ? 'border-yellow-400/70 bg-yellow-400/[0.08] ring-2 ring-yellow-400/10'
                        : 'border-white/10 bg-[#17191f] hover:border-white/20 hover:bg-[#1f222a]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-1.5 sm:gap-2 whitespace-nowrap">
                      <Bars3Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5 text-yellow-300" />
                      {text.season} {selectedSeason}
                    </span>
                    <ChevronDownIcon className={`h-3.5 w-3.5 text-white/45 transition-transform sm:h-4 sm:w-4 ${isSeasonMenuOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isMounted && isSeasonMenuOpen && createPortal(
                    <div
                      ref={seasonPortalRef}
                      role="listbox"
                      aria-label={text.season}
                      onPointerDown={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      style={{
                        position: 'fixed',
                        top: `${seasonCoords.top}px`,
                        left: `${seasonCoords.left}px`,
                        minWidth: `${seasonCoords.minWidth}px`,
                      }}
                      className="season-dropdown z-[9999] max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-[#17191f]/98 p-1.5 shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                    >
                      {seasonOptionList.map((season) => {
                        const isSelected = season.seasonNumber === selectedSeason
                        return (
                          <button
                            key={season.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            data-testid={`season-option-${season.seasonNumber}`}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              updateSelection(season.seasonNumber, 1)
                              setIsSeasonMenuOpen(false)
                            }}
                            onClick={(e) => {
                              e.stopPropagation()
                              updateSelection(season.seasonNumber, 1)
                              setIsSeasonMenuOpen(false)
                            }}
                            className={`flex w-full items-center justify-between gap-4 rounded-lg px-3.5 py-2 text-left text-xs sm:text-sm font-bold transition ${
                              isSelected
                                ? 'bg-yellow-400/15 text-yellow-300 font-black'
                                : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                            }`}
                          >
                            <span className="whitespace-nowrap">
                              {text.season} {season.seasonNumber}
                            </span>
                            {isSelected && <CheckIcon className="ml-2 h-4 w-4 shrink-0 text-yellow-300" />}
                          </button>
                        )
                      })}
                    </div>,
                    document.body
                  )}
                </div>

                <button
                  type="button"
                  data-testid="episode-view-toggle"
                  onClick={() => setIsEpisodesCompact((current) => !current)}
                  aria-expanded={!isEpisodesCompact}
                  title={isEpisodesCompact ? text.expand : text.compact}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] p-2 sm:px-3 sm:py-2.5 text-[10px] sm:text-xs font-black text-white/70 transition hover:border-yellow-400/35 hover:bg-white/10 hover:text-yellow-300 whitespace-nowrap"
                >
                  {isEpisodesCompact ? <ArrowsPointingOutIcon className="h-4 w-4" /> : <ArrowsPointingInIcon className="h-4 w-4" />}
                  <span className="hidden sm:inline">{isEpisodesCompact ? text.expand : text.compact}</span>
                </button>
              </div>
            </div>

            {episodeRanges.length > 1 && (
              <div className="mt-3.5 flex gap-2 overflow-x-auto pb-2.5 range-scrollbar sm:mt-4">
                {episodeRanges.map((range, index) => (
                  <button
                    key={range.start}
                    type="button"
                    onClick={() => setEpisodeRange(index)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-[11px] font-black transition-all sm:px-3.5 sm:py-1.5 sm:text-xs ${
                      episodeRange === index
                        ? 'bg-yellow-400 text-black shadow-md shadow-yellow-400/20'
                        : 'border border-white/10 bg-white/[0.06] text-white/70 hover:bg-white/12 hover:text-white'
                    }`}
                  >
                    {text.episode} {range.start} - {range.end}
                  </button>
                ))}
              </div>
            )}

            {episodesLoading ? (
              <div className="flex h-48 items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" /></div>
            ) : (
              <div
                data-testid={isEpisodesCompact ? 'episode-grid-compact' : 'episode-grid-expanded'}
                className={isEpisodesCompact
                  ? 'mt-3.5 grid grid-cols-4 gap-1.5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 sm:gap-2'
                  : 'mt-3.5 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 sm:gap-2.5'}
              >
                {visibleEpisodeNumbers.map((episodeNumber) => {
                  const episode = episodeByNumber.get(episodeNumber)
                  const isCurrentEpisode = selectedEpisode === episodeNumber

                  if (isEpisodesCompact) {
                    return (
                      <button
                        key={episodeNumber}
                        type="button"
                        onClick={() => updateSelection(selectedSeason, episodeNumber)}
                        className={`group flex min-h-9 items-center justify-center gap-1 overflow-hidden rounded-lg border px-1 py-1 text-[10px] font-bold transition sm:min-h-10 sm:px-1.5 sm:text-[11px] ${
                          isCurrentEpisode
                            ? 'border-yellow-300 bg-yellow-400 text-black shadow-lg shadow-yellow-400/15'
                            : 'border-white/[0.07] bg-[#1a1d23] text-white/68 hover:-translate-y-0.5 hover:border-yellow-400/45 hover:bg-yellow-400 hover:text-black'
                        }`}
                      >
                        <PlayIcon className={`h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3 xl:h-3.5 xl:w-3.5 ${isCurrentEpisode ? 'text-black' : 'text-yellow-300 group-hover:text-black'}`} />
                        <span className="whitespace-nowrap leading-none">{text.episodeShort} {episodeNumber}</span>
                      </button>
                    )
                  }

                  return (
                    <button
                      key={episodeNumber}
                      type="button"
                      onClick={() => updateSelection(selectedSeason, episodeNumber)}
                      className={`group min-w-0 overflow-hidden text-left rounded-xl border transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(0,0,0,0.35)] sm:rounded-2xl ${
                        isCurrentEpisode
                          ? 'border-yellow-400 bg-[#22252d] ring-2 ring-yellow-400/20 shadow-lg shadow-yellow-400/10'
                          : 'border-white/[0.08] bg-[#1a1d23] hover:border-yellow-400/40'
                      }`}
                    >
                      <div className="relative aspect-video overflow-hidden bg-[radial-gradient(circle_at_top,#2a2d35,#111318_72%)]">
                        {episode?.still_path ? (
                          <Image
                            src={`https://image.tmdb.org/t/p/w500${episode.still_path}`}
                            alt={episode.name || `${text.episode} ${episodeNumber}`}
                            fill
                            className="object-cover transition duration-500 group-hover:scale-105"
                            sizes="(max-width: 1280px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center"><FilmIcon className="h-7 w-7 text-white/15 sm:h-10 sm:w-10" /></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                        <span className={`absolute left-2 top-2 rounded-md border px-1.5 py-0.5 text-[8px] font-black backdrop-blur-md sm:left-3 sm:top-3 sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-[10px] ${
                          isCurrentEpisode ? 'border-yellow-400/50 bg-yellow-400 text-black' : 'border-white/10 bg-black/65 text-white'
                        }`}>
                          S{selectedSeason} · E{episodeNumber}
                        </span>
                        <span className={`absolute bottom-2 left-2 flex h-7 w-7 items-center justify-center rounded-full shadow-lg shadow-black/30 transition group-hover:scale-110 sm:bottom-3 sm:left-3 sm:h-9 sm:w-9 ${
                          isCurrentEpisode ? 'bg-yellow-400 text-black' : 'bg-white/20 text-white group-hover:bg-yellow-400 group-hover:text-black'
                        }`}>
                          <PlayIcon className="h-3 w-3 sm:h-4 sm:w-4" />
                        </span>
                      </div>
                      <div className="p-2.5 sm:p-3">
                        <h3 className={`truncate text-xs font-black sm:text-sm ${isCurrentEpisode ? 'text-yellow-300' : 'text-white'}`}>
                          {episode?.name || `${text.episode} ${episodeNumber}`}
                        </h3>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}
      </div>

      <section id="comments" className="relative z-10 border-t border-white/[0.06] bg-[#08090b]/95">
        <Comments movieId={media.id} type={type === 'tv' ? 'tvshow' : 'movie'} title={media.title} />
      </section>
      <section className="relative z-10 bg-[#08090b]">
        <RelatedContent id={media.id} type={type} title={media.title} />
      </section>
    </main>
  )
}
