// Optimized hooks for comments - Focus on reducing API calls and load time
import useSWR from 'swr'
import api from '@/lib/axios'
import { fetchTMDB } from '@/lib/tmdb-cache'

interface CommentData {
  _id: string
  movieId: number
  type: 'movie' | 'tvshow'
  user?: {
    name?: string
    avatar?: string
    isEmailVerified?: boolean
  }
  content: string
  likes?: number
  replyCount?: number
  createdAt: string
}

interface TopComment {
  id: string
  movieId: number
  type: 'movie' | 'tvshow'
  user: {
    name: string
    avatar: string
    verified: boolean
  }
  movie: {
    title: string
    poster: string
    rating: number
  }
  content: string
  likes: number
  replies: number
  timestamp: string
}

interface NewComment {
  id: string
  movieId: number
  type: 'movie' | 'tvshow'
  user: {
    name: string
    avatar: string
    verified: boolean
  }
  content: string
  movie: string
  timestamp: string
}

// Shared cache for movie details across all hooks
const movieCache = new Map<string, { title: string; poster: string }>()

// Batch fetch movie details in parallel (5 at a time to avoid rate limits)
async function batchFetchMovies(items: Array<{ movieId: number; type: 'movie' | 'tvshow' }>) {
  const results = new Map<string, { title: string; poster: string }>()
  
  // Remove duplicates
  const unique = Array.from(
    new Map(items.map(item => [`${item.type}-${item.movieId}`, item])).values()
  )
  
  // Fetch in batches of 5
  for (let i = 0; i < unique.length; i += 5) {
    const batch = unique.slice(i, i + 5)
    
    await Promise.all(
      batch.map(async ({ movieId, type }) => {
        const key = `${type}-${movieId}`
        
        // Check cache first
        if (movieCache.has(key)) {
          results.set(key, movieCache.get(key)!)
          return
        }
        
        try {
          const endpoint = `/${type === 'movie' ? 'movie' : 'tv'}/${movieId}`;
          const data = await fetchTMDB<{ title?: string; name?: string; poster_path?: string }>(endpoint);
          
          const result = {
            title: data.title || data.name || `${type} #${movieId}`,
            poster: data.poster_path ? `https://image.tmdb.org/t/p/w200${data.poster_path}` : ''
          }
          
          movieCache.set(key, result)
          results.set(key, result)
        } catch {
          const fallback = { title: `${type} #${movieId}`, poster: '' }
          movieCache.set(key, fallback)
          results.set(key, fallback)
        }
      })
    )
  }
  
  return results
}

// Format time ago
function formatTimeAgo(timestamp: string): string {
  const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return `${weeks}w ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(days / 365)}y ago`
}

// Fetcher for top comments
async function fetchTopComments(url: string): Promise<TopComment[]> {
  const response = await api.get(url)
  if (!response.data.success) throw new Error('Failed to fetch')
  
  const comments: CommentData[] = response.data.data || []
  
  // Batch fetch all movie details at once
  const movieDetails = await batchFetchMovies(
    comments.map((c) => ({ movieId: c.movieId, type: c.type }))
  )
  
  return comments.map((comment) => {
    const key = `${comment.type}-${comment.movieId}`
    const movie = movieDetails.get(key) || { title: 'Unknown', poster: '' }
    
    return {
      id: comment._id,
      movieId: comment.movieId,
      type: comment.type,
      user: {
        name: comment.user?.name || 'Anonymous',
        avatar: comment.user?.avatar || '',
        verified: comment.user?.isEmailVerified || false
      },
      movie: {
        title: movie.title,
        poster: movie.poster,
        rating: 0
      },
      content: comment.content,
      likes: comment.likes || 0,
      replies: comment.replyCount || 0,
      timestamp: formatTimeAgo(comment.createdAt)
    }
  })
}

// Fetcher for recent comments
async function fetchRecentComments(url: string): Promise<NewComment[]> {
  const response = await api.get(url)
  if (!response.data.success) throw new Error('Failed to fetch')
  
  const comments: CommentData[] = response.data.data || []
  
  // Batch fetch all movie details at once
  const movieDetails = await batchFetchMovies(
    comments.map((c) => ({ movieId: c.movieId, type: c.type }))
  )
  
  return comments.map((comment) => {
    const key = `${comment.type}-${comment.movieId}`
    const movie = movieDetails.get(key) || { title: 'Unknown', poster: '' }
    
    return {
      id: comment._id,
      movieId: comment.movieId,
      type: comment.type,
      user: {
        name: comment.user?.name || 'Anonymous',
        avatar: comment.user?.avatar || '',
        verified: comment.user?.isEmailVerified || false
      },
      content: comment.content,
      movie: movie.title,
      timestamp: formatTimeAgo(comment.createdAt)
    }
  })
}

// Hook for top comments with caching
export function useTopComments(limit = 9) {
  const { data, error, isLoading } = useSWR<TopComment[]>(
    `/comments/top?limit=${limit}&sortBy=likes`,
    fetchTopComments,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000, // 5 seconds (balanced for Vercel/Render free)
      refreshInterval: 0,
    }
  )
  
  return {
    comments: data || [],
    isLoading,
    isError: error
  }
}

// Hook for recent comments with caching
export function useRecentComments(limit = 4) {
  const { data, error, isLoading } = useSWR<NewComment[]>(
    `/comments/recent?limit=${limit}`,
    fetchRecentComments,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000, // 5 seconds (balanced for Vercel/Render free)
      refreshInterval: 0,
    }
  )
  
  return {
    comments: data || [],
    isLoading,
    isError: error
  }
}
