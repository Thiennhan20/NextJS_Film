'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { extractOriginalUrl } from '@/lib/hlsProxy'

interface TVShow {
  id: number;
  name: string;
  year: number | '';
}

interface EpisodeStream {
  name?: string;
  link_m3u8?: string;
  link_embed?: string;
}

interface EpisodeServer {
  server_name?: string;
  server_data?: EpisodeStream[];
  episode_number?: number;
  name?: string;
}

export interface EpisodePlaylistItem {
  episode_number: number;
  title?: string;
  vietsub?: string;
  dubbed?: string;
  m3u8?: string;
}

interface WatchNowTVShowsServer1Props {
  tvShow: TVShow;
  selectedSeason: number;
  selectedEpisode: number;
  onLinksChange: (links: { embed: string; m3u8: string; vietsub: string; dubbed: string }) => void;
  onLoadingChange: (loading: boolean) => void;
  onSearchComplete: (completed: boolean) => void;
  onDataReadyChange: (ready: boolean) => void;
  onEpisodeStreamsChange?: (episodes: EpisodePlaylistItem[]) => void;
}

const normalizeForCompare = (value?: string) => {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\u0111/g, 'd')
    .replace(/\s+/g, ' ')
    .trim();
};

const getEpisodeNumberFromName = (name?: string): number | null => {
  const normalized = normalizeForCompare(name);
  if (!normalized) return null;

  const prefixed = normalized.match(/\b(?:tap|episode|ep|e)\s*[:#._-]?\s*0*(\d{1,4})(?=\D|$)/i);
  if (prefixed) return Number(prefixed[1]);

  const leadingNumber = normalized.match(/^0*(\d{1,4})(?=\D|$)/);
  if (leadingNumber) return Number(leadingNumber[1]);

  return null;
};

const isEpisodeNameMatch = (name: string | undefined, episodeNumber: number) => {
  return getEpisodeNumberFromName(name) === episodeNumber;
};

const findEpisodeStream = (server: EpisodeServer, episodeNumber: number) => {
  return server.server_data?.find(ep => isEpisodeNameMatch(ep.name, episodeNumber));
};

const episodesContainSelectedEpisode = (episodes: EpisodeServer[] | undefined, episodeNumber: number) => {
  if (!episodes || episodeNumber <= 0) return false;

  return episodes.some(ep => {
    if (typeof ep.episode_number === 'number' && ep.episode_number === episodeNumber) return true;
    if (isEpisodeNameMatch(ep.name, episodeNumber)) return true;
    return !!findEpisodeStream(ep, episodeNumber);
  });
};

const getEpisodeUrl = (episode?: EpisodeStream) => {
  const rawUrl = episode?.link_m3u8 || episode?.link_embed || '';
  return extractOriginalUrl(rawUrl);
};

const isVietsubServer = (serverName?: string) => {
  return normalizeForCompare(serverName).includes('vietsub');
};

const isDubbedServer = (serverName?: string) => {
  const normalized = normalizeForCompare(serverName);
  return normalized.includes('thuyet minh') ||
    normalized.includes('long tieng') ||
    normalized.includes('dubbed');
};

const buildEpisodePlaylist = (episodesData: EpisodeServer[] | undefined): EpisodePlaylistItem[] => {
  if (!episodesData || episodesData.length === 0) return [];

  const episodeMap = new Map<number, EpisodePlaylistItem>();

  for (const episodeServer of episodesData) {
    const serverData = episodeServer.server_data || [];
    const isVietsub = isVietsubServer(episodeServer.server_name);
    const isDubbed = isDubbedServer(episodeServer.server_name);

    for (const stream of serverData) {
      const episodeNumber = getEpisodeNumberFromName(stream.name);
      const episodeUrl = getEpisodeUrl(stream);

      if (!episodeNumber || !episodeUrl) continue;

      const current = episodeMap.get(episodeNumber) || {
        episode_number: episodeNumber,
        title: stream.name,
      };

      if (isVietsub && !current.vietsub) {
        current.vietsub = episodeUrl;
      } else if (isDubbed && !current.dubbed) {
        current.dubbed = episodeUrl;
      } else if (!current.m3u8) {
        current.m3u8 = episodeUrl;
      }

      if (!current.title && stream.name) {
        current.title = stream.name;
      }

      episodeMap.set(episodeNumber, current);
    }
  }

  return Array.from(episodeMap.values())
    .sort((a, b) => a.episode_number - b.episode_number);
};

export default function WatchNowTVShowsServer1({
  tvShow,
  selectedSeason,
  selectedEpisode,
  onLinksChange,
  onLoadingChange,
  onSearchComplete,
  onDataReadyChange,
  onEpisodeStreamsChange
}: WatchNowTVShowsServer1Props) {
  const { id } = useParams();

  const [episodesData, setEpisodesData] = useState<EpisodeServer[] | null>(null);

  const [tvShowLinks, setTVShowLinks] = useState({
    embed: '',
    m3u8: '',
    vietsub: '',
    dubbed: '',
    seasonChanged: false,
    currentSeason: 0,
  });

  const hasInitializedSubtitles = useRef(false);

  useEffect(() => {
    if (tvShow?.name && tvShow?.year && !hasInitializedSubtitles.current) {
      hasInitializedSubtitles.current = true;
      fetch(`/api/subtitles?query=${encodeURIComponent(tvShow.name)}&year=${tvShow.year.toString()}`)
        .then(res => res.json())
        .then(() => { })
        .catch(() => { });
    }
  }, [tvShow?.name, tvShow?.year]);

  // Xử lý khi season thay đổi để trigger tìm kiếm lại
  useEffect(() => {
    // Chỉ đánh dấu khi season thay đổi, không phải episode
    if ((tvShowLinks.m3u8 || tvShowLinks.vietsub || tvShowLinks.dubbed) &&
      tvShowLinks.currentSeason !== selectedSeason) {
      setTVShowLinks(links => ({ ...links, seasonChanged: true }));
    }
  }, [selectedSeason, tvShowLinks.m3u8, tvShowLinks.vietsub, tvShowLinks.dubbed, tvShowLinks.currentSeason]);

  // Main useEffect - giống như code gốc, chỉ có 1 useEffect duy nhất
  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    async function fetchPhimApiEmbed() {
      // Let parent episode-reset effects run before a cached result marks data ready.
      await Promise.resolve();
      if (cancelled) return;

      // Nếu đã có audio links cho season hiện tại thì không cần tìm kiếm lại
      const hasEpisodeInCache = episodesContainSelectedEpisode(episodesData || undefined, selectedEpisode);

      if (tvShowLinks.currentSeason === selectedSeason && !tvShowLinks.seasonChanged &&
        (tvShowLinks.vietsub || tvShowLinks.dubbed || tvShowLinks.m3u8) && hasEpisodeInCache) {
        let vietsubLink = '';
        let dubbedLink = '';
        let m3u8Link = '';

        // Xử lý khi episode thay đổi - cập nhật audio links từ episodesData có sẵn
        if (episodesData && selectedEpisode > 0) {
          for (const episode of episodesData) {
            const targetEpisode = findEpisodeStream(episode, selectedEpisode);
            const episodeUrl = getEpisodeUrl(targetEpisode);

            if (targetEpisode && episodeUrl) {
              if (isVietsubServer(episode.server_name)) {
                vietsubLink = episodeUrl;
              } else if (isDubbedServer(episode.server_name)) {
                dubbedLink = episodeUrl;
              } else if (!m3u8Link) {
                m3u8Link = episodeUrl;
              }
            }
          }

        }

        if (cancelled) return;
        const cachedLinks = {
          embed: '',
          m3u8: m3u8Link,
          vietsub: vietsubLink,
          dubbed: dubbedLink,
          seasonChanged: false,
          currentSeason: selectedSeason
        };

        setTVShowLinks(cachedLinks);
        onLinksChange({
          embed: '',
          m3u8: m3u8Link,
          vietsub: vietsubLink,
          dubbed: dubbedLink
        });
        onLoadingChange(false);
        onSearchComplete(true);
        onDataReadyChange(true);
        onEpisodeStreamsChange?.(buildEpisodePlaylist(episodesData || undefined));
        return;
      }

      // Nếu season thay đổi, reset tvShowLinks để tìm kiếm lại
      if (tvShowLinks.seasonChanged) {
        setTVShowLinks(links => ({
          ...links,
          m3u8: '',
          vietsub: '',
          dubbed: '',
          seasonChanged: false,
          currentSeason: 0
        }));
        setEpisodesData(null);
        onEpisodeStreamsChange?.([]);
        onDataReadyChange(false);
        return;
      }
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

      onLoadingChange(true);
      onSearchComplete(false);
      onDataReadyChange(false);


      timeoutId = setTimeout(() => {
        // Timeout handler
      }, 60000);
      try {
        if (typeof id !== 'string') {
          return;
        }
        let slug = null;

        // Helper to detect season number from text (declared outside if block for wider scope)
        const detectSeasonInText = (text: string): number | null => {
            const patterns = [
              /ph[aầ]n[-\s]*(\d+)/i,
              /season[-\s]*(\d+)/i,
              /m[uù]a[-\s]*(\d+)/i,
              /part[-\s]*(\d+)/i,
              /\bs(\d{1,2})\b/i,
            ];
            for (const p of patterns) {
              const m = text.match(p);
              if (m) return parseInt(m[1], 10);
            }
            // Check trailing number in slug-like text: "abc-2"
            const trailing = text.match(/-(\d+)$|\s(\d+)$/);
            if (trailing) {
              const num = parseInt(trailing[1] || trailing[2], 10);
              if (num < 100) return num;
            }
            return null;
          };

        // OPTIMIZED: Sequential search with early exit on high-confidence match
        let tmdbDerivedBaseNames: string[] = []; // Store base names from TMDB for search fallback

        if (tvShow?.name) {
          const originNameWithSeason = `${tvShow.name} (Season ${selectedSeason})`;
          const normalizedName = tvShow.name.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();

          // Unified scoring function
          const scoreMatch = (item: {
            tmdb?: { id?: string | number };
            origin_name?: string;
            name?: string;
            slug?: string;
          }): number => {
            let score = 0;

            // Detect what season this item belongs to
            const itemText = `${item.name || ''} ${item.origin_name || ''} ${item.slug || ''}`.toLowerCase();
            const itemSeason = detectSeasonInText(itemText);

            // CRITICAL: If item clearly belongs to a DIFFERENT season, heavily penalize
            if (itemSeason !== null && itemSeason !== selectedSeason) {
              score -= 200;
            }

            if (item.tmdb?.id && String(item.tmdb.id) === String(id)) score += 100;
            if (item.origin_name && item.origin_name.toLowerCase() === originNameWithSeason.toLowerCase()) score += 90;

            if (item.origin_name) {
              const originLower = item.origin_name.toLowerCase();
              if (originLower.includes(`season ${selectedSeason}`) || originLower.includes(`(season ${selectedSeason})`)) score += 70;
            }

            if (item.name) {
              const nameLower = item.name.toLowerCase();
              const seasonPatterns = [`phần ${selectedSeason}`, `part ${selectedSeason}`, `season ${selectedSeason}`, `mùa ${selectedSeason}`];

              for (const pattern of seasonPatterns) {
                if (nameLower.includes(pattern)) {
                  score += 60;
                  break;
                }
              }

              if (nameLower.includes(normalizedName)) score += 30;
              if (nameLower === tvShow.name.toLowerCase()) score += 40;
            }

            if (item.origin_name && item.origin_name.toLowerCase().includes(tvShow.name.toLowerCase())) score += 25;
            if (item.slug && item.slug.toLowerCase().includes(normalizedName.replace(/\s+/g, '-'))) score += 15;

            return score;
          };

          // Helper function to search and score
          const searchAndScore = async (keyword: string, strategyName: string) => {
            try {
              const url = `${apiUrl}/server1/search?keyword=${encodeURIComponent(keyword)}`;
              const res = await fetch(url);
              const data = await res.json();

              if (data?.status === 'success' && Array.isArray(data?.data?.items)) {
                let bestMatch = null;
                let bestScore = 0;

                for (const item of data.data.items) {
                  const score = scoreMatch(item);
                  if (score > 0) {
                  }
                  if (score > bestScore) {
                    bestScore = score;
                    bestMatch = item;
                  }
                }

                if (bestMatch?.slug && bestScore > 0) {
                  return {
                    slug: bestMatch.slug,
                    name: bestMatch.name || '',
                    score: bestScore,
                    strategy: strategyName
                  };
                } else {
                }
              } else {
              }
            } catch {
            }
            return null;
          };

          try {
            // Step 1: Direct TMDB TV lookup (fastest, most reliable)
            try {
              const tmdbRes = await fetch(`${apiUrl}/server1/tmdb/tv/${id}`);
              const tmdbData = await tmdbRes.json();
              if (tmdbData?.status === true && tmdbData?.movie?.slug) {
                const apiSlug = tmdbData.movie.slug;
                const apiName = tmdbData.movie.name || '';
                const apiOriginName = tmdbData.movie.origin_name || '';
                
                // Trích xuất số Session từ tên hoặc slug
                const extractSeason = (text: string): number | null => {
                  const patterns = [
                      /ph[aầ]n[-\s]*(\d+)/i,
                      /season[-\s]*(\d+)/i,
                      /m[uù]a[-\s]*(\d+)/i,
                      /part[-\s]*(\d+)/i,
                      /\bs(\d{1,2})\b/i,
                  ];
                  for (const p of patterns) {
                      const m = text.match(p);
                      if (m) return parseInt(m[1], 10);
                  }
                  const trailing = text.match(/-(\d+)$|\s(\d+)$/);
                  if (trailing) {
                    const num = parseInt(trailing[1] || trailing[2], 10);
                    if (num < 100) return num;
                  }
                  return null;
                };

                const textToSearch = `${apiName} ${apiOriginName} ${apiSlug}`.toLowerCase();
                const detectedSeason = extractSeason(textToSearch);

                if (detectedSeason === selectedSeason) {
                  slug = apiSlug;
                } else if (!detectedSeason && selectedSeason === 1) {
                  slug = apiSlug;
                } else {
                  
                  // Strategy A: Try to construct the correct slug by replacing the season number
                  if (detectedSeason) {
                    // Replace season patterns in slug: "phan-1" → "phan-6", "-season-1" → "-season-6"
                    const slugVariants = [
                      apiSlug.replace(`phan-${detectedSeason}`, `phan-${selectedSeason}`),
                      apiSlug.replace(`season-${detectedSeason}`, `season-${selectedSeason}`),
                      apiSlug.replace(`mua-${detectedSeason}`, `mua-${selectedSeason}`),
                      apiSlug.replace(new RegExp(`-${detectedSeason}$`), `-${selectedSeason}`),
                    ].filter(s => s !== apiSlug); // Filter out unchanged slugs
                    
                    for (const trySlug of slugVariants) {
                      try {
                        const tryRes = await fetch(`${apiUrl}/server1/detail/${trySlug}`);
                        const tryData = await tryRes.json();
                        if (tryData?.episodes && Array.isArray(tryData.episodes) && tryData.episodes.length > 0) {
                          // Verify this detail data belongs to the correct season
                          const tryText = `${tryData.movie?.name || ''} ${tryData.movie?.origin_name || ''} ${trySlug}`.toLowerCase();
                          const trySeason = detectSeasonInText(tryText);
                          if (trySeason === selectedSeason || (trySeason === null && selectedSeason === 1)) {
                            slug = trySlug;
                            break;
                          }
                        }
                      } catch {
                        // Slug doesn't exist, try next
                      }
                    }
                  }
                  
                  // Strategy B: Extract base names from TMDB result for search fallback
                  // "Quanzhi Fashi (Season 1)" → "Quanzhi Fashi"
                  // "Toàn Chức Pháp Sư (Phần 1)" → "Toàn Chức Pháp Sư"
                  if (!slug) {
                    const stripSeason = (name: string): string => {
                      return name
                        .replace(/\s*\(?\s*(?:season|phần|part|mùa)\s*\d+\s*\)?\s*$/i, '')
                        .replace(/\s+\d+\s*$/, '')
                        .trim();
                    };
                    const tmdbOriginBase = stripSeason(apiOriginName);
                    const tmdbViBase = stripSeason(apiName);
                    
                    if (tmdbOriginBase || tmdbViBase) {
                      tmdbDerivedBaseNames = [tmdbOriginBase, tmdbViBase].filter(Boolean);
                    }
                  }
                }
              } else {
              }
            } catch {
            }

            // Step 2: If TMDB lookup failed, fall back to text search strategies
            if (!slug) {
              
              // Build search priorities — include base names from TMDB if available
              const searchPriorities: Array<{ keyword: string; name: string; minScore: number }> = [
                { keyword: originNameWithSeason, name: 'Origin name', minScore: 80 },
                { keyword: `${normalizedName} phần ${selectedSeason}`, name: 'Vietnamese', minScore: 60 },
              ];
              
              // Add TMDB-derived base names with season
              if (tmdbDerivedBaseNames.length > 0) {
                for (const baseName of tmdbDerivedBaseNames) {
                  searchPriorities.push(
                    { keyword: `${baseName} (Season ${selectedSeason})`, name: `TMDB base: ${baseName} + season`, minScore: 60 },
                    { keyword: `${baseName} phần ${selectedSeason}`, name: `TMDB base VN: ${baseName} + phần`, minScore: 60 },
                    { keyword: baseName, name: `TMDB base: ${baseName}`, minScore: 50 },
                  );
                }
              }
              
              searchPriorities.push(
                { keyword: tvShow.name, name: 'Show name', minScore: 40 }
              );

              let bestResult = null;
              let bestScore = 0;

              // Try each keyword sequentially, but stop early if we get a high-confidence match
              for (const { keyword, name, minScore } of searchPriorities) {
                const result = await searchAndScore(keyword, name);

                if (result && result.score > bestScore) {
                  bestScore = result.score;
                  bestResult = result;

                  // Early exit if we have a high-confidence match
                  if (result.score >= minScore) {
                    slug = result.slug;
                    break;
                  }
                }
              }

              // If no early exit, use best result found — but ONLY if score is positive (not season-mismatched)
              if (!slug && bestResult && bestResult.score > 0) {
                slug = bestResult.slug;
              } else if (!slug && bestResult && bestResult.score <= 0) {
              }
            } // end if (!slug)
          } catch {
            // Search error
          }
        }

        if (!slug) {
          onEpisodeStreamsChange?.([]);
          return;
        }

        const detailRes = await fetch(`${apiUrl}/server1/detail/${slug}`);
        const detailData = await detailRes.json();

        // Kiểm tra xem phim này có episodes của season đang được chọn không
        let hasSeasonEpisodes = false;
        let finalDetailData = detailData;

        if (detailData.episodes && Array.isArray(detailData.episodes)) {
          // FIRST: Verify the detail data actually belongs to the correct season
          // by checking the movie name/slug for season indicators
          const detailMovieName = detailData.movie?.name || '';
          const detailOriginName = detailData.movie?.origin_name || '';
          const detailSlug = detailData.movie?.slug || slug || '';
          const detailText = `${detailMovieName} ${detailOriginName} ${detailSlug}`.toLowerCase();
          const detailSeason = detectSeasonInText(detailText);

          // If the detail data clearly belongs to a different season, skip it
          if (detailSeason !== null && detailSeason !== selectedSeason) {
            hasSeasonEpisodes = false;
          } else {
            // Season matches or no season detected — check for episode
            hasSeasonEpisodes = episodesContainSelectedEpisode(detailData.episodes, selectedEpisode);
          }
        }

        // Nếu không có episodes của season này, tìm kiếm lại với từ khóa khác
        if (!hasSeasonEpisodes) {

          // Thử tìm kiếm với từ khóa có thêm season
          const seasonKeywords = [
            `${tvShow?.name?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()} phần ${selectedSeason}`,
            `${tvShow?.name?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()} part ${selectedSeason}`,
            `${tvShow?.name?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()} season ${selectedSeason}`,
            `${tvShow?.name?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()} tập ${selectedEpisode}`,
            `${tvShow?.name?.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim()} episode ${selectedEpisode}`
          ];

          for (const seasonKeyword of seasonKeywords) {
            const altUrl = `${apiUrl}/server1/search?keyword=${encodeURIComponent(seasonKeyword)}`;

            try {
              const altRes = await fetch(altUrl);
              const altData = await altRes.json();

              if (altData.status === 'success' && altData.data?.items?.length > 0) {
                // Score all items using season detection to pick correct season
                let bestAltItem = null;
                let bestAltScore = -Infinity;
                for (const item of altData.data.items) {
                  const itemText = `${item.name || ''} ${item.origin_name || ''} ${item.slug || ''}`.toLowerCase();
                  const itemSeason = detectSeasonInText(itemText);
                  let s = 0;
                  // Penalize wrong season
                  if (itemSeason !== null && itemSeason !== selectedSeason) {
                    s -= 200;
                  } else if (itemSeason === selectedSeason) {
                    s += 100; // Exact season match bonus
                  }
                  // Name similarity
                  if (item.origin_name?.toLowerCase().includes(tvShow?.name?.toLowerCase() || '')) s += 25;
                  if (item.slug?.toLowerCase().includes(tvShow?.name?.toLowerCase().replace(/[^\\w\\s]/g, '').replace(/\\s+/g, '-').trim() || '')) s += 15;
                  if (s > bestAltScore) {
                    bestAltScore = s;
                    bestAltItem = item;
                  }
                }

                // Only use if score is positive (correct season)
                if (bestAltItem && bestAltScore > 0) {
                  // Kiểm tra lại với phim mới
                  const altDetailRes = await fetch(`${apiUrl}/server1/detail/${bestAltItem.slug}`);
                  const altDetailData = await altDetailRes.json();

                  if (altDetailData.episodes && Array.isArray(altDetailData.episodes)) {
                    // Verify season from detail data
                    const altDetailText = `${altDetailData.movie?.name || ''} ${altDetailData.movie?.origin_name || ''} ${altDetailData.movie?.slug || bestAltItem.slug}`.toLowerCase();
                    const altDetailSeason = detectSeasonInText(altDetailText);

                    if (altDetailSeason !== null && altDetailSeason !== selectedSeason) {
                      continue; // Skip this wrong-season result
                    }

                    if (episodesContainSelectedEpisode(altDetailData.episodes, selectedEpisode)) {
                      slug = bestAltItem.slug;
                      finalDetailData = altDetailData;
                      hasSeasonEpisodes = true;
                      break;
                    }
                  }
                }
              }
            } catch {
            }
          }
        }

        // Tìm episode chính xác dựa trên selectedEpisode
        let vietsubLink = '';
        let dubbedLink = '';
        let defaultEmbed = '';

        if (finalDetailData.episodes && Array.isArray(finalDetailData.episodes)) {

          for (const episode of finalDetailData.episodes) {
            // Tìm episode có số thứ tự tương ứng
            const targetEpisode = findEpisodeStream(episode, selectedEpisode);
            const episodeUrl = getEpisodeUrl(targetEpisode);

            if (targetEpisode && episodeUrl) {

              // Phân loại theo server_name
              if (isVietsubServer(episode.server_name)) {
                vietsubLink = episodeUrl;
              } else if (isDubbedServer(episode.server_name)) {
                dubbedLink = episodeUrl;
              } else {
                defaultEmbed = defaultEmbed || episodeUrl;
              }
            } else {
            }
          }

          // Fallback: lấy episode đầu tiên nếu không tìm thấy episode cụ thể
          if (!vietsubLink && !dubbedLink && !defaultEmbed && selectedEpisode === 1) {
            const firstEpisode = finalDetailData.episodes[0]?.server_data?.[0];
            if (firstEpisode) {
              defaultEmbed = getEpisodeUrl(firstEpisode);
            }
          }
        }

        // Fallback: sử dụng link_embed gốc nếu có
        if (!vietsubLink && !dubbedLink && !defaultEmbed && selectedEpisode === 1 && finalDetailData.link_embed) {
          defaultEmbed = finalDetailData.link_embed.includes('?url=')
            ? finalDetailData.link_embed.split('?url=')[1]
            : finalDetailData.link_embed;
        }

        // Lưu episodes data để tái sử dụng khi đổi episode
        if (cancelled) return;
        const finalEpisodesData = Array.isArray(finalDetailData.episodes) ? finalDetailData.episodes : null;
        setEpisodesData(finalEpisodesData);
        onEpisodeStreamsChange?.(buildEpisodePlaylist(finalEpisodesData || undefined));

        // Cập nhật tvShowLinks với tất cả audio options

        const updatedLinks = {
          embed: '',
          m3u8: defaultEmbed,
          vietsub: vietsubLink,
          dubbed: dubbedLink,
          seasonChanged: false,
          currentSeason: selectedSeason
        };

        if (vietsubLink || dubbedLink || defaultEmbed) {
        } else {
        }

        setTVShowLinks(updatedLinks);

        // Notify parent
        onLinksChange({
          embed: '',
          m3u8: defaultEmbed,
          vietsub: vietsubLink,
          dubbed: dubbedLink
        });

      } catch {
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (!cancelled) {
          onLoadingChange(false);
          onSearchComplete(true);
          onDataReadyChange(true);
        }
      }
    }
    fetchPhimApiEmbed();
    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, tvShow?.name, selectedSeason, selectedEpisode]);

  return null;
}
