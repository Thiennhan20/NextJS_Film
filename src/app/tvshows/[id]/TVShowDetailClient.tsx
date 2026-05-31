'use client'

import { useEffect, useState, useRef } from 'react'
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import { ClockIcon, CalendarIcon, PlayIcon, ChevronDownIcon } from '@heroicons/react/24/solid'
import { BookmarkIcon } from '@heroicons/react/24/outline'
import { useWatchlistStore } from '@/store/store'
import toast from 'react-hot-toast'
import axios from 'axios'
import { useSearchParams, useRouter } from 'next/navigation'
import useAuthStore from '@/store/useAuthStore'
import api from '@/lib/axios'
import Comments from '@/components/Comments'
import WatchNowTVShows from '@/components/watch/WatchNowTVShows'
import RelatedContent from '@/components/RelatedContent'
import AnimeEpisodePlayer from '@/components/anime/AnimeEpisodePlayer'
import { isAnimeInList, getAnimeConfig, getAnimeTotalEpisodes, getAnimeEpisodeMapping } from '@/config/anime-list'
import { useTranslations } from 'next-intl'


interface CastMember {
  name: string
  character: string
  profilePath: string
}

// Định nghĩa kiểu TVShow rõ ràng
interface TVShow {
  id: number
  name: string

  duration: string
  year: number | ''
  firstAirDate?: string
  creator: string
  cast: CastMember[]
  genre: string
  description: string
  poster: string
  backdrop: string
  trailer: string
  tvShowUrl: string
  scenes: string[]

  totalSeasons?: number
  totalEpisodes?: number
}


interface Episode {
  id: number
  name: string
  episode_number: number
  season_number: number
  still_path?: string
  overview?: string
  air_date?: string
}





interface Person {
  name: string
  job?: string
}

