'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import Image from 'next/image'
import axios from 'axios'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline'
import CardWithHover, { batchPrefetchDetails } from '@/components/common/CardWithHover'
import { useTranslations } from 'next-intl'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'

interface Movie {
  id: number;
  title: string;
  original_title?: string;
  poster_path: string;
  vote_average?: number;
  release_date?: string;
  image?: string;
  year?: number;
  genre?: string;
  backdrop_path?: string;
  status?: 'Full HD' | 'Full HD/CAM' | 'Coming Soon' | 'Non';
  original_language?: string;
}

interface ProcessedMovie {
  id: number;
  title: string;
  original_title: string;
  year: number;
  image: string;
  backdrop: string;
  genre: never[];
  release_date?: string;
  status?: 'Full HD' | 'Full HD/CAM' | 'Coming Soon' | 'Non';
  original_language?: string;
  type: 'movie';
}

type ContentItem = ProcessedMovie;

export default function ComingSoonFrame() {
  const router = useRouter();
  const [featuredContent, setFeaturedContent] = useState<ContentItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastFetchDate, setLastFetchDate] = useState<string>('');
  const [canScrollLeftComingSoon, setCanScrollLeftComingSoon] = useState(false);
  const [canScrollRightComingSoon, setCanScrollRightComingSoon] = useState(false);
  const comingSoonScrollRef = useRef<HTMLDivElement>(null);
  const { dragScrollProps } = useHorizontalDragScroll(comingSoonScrollRef);
  const t = useTranslations('ComingSoonSection');
  
  // Giới hạn số lượng dữ liệu để cải thiện hiệu suất
  const MAX_ITEMS = 20;

  // Hàm chuyển đổi language code thành tên quốc gia
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const getCountryName = (languageCode?: string): string => {
    const countryMap: { [key: string]: string } = {
      'en': 'USA',
      'ja': 'Japan',
      'ko': 'Korea',
      'zh': 'China',
      'hi': 'India',
      'fr': 'France',
      'de': 'Germany',
      'es': 'Spain',
      'it': 'Italy',
      'pt': 'Brazil',
      'ru': 'Russia',
      'ar': 'Egypt',
      'th': 'Thailand',
      'vi': 'Vietnam',
      'id': 'Indonesia',
      'ms': 'Malaysia',
      'tl': 'Philippines',
      'my': 'Myanmar',
      'km': 'Cambodia',
      'lo': 'Laos'
    };
    return countryMap[languageCode || 'en'] || 'USA';
  };

  // --- STATUS GENERATION FUNCTION ---
  const generateMovieStatus = (releaseDate?: string): 'Full HD' | 'Full HD/CAM' | 'Coming Soon' | 'Non' => {
    if (!releaseDate) return 'Coming Soon';
    
    const releaseDateObj = new Date(releaseDate);
    const currentDate = new Date();
    const releaseYear = releaseDateObj.getFullYear();
    
    // Trường hợp Non: phim từ 1990 trở về quá khứ
    if (releaseYear < 1990) return 'Non';
    
    // Tính khoảng cách thời gian giữa ngày hiện tại và ngày phát hành (tính bằng tháng)
    const timeDiffInMs = releaseDateObj.getTime() - currentDate.getTime();
    const timeDiffInMonths = timeDiffInMs / (1000 * 60 * 60 * 24 * 30.44); // 30.44 ngày = 1 tháng
    
    // Trường hợp Coming Soon: phim sẽ phát hành từ 1 tháng trở đi (giảm từ 2 xuống 1)
    if (timeDiffInMonths >= 1) return 'Coming Soon';
    
    // Trường hợp Full HD/CAM: phim mới xuất hiện dưới 1 tháng
    if (timeDiffInMonths >= 0 && timeDiffInMonths < 1) return 'Full HD/CAM';
    
    // Trường hợp Full HD: phim đã xuất hiện (quá khứ)
    return 'Full HD';
  };

  // Process movies function
  const processMovies = (movies: Movie[]) => movies
    .filter(movie => {
      // Client-side filtering to ensure only movies with valid release dates
      if (!movie.release_date) return false;
      const movieReleaseDate = new Date(movie.release_date);
      const currentDateObj = new Date();
      return movieReleaseDate >= currentDateObj;
    })
    .map((movie: Movie) => ({
      id: movie.id,
      title: movie.title,
      original_title: movie.original_title || movie.title,
      year: movie.release_date ? Number(movie.release_date.slice(0, 4)) : 0,
      image: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : '',
      backdrop: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : '',
      genre: [],
      release_date: movie.release_date || '',
      status: generateMovieStatus(movie.release_date),
      original_language: movie.original_language || 'en',
      type: 'movie' as const,
    }));

  // Fetch movies function (supports initial load and load more)
  const fetchMovies = async (pageNumber: number, isInitial: boolean = false) => {
    if (isInitial) {
      setLoading(true);
    } else {
      setIsFetchingMore(true);
    }

    try {
      // Calculate dynamic date range (90 days from today)
      const today = new Date();
      const startDate = today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 90);
      const endDateStr = endDate.toISOString().split('T')[0]; // Format: YYYY-MM-DD


      const apiUrl = `/api/tmdb-proxy?endpoint=/discover/movie&release_date.gte=${startDate}&release_date.lte=${endDateStr}&with_release_type=3|6&region=VN&sort_by=release_date.asc`;
      

      const response = await axios.get(apiUrl, {
        params: { page: pageNumber },
      });

      const newMovies: Movie[] = response.data.results;
      const processed = processMovies(newMovies);

      setFeaturedContent(prev => {
        const newContent = isInitial ? processed : [...prev, ...processed];
        // Giới hạn số lượng items để cải thiện hiệu suất
        return newContent.slice(0, MAX_ITEMS);
      });
      setHasMore(pageNumber < response.data.total_pages && newMovies.length > 0 && featuredContent.length < MAX_ITEMS);

      if (isInitial) {
        setLastFetchDate(startDate);
      }

      setPage(pageNumber + 1);
    } catch (error) {
      console.error(error);
    } finally {
      if (isInitial) {
        setLoading(false);
      } else {
        setIsFetchingMore(false);
      }
    }
  };

  // Optimized scroll position checking with throttling
  const checkComingSoonScrollPosition = useCallback(() => {
    if (comingSoonScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = comingSoonScrollRef.current;
      setCanScrollLeftComingSoon(scrollLeft > 0);
      setCanScrollRightComingSoon(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  // Scroll functions for Coming Soon section
  const scrollComingSoonLeft = () => {
    if (comingSoonScrollRef.current) {
      comingSoonScrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollComingSoonRight = () => {
    if (comingSoonScrollRef.current) {
      comingSoonScrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  // Fetch initial content on component mount
  useEffect(() => {
    fetchMovies(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Batch prefetch details cho CardWithHover
  useEffect(() => {
    if (featuredContent && featuredContent.length > 0) {
      batchPrefetchDetails(
        featuredContent.map(item => ({ type: 'movie' as const, id: item.id }))
      );
    }
  }, [featuredContent]);

  // Check for daily updates
  useEffect(() => {
    const checkForDailyUpdate = () => {
      const currentDate = new Date().toISOString().split('T')[0];
      if (lastFetchDate && lastFetchDate !== currentDate) {
        // Reset states and refetch
        setFeaturedContent([]);
        setPage(1);
        setHasMore(true);
        fetchMovies(1, true);
      }
    };

    const interval = setInterval(checkForDailyUpdate, 60000); // Check every minute
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastFetchDate]);

  // Optimized scroll handling with throttling and data limit
  useEffect(() => {
    const container = comingSoonScrollRef.current;
    if (!container) return;

    let throttleTimeout: NodeJS.Timeout | null = null;
    const throttledCheckScroll = () => {
      if (throttleTimeout) return;
      throttleTimeout = setTimeout(() => {
        checkComingSoonScrollPosition();
        throttleTimeout = null;
      }, 16); // ~60fps
    };

    const handleScroll = () => {
      throttledCheckScroll();
      if (container) {
        const { scrollLeft, scrollWidth, clientWidth } = container;
        // Chỉ load more khi chưa đạt giới hạn và có thể scroll thêm
        if (scrollLeft + clientWidth >= scrollWidth - 100 && hasMore && !isFetchingMore && featuredContent.length < MAX_ITEMS) {
          fetchMovies(page);
        }
      }
    };

    checkComingSoonScrollPosition();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', throttledCheckScroll, { passive: true });

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', throttledCheckScroll);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [featuredContent, page, hasMore, isFetchingMore, checkComingSoonScrollPosition, MAX_ITEMS]);

  return (
    <section className="py-6 sm:py-8 md:py-10 px-2 sm:px-3 bg-gradient-to-b from-gray-900 to-black">
      <div className="max-w-7xl mx-auto">
        {/* Title section - left aligned with colored bar */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6 px-3">
          <div className="w-1.5 h-6 sm:h-8 rounded-full bg-gradient-to-b from-yellow-400 to-pink-500" />
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-wide">
            {t('title')}
          </h2>
        </div>

        <div className="relative group/row">
          {/* Navigation arrows - show on hover */}
          <motion.button
            onClick={scrollComingSoonLeft}
            className={`absolute left-0 sm:-left-4 top-[40%] -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/80 text-white backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all duration-300 shadow-2xl ${
              canScrollLeftComingSoon ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>
          
          <motion.button
            onClick={scrollComingSoonRight}
            className={`absolute right-0 sm:-right-4 top-[40%] -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/80 text-white backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all duration-300 shadow-2xl ${
              canScrollRightComingSoon ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
            }`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <ChevronRightIcon className="w-5 h-5 sm:w-6 sm:h-6" />
          </motion.button>

          <div
            ref={comingSoonScrollRef}
            {...dragScrollProps}
            className="horizontal-scroll-container flex gap-3 sm:gap-4 overflow-x-auto overflow-y-visible pb-4 pt-2 scrollbar-none snap-x snap-proximity px-3"
            style={{ 
              WebkitOverflowScrolling: 'touch', 
              scrollbarWidth: 'none', 
              msOverflowStyle: 'none',
              scrollBehavior: 'smooth'
            }}
          >
            {loading ? (
              <div className="text-gray-400 text-center py-8 w-full">{t('loading')}</div>
            ) : (
              <>
                {featuredContent.map((item) => (
                  <div 
                    key={item.id}
                    className="snap-start flex-shrink-0"
                    style={{ width: 'clamp(280px, 30vw, 400px)' }}
                  >
                    <CardWithHover
                      id={item.id}
                      type="movie"
                      title={item.title}
                      posterPath={item.image}
                      onWatchClick={() => router.push(`/movies/${item.id}`)}
                      onDetailsClick={() => router.push(`/movies/${item.id}`)}
                    >
                      <Link href={`/movies/${item.id}`}>
                        <motion.div
                          whileHover={{ scale: 1.03 }}
                          className="cursor-pointer group"
                        >
                          {/* Backdrop image - landscape card */}
                          <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-gray-800">
                            {(item.backdrop || item.image) ? (
                              <Image
                                src={item.backdrop || item.image}
                                alt={item.title}
                                fill
                                sizes="(max-width: 640px) 280px, (max-width: 768px) 320px, 380px"
                                className="object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-3xl text-gray-600">🎬</div>
                            )}
                            
                            {/* Subtle gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                            
                            {/* Coming Soon badge */}
                            <div className="absolute bottom-3 left-3 bg-gray-800/90 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded">
                              Coming Soon
                            </div>
                          </div>
                          
                          {/* Title & Original Title below image */}
                          <div className="mt-2.5 px-0.5">
                            <h4 className="text-white font-semibold text-sm sm:text-base line-clamp-1">
                              {item.title}
                            </h4>
                            {item.original_title && item.original_title !== item.title && (
                              <p className="text-gray-400 text-xs sm:text-sm mt-0.5 line-clamp-1">
                                {item.original_title}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      </Link>
                    </CardWithHover>
                  </div>
                ))}
                {isFetchingMore && (
                  <div className="flex-shrink-0 flex items-center justify-center text-gray-400" style={{ width: 'clamp(280px, 30vw, 400px)' }}>
                    {t('loadingMore')}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
