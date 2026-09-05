'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import toast from 'react-hot-toast'
import {
  ArrowsPointingOutIcon,
  BookmarkIcon,
  CalendarDaysIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  FilmIcon,
  InformationCircleIcon,
  PhotoIcon,
  PlusIcon,
  ServerIcon,
  SpeakerWaveIcon,
  SparklesIcon,
  UserGroupIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { PlayIcon } from '@heroicons/react/24/solid'
import api from '@/lib/axios'
import useAuthStore from '@/store/useAuthStore'
import { useWatchlistStore } from '@/store/store'
import RelatedContent from '@/components/RelatedContent'
import Comments from '@/components/Comments'
import MediaPageLoading from '@/components/common/MediaPageLoading'
import {
  type MediaType,
  useMediaDetails,
} from './movie-data'

interface MovieDetailClientProps {
  id: string
}

type DetailTab = 'episodes' | 'gallery' | 'cast' | 'suggestions'

const buttonClass =
  'inline-flex items-center justify-center gap-2 rounded-full border border-white/10 bg-white/[0.07] px-4 py-2.5 text-sm font-semibold text-white backdrop-blur-xl transition hover:border-white/25 hover:bg-white/[0.13]'

const watchButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-rose-500 via-red-600 to-red-700 font-black text-white shadow-[0_12px_38px_rgba(225,29,72,0.38)] transition hover:-translate-y-0.5 hover:from-rose-400 hover:via-red-500 hover:to-red-600 hover:shadow-[0_16px_44px_rgba(225,29,72,0.48)]'

function formatReleaseDate(value: string, locale: string) {
  if (!value) return ''
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

export default function MovieDetailClient({ id }: MovieDetailClientProps) {
  const type = 'movie' as MediaType
  const locale = useLocale()
  const t = useTranslations('MediaDetail')
  const text = {
    watchNow: t('watchNow'),
    trailer: t('trailer'),
    movieInfo: t('movieInfo'),
    hideInfo: t('hideInfo'),
    add: t('add'),
    added: t('added'),
    episodes: t('episodes'),
    overview: t('overview'),
    gallery: t('gallery'),
    cast: t('cast'),
    suggestions: t('suggestions'),
    season: t('season'),
    episode: t('episode'),
    episodeShort: t('episodeShort'),
    introduction: t('introduction'),
    director: t('director'),
    country: t('country'),
    duration: t('duration'),
    noOverview: t('noOverview'),
    loginRequired: t('loginRequired'),
    addedSuccess: t('addedSuccess'),
    removedSuccess: t('removedSuccess'),
    error: t('error'),
    loading: t('loading'),
    notFound: t('notFound'),
    expand: t('expand'),
    compact: t('compact'),
    seeMore: t('seeMore'),
    showLess: t('showLess'),
    contentNavLabel: t('contentNavLabel'),
    movieExperienceTitle: t('movieExperienceTitle'),
    movieExperienceDescription: t('movieExperienceDescription'),
    closeImage: t('closeImage'),
    previousImage: t('previousImage'),
    nextImage: t('nextImage'),
    closeTrailer: t('closeTrailer'),
  }
  const { media, loading, error } = useMediaDetails(type, id)
  const [activeTab, setActiveTab] = useState<DetailTab>('episodes')
  const [activeScene, setActiveScene] = useState<number | null>(null)
  const [showTrailer, setShowTrailer] = useState(false)
  const [isMobileInfoExpanded, setIsMobileInfoExpanded] = useState(false)
  const [isOverviewExpanded, setIsOverviewExpanded] = useState(false)
  const { addToWatchlist, removeFromWatchlist, isInWatchlist, fetchWatchlistFromServer } = useWatchlistStore()
  const { isAuthenticated, token } = useAuthStore()
  const isBookmarked = media ? isInWatchlist(media.id) : false

  useEffect(() => {
    setActiveTab('episodes')
    setActiveScene(null)
    setIsMobileInfoExpanded(false)
  }, [id, type])

  useEffect(() => {
    if (activeScene === null) return

    const sceneCount = media?.scenes.length || 0
    const previousOverflow = document.body.style.overflow

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setActiveScene(null)
      if (event.key === 'ArrowLeft' && sceneCount > 0) {
        setActiveScene((current) => current === null || current === 0 ? sceneCount - 1 : current - 1)
      }
      if (event.key === 'ArrowRight' && sceneCount > 0) {
        setActiveScene((current) => current === null || current === sceneCount - 1 ? 0 : current + 1)
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [activeScene, media?.scenes.length])

  async function toggleWatchlist() {
    if (!media) return
    if (!isAuthenticated) {
      toast.error(text.loginRequired)
      return
    }
    try {
      if (isBookmarked) {
        await api.delete('/auth/watchlist', { data: { id: media.id } })
        removeFromWatchlist(media.id)
        toast.success(text.removedSuccess)
      } else {
        await api.post('/auth/watchlist', {
          id: media.id,
          title: media.title,
          poster_path: media.poster,
          type,
        })
        addToWatchlist({
          id: media.id,
          title: media.title,
          poster_path: media.poster,
          type,
        })
        toast.success(text.addedSuccess)
      }
      if (token) await fetchWatchlistFromServer(token)
    } catch {
      toast.error(text.error)
    }
  }

  const tWatch = useTranslations('Watch')
  const [selectedServer, setSelectedServer] = useState<'server1' | 'server2' | 'server3'>('server1')
  const [selectedAudio, setSelectedAudio] = useState<'vietsub' | 'dubbed' | ''>('vietsub')
  const [isServerMenuOpen, setIsServerMenuOpen] = useState(false)
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false)
  const serverPickerRef = useRef<HTMLDivElement>(null)
  const audioPickerRef = useRef<HTMLDivElement>(null)
  const [audioOptions, setAudioOptions] = useState<{ hasVietsub: boolean; hasDubbed: boolean }>({
    hasVietsub: false,
    hasDubbed: false,
  })

  const [isMounted, setIsMounted] = useState(false)
  const [serverCoords, setServerCoords] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 0 })
  const [audioCoords, setAudioCoords] = useState<{ top: number; left: number; minWidth: number }>({ top: 0, left: 0, minWidth: 0 })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const updateServerCoords = () => {
    if (serverPickerRef.current) {
      const rect = serverPickerRef.current.getBoundingClientRect()
      setServerCoords({
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: rect.width,
      })
    }
  }

  const updateAudioCoords = () => {
    if (audioPickerRef.current) {
      const rect = audioPickerRef.current.getBoundingClientRect()
      setAudioCoords({
        top: rect.bottom + 6,
        left: rect.left,
        minWidth: rect.width,
      })
    }
  }

  useEffect(() => {
    if (!isServerMenuOpen && !isAudioMenuOpen) return
    function handleScrollOrResize() {
      if (isServerMenuOpen) updateServerCoords()
      if (isAudioMenuOpen) updateAudioCoords()
    }
    window.addEventListener('scroll', handleScrollOrResize, true)
    window.addEventListener('resize', handleScrollOrResize)
    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true)
      window.removeEventListener('resize', handleScrollOrResize)
    }
  }, [isServerMenuOpen, isAudioMenuOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (serverPickerRef.current && !serverPickerRef.current.contains(event.target as Node)) {
        setIsServerMenuOpen(false)
      }
      if (audioPickerRef.current && !audioPickerRef.current.contains(event.target as Node)) {
        setIsAudioMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    const mediaId = media?.id
    const mediaTitle = media?.title
    if (!mediaId) return
    let isCancelled = false

    async function checkAudio() {
      if (selectedServer === 'server2') {
        setAudioOptions({ hasVietsub: false, hasDubbed: false })
        setSelectedAudio('')
        return
      }

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api'

      if (selectedServer === 'server3') {
        let vDub = false
        let vSub = false
        try {
          const tmdbYear = media?.year || (media?.releaseDate ? parseInt(media.releaseDate.substring(0, 4)) : 0)
          const tmdbDirector = (media as unknown as { director?: string })?.director || ''
          const res = await fetch(`${apiUrl}/server3/search-movie?keyword=${encodeURIComponent(mediaTitle || '')}&name=${encodeURIComponent(mediaTitle || '')}&year=${tmdbYear}&director=${encodeURIComponent(tmdbDirector)}`)
          const data = await res.json()
          if (isCancelled) return
          if (data?.status === 'success' && data?.data?.links) {
            if (data.data.links.dubbed) vDub = true
            if (data.data.links.vietsub) vSub = true
          }
        } catch { /* ignore */ }

        if (!isCancelled) {
          setAudioOptions({ hasVietsub: vSub, hasDubbed: vDub })
          if (vSub) {
            setSelectedAudio('vietsub')
          } else if (vDub) {
            setSelectedAudio('dubbed')
          } else {
            setSelectedAudio('')
          }
        }
        return
      }

      // Server 1
      let vDub = false
      let vSub = false
      let slug = null

      try {
        const tmdbRes = await fetch(`${apiUrl}/server1/tmdb/${type}/${mediaId}`)
        const tmdbData = await tmdbRes.json()
        if (tmdbData?.status === true && tmdbData?.movie?.slug) {
          slug = tmdbData.movie.slug
        }
      } catch { /* ignore */ }

      if (!slug && mediaTitle) {
        try {
          const searchRes = await fetch(`${apiUrl}/server1/search?keyword=${encodeURIComponent(mediaTitle)}`)
          const searchData = await searchRes.json()
          const items = searchData?.data?.items || searchData?.items || []
          if (Array.isArray(items) && items.length > 0) {
            slug = items[0].slug
          }
        } catch { /* ignore */ }
      }

      if (isCancelled) return

      if (slug) {
        try {
          const detailRes = await fetch(`${apiUrl}/server1/detail/${slug}`)
          const detailData = await detailRes.json()
          if (isCancelled) return

          if (detailData?.episodes && Array.isArray(detailData.episodes)) {
            detailData.episodes.forEach((ep: { server_name?: string }) => {
              const sName = (ep.server_name || '').toLowerCase()
              if (sName.includes('vietsub') || sName.includes('sub')) {
                vSub = true
              }
              if (sName.includes('thuyết minh') || sName.includes('lồng tiếng') || sName.includes('dubbed')) {
                vDub = true
              }
            })
          }
        } catch { /* ignore */ }
      }

      if (!isCancelled) {
        setAudioOptions({ hasVietsub: vSub, hasDubbed: vDub })
        if (vSub) {
          setSelectedAudio('vietsub')
        } else if (vDub) {
          setSelectedAudio('dubbed')
        } else {
          setSelectedAudio('')
        }
      }
    }

    checkAudio()

    return () => {
      isCancelled = true
    }
  }, [media, type, selectedServer])

  const basePath = type === 'movie' ? `/movies/${id}` : `/tvshows/${id}`

  const hasAudioOptions = selectedServer !== 'server2' && (audioOptions.hasVietsub || audioOptions.hasDubbed)

  const audioLabel = useMemo(() => {
    if (selectedServer === 'server2') return 'None'
    if (selectedAudio === 'vietsub' && audioOptions.hasVietsub) return tWatch('vietsub') || 'Vietsub'
    if (selectedAudio === 'dubbed' && audioOptions.hasDubbed) return tWatch('dubbed') || 'Thuyết minh'
    if (audioOptions.hasVietsub) return tWatch('vietsub') || 'Vietsub'
    if (audioOptions.hasDubbed) return tWatch('dubbed') || 'Thuyết minh'
    return 'None'
  }, [selectedServer, selectedAudio, audioOptions, tWatch])
  const watchHref = useMemo(() => {
    const params = new URLSearchParams()
    params.set('server', selectedServer)
    if (selectedServer !== 'server2') {
      params.set('audio', selectedAudio)
    }
    return `${basePath}/watch?${params.toString()}`
  }, [basePath, selectedServer, selectedAudio])

  if (loading) {
    return <MediaPageLoading label={text.loading} fullScreen />
  }

  if (error || !media) {
    return <main className="flex min-h-screen items-center justify-center bg-[#08090b] text-white/70">{text.notFound}</main>
  }

  const displayPoster = media.poster
  const releaseDate = formatReleaseDate(media.releaseDate, locale)

  return (
    <main className="min-h-screen overflow-hidden bg-[#08090b] text-white">
      <section className={`relative transition-[min-height] duration-300 ${isMobileInfoExpanded ? 'min-h-[880px]' : 'min-h-[540px]'} sm:min-h-[570px] md:min-h-[630px]`}>
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {media.backdrop && (
            <Image
              src={media.backdrop}
              alt=""
              fill
              priority
              className="scale-[1.02] object-cover object-center brightness-[1.05]"
              sizes="100vw"
            />
          )}
          <div className="absolute inset-0 z-[1] bg-gradient-to-t from-[#08090b] via-[#08090b]/30 to-transparent sm:bg-[linear-gradient(180deg,rgba(8,9,11,0.1)_0%,rgba(8,9,11,0.35)_55%,#08090b_100%)]" />
        </div>
        <div className="absolute inset-x-0 bottom-0 z-10 mx-auto flex w-full max-w-[1440px] flex-col items-center gap-4 px-4 pb-2 sm:flex-row sm:items-end sm:gap-6 sm:px-6 sm:pb-5 lg:px-10">
          <div
            className="h-[180px] w-[120px] shrink-0 sm:h-[290px] sm:w-[194px] sm:translate-y-20 lg:h-[330px] lg:w-[220px]"
            style={{ perspective: '1000px' }}
          >
            <div
              data-testid="floating-3d-poster"
              className="relative h-full w-full overflow-hidden rounded-2xl border border-white/15 bg-[#15171b] shadow-[0_30px_80px_rgba(0,0,0,0.65)] motion-reduce:animate-none"
              style={{
                transformStyle: 'preserve-3d',
                animation: 'posterFloat 6s ease-in-out infinite',
                willChange: 'transform',
              }}
            >
              {displayPoster ? (
                <Image src={displayPoster} alt={media.title} fill className="object-cover" priority sizes="220px" />
              ) : (
                <div className="flex h-full items-center justify-center"><FilmIcon className="h-12 w-12 text-white/25" /></div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(255,255,255,0.16)_48%,transparent_68%)] opacity-50" />
            </div>
          </div>

          <div className="w-full min-w-0 flex-1 text-center sm:pl-1 sm:text-left lg:pl-4">
            <h1 className="mx-auto max-w-4xl text-3xl font-black leading-[1.04] tracking-[-0.035em] [text-shadow:0_3px_18px_rgba(0,0,0,0.95)] sm:mx-0 sm:text-5xl lg:text-6xl">{media.title}</h1>
            {media.originalTitle && media.originalTitle !== media.title && (
              <p className="mt-2 text-base font-medium text-white/75 [text-shadow:0_2px_10px_rgba(0,0,0,0.95)] sm:text-lg">{media.originalTitle}</p>
            )}

            <button
              type="button"
              data-testid="mobile-info-toggle"
              aria-expanded={isMobileInfoExpanded}
              aria-controls="mobile-media-info"
              onClick={() => setIsMobileInfoExpanded((current) => !current)}
              className="mx-auto mt-4 flex items-center gap-2 rounded-full px-3 py-2 text-sm font-black text-white/85 transition hover:bg-white/[0.08] hover:text-white sm:hidden"
            >
              {isMobileInfoExpanded ? text.hideInfo : text.movieInfo}
              {isMobileInfoExpanded ? <ChevronUpIcon className="h-4 w-4" /> : <ChevronDownIcon className="h-4 w-4" />}
            </button>

            {isMobileInfoExpanded && (
              <div
                id="mobile-media-info"
                data-testid="mobile-media-info"
                className="mx-auto mt-3 max-w-lg rounded-2xl border border-white/[0.09] bg-[#0d0f13]/90 p-4 text-left shadow-2xl shadow-black/30 backdrop-blur-xl sm:hidden"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md border border-sky-400/50 bg-sky-400/10 px-2.5 py-1 text-xs font-black text-sky-300">TMDb {media.voteAverage.toFixed(1)}</span>
                  {releaseDate && (
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-white/60">
                      <CalendarDaysIcon className="h-4 w-4 text-white/45" />
                      {releaseDate}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  {media.genres.map((genre) => (
                    <span key={genre} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-semibold text-white/70">{genre}</span>
                  ))}
                </div>

                <p className="mt-4 line-clamp-5 text-sm leading-6 text-white/65">{media.description || text.noOverview}</p>

                <dl className="mt-4 grid gap-2.5 border-t border-white/[0.08] pt-4 text-xs">
                  {media.creator && (
                    <div className="flex gap-3"><dt className="w-20 shrink-0 text-white/38">{text.director}</dt><dd className="font-semibold text-white/75">{media.creator}</dd></div>
                  )}
                  {media.countries.length > 0 && (
                    <div className="flex gap-3"><dt className="w-20 shrink-0 text-white/38">{text.country}</dt><dd className="font-semibold text-white/75">{media.countries.join(', ')}</dd></div>
                  )}
                  {media.duration && (
                    <div className="flex gap-3"><dt className="w-20 shrink-0 text-white/38">{text.duration}</dt><dd className="font-semibold text-white/75">{media.duration}</dd></div>
                  )}
                </dl>
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:mt-6 sm:justify-start">
              <Link href={watchHref} data-testid="watch-now-button" className={`${watchButtonClass} px-6 py-3.5 text-sm`}>
                <PlayIcon className="h-5 w-5" /> {text.watchNow}
              </Link>
              {media.trailer && (
                <button
                  type="button"
                  data-testid="trailer-button"
                  onClick={() => setShowTrailer(true)}
                  className={buttonClass}
                >
                  <FilmIcon className="h-5 w-5" />
                  <span>{text.trailer}</span>
                </button>
              )}
              <button type="button" onClick={toggleWatchlist} className={buttonClass}>
                {isBookmarked ? <BookmarkIcon className="h-5 w-5 text-yellow-300" /> : <PlusIcon className="h-5 w-5" />}
                <span className="hidden md:inline">{isBookmarked ? text.added : text.add}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <nav className="border-y border-white/[0.08] bg-[#08090b]/95 backdrop-blur-xl" aria-label={text.contentNavLabel}>
        <div className="mx-auto flex max-w-[1440px] gap-8 overflow-x-auto px-4 pl-4 sm:px-6 sm:pl-[250px] lg:px-10 lg:pl-[286px]" role="tablist">
          {[
            { id: 'episodes' as DetailTab, label: type === 'tv' ? text.episodes : text.overview, icon: FilmIcon },
            { id: 'gallery' as DetailTab, label: text.gallery, icon: PhotoIcon },
            { id: 'cast' as DetailTab, label: text.cast, icon: UserGroupIcon },
            { id: 'suggestions' as DetailTab, label: text.suggestions, icon: SparklesIcon },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`detail-tab-${tab.id}`}
              type="button"
              role="tab"
              data-testid={`detail-tab-${tab.id}`}
              aria-selected={activeTab === tab.id}
              aria-controls={`detail-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex shrink-0 items-center gap-2 py-4 text-sm font-bold transition ${activeTab === tab.id ? 'text-white' : 'text-white/45 hover:text-white'}`}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
              {activeTab === tab.id && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-yellow-400" />}
            </button>
          ))}
        </div>
      </nav>

      {activeTab === 'episodes' && (
      <section
        id="detail-panel-episodes"
        role="tabpanel"
        aria-labelledby="detail-tab-episodes"
        data-testid="detail-panel-episodes"
        className="mx-auto grid grid-cols-1 max-w-[1440px] gap-6 px-4 pb-12 pt-7 sm:px-6 lg:grid-cols-12 lg:gap-10 lg:px-10 lg:pb-14 lg:pt-8"
      >
        {/* Desktop View: Full Uncollapsed Article (lg+) */}
        <article className="hidden lg:block lg:col-span-5 xl:col-span-4">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-yellow-300">{text.introduction}</p>
          <h2 className="text-3xl font-black tracking-tight sm:text-4xl">{media.title}</h2>
          {media.originalTitle && media.originalTitle !== media.title && (
            <p className="mt-2 text-base text-white/42">{media.originalTitle}</p>
          )}

          <div data-testid="media-metadata" className="mt-6 flex flex-wrap items-center gap-3">
            <span data-testid="tmdb-score" className="rounded-md border border-sky-400/50 bg-sky-400/10 px-2.5 py-1 text-xs font-black text-sky-300">TMDb {media.voteAverage.toFixed(1)}</span>
            {releaseDate && (
              <span data-testid="release-date" className="inline-flex items-center gap-2 text-sm font-semibold text-white/55">
                <CalendarDaysIcon className="h-5 w-5 text-white/40" />
                {releaseDate}
              </span>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {media.genres.map((genre) => (
              <span key={genre} className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1.5 text-xs font-semibold text-white/70">{genre}</span>
            ))}
          </div>

          <p className="mt-6 text-[15px] leading-7 text-white/62">{media.description || text.noOverview}</p>
          <dl className="mt-7 grid gap-3 border-t border-white/[0.08] pt-6 text-sm">
            {media.creator && (
              <div className="flex gap-3"><dt className="w-24 shrink-0 text-white/35">{text.director}</dt><dd className="font-semibold text-white/75">{media.creator}</dd></div>
            )}
            {media.countries.length > 0 && (
              <div data-testid="media-country" className="flex gap-3"><dt className="w-24 shrink-0 text-white/35">{text.country}</dt><dd className="font-semibold text-white/75">{media.countries.join(', ')}</dd></div>
            )}
            {media.duration && (
              <div className="flex gap-3"><dt className="w-24 shrink-0 text-white/35">{text.duration}</dt><dd className="font-semibold text-white/75">{media.duration}</dd></div>
            )}
          </dl>
        </article>

        {/* iPad / Tablet View: Compact Collapsible Bar (sm to lg) */}
        <div className="hidden sm:block lg:hidden col-span-1 rounded-2xl border border-white/[0.08] bg-[#111318] p-4 shadow-xl sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-yellow-300">
              <InformationCircleIcon className="h-4 w-4" />
              <span className="text-xs font-black uppercase tracking-[0.2em]">{text.movieInfo}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOverviewExpanded((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-1.5 text-xs font-bold text-white/80 transition hover:border-yellow-400/40 hover:bg-white/10 hover:text-yellow-300"
            >
              <span>{isOverviewExpanded ? text.showLess : text.seeMore}</span>
              {isOverviewExpanded ? <ChevronUpIcon className="h-3.5 w-3.5" /> : <ChevronDownIcon className="h-3.5 w-3.5" />}
            </button>
          </div>

          {isOverviewExpanded && (
            <div className="mt-4 border-t border-white/[0.08] pt-4 transition-all duration-300">
              <h2 className="text-xl font-black tracking-tight text-white sm:text-2xl">{media.title}</h2>
              {media.originalTitle && media.originalTitle !== media.title && (
                <p className="mt-0.5 text-xs text-white/42">{media.originalTitle}</p>
              )}

              <div data-testid="media-metadata" className="mt-3 flex flex-wrap items-center gap-2.5">
                <span data-testid="tmdb-score" className="rounded-md border border-sky-400/50 bg-sky-400/10 px-2 py-0.5 text-xs font-black text-sky-300">TMDb {media.voteAverage.toFixed(1)}</span>
                {releaseDate && (
                  <span data-testid="release-date" className="inline-flex items-center gap-1.5 text-xs font-semibold text-white/55">
                    <CalendarDaysIcon className="h-4 w-4 text-white/40" />
                    {releaseDate}
                  </span>
                )}
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {media.genres.map((genre) => (
                  <span key={genre} className="rounded-full border border-white/10 bg-white/[0.035] px-2.5 py-0.5 text-[11px] font-semibold text-white/70">{genre}</span>
                ))}
              </div>

              <p className="mt-3 text-xs leading-6 text-white/65 sm:text-sm">
                {media.description || text.noOverview}
              </p>

              <dl className="mt-3 grid gap-2 border-t border-white/[0.08] pt-3 text-xs">
                {media.creator && (
                  <div className="flex gap-3"><dt className="w-20 shrink-0 text-white/35">{text.director}</dt><dd className="font-semibold text-white/75">{media.creator}</dd></div>
                )}
                {media.countries.length > 0 && (
                  <div data-testid="media-country" className="flex gap-3"><dt className="w-20 shrink-0 text-white/35">{text.country}</dt><dd className="font-semibold text-white/75">{media.countries.join(', ')}</dd></div>
                )}
                {media.duration && (
                  <div className="flex gap-3"><dt className="w-20 shrink-0 text-white/35">{text.duration}</dt><dd className="font-semibold text-white/75">{media.duration}</dd></div>
                )}
              </dl>
            </div>
          )}
        </div>

        <div className="col-span-1 lg:col-span-7 xl:col-span-8">
          <div className="relative rounded-2xl border border-white/[0.08] bg-[#111318] p-5 shadow-2xl shadow-black/20 sm:rounded-3xl sm:p-6">
              {/* Dedicated Server & Audio Selectors Container */}
              <div className="mb-5 flex flex-col justify-between gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3 backdrop-blur-xl relative z-30 sm:p-4 sm:flex-row sm:items-center sm:gap-3.5">
                <div className="flex flex-col gap-2.5 w-full sm:flex-row sm:items-center sm:gap-3.5 sm:w-auto">
                  {/* Server Custom Dropdown */}
                  <div ref={serverPickerRef} className="relative w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (!isServerMenuOpen) updateServerCoords()
                        setIsServerMenuOpen(!isServerMenuOpen)
                        setIsAudioMenuOpen(false)
                      }}
                      className={`inline-flex w-full items-center justify-between gap-2.5 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-xs font-black text-white shadow-lg shadow-black/15 outline-none transition sm:w-auto sm:px-4 sm:text-sm ${
                        isServerMenuOpen
                          ? 'border-yellow-400/70 bg-yellow-400/[0.08] ring-2 ring-yellow-400/10'
                          : 'border-white/10 bg-[#17191f] hover:border-white/20 hover:bg-[#1f222a]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <ServerIcon className="h-4 w-4 shrink-0 text-yellow-300 sm:h-5 sm:w-5" />
                        {tWatch(selectedServer) || (selectedServer === 'server1' ? 'Máy chủ 1' : selectedServer === 'server2' ? 'Máy chủ 2' : 'Máy chủ 3')}
                      </span>
                      <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-white/45 transition-transform sm:h-4 sm:w-4 ${isServerMenuOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>

                  {/* Audio Custom Dropdown */}
                  <div ref={audioPickerRef} className="relative w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => {
                        if (!hasAudioOptions) return
                        if (!isAudioMenuOpen) updateAudioCoords()
                        setIsAudioMenuOpen(!isAudioMenuOpen)
                        setIsServerMenuOpen(false)
                      }}
                      className={`inline-flex w-full items-center justify-between gap-2.5 whitespace-nowrap rounded-xl border px-3.5 py-2.5 text-xs font-black shadow-lg shadow-black/15 outline-none transition sm:w-auto sm:px-4 sm:text-sm ${
                        hasAudioOptions
                          ? isAudioMenuOpen
                            ? 'border-pink-500/50 bg-pink-500/[0.08] text-white ring-2 ring-pink-500/10'
                            : 'border-white/10 bg-[#17191f] text-white hover:border-white/20 hover:bg-[#1f222a]'
                          : 'border-white/10 bg-[#17191f]/60 text-white/40 cursor-default'
                      }`}
                    >
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <SpeakerWaveIcon className={`h-4 w-4 shrink-0 sm:h-5 sm:w-5 ${hasAudioOptions ? 'text-pink-400' : 'text-white/30'}`} />
                        {audioLabel}
                      </span>
                      {hasAudioOptions && (
                        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-white/45 transition-transform sm:h-4 sm:w-4 ${isAudioMenuOpen ? 'rotate-180' : ''}`} />
                      )}
                    </button>
                  </div>
                </div>

                <span className="hidden md:inline-block text-xs font-bold uppercase tracking-wider text-white/40 whitespace-nowrap">
                  {tWatch('serverAndAudio')}
                </span>
              </div>

              {/* Server 2 Subtitle Tip */}
              {selectedServer === 'server2' && (
                <div className="-mt-3 mb-5 flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3.5 py-2.5 text-xs text-amber-200/90 backdrop-blur-md">
                  <InformationCircleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                  <span className="leading-relaxed">{tWatch('server2SubtitleTip')}</span>
                </div>
              )}

              {/* Server Dropdown Portal */}
              {isMounted && isServerMenuOpen && createPortal(
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    top: `${serverCoords.top}px`,
                    left: `${serverCoords.left}px`,
                    minWidth: `${serverCoords.minWidth}px`,
                  }}
                  className="z-[9999] overflow-hidden rounded-xl border border-white/10 bg-[#17191f]/98 p-1.5 shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                >
                  {[
                    { key: 'server1', label: tWatch('server1') || 'Máy chủ 1' },
                    { key: 'server2', label: tWatch('server2') || 'Máy chủ 2' },
                    { key: 'server3', label: tWatch('server3') || 'Máy chủ 3' },
                  ].map((srv) => {
                    const isSelected = selectedServer === srv.key
                    return (
                      <button
                        key={srv.key}
                        type="button"
                        onClick={() => {
                          setSelectedServer(srv.key as 'server1' | 'server2' | 'server3')
                          setIsServerMenuOpen(false)
                        }}
                        className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-xs font-bold transition sm:text-sm ${
                          isSelected
                            ? 'bg-yellow-400/15 text-yellow-300 font-black'
                            : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                        }`}
                      >
                        <span>{srv.label}</span>
                        {isSelected && <CheckIcon className="ml-2 h-4 w-4 shrink-0 text-yellow-300" />}
                      </button>
                    )
                  })}
                </div>,
                document.body
              )}

              {/* Audio Dropdown Portal */}
              {isMounted && isAudioMenuOpen && hasAudioOptions && createPortal(
                <div
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    top: `${audioCoords.top}px`,
                    left: `${audioCoords.left}px`,
                    minWidth: `${audioCoords.minWidth}px`,
                  }}
                  className="z-[9999] overflow-hidden rounded-xl border border-white/10 bg-[#17191f]/98 p-1.5 shadow-[0_22px_55px_rgba(0,0,0,0.8)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100"
                >
                  {audioOptions.hasVietsub && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAudio('vietsub')
                        setIsAudioMenuOpen(false)
                      }}
                      className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-xs font-bold transition sm:text-sm ${
                        selectedAudio === 'vietsub' || !selectedAudio
                          ? 'bg-pink-500/15 text-pink-300 font-black'
                          : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <span>{tWatch('vietsub') || 'Vietsub'}</span>
                      {(selectedAudio === 'vietsub' || !selectedAudio) && <CheckIcon className="ml-2 h-4 w-4 shrink-0 text-pink-400" />}
                    </button>
                  )}
                  {audioOptions.hasDubbed && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedAudio('dubbed')
                        setIsAudioMenuOpen(false)
                      }}
                      className={`flex w-full items-center justify-between whitespace-nowrap rounded-lg px-3.5 py-2 text-left text-xs font-bold transition sm:text-sm ${
                        selectedAudio === 'dubbed'
                          ? 'bg-pink-500/15 text-pink-300 font-black'
                          : 'text-white/70 hover:bg-white/[0.08] hover:text-white'
                      }`}
                    >
                      <span>{tWatch('dubbed') || 'Thuyết minh'}</span>
                      {selectedAudio === 'dubbed' && <CheckIcon className="ml-2 h-4 w-4 shrink-0 text-pink-400" />}
                    </button>
                  )}
                </div>,
                document.body
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-yellow-400/10 text-yellow-300">
                    <FilmIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white sm:text-xl">{text.movieExperienceTitle}</h3>
                    <p className="mt-1 max-w-xl text-xs leading-5 text-white/55 sm:text-sm">{text.movieExperienceDescription}</p>
                  </div>
                </div>
                <Link href={watchHref} className={`${watchButtonClass} w-full justify-center sm:w-auto shrink-0 px-5 py-3 text-xs font-bold sm:text-sm`}>
                  <PlayIcon className="h-4 w-4 sm:h-5 sm:w-5" /> {text.watchNow}
                </Link>
              </div>
            </div>
          </div>
      </section>
      )}

      {activeTab === 'gallery' && (
      <section
        id="detail-panel-gallery"
        role="tabpanel"
        aria-labelledby="detail-tab-gallery"
        data-testid="detail-panel-gallery"
        className="mx-auto min-h-[480px] max-w-[1440px] px-4 pb-12 pt-7 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8"
      >
        <div className="mb-6 flex items-center gap-3"><PhotoIcon className="h-6 w-6 text-yellow-300" /><h2 className="text-2xl font-black">{text.gallery}</h2></div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {media.scenes.slice(0, 6).map((scene, index) => (
            <button
              key={scene}
              type="button"
              data-testid={`gallery-image-${index}`}
              aria-label={`${text.gallery} ${index + 1}`}
              onClick={() => setActiveScene(index)}
              className={`group relative cursor-zoom-in overflow-hidden rounded-2xl border border-white/[0.08] bg-[#121419] text-left ${index === 0 ? 'aspect-video sm:col-span-2 lg:col-span-2 lg:row-span-2' : 'aspect-video'}`}
            >
              <Image src={scene} alt={`${media.title} gallery ${index + 1}`} fill className="object-cover transition duration-700 hover:scale-105" sizes="(max-width: 768px) 100vw, 50vw" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition duration-300 group-hover:bg-black/35 group-hover:opacity-100">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white backdrop-blur-md">
                  <ArrowsPointingOutIcon className="h-5 w-5" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>
      )}

      {activeTab === 'cast' && (
      <section
        id="detail-panel-cast"
        role="tabpanel"
        aria-labelledby="detail-tab-cast"
        data-testid="detail-panel-cast"
        className="mx-auto min-h-[480px] max-w-[1440px] px-4 pb-12 pt-7 sm:px-6 lg:px-10 lg:pb-14 lg:pt-8"
      >
        <div className="mb-7 flex items-center gap-3"><UserGroupIcon className="h-6 w-6 text-yellow-300" /><h2 className="text-2xl font-black">{text.cast}</h2></div>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-9">
          {media.cast.map((person) => (
            <article
              key={person.id}
              className="group flex flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#111318] p-1.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-yellow-400/40 hover:bg-[#161920] hover:shadow-lg hover:shadow-yellow-400/5"
            >
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-white/5">
                {person.profilePath ? (
                  <Image
                    src={person.profilePath}
                    alt={person.name}
                    fill
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 640px) 33vw, (max-width: 768px) 25vw, (max-width: 1024px) 16vw, 11vw"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-white/[0.03]">
                    <UserGroupIcon className="h-8 w-8 text-white/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60 transition-opacity group-hover:opacity-40" />
              </div>
              <div className="flex flex-col justify-center px-1 pb-0.5 pt-2">
                <h3 className="line-clamp-1 text-xs font-bold text-white group-hover:text-yellow-300 transition-colors">
                  {person.name}
                </h3>
                {person.character && (
                  <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-white/45">
                    {person.character}
                  </p>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>
      )}

      {activeTab === 'suggestions' && (
      <section
        id="detail-panel-suggestions"
        role="tabpanel"
        aria-labelledby="detail-tab-suggestions"
        data-testid="detail-panel-suggestions"
        className="min-h-[480px] border-t border-white/[0.06] bg-[#0b0c0f]"
      >
        <RelatedContent id={media.id} type={type} title={media.title} />
      </section>
      )}

      <section
        id="comments"
        data-testid="detail-comments"
        className="relative z-10 border-t border-white/[0.06] bg-[#08090b]/95"
      >
        <Comments movieId={media.id} type={type === 'tv' ? 'tvshow' : 'movie'} title={media.title} />
      </section>

      {activeScene !== null && media.scenes[activeScene] && (
        <div
          data-testid="gallery-lightbox"
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/95 p-3 backdrop-blur-sm sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`${text.gallery} ${activeScene + 1}`}
          onClick={() => setActiveScene(null)}
        >
          <div className="relative flex max-h-full w-full max-w-6xl flex-col" onClick={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-base font-black text-white sm:text-lg">{text.gallery} <span className="text-white/45">{activeScene + 1} / {media.scenes.length}</span></h3>
              <button
                type="button"
                data-testid="gallery-lightbox-close"
                onClick={() => setActiveScene(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
                aria-label={text.closeImage}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            <div className="relative min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/10 bg-[#08090b] shadow-2xl shadow-black">
              <div className="relative h-[62vh] min-h-[260px] w-full sm:h-[68vh]">
                <Image
                  data-testid="gallery-lightbox-image"
                  src={media.scenes[activeScene]}
                  alt={`${media.title} gallery ${activeScene + 1}`}
                  fill
                  className="object-contain"
                  sizes="100vw"
                  priority
                />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                type="button"
                data-testid="gallery-previous"
                onClick={() => setActiveScene((current) => current === null || current === 0 ? media.scenes.length - 1 : current - 1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
                aria-label={text.previousImage}
              >
                <ChevronLeftIcon className="h-5 w-5" />
              </button>

              <div className="flex max-w-[70vw] gap-2 overflow-x-auto px-1 py-2">
                {media.scenes.map((scene, index) => (
                  <button
                    key={`${scene}-${index}`}
                    type="button"
                    data-testid={`gallery-thumbnail-${index}`}
                    onClick={() => setActiveScene(index)}
                    className={`relative h-10 w-16 shrink-0 overflow-hidden rounded-md transition ${activeScene === index ? 'scale-105 ring-2 ring-red-500' : 'opacity-45 hover:opacity-100'}`}
                    aria-label={`${text.gallery} ${index + 1}`}
                    aria-current={activeScene === index ? 'true' : undefined}
                  >
                    <Image src={scene} alt="" fill className="object-cover" sizes="64px" />
                  </button>
                ))}
              </div>

              <button
                type="button"
                data-testid="gallery-next"
                onClick={() => setActiveScene((current) => current === null || current === media.scenes.length - 1 ? 0 : current + 1)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition hover:bg-white/20"
                aria-label={text.nextImage}
              >
                <ChevronRightIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showTrailer && media.trailer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label={text.trailer} onClick={() => setShowTrailer(false)}>
          <div className="relative w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              data-testid="trailer-close-button"
              className="absolute -top-14 right-0 z-10 flex h-11 w-11 items-center justify-center rounded-full border border-red-400/35 bg-[#17191f]/95 text-white shadow-[0_0_24px_rgba(239,68,68,0.28)] backdrop-blur-xl transition hover:scale-105 hover:border-red-300/70 hover:bg-red-500 hover:shadow-[0_0_30px_rgba(239,68,68,0.48)]"
              onClick={() => setShowTrailer(false)}
              aria-label={text.closeTrailer}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
              <iframe src={media.trailer} className="h-full w-full" title={`${media.title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen />
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
