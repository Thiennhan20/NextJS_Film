'use client'

import { useEffect, useState, useCallback, useRef } from 'react'

// Định nghĩa kiểu TVShow
interface TVShow {
    id: number
    name: string
    duration: string
    year: number | ''
    firstAirDate?: string
    creator: string
    cast: unknown[]
    genre: string
    description: string
    poster: string
    backdrop: string
    trailer: string
    tvShowUrl: string
    scenes: string[]
    totalSeasons?: number
    totalEpisodes?: number
}

// Nguonc.com API types
interface NguoncEpisodeItem {
    name: string;
    slug: string;
    embed: string;
    m3u8: string;
}

interface NguoncEpisodeServer {
    server_name: string;
    items: NguoncEpisodeItem[];
}

interface NguoncCategory {
    [key: string]: {
        group: { id: string; name: string };
        list: { id: string; name: string }[];
    };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface NguoncMovie {
    id: string;
    name: string;
    slug: string;
    original_name: string;
    thumb_url: string;
    poster_url: string;
    description: string;
    total_episodes: number;
    current_episode: string;
    time: string;
    quality: string;
    language: string;
    director: string;
    casts: string;
    episodes: NguoncEpisodeServer[];
    category?: NguoncCategory;
}

// Helper: normalize text for comparison (strip special chars, lowercase)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeForCompare(text: string): string {
    return text
        .toLowerCase()
        .replace(/[:\-–—.,'"!?()\[\]{}‘’“”]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper: check if a search result's name/slug contains a season number
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function extractSeasonFromTitle(name: string, slug: string): number | null {
    const text = `${name} ${slug}`.toLowerCase();
    // Match patterns: "phần 2", "phan 2", "season 2", "mùa 2", "mua 2", "s02", "s2"
    const patterns = [
        /ph[aầ]n\s*(\d+)/i,
        /season\s*(\d+)/i,
        /m[uù]a\s*(\d+)/i,
        /\bs(\d{1,2})\b/i,
    ];
    for (const p of patterns) {
        const m = text.match(p);
        if (m) return parseInt(m[1]);
    }
    // Check trailing number in slug: "toan-chuc-phap-su-2" -> season 2
    const slugTrailing = slug.match(/-(\d+)$/);
    if (slugTrailing) return parseInt(slugTrailing[1]);
    // Check trailing number in name: "Toàn Chức Pháp Sư 2" -> season 2
    const nameTrailing = name.trim().match(/\s(\d+)$/);
    if (nameTrailing) return parseInt(nameTrailing[1]);
    return null;
}

// Helper: check if a title/slug contains any season indicator (including trailing number)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function titleContainsSeason(name: string, slug?: string): boolean {
    const text = name.toLowerCase();
    if (/ph[aầ]n\s*\d/i.test(text) ||
        /season\s*\d/i.test(text) ||
        /m[uù]a\s*\d/i.test(text) ||
        /\bs\d{1,2}\b/i.test(text) ||
        /\s\d+$/.test(name.trim())) return true;
    if (slug && /-(\d+)$/.test(slug)) return true;
    return false;
}
interface WatchNowTVShowsServer3Props {
    tvShow: TVShow;
    selectedSeason: number;
    selectedEpisode: number;
    server1Ready?: boolean;
    onLinksChange?: (links: { vietsub: string; dubbed: string; m3u8: string }) => void;
    onLoadingChange?: (loading: boolean) => void;
    onSearchComplete?: (completed: boolean) => void;
}

// Nguonc.com search result item
// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface NguoncSearchItem {
    name: string;
    slug: string;
    original_name: string;
    thumb_url: string;
    poster_url: string;
    total_episodes: number;
    current_episode: string;
    quality: string;
    language: string;
    director?: string;
}

export default function WatchNowTVShowsServer3({
    tvShow,
    selectedSeason,
    selectedEpisode,
    server1Ready,
    onLinksChange,
    onLoadingChange,
    onSearchComplete
}: WatchNowTVShowsServer3Props) {
    // Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchCompleted, setSearchCompleted] = useState(false);
    const [autoSearchDone, setAutoSearchDone] = useState(false);

    // Sync outward
    useEffect(() => {
        if (onLoadingChange) {
            onLoadingChange(isSearching);
        }
    }, [isSearching, onLoadingChange]);

    useEffect(() => {
        if (onSearchComplete) {
            onSearchComplete(searchCompleted);
        }
    }, [searchCompleted, onSearchComplete]);

    // Cache episodes data for quick episode switching
    const [cachedEpisodes, setCachedEpisodes] = useState<NguoncEpisodeServer[] | null>(null);

    // Track which episode the server already returned correct links for
    // This prevents the client-side useEffect from overwriting server results
    const lastSearchEpisodeRef = useRef<number>(0);

    // Search using the backend API
    const searchAndFetch = useCallback(async (keyword: string) => {
        if (!keyword.trim()) return;

        setIsSearching(true);
        setSearchCompleted(false);
        setCachedEpisodes(null);

        try {
            const normalizedTitle = tvShow?.name?.toLowerCase().trim() || '';
            const tmdbYear = tvShow?.year || (tvShow?.firstAirDate ? parseInt(tvShow.firstAirDate.substring(0, 4)) : 0);
            const season = selectedSeason || 1;
            const episode = selectedEpisode || 1;


            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/server3/search-tv?keyword=${encodeURIComponent(keyword.trim())}&name=${encodeURIComponent(normalizedTitle)}&year=${tmdbYear}&season=${season}&episode=${episode}`);
            const data = await res.json();

            if (data.status === 'success' && data.data) {
                lastSearchEpisodeRef.current = episode;
                setCachedEpisodes(data.data.detail.episodes);
                if (onLinksChange) onLinksChange(data.data.links);
            } else {
            }
        } catch {
        } finally {
            setIsSearching(false);
            setSearchCompleted(true);
            if (onSearchComplete) onSearchComplete(true);
        }
    }, [tvShow?.name, tvShow?.year, tvShow?.firstAirDate, selectedSeason, selectedEpisode, onLinksChange, onSearchComplete]);



    // Auto-search: wait for server1 to finish, then search by TV show name
    useEffect(() => {
        if (autoSearchDone || !tvShow?.name || !server1Ready) return;
        searchAndFetch(tvShow.name);
        setAutoSearchDone(true);
    }, [tvShow?.name, autoSearchDone, searchAndFetch, server1Ready]);

    // Re-search when season changes (different season = different entry on nguonc.com)
    useEffect(() => {
        if (!autoSearchDone || !tvShow?.name) return;
        setCachedEpisodes(null);
        if (onLinksChange) onLinksChange({ vietsub: '', dubbed: '', m3u8: '' });
        searchAndFetch(tvShow.name);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedSeason]);

    // When episode changes, extract links from cached data
    // Skip if server already returned correct links for this episode
    useEffect(() => {
        if (!cachedEpisodes || selectedEpisode <= 0) return;
        // Server already returned correct links for this episode via searchAndFetch
        if (lastSearchEpisodeRef.current === selectedEpisode) return;


        let bestVietsub = '';
        let bestDubbed = '';
        let fallback = '';

        for (const epServer of cachedEpisodes) {
            // Normalize diacritics (strip Vietnamese accents) before matching
            const serverName = (epServer.server_name || '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .toLowerCase();
            const isVietsub = serverName.includes('vietsub');
            const isDubbed = serverName.includes('thuyet minh') || serverName.includes('long tieng') || serverName.includes('dubbed');

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const targetEpisode = epServer.items?.find((ep: any) => {
                const n = ep.name?.toLowerCase() || '';
                const epStr = selectedEpisode.toString();
                const epStrPadded = epStr.padStart(2, '0');
                return n === `tập ${epStr}` ||
                    n === `episode ${epStr}` ||
                    n === epStr ||
                    n === `tập ${epStrPadded}` ||
                    n === `tap-${epStr}` ||
                    n === `tap-${epStrPadded}` ||
                    ep.slug === `tap-${epStr}` ||
                    ep.slug === `tap-${epStrPadded}`;
            });

            if (targetEpisode) {
                const link = targetEpisode.embed || targetEpisode.m3u8 || '';
                if (isVietsub && !bestVietsub) bestVietsub = link;
                else if (isDubbed && !bestDubbed) bestDubbed = link;
                else if (!fallback) fallback = link;
            }
        }

        const links = {
            vietsub: bestVietsub || fallback,
            dubbed: bestDubbed,
            m3u8: fallback || bestVietsub || bestDubbed
        };
        
        if (links.vietsub || links.dubbed || links.m3u8) {
        } else {
        }
        
        if (onLinksChange) onLinksChange(links);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedEpisode, cachedEpisodes]);

    return null;
}
