'use client'

import { useEffect, useState, useCallback } from 'react'

// Định nghĩa kiểu Movie
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

interface WatchNowMoviesServer3Props {
    movie: Movie;
    server1Ready?: boolean;
    onLinksChange?: (links: { vietsub: string; dubbed: string; m3u8: string }) => void;
    onLoadingChange?: (loading: boolean) => void;
    onSearchComplete?: (completed: boolean) => void;
}

// Nguonc.com search result item
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

// Helper: normalize text for comparison (strip special chars, lowercase)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function normalizeForCompare(text: string): string {
    return text
        .toLowerCase()
        .replace(/[:\-–—.,'"!?()\[\]{}‘’“”]/g, ' ') // Replace special chars with space
        .replace(/\s+/g, ' ')                     // Collapse multiple spaces
        .trim();
}

// Helper: check if directors match (handles comma-separated lists)
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function directorsMatch(tmdbDirector: string, nguoncDirector: string): boolean {
    if (!tmdbDirector || !nguoncDirector) return false;
    const normalize = (s: string) => s.toLowerCase().trim();
    const tmdbNames = tmdbDirector.split(',').map(normalize);
    const nguoncNames = nguoncDirector.split(',').map(normalize);
    return tmdbNames.some(t => nguoncNames.some(n => n.includes(t) || t.includes(n)));
}

// Function helper to check if strings are similar enough
function isSimilar(str1: string, str2: string): boolean {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '');
    return s1.includes(s2) || s2.includes(s1);
}

// Helper: split title into parts and check if at least one matches
function hasPartialMatch(tmdbTitle: string, nguoncOriginalName: string, nguoncName: string): boolean {
    // split title into words/parts, ignoring special chars
    const getParts = (str: string) => str.toLowerCase().replace(/[:\-()]/g, ' ').split(/\s+/).filter(Boolean);

    const tmdbParts = getParts(tmdbTitle);
    const nguoncOriginalParts = getParts(nguoncOriginalName);
    const nguoncNameParts = getParts(nguoncName);

    // If any significant part matches, consider it a match
    return tmdbParts.some(part =>
        part.length > 3 && (nguoncOriginalParts.includes(part) || nguoncNameParts.includes(part))
    );
}

// Better title matching logic
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _isTitleMatch(tmdbTitle: string, nguoncOriginalName: string, nguoncName: string): boolean {
    // 1. Check strict similarity first
    if (isSimilar(tmdbTitle, nguoncOriginalName) || isSimilar(tmdbTitle, nguoncName)) {
        return true;
    }

    // 2. Try partial match (like main title words)
    if (hasPartialMatch(tmdbTitle, nguoncOriginalName, nguoncName)) {
        return true;
    }

    // 3. Very loose fallback - check if any part of the names overlap
    const tmdbNames = tmdbTitle.toLowerCase().split(/[:\-()\s]/).filter(Boolean);
    const nguoncNames = [nguoncOriginalName, nguoncName].join(' ').toLowerCase().split(/[:\-()\s]/).filter(Boolean);

    return tmdbNames.some(t => nguoncNames.some(n => n.includes(t) || t.includes(n)));
}
export default function WatchNowMoviesServer3({
    movie,
    server1Ready,
    onLinksChange,
    onLoadingChange,
    onSearchComplete
}: WatchNowMoviesServer3Props) {
    // Search state
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_searchInput, setSearchInput] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchCompleted, setSearchCompleted] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_searchError, setSearchError] = useState('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_nguoncMovie, setNguoncMovie] = useState<NguoncMovie | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [_searchResults, setSearchResults] = useState<NguoncSearchItem[]>([]);
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



    // Search by keyword, then fetch film detail for the best match
    const searchAndFetch = useCallback(async (keyword: string) => {
        if (!keyword.trim()) return;

        setIsSearching(true);
        setSearchCompleted(false);
        setSearchError('');
        setNguoncMovie(null);
        setSearchResults([]);
        if (onLinksChange) onLinksChange({ vietsub: '', dubbed: '', m3u8: '' });


        try {
            const normalizedTitle = movie?.title?.toLowerCase().trim() || '';
            const tmdbYear = movie?.year || (movie?.releaseDate ? parseInt(movie.releaseDate.substring(0, 4)) : 0);
            const tmdbDirector = movie?.director || '';

            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
            const res = await fetch(`${apiUrl}/server3/search-movie?keyword=${encodeURIComponent(keyword.trim())}&name=${encodeURIComponent(normalizedTitle)}&year=${tmdbYear}&director=${encodeURIComponent(tmdbDirector)}`);
            const data = await res.json();

            if (data.status === 'success' && data.data) {
                setNguoncMovie(data.data.detail);
                if (onLinksChange) onLinksChange(data.data.links);
            } else {
                setSearchError('Movie not available on this server.');
            }
        } catch {
            setSearchError('Search failed. Please try again.');
        } finally {
            setIsSearching(false);
            setSearchCompleted(true);
            if (onSearchComplete) onSearchComplete(true);
        }
    }, [movie?.title, movie?.year, movie?.releaseDate, movie?.director, onLinksChange, onSearchComplete]);

    // Auto-search: wait for server1 to finish, then search by movie title
    useEffect(() => {
        if (autoSearchDone || !movie?.title || !server1Ready) return;
        setSearchInput(movie.title);
        searchAndFetch(movie.title);
        setAutoSearchDone(true);
    }, [movie?.title, autoSearchDone, searchAndFetch, server1Ready]);

    return null;
}
