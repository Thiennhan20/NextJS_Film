'use client'

import { useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  ListBulletIcon,
  PlayIcon,
} from '@heroicons/react/24/solid'
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
} from '../movie-data'

interface MovieWatchClientProps {
  id: string
}

export default function MovieWatchClient({ id }: MovieWatchClientProps) {
  const type = 'movie' as MediaType
  const t = useTranslations('CinemaWatch')
  const text = {
    back: t('back'),
    watching: t('watching'),
    cinema: t('cinema'),
    servers: t('servers'),
    quickEpisodes: t('quickEpisodes'),
    season: t('season'),
    episode: t('episode'),
    loading: t('loading'),
    notFound: t('notFound'),
  }
  const { media, loading, error } = useMediaDetails(type, id)
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedSeason, setSelectedSeason] = useState(1)
  const [selectedEpisode, setSelectedEpisode] = useState(1)
  const [episodes, setEpisodes] = useState<MediaEpisode[]>([])
  const [episodesLoading, setEpisodesLoading] = useState(false)

  useEffect(() => {
    const season = Number(searchParams.get('season') || 1)
    const episode = Number(searchParams.get('episode') || 1)
    setSelectedSeason(Number.isFinite(season) && season > 0 ? season : 1)
    setSelectedEpisode(Number.isFinite(episode) && episode > 0 ? episode : 1)
  }, [searchParams])

  useEffect(() => {
    if (!media || type !== 'tv') return
    let cancelled = false
    setEpisodesLoading(true)
    fetchSeasonEpisodes(media.id, selectedSeason)
      .then((items) => {
        if (!cancelled) setEpisodes(items)
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

  const episodeNumbers = useMemo(() => {
    if (episodes.length) return episodes.map((episode) => episode.episode_number)
    const count = media?.seasons.find((season) => season.seasonNumber === selectedSeason)?.episodeCount || 0
    return Array.from({ length: count }, (_, index) => index + 1)
  }, [episodes, media, selectedSeason])

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
          <section className="mt-5 rounded-3xl border border-white/[0.08] bg-[#0d0f13]/95 p-4 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
              <div className="flex items-center gap-3"><ListBulletIcon className="h-5 w-5 text-yellow-300" /><h2 className="text-lg font-black">{text.quickEpisodes}</h2></div>
              <select
                value={selectedSeason}
                onChange={(event) => updateSelection(Number(event.target.value), 1)}
                className="rounded-xl border border-white/10 bg-[#1a1d22] px-4 py-2 text-xs font-black text-white outline-none focus:border-yellow-400/50"
              >
                {(media.seasons.length ? media.seasons : [{ id: 1, seasonNumber: 1, name: '', episodeCount: media.totalEpisodes, posterPath: '', airDate: '' }]).map((season) => (
                  <option key={season.id} value={season.seasonNumber}>☰ {text.season} {season.seasonNumber}</option>
                ))}
              </select>
            </div>

            {episodesLoading ? (
              <div className="flex h-28 items-center justify-center"><div className="h-7 w-7 animate-spin rounded-full border-2 border-white/10 border-t-yellow-400" /></div>
            ) : (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10">
                {episodeNumbers.map((episode) => (
                  <button
                    key={episode}
                    type="button"
                    onClick={() => updateSelection(selectedSeason, episode)}
                    className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-black transition ${selectedEpisode === episode ? 'border-yellow-300 bg-yellow-400 text-black shadow-lg shadow-yellow-400/15' : 'border-white/[0.07] bg-white/[0.04] text-white/60 hover:border-yellow-400/35 hover:text-white'}`}
                  >
                    <PlayIcon className="h-3 w-3" /> {text.episode} {episode}
                  </button>
                ))}
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
