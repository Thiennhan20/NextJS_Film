'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Pagination from '@/components/Pagination'
import FilterIcon from '@/components/FilterIcon'
import axios from 'axios'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Suspense } from 'react'
import CardWithHover from '@/components/common/CardWithHover'
import { useTranslations } from 'next-intl'
import apiCache from '@/hooks/useApiCache'
import {
  CONTENT_COUNTRY_OPTIONS,
  TV_CATEGORY_OPTIONS,
  TV_GENRE_FILTERS,
  appendCountryCodeFilter,
  appendGenreFilter,
  getCountryDisplayName,
} from '@/lib/contentFilters'

// Định nghĩa kiểu TVShow rõ ràng
interface TVShow {
  id: number;
  name: string;
  poster_path: string;
  image?: string;
  year?: number;
  genre?: string;
  first_air_date?: string;
  country?: string;
  totalSeasons?: number;
  totalEpisodes?: number;
}

// Type for TMDB API TV response
interface TMDBTV {
  id: number;
  name: string;
  poster_path: string;
  vote_average: number;
  first_air_date?: string;
  original_language?: string;
  origin_country?: string[];
  number_of_seasons?: number;
  number_of_episodes?: number;
  genre_ids?: number[];
}

function TVShowsPageContent({ initialTVShows }: { initialTVShows: TVShow[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('TVShows');
  
  // Lấy giá trị từ URL parameters cho cả page, year, category và country
  const urlPage = Number(searchParams.get('page')) || 1;
  const urlYear = searchParams.get('year') || 'All';
  const urlCategory = searchParams.get('category') || 'All';
  const urlCountry = searchParams.get('country') || 'All';
  
  // Khởi tạo state từ URL thay vì hardcode
  const [selectedYear, setSelectedYear] = useState<string | number>(urlYear)
  const [selectedCategory, setSelectedCategory] = useState<string>(urlCategory)
  const [selectedCountry, setSelectedCountry] = useState<string>(urlCountry)
  const [page, setPage] = useState(urlPage)
  const [loading, setLoading] = useState(() => {
    // No loading if we have SSR data for default filter page 1
    if (initialTVShows.length > 0 && urlPage === 1 && urlYear === 'All' && urlCategory === 'All' && urlCountry === 'All') return false;
    return false;
  })
  const [isRolling, setIsRolling] = useState(false)
  const [showThoughtBubble, setShowThoughtBubble] = useState(true)
  const [thoughtText, setThoughtText] = useState(t('randomText1'))
  const [pageInput, setPageInput] = useState<string>(String(urlPage))

  
  // Cache các trang đã load: { [filterKey]: { [page]: TVShow[] } }
  // Khôi phục từ: 1) SSR initialTVShows (page 1), 2) global apiCache (revisit)
  const [pagesCache, setPagesCache] = useState<{ [filterKey: string]: { [page: number]: TVShow[] } }>(() => {
    const cached = apiCache.get<{ [filterKey: string]: { [page: number]: TVShow[] } }>('tvshows-pages-cache');
    if (cached && Object.keys(cached).length > 0) return cached;
    if (initialTVShows.length > 0) {
      return { 'All-All-All': { 1: initialTVShows } };
    }
    return {};
  })
  // Lưu các trang đã load cho từng filter: { [filterKey]: number[] }
  const [loadedPages, setLoadedPages] = useState<{ [filterKey: string]: number[] }>(() => {
    const cached = apiCache.get<{ [filterKey: string]: number[] }>('tvshows-loaded-pages');
    if (cached && Object.keys(cached).length > 0) return cached;
    if (initialTVShows.length > 0) {
      return { 'All-All-All': [1] };
    }
    return {};
  })

  // Helper functions để làm việc với cache theo filter
  const getCurrentFilterKey = () => {
    return `${selectedYear}-${selectedCategory}-${selectedCountry}`;
  };

  const getCurrentFilterCache = () => {
    const filterKey = getCurrentFilterKey();
    return pagesCache[filterKey] || {};
  };

  const getCurrentFilterLoadedPages = () => {
    const filterKey = getCurrentFilterKey();
    return loadedPages[filterKey] || [];
  };

  const setCurrentFilterCache = (page: number, tvShows: TVShow[]) => {
    const filterKey = getCurrentFilterKey();
    setPagesCache(prev => ({
      ...prev,
      [filterKey]: {
        ...prev[filterKey],
        [page]: tvShows
      }
    }));
  };

  const setCurrentFilterLoadedPages = (pages: number[]) => {
    const filterKey = getCurrentFilterKey();
    setLoadedPages(prev => ({
      ...prev,
      [filterKey]: pages
    }));
  };

  // Đồng bộ pagesCache và loadedPages vào global apiCache (persist across navigations)
  useEffect(() => {
    if (Object.keys(pagesCache).length > 0) {
      apiCache.set('tvshows-pages-cache', pagesCache, 8 * 60 * 60 * 1000);
    }
  }, [pagesCache]);

  useEffect(() => {
    if (Object.keys(loadedPages).length > 0) {
      apiCache.set('tvshows-loaded-pages', loadedPages, 8 * 60 * 60 * 1000);
    }
  }, [loadedPages]);

  // Track previous values to avoid infinite loops
  const prevPageRef = useRef(page);
  const prevYearRef = useRef(selectedYear);
  const prevCategoryRef = useRef(selectedCategory);
  const prevCountryRef = useRef(selectedCountry);
  


  // Sync state với URL parameters khi URL thay đổi (browser navigation)
  useEffect(() => {
    const newPage = Number(searchParams.get('page')) || 1;
    const newYear = searchParams.get('year') || 'All';
    const newCategory = searchParams.get('category') || 'All';
    const newCountry = searchParams.get('country') || 'All';
    
    // Chỉ update nếu thực sự có thay đổi để tránh infinite loop
    if (newPage !== prevPageRef.current) {
      setPage(newPage);
      prevPageRef.current = newPage;
    }
    
    if (newYear !== prevYearRef.current) {
      setSelectedYear(newYear);
      prevYearRef.current = newYear;
    }

    if (newCategory !== prevCategoryRef.current) {
      setSelectedCategory(newCategory);
      prevCategoryRef.current = newCategory;
    }

    if (newCountry !== prevCountryRef.current) {
      setSelectedCountry(newCountry);
      prevCountryRef.current = newCountry;
    }
  }, [searchParams]);

  // Khởi tạo cache cho filter đầu tiên khi component mount
  // Chỉ cache page 1 (từ SSR/Redis) — các trang khác load on-demand khi user bấm pagination
  useEffect(() => {
    if (!getCurrentFilterCache()[urlPage]) {
      const initCache = async () => {
        setLoading(true);
        try {
          const tvShows = await fetchTVShowsPage(urlPage);
          setCurrentFilterCache(urlPage, tvShows);
          setCurrentFilterLoadedPages([urlPage]);
        } catch {
          setCurrentFilterCache(urlPage, []);
          setCurrentFilterLoadedPages([urlPage]);
        }
        setLoading(false);
      };
      initCache();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Khi page hoặc filter thay đổi từ user action, update URL
  useEffect(() => {
      // Tránh push trùng URL gây thêm history entry không cần thiết
    const currentPageInUrl = Number(searchParams.get('page')) || 1;
    const currentYearInUrl = searchParams.get('year') || 'All';
    const currentCategoryInUrl = searchParams.get('category') || 'All';
    const currentCountryInUrl = searchParams.get('country') || 'All';
    
    if (currentPageInUrl === page && 
        String(currentYearInUrl) === String(selectedYear) &&
        currentCategoryInUrl === selectedCategory &&
        currentCountryInUrl === selectedCountry) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    params.set('year', String(selectedYear));
    params.set('category', String(selectedCategory));
    params.set('country', String(selectedCountry));
    
    // Sử dụng push thay vì replace để tạo history entries
    router.push(`?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedYear, selectedCategory, selectedCountry]);

  // Xử lý khi thay đổi filter
  useEffect(() => {
    // Chỉ reset khi filter thực sự thay đổi từ user action
    if (selectedYear !== urlYear || selectedCategory !== urlCategory || selectedCountry !== urlCountry) {
      setPage(1);
      // Fetch trang 1 ngay lập tức nếu chưa có cache cho filter này
      const fetchFirstPage = async () => {
        if (!getCurrentFilterCache()[1]) {
          setLoading(true);
          try {
            const tvShows = await fetchTVShowsPage(1);
            setCurrentFilterCache(1, tvShows);
            setCurrentFilterLoadedPages([1]);
          } catch {
            setCurrentFilterCache(1, []);
            setCurrentFilterLoadedPages([1]);
          }
          setLoading(false);
          // Prefetch các trang tiếp theo
          loadNext10Pages(2);
        }
      };
      fetchFirstPage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYear, selectedCategory, selectedCountry]);

  // Compute years dynamically from tvshows
  const currentYear = new Date().getFullYear();
  const years = useMemo(() => {
    const yearArr = [];
    for (let y = currentYear; y >= 2000; y--) {
      yearArr.push(y);
    }
    return ['All', ...yearArr];
  }, [currentYear]);

  // Categories for TV shows
  const categories = useMemo(() => TV_CATEGORY_OPTIONS, []);

  // Countries for TV shows
  const countries = useMemo(() => CONTENT_COUNTRY_OPTIONS, []);

  // Hàm fetch 1 trang TV shows
  const fetchTVShowsPage = async (pageToFetch: number) => {
    const params = new URLSearchParams({
      sort_by: 'popularity.desc',
      page: String(pageToFetch)
    });
    
    if (selectedYear !== 'All') {
      params.append('first_air_date_year', String(selectedYear));
    }
    if (selectedCategory !== 'All') {
      appendGenreFilter(params, TV_GENRE_FILTERS, selectedCategory);
    }
    if (selectedCountry !== 'All') {
      appendCountryCodeFilter(params, selectedCountry);
    }
    const response = await axios.get(`/api/tmdb-proxy?endpoint=/discover/tv&${params.toString()}`);
    const fetchedTVShows = response.data.results;
    
    return fetchedTVShows.map((tvShow: TMDBTV) => ({
      id: tvShow.id,
      name: tvShow.name,
      year: tvShow.first_air_date ? Number(tvShow.first_air_date.slice(0, 4)) : '',
      image: tvShow.poster_path ? `https://image.tmdb.org/t/p/w500${tvShow.poster_path}` : '',
      genre: [],
      first_air_date: tvShow.first_air_date,
      country: getCountryDisplayName(tvShow.original_language, tvShow.origin_country?.[0]),
      totalSeasons: tvShow.number_of_seasons || 0,
      totalEpisodes: tvShow.number_of_episodes || 0
    }));
  }

  // Khi page thay đổi, nếu chưa có trong cache thì fetch
  useEffect(() => {
    let ignore = false;
    const loadPage = async () => {
      if (getCurrentFilterCache()[page]) return;
      setLoading(true);
      try {
        const tvShows = await fetchTVShowsPage(page);
        if (!ignore) {
          setCurrentFilterCache(page, tvShows);
          const currentPages = getCurrentFilterLoadedPages();
          const newPages = currentPages.includes(page) ? currentPages : [...currentPages, page].sort((a, b) => a - b);
          setCurrentFilterLoadedPages(newPages);
        }
      } catch {
        if (!ignore) setCurrentFilterCache(page, []);
      }
      if (!ignore) setLoading(false);
    }
    loadPage();
    return () => { ignore = true; }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, selectedYear, selectedCategory, selectedCountry]);

  // Hàm load thêm 10 trang tiếp theo (khi bấm vào 1 trong 2 trang kế tiếp)
  const loadNext10Pages = async (startPage: number) => {
    const promises = [];
    for (let p = startPage; p < startPage + 10; p++) {
      if (!getCurrentFilterCache()[p]) {
        promises.push(fetchTVShowsPage(p).then(tvShows => ({ p, tvShows })));
      }
    }
    
    if (promises.length > 0) {
      setLoading(true);
      const results = await Promise.all(promises);
      results.forEach(({ p, tvShows }) => {
        setCurrentFilterCache(p, tvShows);
      });
      
      const currentPages = getCurrentFilterLoadedPages();
      const newPages = [...currentPages];
      for (let p = startPage; p < startPage + 10; p++) {
        if (!newPages.includes(p)) newPages.push(p);
      }
      setCurrentFilterLoadedPages(newPages.sort((a, b) => a - b));
      setLoading(false);
    }
  }

  // Lấy TV shows của trang hiện tại
  const pagedTVShows = getCurrentFilterCache()[page] || [];

  // Animation variants for grid items
  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  // Xác định các trang hợp lệ (nếu một trang trước đó có < 20 phim, coi như đó là trang cuối)
  const currentCache = getCurrentFilterCache();
  const validLoadedPages = getCurrentFilterLoadedPages().filter(p => {
    for (let i = 1; i < p; i++) {
      if (currentCache[i] && currentCache[i].length < 20) return false;
    }
    return true;
  });
  const maxLoadedPage = validLoadedPages.length > 0 ? Math.max(...validLoadedPages) : 1;
  const isLastPage = currentCache[page] ? currentCache[page].length < 20 : false;

  // Xử lý khi đổi trang - scroll lên top ngay lập tức trước khi load data
  const handlePageChange = (p: number) => {
    if (p < 1) return;
    setPageInput(String(p));
    // Scroll lên top ngay lập tức, không chờ data load
    window.scrollTo({ top: 0, behavior: 'smooth' });
    
    // Nếu bấm vào trang cuối cùng đã load, tự động load tiếp 10 trang mới
    if (p === maxLoadedPage) {
      loadNext10Pages(maxLoadedPage + 1).then(() => {
        setPage(p);
      });
    } else if (p === maxLoadedPage + 1 || p === maxLoadedPage + 2) {
      loadNext10Pages(maxLoadedPage + 1).then(() => {
        setPage(p);
      });
    } else {
      setPage(p);
    }
  }

  // Sync page input when page changes due to URL/back/forward
  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const submitPageInput = () => {
    const target = parseInt(pageInput || '1', 10);
    if (!isNaN(target) && target > 0) {
      handlePageChange(target);
    }
  }

  // Xử lý khi thay đổi filter
  const handleYearChange = (year: string | number) => {
    setSelectedYear(year);
    // Reset page về 1 khi thay đổi năm
    setPage(1);
    // Clear cache cho filter cũ nếu cần thiết để tiết kiệm memory
    if (Object.keys(pagesCache).length > 10) {
      const currentFilterKey = getCurrentFilterKey();
      const newCache = { [currentFilterKey]: pagesCache[currentFilterKey] || {} };
      setPagesCache(newCache);
    }
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    setPage(1);
    if (Object.keys(pagesCache).length > 10) {
      const currentFilterKey = getCurrentFilterKey();
      const newCache = { [currentFilterKey]: pagesCache[currentFilterKey] || {} };
      setPagesCache(newCache);
    }
  }

  const handleCountryChange = (country: string) => {
    setSelectedCountry(country);
    setPage(1);
    if (Object.keys(pagesCache).length > 10) {
      const currentFilterKey = getCurrentFilterKey();
      const newCache = { [currentFilterKey]: pagesCache[currentFilterKey] || {} };
      setPagesCache(newCache);
    }
  };

  // Random filter function
  const handleRandomFilter = () => {
    setIsRolling(true);
    setShowThoughtBubble(false); // Hide thought bubble when rolling
    
    // Random selection
    const randomYear = years[Math.floor(Math.random() * years.length)];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];
    const randomCountry = countries[Math.floor(Math.random() * countries.length)];
    
    // Apply random filters
    setSelectedYear(randomYear);
    setSelectedCategory(randomCategory);
    setSelectedCountry(randomCountry);
    setPage(1);
    
    // Stop rolling animation after delay
    setTimeout(() => {
      setIsRolling(false);
    }, 1000);
  };

  // Auto-show thought bubble after 5 seconds
  useEffect(() => {
    if (!showThoughtBubble) {
      const timer = setTimeout(() => {
        setShowThoughtBubble(true);
        // Change thought text randomly
        const thoughts = [
          t('randomText1'),
          t('randomText2'),
          t('randomText3'),
          t('randomText4'),
          t('randomText5')
        ];
        setThoughtText(thoughts[Math.floor(Math.random() * thoughts.length)]);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [showThoughtBubble, t]);



  return (
    <div className="min-h-screen bg-black">
      <div className="max-w-7xl mx-auto px-2 md:px-4 pt-4 md:pt-6">

        
        {/* Filter and Dice Layout */}
        <div className="flex items-center justify-between gap-1 sm:gap-2 md:gap-4 mb-6 md:mb-8 px-2 md:px-4">
          {/* Filter Icon - Left Side */}
          <div className="flex-1 min-w-0">
            <FilterIcon
              selectedYear={selectedYear}
              selectedCategory={selectedCategory}
              selectedCountry={selectedCountry}
              onYearChange={handleYearChange}
              onCategoryChange={handleCategoryChange}
              onCountryChange={handleCountryChange}
              years={years}
              categories={categories}
              countries={countries}
            />
          </div>
          
          {/* Dice Button with Thought Bubble - Right Side */}
          <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
            {/* Thought Bubble */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ 
                opacity: showThoughtBubble ? 1 : 0,
                scale: showThoughtBubble ? 1 : 0.8
              }}
              transition={{ duration: 0.3 }}
              className="relative"
            >
              {/* Bubble */}
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg px-1.5 py-0.5 shadow-lg">
                <span className="text-white text-[10px] sm:text-xs font-medium leading-tight whitespace-pre-line">
                  {thoughtText}
                </span>
              </div>
              
              {/* Arrow pointing to dice */}
              <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-0 h-0 border-l-[4px] sm:border-l-[6px] border-l-white/20 border-t-[3px] sm:border-t-[4px] border-t-transparent border-b-[3px] sm:border-b-[4px] border-b-transparent"></div>
            </motion.div>
            
            <motion.button
              onClick={handleRandomFilter}
              className="group relative p-2 sm:p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
            >
              <motion.div
                animate={{ rotate: isRolling ? 360 : 0 }}
                transition={{ 
                  duration: isRolling ? 0.8 : 0.3,
                  ease: "easeInOut"
                }}
                className="text-lg sm:text-xl md:text-2xl"
              >
                🎲
              </motion.div>
            </motion.button>
          </div>
        </div>
        {/* TV Shows Grid + Loading + Pagination */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
              className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full"
            />
            <p className="mt-4 text-gray-400 text-lg">{t('loading')}</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${getCurrentFilterKey()}-${page}`}
              variants={{
                hidden: { opacity: 0, y: 30 },
                show: {
                  opacity: 1,
                  y: 0,
                  transition: { staggerChildren: 0.08 },
                },
              }}
              initial="hidden"
              animate="show"
              exit="hidden"
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 md:gap-3 lg:gap-4 xl:gap-6 px-2 md:px-0"
            >
              {/* Sửa điều kiện: chỉ hiện No TV shows found khi !loading, cache đã có key cho page hiện tại và không có TV show */}
              {!loading && getCurrentFilterCache().hasOwnProperty(page) && pagedTVShows.length === 0 && (
                <motion.div
                  key="no-tvshows"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="col-span-full text-center text-gray-400 py-12 text-xl"
                >
                  {t('noTVShows')}
                </motion.div>
              )}
              {pagedTVShows.map((tvShow: TVShow) => (
                <motion.div
                  key={tvShow.id}
                  variants={itemVariants}
                >
                  <CardWithHover
                    id={tvShow.id}
                    type="tv"
                    title={tvShow.name}
                    posterPath={tvShow.image || '/window.svg'}
                    onWatchClick={() => router.push(`/tvshows/${tvShow.id}?page=${page}&year=${selectedYear}&category=${selectedCategory}&country=${selectedCountry}&season=1`)}
                    onDetailsClick={() => router.push(`/tvshows/${tvShow.id}?page=${page}&year=${selectedYear}&category=${selectedCategory}&country=${selectedCountry}&season=1`)}
                  >
                    <Link href={`/tvshows/${tvShow.id}?page=${page}&year=${selectedYear}&category=${selectedCategory}&country=${selectedCountry}&season=1`} className="block">
                      <div className="border border-gray-700 rounded-lg overflow-hidden relative group bg-gray-800 hover:bg-gray-700 transition-colors duration-200">
                        <div className="relative w-full h-[240px] md:h-[300px] lg:h-[360px] overflow-hidden bg-gray-900">
                          <Image
                            src={(tvShow.image && tvShow.image.length > 0) ? tvShow.image : '/window.svg'}
                            alt={tvShow.name}
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 20vw"
                            className="object-cover"
                            priority={false}
                          />
                        </div>
                        <div className="p-2 md:p-3 bg-gray-900">
                          <div className="flex items-start justify-between mb-1 md:mb-2">
                            <h3 className="text-white font-semibold text-xs md:text-sm truncate leading-tight">
                              {tvShow.name}
                            </h3>
                          </div>
                          <div className="flex items-center justify-between text-[10px] md:text-xs text-gray-400">
                            <span className="truncate">
                              {tvShow.first_air_date ? new Date(tvShow.first_air_date).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }) : t('tba')}
                            </span>
                            <span className="truncate ml-1">{tvShow.country}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </CardWithHover>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
        {!loading && getCurrentFilterLoadedPages().length > 0 && (
          <div className="max-w-7xl mx-auto px-2 md:px-4 pb-8 md:pb-12">
            <Pagination
              currentPage={page}
              loadedPages={validLoadedPages}
              onPageChange={handlePageChange}
              isLastPage={isLastPage}
            />
            {/* Go to page input */}
            <div className="mt-4 flex flex-col items-center gap-2">
              <span className="text-sm text-gray-400">{t('goToPage')}</span>
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
                  {t('go')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TVShowsClient({ initialTVShows = [] }: { initialTVShows?: TVShow[] }) {
  return (
    <Suspense>
      <TVShowsPageContent initialTVShows={initialTVShows} />
    </Suspense>
  );
} 
