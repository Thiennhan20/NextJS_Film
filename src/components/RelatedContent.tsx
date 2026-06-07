'use client';

import { useCallback, useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import CardWithHover from '@/components/common/CardWithHover';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';

interface RelatedItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  vote_average: number;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

interface RelatedContentProps {
  id: number;
  type: 'movie' | 'tv';
  title: string;
}

export default function RelatedContent({ id, type, title }: RelatedContentProps) {
  const router = useRouter();
  const [relatedItems, setRelatedItems] = useState<RelatedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { dragScrollProps } = useHorizontalDragScroll(scrollContainerRef);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  useEffect(() => {
    const fetchRelated = async () => {
      setLoading(true);
      try {
        // Fetch recommendations first
        const recResponse = await axios.get(
          `/api/tmdb-proxy?endpoint=/${type}/${id}/recommendations`
        );
        let items: RelatedItem[] = recResponse.data.results || [];

        // If not enough recommendations, fetch similar
        if (items.length < 10) {
          const simResponse = await axios.get(
            `/api/tmdb-proxy?endpoint=/${type}/${id}/similar`
          );
          const similarItems: RelatedItem[] = simResponse.data.results || [];
          
          // Merge and remove duplicates
          const existingIds = new Set(items.map(item => item.id));
          for (const item of similarItems) {
            if (!existingIds.has(item.id) && items.length < 20) {
              items.push(item);
              existingIds.add(item.id);
            }
          }
        }

        // Filter out items without poster
        items = items.filter(item => item.poster_path);
        
        setRelatedItems(items.slice(0, 20));
      } catch (error) {
        console.error('Error fetching related content:', error);
        setRelatedItems([]);
      }
      setLoading(false);
    };

    if (id) {
      fetchRelated();
    }
  }, [id, type]);

  const checkScrollButtons = useCallback(() => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => checkScrollButtons();
    container.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleScroll, { passive: true });
    setTimeout(checkScrollButtons, 100);

    return () => {
      container.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    }
  }, [checkScrollButtons, relatedItems]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">Related {type === 'movie' ? 'Movies' : 'TV Shows'}</h2>
        <div className="flex gap-4 overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-[140px] sm:w-[160px]">
              <div className="aspect-[2/3] bg-gray-700 rounded-lg animate-pulse" />
              <div className="mt-2 h-4 bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (relatedItems.length === 0) {
    return null;
  }

  const linkPrefix = type === 'movie' ? '/movies' : '/tvshows';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <h2 className="text-2xl sm:text-3xl font-bold text-white mb-6">
        More Like &quot;{title}&quot;
      </h2>
      
      <div className="relative group/row">
        {/* Left scroll button */}
        <motion.button
          onClick={() => scroll('left')}
          className={`absolute left-0 sm:-left-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/80 text-white backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all duration-300 shadow-2xl ${
            canScrollLeft ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Scroll left"
        >
          <ChevronLeftIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>

        {/* Scroll container */}
        <div
          ref={scrollContainerRef}
          {...dragScrollProps}
          className="horizontal-scroll-container flex gap-3 sm:gap-4 overflow-x-auto overflow-y-visible pb-4 pt-2 scrollbar-none snap-x snap-mandatory px-1 sm:px-3"
          style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {relatedItems.map((item) => (
            <div key={item.id} className="min-w-[140px] sm:min-w-[160px] md:min-w-[180px] max-w-[180px] snap-start snap-always">
              <CardWithHover
                id={item.id}
                type={type}
                title={item.title || item.name || ''}
                posterPath={item.poster_path ? `https://image.tmdb.org/t/p/w400${item.poster_path}` : ''}
                onWatchClick={() => router.push(`${linkPrefix}/${item.id}`)}
                onDetailsClick={() => router.push(`${linkPrefix}/${item.id}`)}
              >
                <Link href={`${linkPrefix}/${item.id}`}>
                  <motion.div
                    whileHover={{ scale: 1.05, y: -5 }}
                    className="relative rounded-xl overflow-hidden shadow-lg cursor-pointer group bg-gray-900 border border-white/5"
                  >
                    <div className="w-full aspect-[2/3] bg-gray-800 flex items-center justify-center relative overflow-hidden">
                      {item.poster_path ? (
                        <Image
                          src={`https://image.tmdb.org/t/p/w400${item.poster_path}`}
                          alt={item.title || item.name || 'Poster'}
                          fill
                          className="object-cover group-hover:scale-110 transition-transform duration-500"
                          sizes="(max-width: 640px) 140px, (max-width: 768px) 160px, 180px"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-700">
                          <span className="text-3xl">{type === 'movie' ? '🎬' : '📺'}</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>

                    <div className="absolute bottom-0 inset-x-0 p-3 flex flex-col justify-end translate-y-2 group-hover:translate-y-0 transition-transform duration-300">
                      <h3 className="text-white font-semibold text-sm sm:text-base line-clamp-1 drop-shadow-md">
                        {item.title || item.name}
                      </h3>
                      <div className="text-gray-300 text-xs mt-1 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                        {type === 'movie' ? 'Movie' : 'TV Show'}
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </CardWithHover>
            </div>
          ))}
        </div>

        {/* Right scroll button */}
        <motion.button
          onClick={() => scroll('right')}
          className={`absolute right-0 sm:-right-4 top-1/2 -translate-y-1/2 z-20 p-2 sm:p-3 rounded-full bg-black/80 text-white backdrop-blur-md border border-white/10 hover:bg-white hover:text-black transition-all duration-300 shadow-2xl ${
            canScrollRight ? 'opacity-0 group-hover/row:opacity-100' : 'opacity-0 pointer-events-none'
          }`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label="Scroll right"
        >
          <ChevronRightIcon className="w-5 h-5 sm:w-6 sm:h-6" />
        </motion.button>

      </div>
    </div>
  );
}
