'use client';

import { useState, useEffect, Suspense, useMemo, useCallback, useRef } from 'react';
import { PlusIcon as Plus, HashtagIcon as Hash, ArrowRightIcon as ArrowRight, SignalIcon as Radio, ClipboardDocumentIcon as Copy, CheckIcon as Check, ArrowRightOnRectangleIcon as LogIn, FilmIcon as Film, TvIcon as Tv, ClockIcon as Clock, UsersIcon as Users, TrashIcon as Trash2, ArrowPathIcon as RefreshCw, ExclamationTriangleIcon as AlertTriangle, XMarkIcon as X, InformationCircleIcon as Info, SparklesIcon as Sparkles, QuestionMarkCircleIcon as HelpCircle, MagnifyingGlassIcon as Search, ExclamationCircleIcon as ExclamationCircle, ChevronDownIcon as ChevronDown, ChevronUpIcon as ChevronUp, ChevronDoubleLeftIcon as ChevronDoubleLeft, ChevronDoubleRightIcon as ChevronDoubleRight } from '@heroicons/react/24/outline';
import { StarIcon as Star } from '@heroicons/react/24/solid';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import useAuthStore from '@/store/useAuthStore';
import api from '@/lib/axios';
import { useTranslations } from 'next-intl';

interface Particle {
  x: number;
  y: number;
  size: number;
  duration: number;
  xOffset: number;
  yOffset: number;
  scale: number;
}

interface ActiveRoom {
  room_id: string;
  title: string;
  host_id: string;
  host_name: string;
  host_avatar: string;
  status: string;
  member_count: number;
  max_users: number;
  created_at: number;
  ttl_seconds: number;
  content_type?: string;
  season?: number | null;
  current_episode?: number | null;
}

// Helper to accurately identify TV Show vs Movie
const isTvShowRoom = (room: ActiveRoom): boolean => {
  if (room.content_type === 'tvshow') return true;
  if (room.content_type === 'movie') return false;
  if (room.season || room.current_episode) return true;
  const title = room.title || '';
  return /\b(s\d+\s*e\d+|s\d+|e\d+|ep\s*\d+|ep\.\d+|season\s*\d+|tập\s*\d+|episode\s*\d+|ss\d+|ss\s*\d+)\b/i.test(title) ||
    /[-_\s](s\d+|e\d+|ep\d+|tập\s*\d+)/i.test(title);
};

function StreamingLobbyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const t = useTranslations('StreamingLobby');

  // Pre-filled params from Stream button
  const streamUrlFromParams = searchParams.get('streamUrl') || '';
  const titleFromParams = searchParams.get('title') || '';
  const movieIdFromParams = searchParams.get('movieId') || '';
  const posterFromParams = searchParams.get('poster') || '';
  const rawTypeFromParams = searchParams.get('type') || '';
  const seasonFromParams = searchParams.get('season') || '';
  const episodeFromParams = searchParams.get('episode') || '';
  const typeFromParams = rawTypeFromParams === 'tvshow' || rawTypeFromParams === 'movie'
    ? rawTypeFromParams
    : (seasonFromParams || episodeFromParams || /\b(s\d+\s*e\d+|s\d+|e\d+|ep\s*\d+|ep\.\d+|season\s*\d+|tập\s*\d+|episode\s*\d+|ss\d+|ss\s*\d+)\b/i.test(titleFromParams) ? 'tvshow' : 'movie');
  const audioFromParams = searchParams.get('audio') || '';
  const playlistKeyFromParams = searchParams.get('playlistKey') || '';

  // State
  const [joinRoomId, setJoinRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingRoomId: string;
    audio: string;
  } | null>(null);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [showMobileGuide, setShowMobileGuide] = useState(false);
  const [deleteConfirmRoomId, setDeleteConfirmRoomId] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<{
    roomId: string;
    title: string;
    streamUrl: string;
    hostName: string;
    expiresAt: string;
    playlistKey?: string;
  } | null>(null);

  // Has stream info from player
  const hasStreamInfo = !!streamUrlFromParams;

  // Recent watched stream items
  interface RecentStreamItem {
    id: string;
    title: string;
    poster: string;
    streamUrl: string;
    movieId: string;
    type: 'movie' | 'tvshow';
    season?: number | null;
    episode?: number | null;
    audio?: string;
    source: 'watched' | 'history';
  }

  interface MoviePopupDetail {
    title: string;
    overview: string;
    poster: string;
    backdrop?: string;
    releaseDate?: string;
    voteAverage?: number;
    duration?: string;
    genres?: string[];
    type?: 'movie' | 'tvshow';
    movieId?: string;
  }

  const [recentItems, setRecentItems] = useState<RecentStreamItem[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);
  const [creatingRecentId, setCreatingRecentId] = useState<string | null>(null);
  const [isQuickPickExpanded, setIsQuickPickExpanded] = useState(false);
  const [isLeftSidebarCollapsed, setIsLeftSidebarCollapsed] = useState(false);
  const [recentError, setRecentError] = useState('');
  const [recentDuplicateInfo, setRecentDuplicateInfo] = useState<{
    existingRoomId: string;
    audio: string;
  } | null>(null);

  // Movie Details Popup states
  const [selectedMovieItem, setSelectedMovieItem] = useState<RecentStreamItem | null>(null);
  const [movieDetailData, setMovieDetailData] = useState<MoviePopupDetail | null>(null);
  const [loadingMovieDetail, setLoadingMovieDetail] = useState(false);
  const movieDetailsCacheRef = useRef<Record<string, MoviePopupDetail>>({});

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (user as any)?.id || (user as any)?._id || '';

  // Active rooms list
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [maxRooms, setMaxRooms] = useState(30);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'movie' | 'tvshow'>('all');
  const [showAllRoomsModal, setShowAllRoomsModal] = useState(false);


  // Filtered rooms based on search and selected tab
  const filteredRooms = useMemo(() => {
    return activeRooms.filter(room => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchTitle = (room.title || '').toLowerCase().includes(q);
        const matchId = (room.room_id || '').toLowerCase().includes(q.replace('#', ''));
        const matchHost = (room.host_name || '').toLowerCase().includes(q);
        if (!matchTitle && !matchId && !matchHost) return false;
      }
      const isTV = isTvShowRoom(room);
      if (filterType === 'movie' && isTV) return false;
      if (filterType === 'tvshow' && !isTV) return false;
      return true;
    });
  }, [activeRooms, searchQuery, filterType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAllRoomsModal(false);
        setSelectedMovieItem(null);
      }
    };
    if (showAllRoomsModal || selectedMovieItem) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showAllRoomsModal, selectedMovieItem]);

  // Open movie details popup and fetch TMDB metadata
  const openMovieDetail = useCallback(async (item: RecentStreamItem) => {
    setSelectedMovieItem(item);

    const cacheKey = `${item.movieId || ''}-${item.title}`;
    if (movieDetailsCacheRef.current[cacheKey]) {
      setMovieDetailData(movieDetailsCacheRef.current[cacheKey]);
      setLoadingMovieDetail(false);
      return;
    }

    const initialData: MoviePopupDetail = {
      title: item.title,
      overview: '',
      poster: item.poster,
      type: item.type,
      movieId: item.movieId,
      releaseDate: '',
      voteAverage: 0,
      genres: [],
    };
    setMovieDetailData(initialData);
    setLoadingMovieDetail(true);

    try {
      const isTv = item.type === 'tvshow';
      const isNumericId = /^\d+$/.test(item.movieId || '');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let detailObj: any = null;

      if (isNumericId) {
        try {
          const res = await fetch(`/api/tmdb-bundle?type=${isTv ? 'tv' : 'movie'}&id=${item.movieId}`);
          if (res.ok) {
            const data = await res.json();
            detailObj = data?.detail || null;
          }
        } catch {
          // fallback to search
        }
      }

      if (!detailObj && item.title) {
        try {
          const res = await fetch(`/api/tmdb-proxy?endpoint=/search/multi&query=${encodeURIComponent(item.title)}`);
          if (res.ok) {
            const data = await res.json();
            const results = data?.results || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            detailObj = results.find((r: any) => 
              (r.media_type === (isTv ? 'tv' : 'movie') || !r.media_type) &&
              (r.title || r.name)?.toLowerCase().includes(item.title.toLowerCase())
            ) || results[0] || null;
          }
        } catch {
          // ignore
        }
      }

      if (detailObj) {
        const title = detailObj.title || detailObj.name || item.title;
        const overview = detailObj.overview || '';
        const poster = detailObj.poster_path ? `https://image.tmdb.org/t/p/w500${detailObj.poster_path}` : item.poster;
        const backdrop = detailObj.backdrop_path ? `https://image.tmdb.org/t/p/w780${detailObj.backdrop_path}` : '';
        const releaseDate = detailObj.release_date || detailObj.first_air_date || '';
        const voteAverage = Number(detailObj.vote_average || 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const genres = Array.isArray(detailObj.genres) ? detailObj.genres.map((g: any) => g.name || g) : [];
        const runtimeMinutes = detailObj.runtime || (Array.isArray(detailObj.episode_run_time) ? detailObj.episode_run_time[0] : 0);
        const duration = runtimeMinutes > 0 ? (isTv ? `${runtimeMinutes}m/ep` : `${Math.floor(runtimeMinutes / 60)}h ${runtimeMinutes % 60}m`) : '';

        const fullData: MoviePopupDetail = {
          title,
          overview,
          poster,
          backdrop,
          releaseDate,
          voteAverage,
          duration,
          genres,
          type: item.type,
          movieId: String(detailObj.id || item.movieId || ''),
        };
        movieDetailsCacheRef.current[cacheKey] = fullData;
        setMovieDetailData(fullData);
      }
    } catch (err) {
      console.error('Failed to load movie detail:', err);
    } finally {
      setLoadingMovieDetail(false);
    }
  }, []);

  useEffect(() => {
    const mobileQuery = window.matchMedia('(max-width: 767px), (hover: none), (pointer: coarse)');
    const desktopQuery = window.matchMedia('(min-width: 1024px)');

    const syncViewModes = () => {
      const shouldDisableMotion = mobileQuery.matches;
      setIsMobile(shouldDisableMotion);
      setIsDesktop(desktopQuery.matches);

      if (shouldDisableMotion) {
        setParticles([]);
        return;
      }

      // Reduced to 6 lightweight ambient particles for smooth GPU performance
      const newParticles = Array.from({ length: 6 }).map(() => ({
        x: Math.random() * 90 + 5,
        y: Math.random() * 90 + 5,
        size: Math.random() * 4 + 3, // 3px to 7px
        duration: Math.random() * 10 + 15,
        xOffset: Math.random() * 30 - 15,
        yOffset: Math.random() * -40 - 10,
        scale: Math.random() * 0.3 + 1.1,
      }));
      setParticles(newParticles);
    };

    syncViewModes();
    mobileQuery.addEventListener('change', syncViewModes);
    desktopQuery.addEventListener('change', syncViewModes);

    return () => {
      mobileQuery.removeEventListener('change', syncViewModes);
      desktopQuery.removeEventListener('change', syncViewModes);
    };
  }, []);

  // Auth check helper — shows popup if not authenticated, returns false
  const requireAuth = (): boolean => {
    if (!isAuthenticated) {
      setShowAuthPopup(true);
      return false;
    }
    return true;
  };

  // Fetch active rooms (public API — no auth needed)
  const fetchRooms = async () => {
    setLoadingRooms(true);
    try {
      const res = await api.get('/rooms/public');
      setActiveRooms(res.data.rooms || []);
      if (res.data.max_rooms) setMaxRooms(res.data.max_rooms);
    } catch {
      console.error('Failed to fetch rooms');
    } finally {
      setLoadingRooms(false);
    }
  };

  // Fetch 10 random community movies from different users (Public & Secure with 8h Redis Cache)
  const fetchCommunityPicks = useCallback(async (refresh = false) => {
    setLoadingRecent(true);
    try {
      const url = refresh ? '/rooms/community-picks?refresh=true' : '/rooms/community-picks';
      const res = await api.get(url);
      if (res.data?.success && Array.isArray(res.data?.items)) {
        setRecentItems(res.data.items);
      }
    } catch (err) {
      console.error('Error fetching community picks:', err);
    } finally {
      setLoadingRecent(false);
    }
  }, []);

  useEffect(() => {
    void fetchCommunityPicks();
  }, [fetchCommunityPicks]);



  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);



  const handleDeleteRoom = async () => {
    const roomId = deleteConfirmRoomId;
    if (!roomId) return;
    setDeleteConfirmRoomId(null);
    setDeletingRoomId(roomId);
    try {
      await api.delete(`/rooms/${roomId}`);
      setActiveRooms(prev => prev.filter(r => r.room_id !== roomId));
      if (createdRoom?.roomId === roomId) setCreatedRoom(null);
    } catch {
      setError(t('deleteRoomFailed'));
      setTimeout(() => setError(''), 4000);
    } finally {
      setDeletingRoomId(null);
    }
  };

  const formatTimeLeft = (ttlSeconds: number) => {
    const h = Math.floor(ttlSeconds / 3600);
    const m = Math.floor((ttlSeconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };



  const getRoomStatusLabel = (status: string) => {
    switch (status) {
      case 'PLAYING':
        return t('playing');
      case 'PAUSED':
        return t('paused');
      case 'ENDED':
        return t('ended');
      default:
        return t('waiting');
    }
  };

  // Generate deterministic gradient color for host avatar based on host_id
  const getAvatarGradient = (id: string) => {
    const gradients = [
      'from-rose-500 to-pink-500',
      'from-violet-500 to-purple-500',
      'from-blue-500 to-cyan-500',
      'from-emerald-500 to-teal-500',
      'from-amber-500 to-orange-500',
      'from-red-500 to-rose-500',
      'from-indigo-500 to-blue-500',
      'from-fuchsia-500 to-pink-500',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  // Render Quick Pick & Create card (10 random community titles)
  // Render Quick Pick & Create card (10 random community titles)
  const renderRecentlyWatchedCard = () => (
    <div className="bg-gradient-to-b from-gray-900/95 via-gray-900/85 to-gray-900/95 backdrop-blur-xl border border-white/[0.08] hover:border-purple-500/30 rounded-2xl p-3.5 sm:p-4 shadow-xl shadow-black/25 transition-all flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5 pb-2.5 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-400 shadow-sm shadow-purple-500/10">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              {t('createFromRecent')}
            </h3>
            <span className="text-[10px] text-purple-400 font-semibold">10 {t('communityPicksBadge') || 'phim cộng đồng'}</span>
          </div>
        </div>
        <button
          onClick={() => fetchCommunityPicks(true)}
          disabled={loadingRecent}
          className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1.5 transition-all hover:bg-purple-500/15 border border-purple-500/20 px-2.5 py-1 rounded-xl cursor-pointer disabled:opacity-50 active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:outline-none"
          title={t('shuffleRandom')}
          aria-label={t('shuffleRandom')}
        >
          <RefreshCw className={`w-3 h-3 ${loadingRecent ? 'animate-spin' : ''}`} />
          <span className="font-semibold text-[11px]">{t('shuffleRandom')}</span>
        </button>
      </div>

      {loadingRecent ? (
        <div className="text-center py-8 my-auto">
          <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[11px] text-gray-400">{t('loadingRecent')}</p>
        </div>
      ) : recentItems.length > 0 ? (
        <div className="flex flex-col flex-1 min-h-0">
          <p className="text-[11px] text-gray-400 mb-2.5 line-clamp-1">
            {t('createFromRecentDesc')}
          </p>

          {/* ─── Mobile / Tablet: Horizontal Cinema Card Carousel (Swipeable) ─── */}
          <div className="lg:hidden">
            <div className="flex gap-3 overflow-x-auto pb-2 pt-1 px-0.5 chat-scrollbar snap-x snap-mandatory overscroll-x-contain">
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => openMovieDetail(item)}
                  className="w-[145px] sm:w-[155px] shrink-0 snap-start rounded-2xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.08] hover:border-amber-400/40 p-2.5 flex flex-col justify-between transition-all duration-200 group cursor-pointer shadow-lg hover:shadow-amber-500/5 relative"
                  title={t('viewMovieDetails')}
                >
                  {/* Poster with overlays */}
                  <div className="relative w-full aspect-[2/3] rounded-xl overflow-hidden mb-2 bg-gray-800 shadow-md">
                    {item.poster ? (
                      <Image
                        src={item.poster}
                        alt={item.title}
                        fill
                        unoptimized
                        loading="lazy"
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-purple-500/10">
                        <Film className="w-6 h-6 text-purple-400" />
                      </div>
                    )}

                    {/* Floating Detail (!) button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openMovieDetail(item);
                      }}
                      className="absolute top-1.5 left-1.5 w-6 h-6 rounded-lg bg-black/75 backdrop-blur-sm border border-white/20 text-amber-400 flex items-center justify-center transition-all shadow-md active:scale-90"
                      title={t('viewMovieDetails')}
                    >
                      <ExclamationCircle className="w-3.5 h-3.5" />
                    </button>

                    {/* Floating Type/Audio Badges */}
                    <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none">
                      <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                        item.type === 'tvshow' ? 'bg-blue-500/90 text-white' : 'bg-purple-600/90 text-white'
                      } uppercase shadow-sm`}>
                        {item.type === 'tvshow' ? t('showBadge') : t('movieBadge')}
                      </span>
                      {item.audio && (
                        <span className="px-1 py-0.5 text-[8px] font-bold rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white uppercase shadow-sm">
                          {item.audio}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Episode info */}
                  <div className="mb-2 min-w-0">
                    <p className="text-xs text-white font-bold truncate group-hover:text-amber-300 transition-colors" title={item.title}>
                      {item.title}
                    </p>
                    {item.season && item.episode ? (
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">
                        S{item.season} E{item.episode}
                      </p>
                    ) : (
                      <p className="text-[10px] text-gray-500 truncate mt-0.5">
                        {item.type === 'tvshow' ? t('tvShow') : t('movieBadge')}
                      </p>
                    )}
                  </div>

                  {/* 1-Click Create Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateFromRecent(item);
                    }}
                    disabled={creatingRecentId === item.id || loading}
                    className="w-full py-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-black text-[11px] font-black rounded-xl transition-all flex items-center justify-center gap-1 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
                    title={t('createPartyNow')}
                  >
                    {creatingRecentId === item.id ? (
                      <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Radio className="w-3 h-3" />
                    )}
                    <span>{t('createPartyNow')}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* ─── Desktop: Vertical Cinema List ─── */}
          <div className="hidden lg:block relative">
            <div
              id="desktop-quick-pick-list"
              role="region"
              aria-label={t('createFromRecent')}
              className={`space-y-2 pr-1 overscroll-contain transition-all duration-300 ease-out ${
                isQuickPickExpanded
                  ? 'max-h-[380px] xl:max-h-[420px] overflow-y-auto chat-scrollbar'
                  : 'max-h-[240px] overflow-hidden'
              }`}
            >
              {recentItems.map((item) => (
                <div
                  key={item.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openMovieDetail(item)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openMovieDetail(item);
                    }
                  }}
                  className="flex items-center justify-between gap-2.5 p-2 sm:p-2.5 rounded-xl bg-gradient-to-r from-white/[0.03] to-white/[0.01] hover:from-amber-500/[0.08] hover:to-purple-500/[0.04] border border-white/[0.06] hover:border-amber-400/35 hover:shadow-lg hover:shadow-black/40 transition-all duration-200 group cursor-pointer focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none select-none"
                  title={t('viewMovieDetails')}
                >
                  {/* Exclamation mark icon button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openMovieDetail(item);
                    }}
                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 group-hover:text-amber-300 group-hover:bg-amber-400/20 group-hover:border-amber-400/40 flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-sm active:scale-95 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none"
                    title={t('viewMovieDetails')}
                    aria-label={t('viewMovieDetails')}
                  >
                    <ExclamationCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>

                  {/* Poster + Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    {item.poster ? (
                      <Image
                        src={item.poster}
                        alt={item.title}
                        width={38}
                        height={50}
                        unoptimized
                        loading="lazy"
                        className="w-8 h-11 sm:w-9 sm:h-12 rounded-lg object-cover shrink-0 shadow-md border border-white/10 group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <div className="w-8 h-11 sm:w-9 sm:h-12 rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center shrink-0 border border-white/10 shadow-sm">
                        <Film className="w-4 h-4 text-purple-400/80" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-white font-bold truncate group-hover:text-amber-300 transition-colors leading-tight" title={item.title}>
                        {item.title}
                      </p>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded ${
                          item.type === 'tvshow' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/20' : 'bg-purple-500/20 text-purple-400 border border-purple-500/20'
                        } uppercase tracking-wider`}>
                          {item.type === 'tvshow' ? t('showBadge') : t('movieBadge')}
                        </span>
                        {item.season && item.episode ? (
                          <span className="text-[10px] text-gray-400 font-medium">
                            S{item.season} E{item.episode}
                          </span>
                        ) : null}
                        {item.audio && (
                          <span className="px-1.5 py-0.2 text-[8px] font-semibold rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white uppercase">
                            {item.audio}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 1-Click Create Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateFromRecent(item);
                    }}
                    disabled={creatingRecentId === item.id || loading}
                    className="px-3 py-1.5 bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-300 text-black text-[11px] font-black rounded-xl transition-all shrink-0 flex items-center gap-1 shadow-sm hover:shadow-amber-500/20 cursor-pointer whitespace-nowrap active:scale-95 disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-amber-400/70 focus-visible:outline-none"
                    title={t('createPartyNow')}
                    aria-label={t('createPartyNow')}
                  >
                    {creatingRecentId === item.id ? (
                      <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    ) : (
                      <Radio className="w-3 h-3" />
                    )}
                    <span>{t('createPartyNow')}</span>
                  </button>
                </div>
              ))}
            </div>

            {/* Subtle bottom gradient fade when collapsed (thin edge fade) */}
            {!isQuickPickExpanded && recentItems.length > 4 && (
              <div className="absolute bottom-0 left-0 right-1 h-5 bg-gradient-to-t from-gray-900/80 to-transparent pointer-events-none rounded-b-xl" />
            )}
          </div>

          {/* Expand / Collapse Toggle (Desktop only) */}
          {recentItems.length > 4 && (
            <div className="hidden lg:block mt-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                aria-expanded={isQuickPickExpanded}
                aria-controls="desktop-quick-pick-list"
                onClick={() => setIsQuickPickExpanded(!isQuickPickExpanded)}
                className="w-full py-1.5 px-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] hover:border-purple-500/30 text-xs font-semibold text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all group cursor-pointer shadow-sm active:scale-98 focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:outline-none"
              >
                <span>{isQuickPickExpanded ? t('collapse') : t('expand')}</span>
                {isQuickPickExpanded ? (
                  <ChevronUp className="w-3.5 h-3.5 text-purple-400 group-hover:-translate-y-0.5 transition-transform" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-purple-400 group-hover:translate-y-0.5 transition-transform" />
                )}
              </button>
            </div>
          )}

          {/* Error notice inside recently watched */}
          {recentError && (
            <div className="mt-2 text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-2.5 py-2">
              <p>{recentError}</p>
              {recentDuplicateInfo?.existingRoomId && (
                <button
                  onClick={() => router.push(`/streaming-room?room=${recentDuplicateInfo.existingRoomId}`)}
                  className="mt-1.5 w-full px-2.5 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-[11px] font-semibold rounded hover:from-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-1"
                >
                  <Radio className="h-3 w-3" />
                  {t('goToExistingRoom')} ({recentDuplicateInfo.existingRoomId})
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-5">
          <Film className="w-6 h-6 text-gray-600 mx-auto mb-1.5" />
          <p className="text-xs text-gray-400 mb-1">{t('noRecentWatched')}</p>
          <button
            onClick={() => router.push('/movies')}
            className="text-[11px] text-yellow-400 hover:underline flex items-center gap-1 mx-auto mt-2"
          >
            <span>{t('exploreMovies')}</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}
    </div>
  );

  // Render individual room card
  const renderRoomCard = (room: ActiveRoom, isInsideModal = false) => {
    return (
      <motion.div
        key={room.room_id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl p-3.5 sm:p-4 border transition-all flex flex-col justify-between gap-3 bg-gray-800/60 backdrop-blur-sm border-white/[0.08] hover:border-yellow-500/30 hover:bg-gray-800/80 group"
      >
        {/* Top: Avatar + Room ID & Badges */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Host Avatar */}
          {room.host_avatar ? (
            <Image
              src={room.host_avatar}
              alt={room.host_name}
              width={38}
              height={38}
              unoptimized
              loading="lazy"
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shrink-0 shadow-md border border-gray-600/50"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
              }}
            />
          ) : null}
          <div
            className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br ${getAvatarGradient(
              room.host_id
            )} flex items-center justify-center text-white text-xs sm:text-sm font-bold shrink-0 shadow-md ${
              room.host_avatar ? 'hidden' : ''
            }`}
          >
            {room.host_name?.charAt(0)?.toUpperCase() || '?'}
          </div>

          <div className="min-w-0 flex-grow">
            {/* Room ID row */}
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-xs font-mono font-bold text-yellow-300">#{room.room_id}</span>
            </div>

            {/* Movie type badge + Room status badge on their own separate row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {isTvShowRoom(room) ? (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/10 uppercase tracking-wider shrink-0">
                  {t('showBadge')}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/10 uppercase tracking-wider shrink-0">
                  {t('movieBadge')}
                </span>
              )}
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold rounded-full border shrink-0 ${
                  room.status === 'PLAYING'
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : room.status === 'PAUSED'
                    ? 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  room.status === 'PLAYING' ? 'bg-green-400 animate-pulse' : room.status === 'PAUSED' ? 'bg-amber-400' : 'bg-blue-400'
                }`} />
                {getRoomStatusLabel(room.status)}
              </span>
            </div>
          </div>
        </div>

        {/* Middle: Title & Host (full width, filling space under avatar) */}
        <div className="min-w-0">
          <p className="text-xs sm:text-sm text-white font-semibold truncate group-hover:text-yellow-300 transition-colors" title={room.title || t('untitledRoom')}>
            {room.title || t('untitledRoom')}
          </p>

          <p className="text-[11px] text-gray-400 truncate mt-0.5">
            {t('host')}: <span className="text-gray-300 font-medium">{room.host_name}</span>
          </p>
        </div>

        {/* Bottom: Member Count & Time on left, Actions on right */}
        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.06] mt-auto">
          <div className="flex items-center gap-1.5 sm:gap-2 text-[11px] text-gray-400 shrink-0">
            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.04]" title={t('maxUsersPerRoom')}>
              <Users className="h-3 w-3 text-yellow-400/80" />
              <span className="font-semibold text-gray-300">{room.member_count}/{room.max_users}</span>
            </span>
            <span className="flex items-center gap-1 bg-white/[0.04] px-2 py-1 rounded-md border border-white/[0.04]" title={t('sessionLimit')}>
              <Clock className="h-3 w-3 text-blue-400/80" />
              <span className="font-medium text-gray-300">{formatTimeLeft(room.ttl_seconds)}</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {userId === room.host_id && (
              <button
                onClick={() => setDeleteConfirmRoomId(room.room_id)}
                disabled={deletingRoomId === room.room_id}
                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-red-400/70 focus-visible:outline-none"
                title={t('deleteRoomTitle')}
                aria-label={t('deleteRoomTitle')}
              >
                <Trash2 className={`h-3.5 w-3.5 ${deletingRoomId === room.room_id ? 'animate-spin' : ''}`} />
              </button>
            )}
            <button
              onClick={() => {
                if (!requireAuth()) return;
                if (isInsideModal) setShowAllRoomsModal(false);
                const roomType = isTvShowRoom(room) ? 'tvshow' : 'movie';
                router.push(`/streaming-room?room=${encodeURIComponent(room.room_id)}&type=${roomType}&title=${encodeURIComponent(room.title || '')}`);
              }}
              disabled={room.member_count >= room.max_users && userId !== room.host_id}
              className="px-3.5 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold rounded-lg hover:from-yellow-400 hover:to-amber-400 disabled:from-gray-700 disabled:to-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-all shadow-sm text-center cursor-pointer active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:outline-none"
            >
              {room.member_count >= room.max_users && userId !== room.host_id ? t('full') : t('join')}
            </button>
          </div>
        </div>
      </motion.div>
    );
  };

  const handleCreateRoom = async () => {
    if (!requireAuth()) return;
    if (!streamUrlFromParams) return;

    setLoading(true);
    setError('');
    setDuplicateInfo(null);
    try {
      let episodePlaylist: unknown[] = [];

      if (typeFromParams === 'tvshow' && playlistKeyFromParams && typeof window !== 'undefined') {
        try {
          const storedPlaylist = sessionStorage.getItem(playlistKeyFromParams);
          if (storedPlaylist) {
            const parsed = JSON.parse(storedPlaylist);
            if (Array.isArray(parsed?.episodes)) {
              episodePlaylist = parsed.episodes;
            }
          }
        } catch (playlistError) {
          console.warn('Unable to read TV show watch-party playlist:', playlistError);
        }
      }

      const response = await api.post('/rooms', {
        title: titleFromParams,
        stream_url: streamUrlFromParams,
        movie_id: movieIdFromParams,
        audio: audioFromParams,
        content_type: typeFromParams,
        season: seasonFromParams ? Number(seasonFromParams) : null,
        episode: episodeFromParams ? Number(episodeFromParams) : null,
        episode_playlist: episodePlaylist,
        poster: posterFromParams,
      });

      const { room_id, expires_at } = response.data;

      setCreatedRoom({
        roomId: room_id,
        title: titleFromParams,
        streamUrl: streamUrlFromParams,
        hostName: user?.name || 'Host',
        expiresAt: new Date(expires_at).toISOString(),
        playlistKey: playlistKeyFromParams || undefined,
      });
      void fetchRooms();
    } catch (err: unknown) {
      console.error('Error creating room:', err);
      const axiosErr = err as { response?: { data?: { error?: string; code?: string; existing_room_id?: string } } };
      const errData = axiosErr?.response?.data;

      if (errData?.code === 'DUPLICATE_ROOM') {
        setDuplicateInfo({
          existingRoomId: errData.existing_room_id || '',
          audio: audioFromParams,
        });
        setError(errData.error || t('duplicateRoomError'));
      } else {
        setError(errData?.error || t('createRoomFailed'));
      }
    } finally {
      setLoading(false);
    }
  };

  // 1-Click create room directly from a recently watched item
  const handleCreateFromRecent = async (item: RecentStreamItem) => {
    if (!requireAuth()) return;
    if (!item.streamUrl) return;
    if (activeRooms.length >= maxRooms) {
      setRecentError(t('serverFullWait'));
      return;
    }

    setCreatingRecentId(item.id);
    setRecentError('');
    setRecentDuplicateInfo(null);

    try {
      const response = await api.post('/rooms', {
        title: item.title,
        stream_url: item.streamUrl,
        movie_id: item.movieId,
        audio: item.audio || '',
        content_type: item.type,
        season: item.season,
        episode: item.episode,
        episode_playlist: [],
        poster: item.poster || '',
      });

      const { room_id } = response.data;
      const targetType = item.type || 'movie';
      router.push(`/streaming-room?room=${encodeURIComponent(room_id)}&type=${encodeURIComponent(targetType)}&title=${encodeURIComponent(item.title || '')}`);
    } catch (err: unknown) {
      console.error('Error creating room from recent item:', err);
      const axiosErr = err as { response?: { data?: { error?: string; code?: string; existing_room_id?: string } } };
      const errData = axiosErr?.response?.data;

      if (errData?.code === 'DUPLICATE_ROOM') {
        setRecentDuplicateInfo({
          existingRoomId: errData.existing_room_id || '',
          audio: item.audio || '',
        });
        setRecentError(errData.error || t('duplicateRoomError'));
      } else {
        setRecentError(errData?.error || t('createRoomFailed'));
      }
    } finally {
      setCreatingRecentId(null);
    }
  };



  const handleJoinById = async () => {
    if (!requireAuth()) return;
    if (!joinRoomId.trim()) return;

    setIsJoining(true);
    setJoinError('');

    try {
      // Strip exactly ONE '#' from the beginning if it exists
      let roomId = joinRoomId.trim();
      if (roomId.startsWith('#')) {
        roomId = roomId.substring(1);
      }
      roomId = roomId.toUpperCase();

      // Validate room existence before joining. Use encodeURIComponent to handle special characters like '#' safely.
      await api.get(`/rooms/${encodeURIComponent(roomId)}`);
      
      // If no error, room exists, navigate to it
      router.push(`/streaming-room?room=${encodeURIComponent(roomId)}`);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number, data?: { error?: string } } };
      if (axiosErr?.response?.status === 404) {
        setJoinError(t('roomNotFound'));
      } else {
        console.error('Error joining room:', err);
        setJoinError(axiosErr?.response?.data?.error || t('joinRoomFailed'));
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleGoToRoom = () => {
    if (createdRoom) {
      const params = new URLSearchParams({
        room: createdRoom.roomId,
        streamUrl: createdRoom.streamUrl,
        title: createdRoom.title,
        type: typeFromParams || (createdRoom.playlistKey ? 'tvshow' : 'movie'),
      });
      if (movieIdFromParams) {
        params.set('movieId', movieIdFromParams);
      }
      if (createdRoom.playlistKey) {
        params.set('playlistKey', createdRoom.playlistKey);
      }
      router.push(`/streaming-room?${params.toString()}`);
    }
  };

  const handleCopyInvite = () => {
    if (createdRoom) {
      const inviteUrl = `${window.location.origin}/streaming-room?room=${createdRoom.roomId}`;
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  };



  return (
    <div className="mobile-static-effects min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex justify-center px-4 py-6 relative overflow-y-auto">
      {/* Background Particles (Optimized) */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {!isMobile && particles.map((p, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full blur-[1px] will-change-transform ${
              i % 3 === 0 ? 'bg-yellow-400/20' :
              i % 3 === 1 ? 'bg-purple-400/15' :
              'bg-blue-400/15'
            }`}
            animate={{
              x: [0, p.xOffset, 0],
              y: [0, p.yOffset, 0],
              scale: [1, p.scale, 1],
              opacity: [0.12, 0.3, 0.12],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "linear"
            }}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              transform: 'translateZ(0)',
            }}
          />
        ))}
      </div>

      {/* Glow Effects (Ambient Cinema Lighting & Projector Beam) */}
      <div className="mobile-decorative-motion absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[320px] bg-gradient-to-b from-amber-500/10 via-purple-500/5 to-transparent blur-3xl opacity-60 rounded-full" />
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-yellow-500/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-[1536px] mx-auto px-2.5 sm:px-4 md:px-6">
        {/* Mobile / Tablet Compact Top Banner (< 1024px) */}
        <div className="lg:hidden mb-3 bg-gradient-to-r from-gray-900/95 via-gray-900/90 to-gray-900/95 backdrop-blur-xl border border-white/[0.08] hover:border-amber-400/20 rounded-2xl p-3 sm:p-3.5 shadow-xl shadow-black/25 transition-all">
          <div className="flex items-center justify-between gap-2.5">
            {/* Left: Rooms count & status */}
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Radio className="w-4 h-4 text-amber-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] font-bold text-white uppercase tracking-wider whitespace-nowrap">
                  {t('systemStatus')}
                </span>
                <p className="text-[11px] text-gray-400 truncate mt-0.5">
                  <span className="text-white font-semibold">{activeRooms.length}</span>
                  <span className="text-gray-500">/{maxRooms}</span>
                  <span className="ml-1 text-gray-400">{t('activeRooms')}</span>
                </p>
              </div>
            </div>

            {/* Right: Guide Button */}
            <button
              type="button"
              onClick={() => setShowMobileGuide(!showMobileGuide)}
              className="shrink-0 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl text-xs font-semibold text-amber-300 bg-gradient-to-r from-amber-500/15 to-yellow-500/10 hover:from-amber-500/25 hover:to-yellow-500/20 border border-amber-500/30 active:scale-95 transition-all cursor-pointer whitespace-nowrap shadow-sm shadow-amber-500/10"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>
                {showMobileGuide ? (
                  t('collapse')
                ) : (
                  <>
                    <span className="hidden sm:inline">{t('experienceGuide')}</span>
                    <span className="sm:hidden">{t('guide')}</span>
                  </>
                )}
              </span>
              <ChevronDown className={`w-3.5 h-3.5 text-amber-400/80 transition-transform duration-200 shrink-0 ${showMobileGuide ? 'rotate-180' : ''}`} />
            </button>
          </div>

          {/* Expanded Guide Content */}
          <AnimatePresence>
            {showMobileGuide && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 pt-3 pb-1 border-t border-white/[0.08] space-y-2.5">
                  <div className="relative pl-1 space-y-2.5 text-xs">
                    <div className="absolute left-[11px] top-2.5 bottom-2.5 w-[1.5px] bg-gradient-to-b from-amber-500/40 via-amber-500/20 to-transparent" />

                    <div className="flex items-start gap-2.5 relative">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[9px] shrink-0 shadow-sm shadow-amber-500/30 mt-0.5">
                        1
                      </div>
                      <p className="leading-snug text-gray-300 text-[11px]">{t('experienceStep1')}</p>
                    </div>

                    <div className="flex items-start gap-2.5 relative">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[9px] shrink-0 shadow-sm shadow-amber-500/30 mt-0.5">
                        2
                      </div>
                      <p className="leading-snug text-gray-300 text-[11px]">{t('experienceStep2')}</p>
                    </div>

                    <div className="flex items-start gap-2.5 relative">
                      <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[9px] shrink-0 shadow-sm shadow-amber-500/30 mt-0.5">
                        3
                      </div>
                      <p className="leading-snug text-gray-300 text-[11px]">{t('experienceStep3')}</p>
                    </div>
                  </div>

                  {/* Quick rule note */}
                  <div className="pt-2 border-t border-white/[0.04] flex items-center justify-between text-[10px] text-gray-400">
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3 text-amber-400/80" />
                      <span>{t('maxUsersPerRoom')}: <strong className="text-gray-200">{t('twoUsers')}</strong></span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-blue-400/80" />
                      <span>{t('sessionLimit')}: <strong className="text-gray-200">{t('sixHours')}</strong></span>
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Mobile Quick Navigation Pill Tabs (< 1024px) */}
        <div className="lg:hidden mb-4 flex items-center gap-2 overflow-x-auto pb-1 chat-scrollbar">
          <button
            type="button"
            onClick={() => document.getElementById('section-active-rooms')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer shadow-sm transition-all"
          >
            <Radio className="w-3 h-3 text-amber-400" />
            <span>{t('activeRooms')}</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-400/20 text-amber-300 font-bold">
              {activeRooms.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => document.getElementById('section-create-join')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer shadow-sm transition-all"
          >
            <Plus className="w-3 h-3 text-yellow-400" />
            <span>{t('createRoom')} / {t('joinRoom')}</span>
          </button>

          <button
            type="button"
            onClick={() => document.getElementById('section-quick-picks')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="px-3 py-1.5 rounded-full text-xs font-semibold bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center gap-1.5 whitespace-nowrap active:scale-95 cursor-pointer shadow-sm transition-all"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('createFromRecent')}</span>
          </button>
        </div>

        {/* ─── Main Elastic Grid: 12 Columns on Desktop (3 : 5 : 4) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 items-start">
          {/* ─── Left Sidebar: Unified Lobby Hub (Desktop only) ─── */}
          <div className={`hidden lg:flex flex-col gap-4 col-span-1 transition-all duration-300 ${
            isLeftSidebarCollapsed
              ? 'lg:col-span-1 xl:col-span-1'
              : 'lg:col-span-3 xl:col-span-3'
          }`}>
            {isLeftSidebarCollapsed ? (
              /* ─── Collapsed Slim Vertical Rail ─── */
              <div className="bg-gradient-to-b from-gray-900/90 via-gray-900/80 to-gray-900/90 backdrop-blur-md border border-white/[0.08] hover:border-amber-400/30 rounded-2xl p-2 sm:p-2.5 shadow-xl transition-all flex flex-col items-center gap-3 select-none">
                {/* Expand Button */}
                <button
                  type="button"
                  onClick={() => setIsLeftSidebarCollapsed(false)}
                  className="w-8 h-8 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 flex items-center justify-center transition-all cursor-pointer active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none group"
                  title={t('expand')}
                  aria-label={t('expand')}
                >
                  <ChevronDoubleRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </button>

                <div className="w-full h-[1px] bg-white/[0.06]" />

                {/* 3 Step Badges */}
                <div className="flex flex-col items-center gap-2" title={t('experienceGuide')}>
                  <div
                    className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[10px] shadow-sm shadow-amber-500/30 cursor-pointer hover:scale-110 transition-transform"
                    title={`1. ${t('experienceStep1')}`}
                    onClick={() => setIsLeftSidebarCollapsed(false)}
                  >
                    1
                  </div>
                  <div
                    className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[10px] shadow-sm shadow-amber-500/30 cursor-pointer hover:scale-110 transition-transform"
                    title={`2. ${t('experienceStep2')}`}
                    onClick={() => setIsLeftSidebarCollapsed(false)}
                  >
                    2
                  </div>
                  <div
                    className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[10px] shadow-sm shadow-amber-500/30 cursor-pointer hover:scale-110 transition-transform"
                    title={`3. ${t('experienceStep3')}`}
                    onClick={() => setIsLeftSidebarCollapsed(false)}
                  >
                    3
                  </div>
                </div>

                <div className="w-full h-[1px] bg-white/[0.06]" />

                {/* Active Rooms Mini Counter */}
                <div
                  className="flex flex-col items-center gap-1 py-1 px-1 rounded-lg bg-white/[0.02] border border-white/[0.05] w-full text-center cursor-pointer hover:bg-white/[0.06] transition-colors"
                  title={`${t('activeRooms')}: ${activeRooms.length}/${maxRooms}`}
                  onClick={() => setShowAllRoomsModal(true)}
                >
                  <Radio className="w-3.5 h-3.5 text-amber-400" />
                  <span className="text-[9px] font-bold text-white">{activeRooms.length}/{maxRooms}</span>
                </div>

                {/* Rules Mini Icon */}
                <button
                  type="button"
                  onClick={() => {
                    setIsLeftSidebarCollapsed(false);
                    setShowRules(true);
                  }}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all cursor-pointer"
                  title={t('watchPartyRules')}
                  aria-label={t('watchPartyRules')}
                >
                  <HelpCircle className="w-4 h-4 text-emerald-400" />
                </button>
              </div>
            ) : (
              /* ─── Expanded Full Sidebar ─── */
              <div className="bg-gradient-to-b from-gray-900/90 via-gray-900/80 to-gray-900/90 backdrop-blur-md border border-white/[0.08] hover:border-amber-400/20 rounded-2xl p-4 shadow-xl transition-all space-y-4">
                {/* Hub Header with Collapse Button */}
                <div className="flex items-center justify-between pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLeftSidebarCollapsed(true)}
                      className="p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 hover:text-amber-300 transition-all cursor-pointer active:scale-95 shadow-sm focus-visible:ring-2 focus-visible:ring-amber-400/60 focus-visible:outline-none group"
                      title={t('collapse')}
                      aria-label={t('collapse')}
                    >
                      <ChevronDoubleLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                    </button>
                    <div>
                      <h3 className="text-xs font-bold text-white uppercase tracking-wider">{t('experienceGuide')}</h3>
                    </div>
                  </div>
                </div>

                {/* 3-Step Mini Roadmap */}
                <div className="relative pl-1 space-y-2.5 text-xs">
                  <div className="absolute left-[11px] top-2.5 bottom-2.5 w-[1.5px] bg-gradient-to-b from-amber-500/40 via-amber-500/20 to-transparent" />

                  <div className="flex items-start gap-2.5 relative">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[9px] shrink-0 shadow-sm shadow-amber-500/30 mt-0.5">
                      1
                    </div>
                    <p className="leading-snug text-gray-300 text-[11px]">{t('experienceStep1')}</p>
                  </div>

                  <div className="flex items-start gap-2.5 relative">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[9px] shrink-0 shadow-sm shadow-amber-500/30 mt-0.5">
                      2
                    </div>
                    <p className="leading-snug text-gray-300 text-[11px]">{t('experienceStep2')}</p>
                  </div>

                  <div className="flex items-start gap-2.5 relative">
                    <div className="w-4 h-4 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black font-black flex items-center justify-center text-[9px] shrink-0 shadow-sm shadow-amber-500/30 mt-0.5">
                      3
                    </div>
                    <p className="leading-snug text-gray-300 text-[11px]">{t('experienceStep3')}</p>
                  </div>
                </div>

                {/* Capacity & Live Metrics (Compact Bar) */}
                <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <Radio className="w-3 h-3 text-amber-400" />
                      {t('activeRooms')}
                    </span>
                    <span className="font-semibold text-white">
                      {activeRooms.length} <span className="text-gray-500 font-normal">/ {maxRooms}</span>
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-800/80 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 via-amber-400 to-yellow-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (activeRooms.length / (maxRooms || 30)) * 100)}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 pt-1 text-[10px] text-gray-400 border-t border-white/[0.04]">
                    <div className="flex items-center gap-1">
                      <Users className="w-2.5 h-2.5 text-amber-400/80" />
                      <span>{t('maxUsersPerRoom')}: <strong className="text-gray-200">{t('twoUsers')}</strong></span>
                    </div>
                    <div className="flex items-center gap-1 justify-end">
                      <Clock className="w-2.5 h-2.5 text-blue-400/80" />
                      <span>{t('sessionLimit')}: <strong className="text-gray-200">{t('sixHours')}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Rules Dropdown / Collapsible */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => setShowRules(!showRules)}
                    className="w-full flex items-center justify-between text-[11px] text-emerald-400 hover:text-emerald-300 font-medium py-1 transition-colors cursor-pointer"
                  >
                    <span className="flex items-center gap-1.5">
                      <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                      {t('watchPartyRules')}
                    </span>
                    <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${showRules ? 'rotate-180' : ''}`} />
                  </button>
                  {showRules && (
                    <div className="mt-2 space-y-1.5 text-[11px] text-gray-300 bg-emerald-950/20 border border-emerald-500/15 rounded-xl p-2.5">
                      <div className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        <p>{t('ruleRespect')}</p>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        <p>{t('ruleNoSensitiveSpam')}</p>
                      </div>
                      <div className="flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-emerald-400 mt-1.5 shrink-0 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                        <p>{t('ruleHeadphones')}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── Center Column (Main Content) ─── */}
          <div className={`col-span-1 transition-all duration-300 flex flex-col gap-4 ${
            isLeftSidebarCollapsed
              ? 'lg:col-span-6 xl:col-span-6'
              : 'lg:col-span-5 xl:col-span-5'
          }`}>
            {/* Room Created Card */}
            <AnimatePresence>
              {createdRoom && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  className="mb-2 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-2xl p-4 sm:p-5 border border-yellow-500/30 shadow-2xl"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    <h2 className="text-base sm:text-lg font-bold text-green-300">{t('roomCreatedSuccessfully')}</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs sm:text-sm mb-4">
                    <div className="bg-gray-800/50 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 text-[11px]">{t('roomId')}</span>
                      <p className="text-yellow-300 font-mono font-bold text-sm sm:base">{createdRoom.roomId}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 text-[11px]">{t('host')}</span>
                      <p className="text-white font-semibold truncate">{createdRoom.hostName}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-2.5 sm:p-3 col-span-2">
                      <span className="text-gray-400 text-[11px]">{t('movie')}</span>
                      <p className="text-white font-semibold truncate">{createdRoom.title}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 text-[11px]">{t('status')}</span>
                      <p className="text-blue-300 font-semibold">{t('waiting')}</p>
                    </div>
                    <div className="bg-gray-800/50 rounded-xl p-2.5 sm:p-3">
                      <span className="text-gray-400 text-[11px] flex items-center gap-1"><Clock className="h-3 w-3" /> {t('expires')}</span>
                      <p className="text-gray-300 font-semibold">{t('sixHours')}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={handleGoToRoom}
                      className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-bold rounded-xl hover:from-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm shadow-lg shadow-yellow-500/20 cursor-pointer"
                    >
                      <Radio className="h-4 w-4" />
                      {t('enterRoom')}
                    </button>
                    <button
                      onClick={handleCopyInvite}
                      className="px-4 py-2.5 bg-white/10 text-white font-semibold rounded-xl hover:bg-white/15 transition-all flex items-center justify-center gap-2 text-xs sm:text-sm border border-white/10 cursor-pointer"
                    >
                      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                      {copied ? t('copied') : t('copyInvite')}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Content (Create / Join Room Console) */}
            <div id="section-create-join" className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Create Room */}
              <motion.div
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-gray-900/90 via-gray-900/75 to-gray-950/90 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.08] hover:border-yellow-500/35 transition-all duration-300 shadow-xl shadow-black/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center shadow-sm shadow-yellow-500/10">
                      <Plus className="h-4 w-4 text-yellow-400" />
                    </div>
                    <h2 className="text-lg font-bold text-yellow-300">{t('createRoom')}</h2>
                  </div>

                  {hasStreamInfo ? (
                    <div className="space-y-3">
                      {/* Stream info preview */}
                      <div className="bg-gray-950/60 rounded-xl p-3.5 border border-white/[0.08] shadow-inner">
                        <div className="flex items-center gap-2 mb-2">
                          {typeFromParams === 'tvshow' ? (
                            <Tv className="h-4 w-4 text-blue-400" />
                          ) : (
                            <Film className="h-4 w-4 text-purple-400" />
                          )}
                          <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">
                            {typeFromParams === 'tvshow' ? t('tvShow') : t('movie')}
                          </span>
                        </div>
                        <p className="text-sm text-white font-bold truncate" title={titleFromParams}>
                          {titleFromParams}
                        </p>
                        {typeFromParams === 'tvshow' && seasonFromParams && episodeFromParams && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {t('seasonEpisode', { season: seasonFromParams, episode: episodeFromParams })}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                          <span className="text-xs text-green-400 font-medium">{t('streamReady')}</span>
                          {audioFromParams && (
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white uppercase">
                              {audioFromParams}
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={createdRoom ? handleGoToRoom : handleCreateRoom}
                        disabled={loading || (!createdRoom && activeRooms.length >= maxRooms)}
                        className={`w-full px-4 py-2.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm font-bold shadow-lg ${
                          createdRoom
                            ? 'bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 text-white border border-emerald-400/30 shadow-emerald-900/30 cursor-pointer active:scale-98'
                            : activeRooms.length >= maxRooms
                            ? 'bg-gray-800/90 border border-white/10 text-gray-400 cursor-not-allowed shadow-none'
                            : loading
                            ? 'bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 text-black font-black opacity-80 cursor-wait shadow-yellow-500/20'
                            : 'bg-gradient-to-r from-yellow-500 via-amber-400 to-yellow-500 hover:from-yellow-400 hover:to-amber-300 text-black font-black shadow-yellow-500/20 active:scale-98 cursor-pointer'
                        }`}
                      >
                        {loading ? (
                          <>
                            <div className="w-4 h-4 border-2 border-black/50 border-t-transparent rounded-full animate-spin" />
                            <span>{t('creating')}</span>
                          </>
                        ) : createdRoom ? (
                          <>
                            <Check className="h-4 w-4 text-emerald-100" />
                            <span className="text-white font-bold">{t('roomCreated')}</span>
                          </>
                        ) : activeRooms.length >= maxRooms ? (
                          <>
                            <AlertTriangle className="h-4 w-4 text-amber-400" />
                            <span>{t('serverFullWait')}</span>
                          </>
                        ) : (
                          <>
                            <Radio className="h-4 w-4" />
                            <span>{t('createWatchParty')}</span>
                          </>
                        )}
                      </button>

                      {activeRooms.length >= maxRooms && (
                        <p className="text-xs text-amber-400 bg-amber-900/20 border border-amber-500/20 rounded-lg px-3 py-2 flex items-center gap-1.5">
                          <Clock className="h-3 w-3 shrink-0" />
                          {t('serverFullCap', { current: activeRooms.length, max: maxRooms })}
                        </p>
                      )}

                      {/* Error message */}
                      {error && (
                        <div className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">
                          <p>{error}</p>
                          {duplicateInfo?.existingRoomId && (
                            <button
                              onClick={() => router.push(`/streaming-room?room=${duplicateInfo.existingRoomId}`)}
                              className="mt-2 w-full px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-1.5"
                            >
                              <Radio className="h-3 w-3" />
                              {t('goToExistingRoom')} ({duplicateInfo.existingRoomId})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-5">
                      <div className="w-12 h-12 mx-auto mb-2.5 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shadow-inner">
                        <Film className="h-6 w-6 text-gray-500" />
                      </div>
                      <p className="text-sm text-gray-400 mb-3.5 font-medium">{t('noStreamSelected')}</p>
                      <button
                        onClick={() => setShowInstructions(true)}
                        className="px-4 py-2 bg-white/[0.05] hover:bg-white/[0.08] text-blue-400 font-medium text-xs rounded-xl transition-all border border-white/[0.08] hover:border-blue-500/40 flex items-center gap-2 mx-auto cursor-pointer shadow-sm active:scale-95"
                      >
                        <Info className="w-4 h-4 text-blue-400" />
                        {t('instructionBtn')}
                      </button>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Join Room */}
              <motion.div
                initial={{ opacity: 0, x: 15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
                className="bg-gradient-to-br from-gray-900/90 via-gray-900/75 to-gray-950/90 backdrop-blur-xl rounded-2xl p-5 border border-white/[0.08] hover:border-purple-500/35 transition-all duration-300 shadow-xl shadow-black/20 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shadow-sm shadow-purple-500/10">
                      <Hash className="h-4 w-4 text-purple-400" />
                    </div>
                    <h2 className="text-lg font-bold text-purple-300">{t('joinRoom')}</h2>
                  </div>

                  <div className="space-y-3">
                    <input
                      type="text"
                      value={joinRoomId}
                      onChange={(e) => setJoinRoomId(e.target.value.toUpperCase())}
                      placeholder={t('enterRoomIdPlaceholder')}
                      className="w-full px-4 py-2.5 bg-gray-950/60 border border-white/[0.1] rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500/60 transition-all duration-300 font-mono tracking-wider shadow-inner"
                      onKeyDown={(e) => e.key === 'Enter' && handleJoinById()}
                    />

                    <button
                      onClick={handleJoinById}
                      disabled={!joinRoomId.trim() || isJoining}
                      className={`w-full px-4 py-2.5 rounded-xl transition-all duration-300 flex items-center justify-center gap-2 text-sm font-bold shadow-lg ${
                        !joinRoomId.trim()
                          ? 'bg-gray-800/80 border border-white/10 text-gray-500 cursor-not-allowed shadow-none'
                          : isJoining
                          ? 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 text-white font-bold opacity-80 cursor-wait shadow-purple-500/20'
                          : 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-purple-600 text-white font-bold hover:from-purple-500 hover:to-fuchsia-500 shadow-purple-500/20 active:scale-98 cursor-pointer'
                      }`}
                    >
                      {isJoining ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                          {t('loading')}
                        </>
                      ) : (
                        <>
                          <ArrowRight className="h-4 w-4" />
                          {t('joinRoom')}
                        </>
                      )}
                    </button>

                    {joinError && (
                      <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-xl px-3 py-2 text-center">
                        {joinError}
                      </p>
                    )}

                    <p className="text-xs text-gray-500 text-center pt-1">
                      {t('askHostJoin')}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* ─── Active Rooms List ──────────────────────────── */}
            <motion.div
              id="section-active-rooms"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-6 w-full"
            >
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Radio className="h-4 w-4 text-yellow-400" />
                  {t('activeRooms')}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeRooms.length >= maxRooms
                      ? 'bg-red-500/20 text-red-400'
                      : activeRooms.length >= maxRooms * 0.8
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-yellow-500/20 text-yellow-400'
                  }`}>{activeRooms.length}/{maxRooms}</span>
                </h2>
                <button
                  onClick={fetchRooms}
                  disabled={loadingRooms}
                  className="p-1.5 text-gray-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-800 cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:outline-none"
                  title={t('refresh')}
                  aria-label={t('refresh')}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingRooms ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loadingRooms && activeRooms.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-xs text-gray-500">{t('loadingRooms')}</p>
                </div>
              ) : activeRooms.length === 0 ? (
                <div className="text-center py-6 bg-gray-800/30 rounded-xl border border-gray-700/30">
                  <Radio className="h-6 w-6 text-gray-600 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">{t('noActiveRooms')}</p>
                  <p className="text-xs text-gray-600 mt-0.5">{t('createRoomStart')}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className={`grid grid-cols-1 ${activeRooms.slice(0, 2).length > 1 ? 'sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2' : ''} gap-3`}>
                    {activeRooms.slice(0, 2).map((room) => renderRoomCard(room, false))}
                  </div>

                  {activeRooms.length > 2 && (
                    <button
                      onClick={() => setShowAllRoomsModal(true)}
                      className="w-full py-2.5 px-4 rounded-xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-amber-500/10 to-yellow-500/10 hover:from-yellow-500/20 hover:via-amber-500/20 hover:to-yellow-500/20 text-yellow-400 font-semibold text-xs flex items-center justify-center gap-2 transition-all group shadow-sm hover:border-yellow-500/50 cursor-pointer active:scale-[0.99] focus-visible:ring-2 focus-visible:ring-yellow-500/70 focus-visible:outline-none"
                    >
                      <span>{t('viewAllRooms', { count: activeRooms.length })}</span>
                      <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </button>
                  )}

                  {/* Mobile Quick Pick - only rendered when viewport is mobile/tablet */}
                  {!isDesktop && (
                    <div id="section-quick-picks" className="lg:hidden mt-5">
                      {renderRecentlyWatchedCard()}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </div>

          {/* ─── Right Sidebar (Desktop only) ─── */}
          {isDesktop && (
            <div className={`hidden lg:flex flex-col gap-4 col-span-1 transition-all duration-300 ${
              isLeftSidebarCollapsed
                ? 'lg:col-span-5 xl:col-span-5'
                : 'lg:col-span-4 xl:col-span-4'
            }`}>
              {renderRecentlyWatchedCard()}
            </div>
          )}
        </div>
      </div>

      {/* All Active Rooms Floating Modal */}
      <AnimatePresence>
        {showAllRoomsModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2.5 sm:p-4 md:p-6"
            onClick={() => setShowAllRoomsModal(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="all-rooms-modal-title"
              initial={{ scale: 0.96, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.96, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-gray-900/95 backdrop-blur-2xl rounded-2xl md:rounded-3xl border border-white/10 shadow-2xl w-full max-w-7xl max-h-[92vh] h-[90vh] flex flex-col overflow-hidden text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center shrink-0">
                    <Radio className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <h3 id="all-rooms-modal-title" className="text-base sm:text-lg md:text-xl font-bold text-white tracking-tight">
                      {t('allActiveRoomsModalTitle')}
                    </h3>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold shrink-0 ${
                      activeRooms.length >= maxRooms
                        ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                        : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                    }`}>
                      {activeRooms.length}/{maxRooms}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2">
                  <button
                    onClick={fetchRooms}
                    disabled={loadingRooms}
                    className="p-2 text-gray-400 hover:text-yellow-400 hover:bg-white/5 rounded-xl transition-all cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-yellow-400/60 focus-visible:outline-none"
                    title={t('refresh')}
                    aria-label={t('refresh')}
                  >
                    <RefreshCw className={`w-4 h-4 ${loadingRooms ? 'animate-spin' : ''}`} />
                  </button>
                  <button
                    onClick={() => setShowAllRoomsModal(false)}
                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                    aria-label={t('close')}
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Search and Filter Section inside Modal */}
              <div className="px-4 py-3 sm:px-6 sm:py-4 border-b border-white/[0.06] bg-black/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
                {/* Search input */}
                <div className="relative flex-grow max-w-full sm:max-w-md">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t('searchRoomPlaceholder')}
                    className="w-full pl-10 pr-9 py-2.5 bg-gray-800/80 border border-white/10 rounded-xl text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none focus:border-yellow-500/50 focus-visible:ring-2 focus-visible:ring-yellow-500/40 transition-all"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none rounded"
                      aria-label={t('close')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 chat-scrollbar text-xs sm:text-sm">
                  {(['all', 'movie', 'tvshow'] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setFilterType(tab)}
                      className={`px-3.5 py-2 rounded-xl font-semibold transition-all whitespace-nowrap text-xs cursor-pointer active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-yellow-500/50 focus-visible:outline-none ${
                        filterType === tab
                          ? 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 shadow-sm'
                          : 'bg-white/[0.04] text-gray-400 hover:text-white hover:bg-white/[0.08] border border-transparent'
                      }`}
                    >
                      {tab === 'all' && t('filterAll')}
                      {tab === 'movie' && t('filterMovies')}
                      {tab === 'tvshow' && t('filterShows')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Room Grid List (Scrollable) */}
              <div className="p-4 sm:p-6 overflow-y-auto chat-scrollbar flex-grow">
                {filteredRooms.length === 0 ? (
                  <div className="text-center py-16 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                    <Search className="h-10 w-10 text-gray-500 mx-auto mb-2 opacity-50" />
                    <p className="text-sm text-gray-300 font-medium">{t('noRoomsFound')}</p>
                    {(searchQuery || filterType !== 'all') && (
                      <button
                        onClick={() => { setSearchQuery(''); setFilterType('all'); }}
                        className="mt-3 text-xs text-yellow-400 hover:underline inline-flex items-center gap-1.5 font-semibold bg-yellow-500/10 px-3 py-1.5 rounded-lg border border-yellow-500/20"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {t('filterAll')}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-3.5 sm:gap-4">
                    {filteredRooms.map((room) => renderRoomCard(room, true))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Auth Required Popup */}
      <AnimatePresence>
        {showAuthPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowAuthPopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-gray-800/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/60 shadow-2xl max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowAuthPopup(false)}
                className="absolute top-3 right-3 p-1 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 flex items-center justify-center">
                <LogIn className="h-7 w-7 text-yellow-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t('signInRequired')}</h3>
              <p className="text-sm text-gray-400 mb-5">
                {t('pleaseSignIn')}
              </p>
              <div className="flex gap-2.5 justify-center">
                <button
                  onClick={() => router.push('/login')}
                  className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 transition-all text-sm shadow-lg shadow-yellow-500/20"
                >
                  {t('signIn')}
                </button>
                <button
                  onClick={() => setShowAuthPopup(false)}
                  className="px-5 py-2 bg-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-600 transition-all text-sm border border-gray-600"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Room Confirm Popup */}
      <AnimatePresence>
        {deleteConfirmRoomId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setDeleteConfirmRoomId(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-gray-800/95 backdrop-blur-xl rounded-2xl p-6 border border-gray-700/60 shadow-2xl max-w-sm w-full text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setDeleteConfirmRoomId(null)}
                className="absolute top-3 right-3 p-1 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/20 border border-red-500/30 flex items-center justify-center">
                <Trash2 className="h-7 w-7 text-red-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t('deleteRoomQ')}</h3>
              <p className="text-sm text-gray-400 mb-2">
                {t('closeRoomDesc')}
              </p>
              <p className="text-xs font-mono text-yellow-300/70 mb-5">
                #{deleteConfirmRoomId}
              </p>
              <div className="flex gap-2.5 justify-center">
                <button
                  onClick={handleDeleteRoom}
                  className="px-5 py-2 bg-gradient-to-r from-red-500 to-rose-600 text-white font-semibold rounded-lg hover:from-red-400 hover:to-rose-500 transition-all text-sm shadow-lg shadow-red-500/20"
                >
                  {t('delete')}
                </button>
                <button
                  onClick={() => setDeleteConfirmRoomId(null)}
                  className="px-5 py-2 bg-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-600 transition-all text-sm border border-gray-600"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Popup */}
      <AnimatePresence>
        {showInstructions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setShowInstructions(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-gray-800/95 backdrop-blur-xl rounded-3xl p-6 md:p-8 border border-gray-700/60 shadow-2xl max-w-3xl w-full text-left overflow-y-auto max-h-[90vh] custom-scrollbar"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowInstructions(false)}
                className="absolute top-5 right-5 p-2 text-gray-400 bg-gray-800/80 hover:text-white hover:bg-red-500 transition-all duration-300 rounded-xl border border-gray-700/50 shadow-sm z-10"
              >
                <X className="h-5 w-5" />
              </button>
              
              <div className="flex items-center gap-3 mb-8 border-b border-gray-700/50 pb-5 pr-14">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-inner">
                  <Info className="h-6 w-6 text-blue-400" />
                </div>
                <h3 className="text-xl md:text-2xl font-bold text-white leading-tight">{t('instructionTitle')}</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-8 text-sm text-gray-300">
                <div className="flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-600 flex items-center justify-center font-bold text-yellow-400 text-lg shadow-sm">1</div>
                  <div className="pt-1">
                    <h4 className="font-semibold text-white mb-1.5 text-base">{t('step1Title')}</h4>
                    <p className="leading-relaxed">{t('step1Desc')}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-600 flex items-center justify-center font-bold text-yellow-400 text-lg shadow-sm">2</div>
                  <div className="pt-1">
                    <h4 className="font-semibold text-white mb-1.5 text-base">{t('step2Title')}</h4>
                    <p className="leading-relaxed">{t('step2Desc1')} <span className="px-2 py-1 bg-gradient-to-r from-yellow-500 to-amber-500 text-black rounded-md text-xs font-bold inline-flex items-center gap-1 shadow-sm"><Radio className="w-3 h-3"/>{t('step2Btn')}</span> {t('step2Desc2')}</p>
                    <p className="mt-2 text-xs text-amber-400 flex gap-1.5 items-start bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                      {t('loginRequiredMsg')}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <div className="w-10 h-10 rounded-xl bg-gray-800 border border-gray-600 flex items-center justify-center font-bold text-yellow-400 text-lg shadow-sm">3</div>
                  <div className="pt-1">
                    <h4 className="font-semibold text-white mb-1.5 text-base">{t('step3Title')}</h4>
                    <p className="leading-relaxed">{t('step3Desc1')} <span className="font-medium text-white px-2 py-1 bg-gray-700 rounded-md text-xs border border-gray-500 shadow-sm">{t('step3Btn')}</span> {t('step3Desc2')}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-8 pt-5 border-t border-gray-700/50 flex justify-end">
                <button
                  onClick={() => setShowInstructions(false)}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                  {t('gotIt')}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Movie Details Floating Modal ─────────────────── */}
      <AnimatePresence>
        {selectedMovieItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4"
            onClick={() => setSelectedMovieItem(null)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="movie-detail-modal-title"
              initial={{ scale: 0.95, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className="relative bg-gray-900/95 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden text-left"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Optional Backdrop Banner at top */}
              {movieDetailData?.backdrop && (
                <div className="relative w-full h-36 sm:h-44 overflow-hidden shrink-0">
                  <Image
                    src={movieDetailData.backdrop}
                    alt={movieDetailData.title}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-gray-900/60 to-transparent" />
                </div>
              )}

              {/* Close Button Top Right */}
              <button
                onClick={() => setSelectedMovieItem(null)}
                className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-gray-300 hover:text-white flex items-center justify-center transition-all cursor-pointer active:scale-95 focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                title={t('close')}
                aria-label={t('close')}
              >
                <X className="w-4 h-4" />
              </button>

              {/* Modal Body */}
              <div className={`p-4 sm:p-5 overflow-y-auto chat-scrollbar ${movieDetailData?.backdrop ? '-mt-14 sm:-mt-16 relative z-10' : ''}`}>
                <div className="flex gap-4 items-start mb-4">
                  {/* Poster */}
                  <div className="relative w-24 sm:w-28 aspect-[2/3] rounded-xl overflow-hidden shadow-2xl border border-white/20 shrink-0 bg-gray-800">
                    {movieDetailData?.poster || selectedMovieItem.poster ? (
                      <Image
                        src={movieDetailData?.poster || selectedMovieItem.poster}
                        alt={movieDetailData?.title || selectedMovieItem.title}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500">
                        <Film className="w-8 h-8 text-gray-400" />
                      </div>
                    )}
                  </div>

                  {/* Title & Info */}
                  <div className="min-w-0 flex-grow pt-1">
                    <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                      <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-bold rounded-full uppercase tracking-wider ${
                        selectedMovieItem.type === 'tvshow'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      }`}>
                        {selectedMovieItem.type === 'tvshow' ? t('showBadge') : t('movieBadge')}
                      </span>

                      {selectedMovieItem.season && selectedMovieItem.episode ? (
                        <span className="px-2 py-0.5 text-[9px] sm:text-[10px] font-semibold rounded-full bg-white/10 text-gray-300 border border-white/10">
                          S{selectedMovieItem.season} E{selectedMovieItem.episode}
                        </span>
                      ) : null}

                      {selectedMovieItem.audio && (
                        <span className="px-1.5 py-0.5 text-[9px] font-semibold rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white uppercase">
                          {selectedMovieItem.audio}
                        </span>
                      )}
                    </div>

                    <h3 id="movie-detail-modal-title" className="text-base sm:text-lg font-bold text-white leading-snug mb-1">
                      {movieDetailData?.title || selectedMovieItem.title}
                    </h3>

                    {/* Metadata chips: Rating, Year, Duration */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-300 mt-2">
                      {movieDetailData?.voteAverage ? (
                        <span className="flex items-center gap-1 text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                          <span>{movieDetailData.voteAverage.toFixed(1)}</span>
                        </span>
                      ) : null}

                      {movieDetailData?.releaseDate ? (
                        <span className="text-gray-400">
                          {movieDetailData.releaseDate.slice(0, 4)}
                        </span>
                      ) : null}

                      {movieDetailData?.duration ? (
                        <>
                          <span className="text-gray-600">•</span>
                          <span className="text-gray-400">{movieDetailData.duration}</span>
                        </>
                      ) : null}
                    </div>

                    {/* Genres */}
                    {movieDetailData?.genres && movieDetailData.genres.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {movieDetailData.genres.slice(0, 3).map((g) => (
                          <span
                            key={g}
                            className="px-1.5 py-0.5 text-[10px] rounded bg-white/5 text-gray-400 border border-white/10"
                          >
                            {g}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Synopsis / Overview */}
                <div className="mt-3 pt-3 border-t border-white/10">
                  <h4 className="text-xs font-bold text-gray-300 mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                    <Info className="w-3.5 h-3.5 text-yellow-400" />
                    {t('overview')}
                  </h4>
                  {loadingMovieDetail ? (
                    <div className="space-y-2 py-2">
                      <div className="h-3 bg-white/10 rounded animate-pulse w-full" />
                      <div className="h-3 bg-white/10 rounded animate-pulse w-5/6" />
                      <div className="h-3 bg-white/10 rounded animate-pulse w-4/6" />
                    </div>
                  ) : movieDetailData?.overview ? (
                    <p className="text-xs text-gray-300 leading-relaxed max-h-36 overflow-y-auto pr-1 chat-scrollbar">
                      {movieDetailData.overview}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 italic">
                      {t('noOverview')}
                    </p>
                  )}
                </div>
              </div>

              {/* Modal Footer / Actions */}
              <div className="p-3 sm:p-4 bg-gray-950/60 border-t border-white/10 flex items-center justify-end gap-2.5 shrink-0">
                {movieDetailData?.movieId && (
                  <button
                    onClick={() => {
                      const path = selectedMovieItem.type === 'tvshow'
                        ? `/tvshows/${movieDetailData.movieId}`
                        : `/movies/${movieDetailData.movieId}`;
                      router.push(path);
                    }}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all flex items-center gap-1.5 cursor-pointer active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:outline-none"
                  >
                    <span>{t('viewMoviePage')}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                <button
                  onClick={() => {
                    handleCreateFromRecent(selectedMovieItem);
                    setSelectedMovieItem(null);
                  }}
                  disabled={creatingRecentId === selectedMovieItem.id || loading}
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 text-black text-xs font-bold rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-yellow-400/70 focus-visible:outline-none"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>{t('createPartyNow')}</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StreamingLobby() {
  const t = useTranslations('StreamingLobby');
  return (
    <Suspense fallback={
      <div className="mobile-static-effects min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">{t('loading')}</span>
        </div>
      </div>
    }>
      <StreamingLobbyContent />
    </Suspense>
  );
}
