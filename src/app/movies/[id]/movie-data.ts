'use client'

import { useEffect, useState } from 'react'
import axios from 'axios'

export type MediaType = 'movie' | 'tv'

export interface CastMember {
  id: number
  name: string
  character: string
  profilePath: string
}

export interface MediaSeason {
  id: number
  name: string
  seasonNumber: number
  episodeCount: number
  posterPath: string
  airDate: string
}

export interface MediaEpisode {
  id: number
  name: string
  episode_number: number
  season_number: number
  still_path?: string
  overview?: string
  air_date?: string
}

export interface MediaDetails {
  id: number
  type: MediaType
  title: string
  originalTitle: string
  duration: string
  year: number | ''
  releaseDate: string
  creator: string
  countries: string[]
  cast: CastMember[]
  genres: string[]
  description: string
  poster: string
  backdrop: string
  trailer: string
  scenes: string[]
  voteAverage: number
  status: string
  adult: boolean
  totalSeasons: number
  totalEpisodes: number
  seasons: MediaSeason[]
}

interface TMDBGenre {
  name: string
}

interface TMDBPerson {
  id?: number
  name: string
  character?: string
  profile_path?: string | null
  job?: string
}

interface TMDBSeason {
  id: number
  name: string
  season_number: number
  episode_count: number
  poster_path?: string | null
  air_date?: string | null
}

interface TMDBProductionCountry {
  iso_3166_1?: string
  name?: string
}

interface TMDBBundle {
  detail?: {
    id: number
    title?: string
    name?: string
    original_title?: string
    original_name?: string
    runtime?: number
    episode_run_time?: number[]
    release_date?: string
    first_air_date?: string
    origin_country?: string[]
    production_countries?: TMDBProductionCountry[]
    genres?: TMDBGenre[]
    overview?: string
    poster_path?: string | null
    backdrop_path?: string | null
    vote_average?: number
    status?: string
    adult?: boolean
    number_of_seasons?: number
    number_of_episodes?: number
    seasons?: TMDBSeason[]
    created_by?: TMDBPerson[]
  }
  images?: { backdrops?: Array<{ file_path: string }> }
  videos?: { results?: Array<{ type: string; site: string; key: string }> }
  credits?: { crew?: TMDBPerson[]; cast?: TMDBPerson[] }
}

const imageUrl = (path: string | null | undefined, size: string) =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : ''

function mapBundle(bundle: TMDBBundle, type: MediaType): MediaDetails | null {
  const data = bundle.detail
  if (!data) return null

  const releaseDate = type === 'movie' ? data.release_date || '' : data.first_air_date || ''
  const runtime = type === 'movie' ? data.runtime : data.episode_run_time?.[0]
  const title = type === 'movie' ? data.title || '' : data.name || ''
  const originalTitle = type === 'movie'
    ? data.original_title || title
    : data.original_name || title
  const trailerVideo = bundle.videos?.results?.find(
    (video) => video.type === 'Trailer' && video.site === 'YouTube'
  )
  const crew = bundle.credits?.crew || []
  const creator = type === 'movie'
    ? crew.find((person) => person.job === 'Director')?.name || ''
    : data.created_by?.[0]?.name || crew.find((person) => person.job === 'Creator')?.name || ''

  const scenes = (bundle.images?.backdrops || [])
    .slice(0, 6)
    .map((image) => imageUrl(image.file_path, 'w780'))

  if (scenes.length === 0 && data.backdrop_path) {
    scenes.push(imageUrl(data.backdrop_path, 'w780'))
  }

  return {
    id: data.id,
    type,
    title,
    originalTitle,
    duration: runtime
      ? type === 'movie'
        ? `${Math.floor(runtime / 60)}h ${runtime % 60}m`
        : `${runtime} phút/tập`
      : '',
    year: releaseDate ? Number(releaseDate.slice(0, 4)) : '',
    releaseDate,
    creator,
    countries: (data.production_countries || []).length > 0
      ? (data.production_countries || []).map((country) => country.name || country.iso_3166_1 || '').filter(Boolean)
      : (data.origin_country || []).filter(Boolean),
    cast: (bundle.credits?.cast || []).slice(0, 12).map((person, index) => ({
      id: person.id || index,
      name: person.name,
      character: person.character || '',
      profilePath: imageUrl(person.profile_path, 'w185'),
    })),
    genres: (data.genres || []).map((genre) => genre.name),
    description: data.overview || '',
    poster: imageUrl(data.poster_path, 'w500'),
    backdrop: imageUrl(data.backdrop_path, 'original'),
    trailer: trailerVideo ? `https://www.youtube.com/embed/${trailerVideo.key}` : '',
    scenes,
    voteAverage: Number(data.vote_average || 0),
    status: data.status || '',
    adult: Boolean(data.adult),
    totalSeasons: Number(data.number_of_seasons || 0),
    totalEpisodes: Number(data.number_of_episodes || 0),
    seasons: (data.seasons || [])
      .filter((season) => season.season_number > 0)
      .map((season) => ({
        id: season.id,
        name: season.name,
        seasonNumber: season.season_number,
        episodeCount: season.episode_count,
        posterPath: imageUrl(season.poster_path, 'w342'),
        airDate: season.air_date || '',
      })),
  }
}

export function useMediaDetails(type: MediaType, rawId: string) {
  const id = rawId.replace(/-(vietsub|dubbed)$/i, '')
  const [media, setMedia] = useState<MediaDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(false)
      try {
        const response = await axios.get<TMDBBundle>(`/api/tmdb-bundle?type=${type}&id=${id}`)
        if (cancelled) return
        const mapped = mapBundle(response.data, type)
        setMedia(mapped)
        setError(!mapped)
      } catch {
        if (!cancelled) {
          setMedia(null)
          setError(true)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    if (id) load()
    return () => {
      cancelled = true
    }
  }, [id, type])

  return { media, loading, error, id }
}

export async function fetchSeasonEpisodes(tvId: number, season: number) {
  const response = await axios.get<{ episodes?: MediaEpisode[] }>(
    `/api/tmdb-proxy?endpoint=/tv/${tvId}/season/${season}`
  )
  return response.data.episodes || []
}
