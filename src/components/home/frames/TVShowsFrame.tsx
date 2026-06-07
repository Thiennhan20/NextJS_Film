'use client'

import { useCallback, useEffect, useRef } from 'react'

import Image from 'next/image'
import axios from 'axios'

import { useRouter } from 'next/navigation'
import { useApiCache } from '@/hooks/useApiCache'
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll'
import CardWithHover, { batchPrefetchDetails } from '@/components/common/CardWithHover'
import { useTranslations } from 'next-intl'
import FrameLoadingPlaceholder from './FrameLoadingPlaceholder'

interface TVShowItem {
  id: number;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  poster_path?: string;
  first_air_date?: string;
}

const CATEGORY = {
  id: 'top-tvshows',
  title: 'Top 5 TV Shows Today',
  endpoint: '/trending/tv/day',
  type: 'tv' as const,
};

export default function TVShowsFrame() {
  const router = useRouter();
  const t = useTranslations('Frames');
  const scrollRef = useRef<HTMLDivElement>(null);
  const { dragScrollProps } = useHorizontalDragScroll(scrollRef);

  const fetchData = useCallback(async () => {
    const response = await axios.get(`/api/tmdb-proxy?endpoint=${encodeURIComponent(CATEGORY.endpoint)}`);
    return response.data.results.slice(0, 5) as TVShowItem[];
  }, []);

  const { data: items, loading, error } = useApiCache<TVShowItem[]>(
    'home-tvshows-frame',
    fetchData,
    8 * 60 * 60 * 1000 // 8 tiếng
  );

  // Batch prefetch details cho CardWithHover
  useEffect(() => {
    if (items && items.length > 0) {
      batchPrefetchDetails(
        items.map(item => ({ type: CATEGORY.type, id: item.id }))
      );
    }
  }, [items]);

  const getRoute = (item: TVShowItem) => `/tvshows/${item.id}`;
  const getTitle = (item: TVShowItem) => item.title || item.name || 'Unknown';
  const getOriginalTitle = (item: TVShowItem) => item.original_title || item.original_name || '';
  const getYear = (item: TVShowItem) => {
    const date = item.first_air_date;
    return date ? date.slice(0, 4) : '';
  };

  if (error) return null;
  if (loading && !items) return <FrameLoadingPlaceholder variant="top-five" />;
  if (!items || items.length === 0) return null;

  return (
    <div className="mb-10 sm:mb-12">
      <div className="flex items-center gap-3 mb-4 px-3">
        <div className="w-1.5 h-6 sm:h-8 rounded-full bg-gradient-to-b from-blue-500 to-purple-500" />
        <h3 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
          {t('topTVShowsTitle')}
        </h3>
      </div>
      
      <div 
        ref={scrollRef}
        {...dragScrollProps}
        className="horizontal-scroll-container flex md:grid md:grid-cols-5 gap-4 px-3 pt-6 overflow-x-auto md:overflow-visible pb-6 snap-x snap-mandatory select-none cursor-grab active:cursor-grabbing md:cursor-default"
        style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {items.map((item, index) => (
          <div key={item.id} className="flex flex-col group cursor-pointer snap-start snap-always min-w-[250px] md:min-w-0 w-[250px] md:w-auto shrink-0" onClick={() => router.push(getRoute(item))}>
            {/* Poster */}
            <CardWithHover
                id={item.id}
                type={CATEGORY.type}
                title={getTitle(item)}
                posterPath={item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : ''}
                onWatchClick={() => router.push(getRoute(item))}
                onDetailsClick={() => router.push(getRoute(item))}
                hoverDelay={1000}
            >
              <div className="relative w-full aspect-[2/3] mb-4">
                <div 
                  className="absolute inset-0 rounded-xl overflow-hidden bg-gray-900 shadow-lg transition-transform duration-500 group-hover:!transform-none"
                  style={{
                    transform: index % 2 === 0 
                      ? 'perspective(1000px) rotateY(30deg)' 
                      : 'perspective(1000px) rotateY(-30deg)',
                    transformOrigin: index % 2 === 0 ? 'right center' : 'left center'
                  }}
                >
                  {item.poster_path ? (
                    <Image 
                      src={`https://image.tmdb.org/t/p/w500${item.poster_path}`}
                      alt={getTitle(item)}
                      fill
                      sizes="(max-width: 768px) 50vw, 20vw"
                      className="object-cover w-full h-full transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full bg-[#1a1c23] flex items-center justify-center">
                      <span className="text-4xl text-gray-500">🎬</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300" />
                </div>
              </div>
            </CardWithHover>

            {/* Content & Rank */}
            <div className="flex items-start gap-3 sm:gap-4">
              {/* Giant Number */}
              <div className="text-5xl md:text-6xl font-black italic text-[#fcd53f] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] tracking-tighter leading-none mt-1 shrink-0 min-w-[36px] md:min-w-[44px]">
                {index + 1}
              </div>
              
              {/* Decorative Divider */}
              <div className="w-1 h-10 bg-gradient-to-b from-[#fcd53f] to-transparent mt-2 shrink-0 rounded-full opacity-80" />

              {/* Text Info */}
              <div className="flex flex-col flex-1 overflow-hidden pt-1">
                <h4 className="text-white font-bold text-sm sm:text-base line-clamp-1 drop-shadow-sm" title={getTitle(item)}>
                  {getTitle(item)}
                </h4>
                <p className="text-gray-400 text-xs line-clamp-1 mb-1" title={getOriginalTitle(item)}>
                  {getOriginalTitle(item)}
                </p>
                <div className="flex items-center gap-2 text-[10px] sm:text-xs font-semibold text-gray-300">
                  <span className="text-gray-100">T16</span>
                  <span className="w-1 h-1 rounded-full bg-gray-500" />
                  <span>{getYear(item)}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
