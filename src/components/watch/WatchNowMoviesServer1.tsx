'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'

interface Movie {
  id: number;
  title: string;
  duration: string;
  year: number | '';
  releaseDate?: string;
  director: string;
  cast: unknown[];
  genre: string;
  description: string;
  poster: string;
  backdrop: string;
  trailer: string;
  movieUrl: string;
  scenes: string[];
}

interface PhimApiEpisode {
  server_name?: string;
  server_data?: Array<{
    name?: string;
    slug?: string;
    link_embed?: string;
  }>;
}

interface PhimApiMovie {
  name?: string;
  title?: string;
  slug?: string;
  origin_name?: string;
  year?: string | number;
  tmdb?: {
    id?: string | number;
  };
  link_embed?: string;
  episodes?: PhimApiEpisode[];
}

interface WatchNowMoviesServer1Props {
  movie: Movie;
  onLinksChange: (links: { embed: string; m3u8: string; vietsub: string; dubbed: string }) => void;
  onLoadingChange: (loading: boolean) => void;
  onSearchComplete: (completed: boolean) => void;
}

export default function WatchNowMoviesServer1({
  movie,
  onLinksChange,
  onLoadingChange,
  onSearchComplete
}: WatchNowMoviesServer1Props) {
  const { id } = useParams();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (movie?.title && movie?.year) {
      onLoadingChange(true);
      fetch(`/api/subtitles?query=${encodeURIComponent(movie.title)}&year=${movie.year.toString()}`)
        .then(res => res.json())
        .then(() => { })
        .catch(() => { })
        .finally(() => onLoadingChange(false));
    }
  }, [movie?.title, movie?.year, onLoadingChange]);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    let timeoutId: NodeJS.Timeout;
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

    async function fetchPhimApiEmbed() {
      onLoadingChange(true);
      onSearchComplete(false);
      timeoutId = setTimeout(() => {
        // Timeout handler
      }, 60000);

      try {
        if (typeof id !== 'string') {
          return;
        }

        let slug = null;

        // UNIFIED STRATEGY: Try TMDB direct API with verification, then search with all keywords in parallel

        // Step 1: Try TMDB ID direct API with title/year verification (HIGHEST PRIORITY)
        try {
          const tmdbDirectUrl = `${apiUrl}/server1/tmdb/movie/${id}`;
          const tmdbDirectRes = await fetch(tmdbDirectUrl);
          const tmdbDirectData = await tmdbDirectRes.json();

          if (tmdbDirectData?.status === true && tmdbDirectData?.movie) {
            const apiMovie = tmdbDirectData.movie;
            const apiName = apiMovie.name || '';
            const apiOriginName = apiMovie.origin_name || '';
            const apiTitle = apiMovie.title || '';
            const apiYear = apiMovie.year;
            const apiSlug = apiMovie.slug;

            // Verify title match - check against name, origin_name, or title
            const normalizedTarget = normalizeTitle(movie?.title || '');
            const nameMatch = normalizeTitle(apiName) === normalizedTarget;
            const originNameMatch = normalizeTitle(apiOriginName) === normalizedTarget;
            const titleMatch = normalizeTitle(apiTitle) === normalizedTarget;

            // Accept if ANY of the title fields match
            const anyTitleMatch = nameMatch || originNameMatch || titleMatch;
            const yearMatch = apiYear && parseInt(String(apiYear)) === (movie?.year as number);

            if (apiSlug && anyTitleMatch && yearMatch) {
              slug = apiSlug;
            } else if (apiSlug && anyTitleMatch) {
              // Accept if title matches even if year is slightly off
              const yearDiff = Math.abs(parseInt(String(apiYear || '0')) - (movie?.year as number || 0));

              if (yearDiff <= 1) {
                slug = apiSlug;
              }
            }
            if (slug) {
            } else {
            }
          } else {
          }
        } catch {
          // TMDB direct API failed
        }

        // Step 2: If TMDB verification fails, search with ALL keywords in parallel
        if (!slug && movie?.title) {

          // Collect ALL keywords from all strategies
          const normalizedTitle = normalizeTitle(movie.title);
          const keywords = extractKeywords(movie.title);
          const titleVariations = [
            movie.title,
            movie.title.replace(/[^\w\s]/g, ''),
            movie.title.toLowerCase(),
            movie.title.split(' ').slice(0, 3).join(' ')
          ];

          // Combine all unique keywords
          const allKeywords = [
            movie.title,           // Original
            normalizedTitle,       // Normalized
            ...keywords,           // Keywords
            ...titleVariations     // Variations
          ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates


          // Search all keywords in parallel using Promise.race
          const searchPromises = allKeywords.map(async (keyword) => {
            const searchResults = await searchPhimApi(keyword, movie.year as number);
            if (searchResults.length > 0) {
              const match = findBestMatch(searchResults, movie.title, movie.year as number, id);
              if (match) {
                return { keyword, match };
              }
            }
            return null;
          });

          // Race all searches - first one to find a match wins
          const result = await Promise.race(
            searchPromises.map(async (promise, index) => {
              const res = await promise;
              return res ? { ...res, index } : null;
            })
          );

          if (result) {
            slug = result.match.slug;
          } else {
            // Wait for all to complete if race didn't find anything
            const allResults = await Promise.all(searchPromises);
            const firstMatch = allResults.find(r => r !== null);
            if (firstMatch) {
              slug = firstMatch.match.slug;
            } else {
            }
          }
        }

        if (!slug) {
          return;
        }

        // Get movie details and extract embed link
        const detailRes = await fetch(`${apiUrl}/server1/detail/${slug}`);
        const detailData = await detailRes.json();

        let vietsubLink = '';
        let dubbedLink = '';
        let defaultEmbed = '';

        // Extract links from episodes
        if (detailData.episodes && detailData.episodes.length > 0) {
          detailData.episodes.forEach((episode: PhimApiEpisode) => {
            const serverName = episode.server_name?.toLowerCase() || '';

            if (episode.server_data && episode.server_data.length > 0) {
              // Check server_name first to determine audio type
              const isVietsub = serverName.includes('vietsub');
              const isDubbed = serverName.includes('thuyết minh') || serverName.includes('lồng tiếng') || serverName.includes('dubbed');

              // If server_name matches, take the first available link from server_data
              if ((isVietsub || isDubbed) && episode.server_data[0]?.link_embed) {
                const linkEmbed = episode.server_data[0].link_embed;

                if (isVietsub && !vietsubLink) {
                  vietsubLink = linkEmbed;
                } else if (isDubbed && !dubbedLink) {
                  dubbedLink = linkEmbed;
                }
              }
            }
          });
        }

        // Try to get embed from direct link as fallback
        if (detailData.link_embed) {
          defaultEmbed = detailData.link_embed;
        }
        // Try to get embed from first episode as fallback
        else if (detailData.episodes && detailData.episodes[0]?.server_data) {
          const firstEpisode = detailData.episodes[0];
          let foundFallback = false;

          for (const serverData of firstEpisode.server_data) {
            const dataName = serverData.name?.toLowerCase() || '';
            const dataSlug = serverData.slug?.toLowerCase() || '';

            if (serverData.link_embed && (
              dataName.includes('full') || dataName.includes('vietsub') ||
              dataSlug.includes('full') || dataSlug.includes('vietsub')
            )) {
              defaultEmbed = serverData.link_embed;
              foundFallback = true;
              break;
            }
          }

          if (!foundFallback && firstEpisode.server_data[0]?.link_embed) {
            defaultEmbed = firstEpisode.server_data[0].link_embed;
          }
        }

        // Clean up URLs if they contain ?url= parameter
        const cleanUrl = (url: string) => {
          if (url && url.includes('?url=')) {
            return url.split('?url=')[1];
          }
          return url;
        };

        vietsubLink = cleanUrl(vietsubLink);
        dubbedLink = cleanUrl(dubbedLink);
        defaultEmbed = cleanUrl(defaultEmbed);

        // Set the appropriate link based on availability
        if (vietsubLink || dubbedLink) {
          const finalLink = vietsubLink || dubbedLink || defaultEmbed;
          onLinksChange({
            embed: '',
            m3u8: finalLink,
            vietsub: vietsubLink,
            dubbed: dubbedLink
          });
          onLoadingChange(false);
          onSearchComplete(true);
        } else if (defaultEmbed) {
          onLinksChange({
            embed: '',
            m3u8: defaultEmbed,
            vietsub: '',
            dubbed: ''
          });
          onLoadingChange(false);
          onSearchComplete(true);
        } else {
        }

      } catch {
        // Error handling
      } finally {
        clearTimeout(timeoutId);
        onLoadingChange(false);
        onSearchComplete(true);
      }
    }

    // Helper function to search PhimAPI
    async function searchPhimApi(keyword: string, year?: number): Promise<PhimApiMovie[]> {
      try {
        let url = `${apiUrl}/server1/search?keyword=${encodeURIComponent(keyword)}`;
        if (year) url += `&year=${year}`;

        const res = await fetch(url);
        const data = await res.json();

        if (data.status === 'success' && data.data && Array.isArray(data.data.items)) {
          return data.data.items;
        }

        return [];
      } catch {
        return [];
      }
    }

    // Helper function to find best matching movie
    function findBestMatch(items: PhimApiMovie[], targetTitle: string, targetYear: number, tmdbId: string): PhimApiMovie | null {
      if (!items || items.length === 0) {
        return null;
      }

      // Priority 1: Exact TMDB ID match
      const tmdbMatch = items.find(item =>
        item.tmdb && item.tmdb.id && item.tmdb.id.toString() === tmdbId.toString()
      );
      if (tmdbMatch) {
        return tmdbMatch;
      }

      // Priority 2: Exact title and year match
      const exactMatch = items.find(item => {
        const titleMatch = normalizeTitle(item.name || item.title || '') === normalizeTitle(targetTitle);
        const yearMatch = item.year && parseInt(String(item.year)) === targetYear;
        return titleMatch && yearMatch;
      });
      if (exactMatch) {
        return exactMatch;
      }

      // Priority 3: Origin name match (similar to slug matching)
      const originNameMatch = items.find(item => {
        if (!item.origin_name) return false;
        const originNameNormalized = normalizeTitle(item.origin_name);
        const targetNormalized = normalizeTitle(targetTitle);
        const similarity = calculateSimilarity(originNameNormalized, targetNormalized);
        const yearDiff = Math.abs(parseInt(String(item.year || '0')) - targetYear);
        return similarity > 0.7 && yearDiff <= 2;
      });
      if (originNameMatch) {
        return originNameMatch;
      }

      // Priority 4: Title match with year tolerance
      const titleMatchWithYearTolerance = items.find(item => {
        const titleMatch = normalizeTitle(item.name || item.title || '') === normalizeTitle(targetTitle);
        const yearDiff = Math.abs(parseInt(String(item.year || '0')) - targetYear);
        return titleMatch && yearDiff <= 1;
      });
      if (titleMatchWithYearTolerance) {
        return titleMatchWithYearTolerance;
      }

      // Priority 5: Fuzzy title match
      const fuzzyMatch = items.find(item => {
        const itemTitle = normalizeTitle(item.name || item.title || '');
        const targetNormalized = normalizeTitle(targetTitle);
        const similarity = calculateSimilarity(itemTitle, targetNormalized);
        const yearDiff = Math.abs(parseInt(String(item.year || '0')) - targetYear);
        return similarity > 0.8 && yearDiff <= 2;
      });
      if (fuzzyMatch) {
        return fuzzyMatch;
      }

      return null;
    }

    // Helper function to normalize title for comparison
    function normalizeTitle(title: string): string {
      return title
        .toLowerCase()
        .replace(/[^\w\s]/g, '') // Remove special characters
        .replace(/\s+/g, ' ')    // Replace multiple spaces with single space
        .trim();
    }

    // Helper function to extract keywords from title
    function extractKeywords(title: string): string[] {
      const normalized = normalizeTitle(title);
      const words = normalized.split(' ').filter(word => word.length > 2);

      // Return combinations: full title, major words, individual significant words
      const keywords = [
        title, // Original title
        normalized, // Normalized title
        ...words.filter(word => word.length > 3) // Significant individual words
      ];

      return [...new Set(keywords)]; // Remove duplicates
    }

    // Helper function to calculate string similarity
    function calculateSimilarity(str1: string, str2: string): number {
      const longer = str1.length > str2.length ? str1 : str2;
      const shorter = str1.length > str2.length ? str2 : str1;

      if (longer.length === 0) return 1.0;

      const distance = levenshteinDistance(longer, shorter);
      return (longer.length - distance) / longer.length;
    }

    // Helper function to calculate Levenshtein distance
    function levenshteinDistance(str1: string, str2: string): number {
      const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));

      for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
      for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

      for (let j = 1; j <= str2.length; j++) {
        for (let i = 1; i <= str1.length; i++) {
          const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
          matrix[j][i] = Math.min(
            matrix[j][i - 1] + 1,     // deletion
            matrix[j - 1][i] + 1,     // insertion
            matrix[j - 1][i - 1] + indicator // substitution
          );
        }
      }

      return matrix[str2.length][str1.length];
    }

    fetchPhimApiEmbed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, movie?.title, movie?.year]);

  return null;
}