export default function TVShowDetailClient({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>('');
  
  useEffect(() => {
    params.then(p => setId(p.id));
  }, [params]);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const searchParams = useSearchParams()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const router = useRouter()
  const [tvShow, setTVShow] = useState<TVShow | null>(null)
  const t = useTranslations('TVShows')



  const [loading, setLoading] = useState<boolean>(true)
  const [activeScene, setActiveScene] = useState<number | null>(null)
  const [showTrailer, setShowTrailer] = useState<boolean>(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"]
  })

  const { addToWatchlist, removeFromWatchlist, isInWatchlist, fetchWatchlistFromServer } = useWatchlistStore()
  const { isAuthenticated, token } = useAuthStore()
  const isBookmarked = tvShow ? isInWatchlist(tvShow.id) : false
  const [isCastExpanded, setIsCastExpanded] = useState(false)
  const [isDescExpanded, setIsDescExpanded] = useState(false)
  const [posterLoaded, setPosterLoaded] = useState(false)

  const handleToggleWatchlist = async () => {
    if (!tvShow) return
    if (!isAuthenticated) {
      toast.error(t('loginRequired'))
      return
    }
    try {
      if (isBookmarked) {
        await api.delete('/auth/watchlist', {
          data: { id: tvShow.id },
        })
        removeFromWatchlist(tvShow.id)
        toast.success(t('removedFromWatchlist'))
        if (token) await fetchWatchlistFromServer(token)
      } else {
        await api.post('/auth/watchlist', {
          id: tvShow.id,
          title: tvShow.name,
          poster_path: tvShow.poster,
          type: 'tv',
        })
        addToWatchlist({
          id: tvShow.id,
          title: tvShow.name,
          poster_path: tvShow.poster,
          type: 'tv',
        })
        toast.success(t('addedToWatchlist'))
        if (token) await fetchWatchlistFromServer(token)
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        toast.error((err as { response?: { data?: { message?: string } } })?.response?.data?.message || t('errorOccurred'))
      } else {
        toast.error(t('errorOccurred'))
      }
    }
  }

  const [selectedSeason, setSelectedSeason] = useState<number>(1)
  const [selectedEpisode, setSelectedEpisode] = useState<number>(0)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)
  const [seasons, setSeasons] = useState<{ id: number; name: string; season_number: number; episode_count: number; poster_path?: string; overview?: string; air_date?: string }[]>([])
  const [isSeasonDropdownOpen, setIsSeasonDropdownOpen] = useState(false)
  const seasonDropdownRef = useRef<HTMLDivElement>(null)
  const [isEpisodesCompact, setIsEpisodesCompact] = useState(true)



  const handleSeasonSelect = (season: number) => {
    setSelectedSeason(season)
    setSelectedEpisode(1) // Mặc định chọn episode 1 khi đổi season



    // Update URL: set season and episode 1
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    params.set('season', String(season))
    params.set('episode', '1')
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    }
  }

  const handleEpisodeSelect = (episode: number) => {
    setSelectedEpisode(episode)

    // Update URL: set season and episode
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
    params.set('season', String(selectedSeason))
    params.set('episode', String(episode))
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`)
    }
  }



  const y = useTransform(scrollYProgress, [0, 1], [0, -100])
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0])



  useEffect(() => {
    if (!id) return;
    const fetchTVShow = async () => {
      setLoading(true)
      try {
        // Fetch all TMDB data in parallel for faster loading
        const [detailResult, imgResult, videoResult, creditsResult] = await Promise.allSettled([
          axios.get(`/api/tmdb-proxy?endpoint=/tv/${id}`),
          axios.get(`/api/tmdb-proxy?endpoint=/tv/${id}/images`),
          axios.get(`/api/tmdb-proxy?endpoint=/tv/${id}/videos`),
          axios.get(`/api/tmdb-proxy?endpoint=/tv/${id}/credits`),
        ])

        // Detail is required - if it fails, throw
        if (detailResult.status === 'rejected') throw detailResult.reason
        const data = detailResult.value.data

        // Images - optional, graceful fallback
        let scenes: string[] = []
        if (imgResult.status === 'fulfilled') {
          const backdrops: { file_path: string }[] = imgResult.value.data.backdrops || []
          scenes = backdrops.slice(0, 3).map((img) => `https://image.tmdb.org/t/p/w780${img.file_path}`)
        }
        if (scenes.length < 3) {
          if (data.backdrop_path) scenes.push(`https://image.tmdb.org/t/p/w780${data.backdrop_path}`)
          if (data.poster_path) scenes.push(`https://image.tmdb.org/t/p/w500${data.poster_path}`)
        }
        scenes = scenes.slice(0, 3)

        // Videos - optional, graceful fallback
        let trailer = ''
        if (videoResult.status === 'fulfilled') {
          const videos: { type: string; site: string; key: string }[] = videoResult.value.data.results || []
          const ytTrailer = videos.find((v) => v.type === 'Trailer' && v.site === 'YouTube')
          if (ytTrailer) {
            trailer = `https://www.youtube.com/embed/${ytTrailer.key}`
          }
        }

        // Credits - graceful fallback
        const credits = creditsResult.status === 'fulfilled' ? creditsResult.value.data : { crew: [], cast: [] }

        // Set seasons data
        setSeasons(data.seasons || [])

        const tvShowData = {
          id: data.id,
          name: data.name,

          duration: data.episode_run_time && data.episode_run_time.length > 0
            ? `${data.episode_run_time[0]}m` : '',
          year: data.first_air_date ? Number(data.first_air_date.slice(0, 4)) : '' as number | '',
          firstAirDate: data.first_air_date || '',
          creator: credits.crew?.find((person: Person) => person.job === 'Creator')?.name || '',
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
          tvShowUrl: '',
          scenes,

          totalSeasons: data.number_of_seasons,
          totalEpisodes: data.number_of_episodes,
        }

        setTVShow(tvShowData)
      } catch {
        setTVShow(null)
      }
      setLoading(false)
    }
    fetchTVShow()
  }, [id])

  // Reset selections when navigating to a different TV show id
  useEffect(() => {
    setSelectedSeason(1)
    setSelectedEpisode(1) // Mặc định chọn episode 1
    setEpisodes([])
  }, [id])

  // Helper to format date as dd/mm/yyyy (Vietnam locale)
  const formatDate = (dateStr?: string) => {
    try {
      if (!dateStr) return ''
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    } catch {
      return dateStr || ''
    }
  }

  useEffect(() => {
    if (tvShow?.id) {
      setEpisodesLoading(true)
      const fetchEpisodes = async () => {
        try {
          const response = await axios.get(
            `/api/tmdb-proxy?endpoint=/tv/${tvShow.id}/season/${selectedSeason}`
          )
          const data = response.data
          if (data.episodes) {

            setEpisodes(data.episodes)
          }
        } catch {
          setEpisodes([])
        } finally {
          setEpisodesLoading(false)
        }
      }
      fetchEpisodes()
    }
  }, [tvShow?.id, selectedSeason])

  // Sync selected season and episode from URL on mount and browser navigation without route reload
  useEffect(() => {
    const syncFromUrl = () => {
      const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '')
      const seasonParam = params.get('season')
      const episodeParam = params.get('episode')

      const seasonNum = seasonParam && !isNaN(Number(seasonParam)) ? Number(seasonParam) : 1
      // Mặc định chọn episode 1 thay vì 0
      const episodeNum = episodeParam && !isNaN(Number(episodeParam)) ? Number(episodeParam) : 1

      // Always set from URL; React will skip state update if value is unchanged
      setSelectedSeason(seasonNum)
      setSelectedEpisode(episodeNum)

      // Nếu URL không có episode param, tự động thêm episode=1 vào URL
      if (!episodeParam && typeof window !== 'undefined') {
        const newParams = new URLSearchParams(window.location.search)
        newParams.set('season', String(seasonNum))
        newParams.set('episode', '1')
        const newUrl = `${window.location.pathname}?${newParams.toString()}`
        window.history.replaceState({}, '', newUrl)
      }
    }

    syncFromUrl()
    if (typeof window !== 'undefined') {
      window.addEventListener('popstate', syncFromUrl)
      return () => window.removeEventListener('popstate', syncFromUrl)
    }
  }, [id])













  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (seasonDropdownRef.current && !seasonDropdownRef.current.contains(event.target as Node)) {
        setIsSeasonDropdownOpen(false)
      }
    }

    if (isSeasonDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSeasonDropdownOpen])

  // Removed large useEffect for watch now logic - now handled by WatchNowTVShows component

  // Reset poster loading state when season changes
  useEffect(() => {
    setPosterLoaded(false);
  }, [selectedSeason]);

  if (loading || !tvShow) {
    return (
      <div ref={containerRef} className="min-h-screen flex items-center justify-center bg-gradient-to-b from-gray-900 to-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full"
        />
      </div>
    )
  }

  const { name, backdrop, poster, duration, year, genre, creator, cast, description, scenes, trailer, totalSeasons, totalEpisodes, firstAirDate } = tvShow

  // Check if this anime is in the manual config list
  const isAnime = isAnimeInList(tvShow.id)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _animeConfig = getAnimeConfig(tvShow.id)

  // Get total episodes from config or use TMDB data as fallback
  const animeTotalEpisodes = getAnimeTotalEpisodes(tvShow.id, totalEpisodes)

  // Get episode to season mapping from config
  const episodeToSeason = getAnimeEpisodeMapping(tvShow.id)

  // Season-aware visuals
  const currentSeason = seasons.find((s) => s.season_number === selectedSeason) || seasons[selectedSeason - 1]
  const displayPoster = currentSeason?.poster_path
    ? `https://image.tmdb.org/t/p/w342${currentSeason.poster_path}`
    : poster
  const seasonAirDate = currentSeason?.air_date

  const heroHeightClass = (displayPoster && displayPoster.length > 0)
    ? 'h-[30vh] sm:h-[35vh] md:h-[50vh] lg:h-[60vh]'
    : 'h-[20vh] sm:h-[24vh] md:h-[28vh] lg:h-[32vh]';

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-gray-900 to-black">
      <div className="relative w-full overflow-hidden py-10 sm:py-14 lg:py-0 min-h-[60vh] md:min-h-screen flex items-center">
        <div className="absolute inset-0">
          <Image
            src={backdrop}
            alt={name}
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
            {displayPoster ? (
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
                    src={`/api/cache-image?id=${id}&url=${encodeURIComponent(displayPoster ?? '')}`}
                    alt={name}
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
                <span className="text-2xl sm:text-3xl">📺</span>
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
                {name}
              </motion.h1>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="px-2 py-1 text-xs sm:text-sm font-bold rounded-md bg-blue-600 text-white whitespace-nowrap">
                  {t('season')} {selectedSeason}
                </span>

              </div>
            </div>

            <div className="flex flex-wrap gap-3">

              <div className="flex items-center space-x-1.5">
                <ClockIcon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-gray-400" />
                <span className="text-gray-400 text-sm sm:text-base">{duration}</span>
              </div>
              <div className="flex items-center space-x-2">
                <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 lg:h-6 lg:w-6 text-gray-400" />
                <span className="text-gray-400 text-sm sm:text-base">{seasonAirDate ? formatDate(seasonAirDate) : (firstAirDate ? formatDate(firstAirDate) : year)}</span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-gray-300 text-sm sm:text-base">{genre}</p>
              {creator && (
                <p className="text-gray-300">{t('director')}: {creator}</p>
              )}
              {/* Cast collapsed */}
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

            {/* Description collapsed */}
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

      {/* Watch Now Section - Use Anime Player for anime in config list */}
      {isAnime && animeTotalEpisodes ? (
        <AnimeEpisodePlayer
          tvShow={tvShow}
          totalEpisodes={animeTotalEpisodes}
          episodeToSeason={episodeToSeason}
        />
      ) : (
        tvShow && <WatchNowTVShows tvShow={tvShow} selectedSeason={selectedSeason} selectedEpisode={selectedEpisode} episodes={episodes} />
      )}

      {/* Episodes Section - Only show for regular TV shows, not anime */}
      {!isAnime && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-3xl font-bold">{t('episodes')}</h2>
              {totalSeasons && totalSeasons > 1 && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-300 text-sm">{t('season')}:</span>
                  <div className="relative" ref={seasonDropdownRef}>
                    <button
                      onClick={() => setIsSeasonDropdownOpen(!isSeasonDropdownOpen)}
                      className="flex items-center justify-between bg-gray-700 text-white text-sm px-3 py-1.5 pr-2 rounded-md border border-gray-600 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent cursor-pointer hover:bg-gray-600 transition-colors min-w-[80px] max-w-[120px]"
                    >
                      <span>{selectedSeason}</span>
                      <ChevronDownIcon className={`w-4 h-4 text-gray-400 transition-transform ${isSeasonDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {isSeasonDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg z-50 max-h-[200px] overflow-y-auto scrollbar-hide">
                        {Array.from({ length: totalSeasons || 0 }, (_, i) => i + 1).map((season) => (
                          <button
                            key={season}
                            onClick={() => {
                              handleSeasonSelect(season);
                              setIsSeasonDropdownOpen(false);
                            }}
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-600 transition-colors ${selectedSeason === season ? 'bg-red-500 text-white' : 'text-white'
                              }`}
                          >
                            {season}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-between">
              {totalSeasons && totalEpisodes && (
                <p className="text-gray-300 text-sm">
                  {(totalSeasons || 0) > 1 ? t('seasonsCountPlural', { count: totalSeasons }) : t('seasonsCount', { count: totalSeasons })} • {(totalEpisodes || 0) > 1 ? t('episodesCountPlural', { count: totalEpisodes }) : t('episodesCount', { count: totalEpisodes })}
                </p>
              )}
              <button
                onClick={() => setIsEpisodesCompact(!isEpisodesCompact)}
                className="flex items-center gap-1.5 bg-gray-700 text-white text-xs px-2.5 py-1 rounded-md border border-gray-600 hover:bg-gray-600 transition-colors"
                title={isEpisodesCompact ? t('expandView') : t('compactView')}
              >
                {isEpisodesCompact ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    <span>{t('expand')}</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                    </svg>
                    <span>{t('compact')}</span>
                  </>
                )}
              </button>
            </div>
          </div>
          {episodesLoading ? (
            <div className="flex justify-center">
              <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : episodes.length > 0 ? (
            <div className={`grid gap-3 sm:gap-4 ${isEpisodesCompact
              ? 'grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 2xl:grid-cols-16'
              : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8'
              }`}>
              {episodes.map((episode) => (
                <motion.div
                  key={episode.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: episode.episode_number * 0.05 }}
                  className={`relative bg-gray-800/50 backdrop-blur-sm rounded-xl overflow-hidden cursor-pointer transition-all duration-300 group ${selectedEpisode === episode.episode_number
                    ? 'ring-2 ring-red-500 ring-offset-2 ring-offset-gray-900 scale-105 shadow-lg shadow-red-500/25'
                    : 'hover:scale-105 hover:shadow-lg hover:shadow-gray-500/25'
                    }`}
                  onClick={() => handleEpisodeSelect(episode.episode_number)}
                >
                  {!isEpisodesCompact ? (
                    <>
                      {episode.still_path ? (
                        <div className="relative aspect-[4/3]">
                          <Image
                            src={`https://image.tmdb.org/t/p/w500${episode.still_path}`}
                            alt={episode.name}
                            fill
                            className="object-cover transition-transform duration-300 group-hover:scale-110"
                          />
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                            <div className="bg-gray-300/10 text-red-600 px-3 py-1 rounded-full text-sm font-semibold">
                              S{selectedSeason} E{episode.episode_number}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-[4/3] bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
                          <div className="text-center">
                            <div className="text-2xl sm:text-3xl mb-1">📺</div>
                            <div className="bg-gray-300/10 text-red-600 px-3 py-1 rounded-full text-sm font-semibold">
                              S{selectedSeason} E{episode.episode_number}
                            </div>
                          </div>
                        </div>
                      )}
                      <div className="p-2 sm:p-3">
                        <h3 className="font-semibold text-xs sm:text-sm text-center leading-tight truncate" title={episode.name}>
                          {episode.name}
                        </h3>
                      </div>
                    </>
                  ) : (
                    <div className="aspect-square bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center p-2">
                      <div className="text-center">
                        <div className="text-red-500 text-xs sm:text-sm font-bold">
                          S{selectedSeason}
                        </div>
                        <div className="text-white text-lg sm:text-xl font-bold">
                          E{episode.episode_number}
                        </div>
                      </div>
                    </div>
                  )}
                  {selectedEpisode === episode.episode_number && (
                    <div className="absolute top-1 right-1 sm:top-2 sm:right-2">
                      <div className="bg-red-500 text-white rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-[10px] sm:text-xs font-bold shadow-lg">
                        ✓
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📺</div>
              <p className="text-gray-400">{t('noEpisodes')}</p>
            </div>
          )}
        </div>
      )}


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







      {/* Comments Section */}
      <Comments
        movieId={tvShow.id}
        type="tvshow"
        title={tvShow.name}
      />

      {/* Related TV Shows */}
      <RelatedContent
        id={tvShow.id}
        type="tv"
        title={tvShow.name}
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
                <h3 className="text-white text-lg font-semibold">TV Show Scenes ({activeScene + 1}/{scenes.length})</h3>
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
