'use client'

import { useState, useEffect, useMemo, useRef, Suspense, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import axios, { CancelTokenSource } from 'axios'
import { MagnifyingGlassIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline'
import { useSearchHistory } from '@/hooks/useSearchHistory'
import { useTranslations } from 'next-intl'
import Pagination from '@/components/Pagination'
import FilterIcon from '@/components/FilterIcon'
import CardWithHover from '@/components/common/CardWithHover'
import { useRouter as useNavRouter } from 'next/navigation'
import {
  CONTENT_COUNTRY_OPTIONS,
  MOVIE_GENRE_FILTERS,
  TV_GENRE_FILTERS,
  getCountryCode,
  getCountryLanguage,
  getGenreId,
} from '@/lib/contentFilters'

const DEBOUNCE_DELAY = 600

interface Movie {
  id: number
  title: string
  poster_path: string | null
  release_date?: string
  vote_average?: number
  overview?: string
  genre_ids?: number[]
  original_language?: string
}

interface TVShow {
  id: number
  name: string
  poster_path: string | null
  first_air_date?: string
  vote_average?: number
  overview?: string
  genre_ids?: number[]
  original_language?: string
  origin_country?: string[]
}

type SearchResult = (Movie & { type: 'movie' }) | (TVShow & { type: 'tv' })

interface TMDBMovieResponse {
  id: number
  title: string
  poster_path: string | null
  release_date?: string
  vote_average?: number
  overview?: string
  genre_ids?: number[]
  original_language?: string
}

interface TMDBTVResponse {
  id: number
  name: string
  poster_path: string | null
  first_air_date?: string
  vote_average?: number
  overview?: string
  genre_ids?: number[]
  original_language?: string
  origin_country?: string[]
}

type ContentType = 'all' | 'movie' | 'tv'

interface SearchMetadata {
  totalPages: number
  totalResults: number
}

function SearchPageContent() {
  const router = useRouter()
  const navRouter = useNavRouter()
  const searchParams = useSearchParams()
  const t = useTranslations('Search')
  const { addSearch: addToSearchHistory } = useSearchHistory()
  
  // URL params
  const queryFromUrl = searchParams.get('q') || ''
  const pageFromUrl = Number(searchParams.get('page')) || 1
  const typeFromUrl = (searchParams.get('type') as ContentType) || 'all'
  const yearFromUrl = searchParams.get('year') || 'All'
  const genreFromUrl = searchParams.get('genre') || 'All'
  
  // State
  const [inputValue, setInputValue] = useState(queryFromUrl)
  const [query, setQuery] = useState(queryFromUrl)
  const [page, setPage] = useState(pageFromUrl)
  const [contentType, setContentType] = useState<ContentType>(typeFromUrl)
  const [selectedYear, setSelectedYear] = useState<string>(yearFromUrl)
  const [selectedGenre, setSelectedGenre] = useState<string>(genreFromUrl)
  const [selectedCountry, setSelectedCountry] = useState<string>(searchParams.get('country') || 'All')
  const [loading, setLoading] = useState(false)
  const [pageInput, setPageInput] = useState<string>(String(pageFromUrl))
  const [error, setError] = useState<string | null>(null)
  
  // Cache các trang đã load: { [filterKey]: { [page]: SearchResult[] } }
  const [pagesCache, setPagesCache] = useState<{ [filterKey: string]: { [page: number]: SearchResult[] } }>({})
  // Lưu các trang đã load cho từng filter: { [filterKey]: number[] }
  const [loadedPages, setLoadedPages] = useState<{ [filterKey: string]: number[] }>({})
  // Metadata cho từng filter: { [filterKey]: { totalPages, totalResults } }
  const [metadataCache, setMetadataCache] = useState<{ [filterKey: string]: SearchMetadata }>({})
  
  // Refs
  const cancelTokenRef = useRef<CancelTokenSource | null>(null)
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)
  const isInitialMount = useRef(true)
  const prevPageRef = useRef(pageFromUrl)
  const prevQueryRef = useRef(queryFromUrl)
  const prevTypeRef = useRef(typeFromUrl)
  const prevYearRef = useRef(yearFromUrl)
  const prevGenreRef = useRef(genreFromUrl)
  const prevCountryRef = useRef(searchParams.get('country') || 'All')
  const requestCache = useRef(new Map<string, Promise<{ results: SearchResult[], totalPages: number, totalResults: number }>>())
  
  // Years list
  const years = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const yearArr = ['All']
    for (let y = currentYear; y >= 2000; y--) {
      yearArr.push(String(y))
    }
    return yearArr
  }, [])
  
  // Countries list
  const countries = useMemo(() => CONTENT_COUNTRY_OPTIONS, [])
  
  // Movie genres
  const movieGenres = useMemo(() => MOVIE_GENRE_FILTERS, [])
  
  // TV genres
  const tvGenres = useMemo(() => TV_GENRE_FILTERS, [])
  
  const genres = useMemo(() => {
    if (contentType === 'movie') return movieGenres.map(g => g.name)
    if (contentType === 'tv') return tvGenres.map(g => g.name)
    const combined = [...movieGenres, ...tvGenres.filter(tg => !movieGenres.find(mg => mg.name === tg.name))]
    return combined.map(g => g.name)
  }, [contentType, movieGenres, tvGenres])
  
  // Helper functions để làm việc với cache theo filter
  const getCurrentFilterKey = useCallback(() => {
    return `${query}-${contentType}-${selectedYear}-${selectedGenre}-${selectedCountry}`
  }, [query, contentType, selectedYear, selectedGenre, selectedCountry])

  const getCurrentFilterCache = useCallback(() => {
    const filterKey = getCurrentFilterKey()
    return pagesCache[filterKey] || {}
  }, [pagesCache, getCurrentFilterKey])

  const getCurrentFilterLoadedPages = useCallback(() => {
    const filterKey = getCurrentFilterKey()
    return loadedPages[filterKey] || []
  }, [loadedPages, getCurrentFilterKey])

  const setCurrentFilterCache = useCallback((page: number, results: SearchResult[]) => {
    const filterKey = getCurrentFilterKey()
    setPagesCache(prev => ({
      ...prev,
      [filterKey]: {
        ...prev[filterKey],
        [page]: results
      }
    }))
  }, [getCurrentFilterKey])

  const setCurrentFilterLoadedPages = useCallback((pages: number[]) => {
    const filterKey = getCurrentFilterKey()
    setLoadedPages(prev => ({
      ...prev,
      [filterKey]: pages
    }))
  }, [getCurrentFilterKey])

  const setCurrentFilterMetadata = useCallback((metadata: SearchMetadata) => {
    const filterKey = getCurrentFilterKey()
    setMetadataCache(prev => ({
      ...prev,
      [filterKey]: metadata
    }))
  }, [getCurrentFilterKey])

  const getCurrentFilterMetadata = useCallback(() => {
    const filterKey = getCurrentFilterKey()
    return metadataCache[filterKey] || { totalPages: 0, totalResults: 0 }
  }, [metadataCache, getCurrentFilterKey])
  
  // Fetch một trang search results
  const fetchSearchPage = useCallback(async (
    searchQuery: string,
    pageNum: number,
    ct: ContentType,
    year: string,
    genre: string,
    country: string
  ): Promise<{ results: SearchResult[], totalPages: number, totalResults: number }> => {
    // Create cache key for this request
    const cacheKey = `${searchQuery}-${pageNum}-${ct}-${year}-${genre}-${country}`
    
    // Check if request is already pending
    if (requestCache.current.has(cacheKey)) {
      return requestCache.current.get(cacheKey)!
    }
    
    // Cancel previous request only if it's a new request (not from cache)
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel('New search initiated')
    }
    
    // Create new cancel token for this request
    const cancelToken = axios.CancelToken.source()
    cancelTokenRef.current = cancelToken
    
    setLoading(true)
    setError(null)
    
    // Create the promise and store it in cache
    const fetchPromise = (async () => {
      try {
        let movies: SearchResult[] = []
        let tvShows: SearchResult[] = []
        let moviesTotalPages = 0
        let tvShowsTotalPages = 0
        let moviesTotalResults = 0
        let tvShowsTotalResults = 0
        
        const API_BASE = '/api/tmdb-proxy';
        
        const searchPromises: Promise<unknown>[] = []
        
        if (ct === 'all' || ct === 'movie') {
          const movieParams = new URLSearchParams({
            query: searchQuery,
            page: pageNum.toString()
          });
          if (year !== 'All') {
            movieParams.append('year', year);
          }
          let movieUrl = `${API_BASE}?endpoint=/search/movie&${movieParams.toString()}`;
          if (genre !== 'All') {
            const genreId = getGenreId(MOVIE_GENRE_FILTERS, genre)
            if (genreId) {
              movieUrl += `&with_genres=${genreId}`
            }
          }
          // Country filter for movies (using language)
          if (country !== 'All') {
            const languageCode = getCountryLanguage(country)
            if (languageCode) {
              movieUrl += `&with_original_language=${languageCode}`
            }
          }
          
          searchPromises.push(
            axios.get(movieUrl, { cancelToken: cancelToken.token })
          )
        }
        
        if (ct === 'all' || ct === 'tv') {
          const tvParams = new URLSearchParams({
            query: searchQuery,
            page: pageNum.toString()
          });
          if (year !== 'All') {
            tvParams.append('first_air_date_year', year);
          }
          let tvUrl = `${API_BASE}?endpoint=/search/tv&${tvParams.toString()}`;
          if (genre !== 'All') {
            const genreId = getGenreId(TV_GENRE_FILTERS, genre)
            if (genreId) {
              tvUrl += `&with_genres=${genreId}`
            }
          }
          // Country filter for TV shows
          if (country !== 'All') {
            const countryCode = getCountryCode(country)
            if (countryCode) {
              tvUrl += `&with_origin_country=${countryCode}`
            }
          }
          
          searchPromises.push(
            axios.get(tvUrl, { cancelToken: cancelToken.token })
          )
        }
        
        const responses = await Promise.all(searchPromises)
        
        if (ct === 'all') {
          if (responses[0]) {
            const movieData = (responses[0] as { data: { results: TMDBMovieResponse[], total_pages: number, total_results: number } }).data
            movies = (movieData.results || []).map((m: TMDBMovieResponse): SearchResult => ({
              ...m,
              type: 'movie' as const
            }))
            moviesTotalPages = movieData.total_pages || 0
            moviesTotalResults = movieData.total_results || 0
          }
          if (responses[1]) {
            const tvData = (responses[1] as { data: { results: TMDBTVResponse[], total_pages: number, total_results: number } }).data
            tvShows = (tvData.results || []).map((t: TMDBTVResponse): SearchResult => ({
              ...t,
              type: 'tv' as const
            }))
            tvShowsTotalPages = tvData.total_pages || 0
            tvShowsTotalResults = tvData.total_results || 0
          }
        } else if (ct === 'movie' && responses[0]) {
          const movieData = (responses[0] as { data: { results: TMDBMovieResponse[], total_pages: number, total_results: number } }).data
          movies = (movieData.results || []).map((m: TMDBMovieResponse): SearchResult => ({
            ...m,
            type: 'movie' as const
          }))
          moviesTotalPages = movieData.total_pages || 0
          moviesTotalResults = movieData.total_results || 0
        } else if (ct === 'tv' && responses[0]) {
          const tvData = (responses[0] as { data: { results: TMDBTVResponse[], total_pages: number, total_results: number } }).data
          tvShows = (tvData.results || []).map((t: TMDBTVResponse): SearchResult => ({
            ...t,
            type: 'tv' as const
          }))
          tvShowsTotalPages = tvData.total_pages || 0
          tvShowsTotalResults = tvData.total_results || 0
        }
        
        // Combine results
        const combinedResults: SearchResult[] = [...movies, ...tvShows]
        
        // Calculate metadata
        const maxTotalPages = Math.max(moviesTotalPages, tvShowsTotalPages)
        const totalResultsCount = ct === 'all' 
          ? moviesTotalResults + tvShowsTotalResults 
          : (ct === 'movie' ? moviesTotalResults : tvShowsTotalResults)
        
        const result = {
          results: combinedResults,
          totalPages: maxTotalPages,
          totalResults: totalResultsCount
        }
        
        // Remove from cache on success (data is stored in pagesCache)
        requestCache.current.delete(cacheKey)
        
        return result
        
      } catch (error) {
        // Remove from cache on error
        requestCache.current.delete(cacheKey)
        
        if (axios.isCancel(error)) {
          throw error
        }
        console.error('Search error:', error)
        setError('Failed to load results. Please try again.')
        throw error
      } finally {
        // Only set loading false if this is still the current request
        if (cancelTokenRef.current === cancelToken) {
          setLoading(false)
        }
      }
    })()
    
    // Store promise in cache
    requestCache.current.set(cacheKey, fetchPromise)
    
    return fetchPromise
  }, [])
  
  // Hàm load thêm 10 trang tiếp theo (khi bấm vào 1 trong 2 trang kế tiếp)
  const loadNext10Pages = useCallback(async (startPage: number) => {
    if (!query.trim()) return
    
    const promises = []
    for (let p = startPage; p < startPage + 10; p++) {
      if (!getCurrentFilterCache()[p]) {
        promises.push(
          fetchSearchPage(query, p, contentType, selectedYear, selectedGenre, selectedCountry)
            .then(({ results }) => ({ p, results }))
            .catch(() => ({ p, results: [] as SearchResult[] }))
        )
      }
    }
    
    if (promises.length > 0) {
      const results = await Promise.all(promises)
      results.forEach(({ p, results }) => {
        if (results.length > 0) {
          setCurrentFilterCache(p, results)
        }
      })
      
      const currentPages = getCurrentFilterLoadedPages()
      const newPages = [...currentPages]
      for (let p = startPage; p < startPage + 10; p++) {
        if (!newPages.includes(p)) newPages.push(p)
      }
      setCurrentFilterLoadedPages(newPages.sort((a, b) => a - b))
    }
  }, [query, contentType, selectedYear, selectedGenre, selectedCountry, getCurrentFilterCache, getCurrentFilterLoadedPages, setCurrentFilterCache, setCurrentFilterLoadedPages, fetchSearchPage])
  
  // Debounced search effect
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    
    debounceTimerRef.current = setTimeout(() => {
      if (inputValue !== query) {
        setQuery(inputValue)
        setPage(1)
      }
    }, DEBOUNCE_DELAY)
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [inputValue, query])
  
  // Sync state với URL parameters khi URL thay đổi (browser navigation)
  useEffect(() => {
    const newQ = searchParams.get('q') || ''
    const newPage = Number(searchParams.get('page')) || 1
    const newType = (searchParams.get('type') as ContentType) || 'all'
    const newYear = searchParams.get('year') || 'All'
    const newGenre = searchParams.get('genre') || 'All'
    const newCountry = searchParams.get('country') || 'All'
    
    // Chỉ update nếu thực sự có thay đổi để tránh infinite loop
    if (newQ !== prevQueryRef.current) {
      setInputValue(newQ)
      setQuery(newQ)
      prevQueryRef.current = newQ
    }
    
    if (newPage !== prevPageRef.current) {
      setPage(newPage)
      prevPageRef.current = newPage
    }
    
    if (newType !== prevTypeRef.current) {
      setContentType(newType)
      prevTypeRef.current = newType
    }
    
    if (newYear !== prevYearRef.current) {
      setSelectedYear(newYear)
      prevYearRef.current = newYear
    }
    
    if (newGenre !== prevGenreRef.current) {
      setSelectedGenre(newGenre)
      prevGenreRef.current = newGenre
    }
    
    if (newCountry !== prevCountryRef.current) {
      setSelectedCountry(newCountry)
      prevCountryRef.current = newCountry
    }
  }, [searchParams])

  // Khi page hoặc filter thay đổi từ user action, update URL
  useEffect(() => {
    if (isInitialMount.current) {
      return
    }
    
    // So sánh state với URL hiện tại - chỉ push nếu khác
    const currentQInUrl = searchParams.get('q') || ''
    const currentPageInUrl = Number(searchParams.get('page')) || 1
    const currentTypeInUrl = (searchParams.get('type') as ContentType) || 'all'
    const currentYearInUrl = searchParams.get('year') || 'All'
    const currentGenreInUrl = searchParams.get('genre') || 'All'
    const currentCountryInUrl = searchParams.get('country') || 'All'
    
    // So sánh state với URL - nếu giống nhau thì không cần push
    if (
      currentQInUrl === query &&
      currentPageInUrl === page &&
      currentTypeInUrl === contentType &&
      currentYearInUrl === selectedYear &&
      currentGenreInUrl === selectedGenre &&
      currentCountryInUrl === selectedCountry
    ) {
      // State đã khớp với URL, update refs để effect sync state từ URL không trigger
      prevQueryRef.current = query
      prevPageRef.current = page
      prevTypeRef.current = contentType
      prevYearRef.current = selectedYear
      prevGenreRef.current = selectedGenre
      prevCountryRef.current = selectedCountry
      return
    }

    // State khác URL - cần push URL mới
    const params = new URLSearchParams()
    if (query) {
      params.set('q', query)
    }
    if (page > 1) {
      params.set('page', String(page))
    }
    if (contentType !== 'all') {
      params.set('type', contentType)
    }
    if (selectedYear !== 'All') {
      params.set('year', selectedYear)
    }
    if (selectedGenre !== 'All') {
      params.set('genre', selectedGenre)
    }
    if (selectedCountry !== 'All') {
      params.set('country', selectedCountry)
    }
    
    // Sử dụng push thay vì replace để tạo history entries
    router.push(`/search?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, contentType, selectedYear, selectedGenre, selectedCountry, router])
  
  // Khi page hoặc filter thay đổi, nếu chưa có trong cache thì fetch
  useEffect(() => {
    if (!query.trim()) {
      setCurrentFilterMetadata({ totalPages: 0, totalResults: 0 })
      setError(null)
      return
    }
    
    let ignore = false
    const loadPage = async () => {
      // Check cache first
      if (getCurrentFilterCache()[page]) {
        // Update metadata if exists
        const metadata = getCurrentFilterMetadata()
        if (metadata.totalPages > 0) {
          return
        }
      }
      
      setLoading(true)
      try {
        const { results, totalPages, totalResults } = await fetchSearchPage(
          query,
          page,
          contentType,
          selectedYear,
          selectedGenre,
          selectedCountry
        )
        
        if (!ignore) {
          setCurrentFilterCache(page, results)
          setCurrentFilterMetadata({ totalPages, totalResults })
          
          const currentPages = getCurrentFilterLoadedPages()
          const newPages = currentPages.includes(page) 
            ? currentPages 
            : [...currentPages, page].sort((a, b) => a - b)
          setCurrentFilterLoadedPages(newPages)
          
          // Prefetch các trang tiếp theo
          if (page === 1 && totalPages > 1) {
            loadNext10Pages(2)
          }
        }
      } catch (error) {
        if (!ignore && !axios.isCancel(error)) {
          setCurrentFilterCache(page, [])
        }
      }
      if (!ignore) setLoading(false)
    }
    
    loadPage()
    return () => { ignore = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, contentType, selectedYear, selectedGenre, selectedCountry])
  
  // Khởi tạo cache cho filter đầu tiên khi component mount
  useEffect(() => {
    if (queryFromUrl.trim() && !getCurrentFilterCache()[pageFromUrl]) {
      const initCache = async () => {
        setLoading(true)
        try {
          const { results, totalPages, totalResults } = await fetchSearchPage(
            queryFromUrl,
            pageFromUrl,
            typeFromUrl,
            yearFromUrl,
            genreFromUrl,
            searchParams.get('country') || 'All'
          )
          setCurrentFilterCache(pageFromUrl, results)
          setCurrentFilterMetadata({ totalPages, totalResults })
          setCurrentFilterLoadedPages([pageFromUrl])
          // Prefetch các trang tiếp theo
          if (pageFromUrl === 1 && totalPages > 1) {
            loadNext10Pages(2)
          }
        } catch {
          setCurrentFilterCache(pageFromUrl, [])
          setCurrentFilterLoadedPages([pageFromUrl])
        }
        setLoading(false)
      }
      initCache()
    }
    
    // Mark initial mount complete
    isInitialMount.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  
  // Handle search submit
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }
    const trimmed = inputValue.trim()
    if (trimmed) {
      addToSearchHistory(trimmed)
    }
    setQuery(inputValue)
    setPage(1)
  }


  
  // Handle filter changes
  const handleYearChange = useCallback((year: string | number) => {
    setSelectedYear(String(year))
    setPage(1)
  }, [])
  
  const handleCategoryChange = useCallback((category: string) => {
    setSelectedGenre(category)
    setPage(1)
  }, [])
  
  const handleCountryChange = useCallback((country: string) => {
    setSelectedCountry(country)
    setPage(1)
  }, [])
  
  const handleContentTypeChange = useCallback((type: 'all' | 'movie' | 'tv') => {
    setContentType(type)
    setSelectedGenre('All')
    setPage(1)
  }, [])
  
  // Lấy results của trang hiện tại từ cache
  const pagedResults = getCurrentFilterCache()[page] || []
  const metadata = getCurrentFilterMetadata()
  const totalPages = metadata.totalPages
  const totalResults = metadata.totalResults
  
  // Xác định maxLoadedPage
  const maxLoadedPage = getCurrentFilterLoadedPages().length > 0 
    ? Math.max(...getCurrentFilterLoadedPages()) 
    : 1
  
  // Xử lý khi đổi trang
  const handlePageChange = useCallback((p: number) => {
    if (p < 1) return
    setPageInput(String(p))
    
    // Nếu bấm vào trang cuối cùng đã load, tự động load tiếp 10 trang mới
    if (p === maxLoadedPage) {
      loadNext10Pages(maxLoadedPage + 1).then(() => {
        setPage(p)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    } else if (p === maxLoadedPage + 1 || p === maxLoadedPage + 2) {
      loadNext10Pages(maxLoadedPage + 1).then(() => {
        setPage(p)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      })
    } else {
      setPage(p)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [maxLoadedPage, loadNext10Pages])
  
  // Sync page input when page changes due to URL/back/forward
  useEffect(() => {
    setPageInput(String(page))
  }, [page])
  
  const submitPageInput = useCallback(() => {
    const target = parseInt(pageInput || '1', 10)
    if (!isNaN(target) && target > 0) {
      handlePageChange(target)
    }
  }, [pageInput, handlePageChange])
  
  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-2 md:px-4 pt-4 md:pt-6">
        {/* Search Bar */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 md:mb-8 px-2 md:px-4"
        >
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-500 to-pink-500 text-transparent bg-clip-text mb-4">
            Search
          </h1>
          
          <form onSubmit={handleSearch} className="relative mb-6">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={t('placeholder')}
              className="w-full bg-gray-900 border-2 border-gray-700 rounded-xl px-6 py-3 md:py-4 pl-14 pr-32 md:pr-36 text-white placeholder-gray-400 focus:outline-none focus:border-red-500 transition-colors text-base"
              style={{ fontSize: '16px' }}
            />
            <MagnifyingGlassIcon className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <button
              type="submit"
              className="absolute right-2 md:right-3 top-1/2 -translate-y-1/2 bg-red-600 hover:bg-red-700 text-white px-4 md:px-6 py-2 rounded-lg transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm md:text-base"
              disabled={loading}
            >
              Search
            </button>
          </form>
          
          
          {/* Filter Icon */}
          <div className="mb-4">
            <FilterIcon
              selectedYear={selectedYear}
              selectedCategory={selectedGenre}
              selectedCountry={selectedCountry}
              onYearChange={handleYearChange}
              onCategoryChange={handleCategoryChange}
              onCountryChange={handleCountryChange}
              years={years}
              categories={genres}
              countries={countries}
              selectedContentType={contentType}
              onContentTypeChange={handleContentTypeChange}
              showContentType={true}
              showSort={false}
            />
          </div>
          
          {/* Results Count */}
          {query && (
            <div className="flex items-center justify-between text-sm text-gray-400 px-2">
              <p>
                {loading ? 'Searching...' : totalResults > 0 ? `${totalResults.toLocaleString()} results found` : 'No results found'}
              </p>
              {!loading && pagedResults.length > 0 && totalPages > 0 && (
                <p className="text-xs">
                  Page {page} of {totalPages}
                </p>
              )}
            </div>
          )}
        </motion.div>
        
        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6 flex items-center gap-3"
          >
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 flex-shrink-0" />
            <p className="text-red-200 text-sm">{error}</p>
          </motion.div>
        )}
        
        {/* Results */}
        {loading && !pagedResults.length ? (
          <div className="flex flex-col items-center justify-center py-24">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full"
            />
            <p className="mt-4 text-gray-400 text-lg">{t('searching')}</p>
          </div>
        ) : pagedResults.length > 0 ? (
          <>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${getCurrentFilterKey()}-${page}`}
                variants={{
                  hidden: { opacity: 0, y: 30 },
                  show: {
                    opacity: 1,
                    y: 0,
                    transition: { staggerChildren: 0.03 },
                  },
                }}
                initial="hidden"
                animate="show"
                exit="hidden"
                className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3 lg:gap-4 xl:gap-6 px-2 md:px-0"
              >
                {pagedResults.map((item) => (
                  <motion.div
                    key={`${item.type}-${item.id}`}
                    variants={{
                      hidden: { opacity: 0, y: 20 },
                      show: { opacity: 1, y: 0 },
                    }}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                  >
                    <CardWithHover
                      id={item.id}
                      type={item.type}
                      title={item.type === 'movie' ? item.title : item.name}
                      posterPath={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : ''}
                      onWatchClick={() => navRouter.push(item.type === 'movie' ? `/movies/${item.id}` : `/tvshows/${item.id}`)}
                    >
                      <Link
                        href={item.type === 'movie' ? `/movies/${item.id}` : `/tvshows/${item.id}`}
                        className="block"
                      >
                        <div className="border border-gray-700 rounded-lg overflow-hidden relative group bg-gray-800 hover:bg-gray-700 transition-colors duration-200">
                          {/* Poster Image */}
                          <div className="relative w-full h-[240px] md:h-[300px] lg:h-[360px] overflow-hidden bg-gray-900">
                            {item.poster_path ? (
                              <Image
                                src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                                alt={item.type === 'movie' ? item.title : item.name}
                                fill
                                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                                className="object-cover"
                                priority={false}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-gray-800">
                                <span className="text-gray-600 text-4xl">🎬</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Content Info */}
                          <div className="p-2 md:p-3 bg-gray-900">
                            <h3 className="text-white font-semibold text-xs md:text-sm truncate leading-tight mb-1 md:mb-2">
                              {item.type === 'movie' ? item.title : item.name}
                            </h3>
                            
                            {/* Date */}
                            <div className="flex items-center justify-between text-[10px] md:text-xs text-gray-400">
                              <span className="truncate">
                                {item.type === 'movie' 
                                  ? item.release_date ? new Date(item.release_date).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    }) : 'TBA'
                                  : item.first_air_date ? new Date(item.first_air_date).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'short',
                                      day: 'numeric'
                                    }) : 'TBA'
                                }
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </CardWithHover>
                  </motion.div>
                ))}
              </motion.div>
            </AnimatePresence>
            
            {/* Pagination */}
            {!loading && getCurrentFilterLoadedPages().length > 0 && totalPages > 1 && (
              <div className="max-w-7xl mx-auto px-2 md:px-4 pb-8 md:pb-12 mt-6 md:mt-8">
                <Pagination
                  currentPage={page}
                  loadedPages={getCurrentFilterLoadedPages()}
                  onPageChange={handlePageChange}
                />
                {/* Go to page input */}
                <div className="mt-4 flex flex-col items-center gap-2">
                  <span className="text-sm text-gray-400">Go to Page</span>
                  <div className="flex items-center gap-2 px-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={pageInput}
                      onChange={(e) => setPageInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') submitPageInput(); }}
                      className="w-20 rounded-lg bg-gray-800 text-white border border-gray-700 px-3 py-2 text-base text-center focus:outline-none focus:ring-2 focus:ring-red-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      placeholder={t('page')}
                      style={{ fontSize: '16px' }}
                    />
                    <button
                      onClick={submitPageInput}
                      className="rounded-lg bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 transition-colors"
                    >
                      Go
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : query ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="inline-block p-6 bg-gray-900 rounded-full mb-4">
              <MagnifyingGlassIcon className="h-16 w-16 text-gray-700" />
            </div>
            <p className="text-gray-400 text-lg mb-2">No results found for &quot;{query}&quot;</p>
            <p className="text-gray-500 text-sm">Try adjusting your filters or search terms</p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-24"
          >
            <div className="inline-block p-6 bg-gray-900 rounded-full mb-4">
              <MagnifyingGlassIcon className="h-16 w-16 text-gray-700" />
            </div>
            <p className="text-gray-400 text-lg mb-2">Start searching for movies and TV shows</p>
            <p className="text-gray-500 text-sm">Enter a title, actor, or keyword above</p>
          </motion.div>
        )}
      </div>
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4"
          />
          <p className="text-gray-400">Loading search...</p>
        </div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  )
}
