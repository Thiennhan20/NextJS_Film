'use client'

import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useSearchParams, useRouter } from 'next/navigation'
import EnhancedMoviePlayer from '@/components/common/video-player/EnhancedMoviePlayer'
import useAuthStore from '@/store/useAuthStore'
import {
  applyAudioSettings,
  cleanupAudioNodes,
  DEFAULT_AUDIO_SETTINGS,
  detectBestPresetId,
  AUDIO_PRESETS,
  setupAudioNodes,
  type AudioNodes,
  type AudioSettings,
} from '@/lib/audioUtils'
import { extractOriginalUrl, prepareHlsPlayerSource } from '@/lib/hlsProxy'

import WatchNowMoviesServer1 from './WatchNowMoviesServer1'
import WatchNowMoviesServer2 from './WatchNowMoviesServer2'
import WatchNowMoviesServer3 from './WatchNowMoviesServer3'
import { SignalIcon as Radio, ArrowPathIcon as Loader2 } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import api from '@/lib/axios'

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

interface WatchNowMoviesProps {
  movie: Movie;
}

export default function WatchNowMovies({ movie }: WatchNowMoviesProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = useAuthStore((s) => (s.user as any)?.id || (s.user as any)?._id)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [streamPopup, setStreamPopup] = useState<{ type: 'auth' } | { type: 'duplicate', roomId: string } | null>(null)
  const [isCheckingStream, setIsCheckingStream] = useState(false)
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('Watch');
  const tStreaming = useTranslations('StreamingLobby');

  const [selectedServer, setSelectedServer] = useState<'server1' | 'server2' | 'server3'>('server1');
  const hasInitialized = useRef(false);

  // Read audio parameter from URL
  const audioFromUrl = searchParams.get('audio');

  // Cập nhật URL khi thay đổi server
  const updateServerInUrl = (server: 'server1' | 'server2' | 'server3') => {
    const params = new URLSearchParams(searchParams.toString());
    const currentServer = searchParams.get('server');

    // Chỉ cập nhật nếu server thực sự thay đổi
    if (currentServer !== server) {
      params.set('server', server);
      const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;

      // Nếu đang từ server khác về server1, sử dụng replace để không tạo history entry mới
      if (currentServer !== 'server1' && server === 'server1') {
        router.replace(newUrl, { scroll: false });
      } else {
        router.push(newUrl, { scroll: false });
      }
    }
  };

  // Cập nhật server và URL
  const handleServerChange = (server: 'server1' | 'server2' | 'server3') => {
    if (selectedServer !== server) {
      setSelectedServer(server);
      updateServerInUrl(server);
    }
  };

  const [movieLinks, setMovieLinks] = useState({
    embed: '',
    m3u8: '',
    vietsub: '',
    dubbed: '', // Gộp thuyết minh và lồng tiếng
  });
  const [movieLinksLoading, setMovieLinksLoading] = useState(false);
  const [apiSearchCompleted, setApiSearchCompleted] = useState(false);
  const [selectedAudio, setSelectedAudio] = useState<'vietsub' | 'dubbed' | null>(null);

  // Instant Playback States
  const [savedProgress, setSavedProgress] = useState<{ currentTime: number; watchUrl: string; audio?: string } | null>(null);
  const [hasLoadedSavedProgress, setHasLoadedSavedProgress] = useState(false);
  const [activeWatchUrl, setActiveWatchUrl] = useState<string>('');
  const [isSavedLinkFatalError, setIsSavedLinkFatalError] = useState(false);

  // Load Saved Progress on mount
  useEffect(() => {
    let cancelled = false;
    async function loadProgress() {
      // Clear old progress state first to prevent bleed and race conditions
      setSavedProgress(null);
      setActiveWatchUrl('');
      setIsSavedLinkFatalError(false);
      setHasLoadedSavedProgress(false);
      setApiSearchCompleted(false); // Trigger loading state immediately

      let savedTime = 0;
      let savedWatchUrl = '';
      let savedAudio = '';

      if (userId) {
        try {
          const params = { contentId: String(movie.id), isTVShow: 'false' };
          const resp = await api.get('/recently-watched', { params });
          if (cancelled) return;
          savedTime = resp.data?.item?.currentTime || 0;
          savedWatchUrl = resp.data?.item?.watchUrl || '';
          savedAudio = resp.data?.item?.audio || '';
        } catch { /* ignore */ }
      } else {
        const key = `movie-progress-${movie.id}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const pd = JSON.parse(saved);
            savedTime = pd.currentTime || 0;
            savedWatchUrl = pd.watchUrl || '';
            savedAudio = pd.audio || '';
            if (pd.expiresAt && new Date() > new Date(pd.expiresAt)) {
              localStorage.removeItem(key);
              savedTime = 0;
              savedWatchUrl = '';
              savedAudio = '';
            }
          } catch {
            savedTime = parseFloat(saved) || 0;
          }
        }
      }

      if (cancelled) return;
      if (savedTime > 0 || savedWatchUrl) {
        setSavedProgress({ currentTime: savedTime, watchUrl: savedWatchUrl, audio: savedAudio || undefined });
        if (savedWatchUrl) {
          setActiveWatchUrl(savedWatchUrl);
        }
        if (savedAudio === 'vietsub' || savedAudio === 'dubbed') {
          setSelectedAudio(savedAudio as 'vietsub' | 'dubbed');
        }
      }
      setHasLoadedSavedProgress(true);
    }

    loadProgress();
    return () => {
      cancelled = true;
    };
  }, [movie.id, userId]);

  // Auto-swap on fatal error when background search completes
  useEffect(() => {
    let videoSrc = '';
    if (selectedAudio === 'vietsub' && movieLinks.vietsub) {
      videoSrc = movieLinks.vietsub;
    } else if (selectedAudio === 'dubbed' && movieLinks.dubbed) {
      videoSrc = movieLinks.dubbed;
    } else if (movieLinks.vietsub) {
      videoSrc = movieLinks.vietsub;
    } else if (movieLinks.dubbed) {
      videoSrc = movieLinks.dubbed;
    } else {
      videoSrc = movieLinks.m3u8;
    }

    if (apiSearchCompleted && isSavedLinkFatalError && videoSrc) {
      setActiveWatchUrl(videoSrc);
      setIsSavedLinkFatalError(false);
      const rawVideoSrc = extractOriginalUrl(videoSrc);
      // Update savedProgress to new working source at 0
      setSavedProgress(prev => prev ? { ...prev, watchUrl: rawVideoSrc, currentTime: 0 } : { watchUrl: rawVideoSrc, currentTime: 0 });
      
      // Save it immediately in database or localStorage
      if (userId) {
        api.post('/recently-watched', {
          contentId: String(movie.id), isTVShow: false,
          season: null, episode: null,
          server: selectedServer, audio: selectedAudio || '',
          currentTime: 0, duration: 0,
          title: movie.title, poster: movie.poster,
          watchUrl: rawVideoSrc
        }).catch(() => {});
      } else {
        const key = `movie-progress-${movie.id}`;
        localStorage.setItem(key, JSON.stringify({
          currentTime: 0, duration: 0, title: movie.title, poster: movie.poster,
          server: selectedServer, audio: selectedAudio || '',
          watchUrl: rawVideoSrc,
          lastWatched: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
        }));
      }
    }
  }, [apiSearchCompleted, isSavedLinkFatalError, movieLinks, selectedAudio, userId, movie.id, movie.title, movie.poster, selectedServer]);

  // Reset activeWatchUrl when user manually changes audio
  useEffect(() => {
    if (hasLoadedSavedProgress && savedProgress) {
      const savedAudio = savedProgress.audio || 'vietsub';
      const currentAudio = selectedAudio || 'vietsub';
      if (currentAudio !== savedAudio) {
        setActiveWatchUrl('');
      }
    }
  }, [selectedAudio, savedProgress, hasLoadedSavedProgress]);

  // Server 3 states
  const [server3Links, setServer3Links] = useState({ vietsub: '', dubbed: '', m3u8: '' });
  const [server3Loading, setServer3Loading] = useState(false);
  const [server3SearchCompleted, setServer3SearchCompleted] = useState(false);

  // Đọc server từ URL khi component mount hoặc URL thay đổi
  useEffect(() => {
    const serverFromUrl = searchParams.get('server');
    if (serverFromUrl === 'server1' || serverFromUrl === 'server2' || serverFromUrl === 'server3') {
      setSelectedServer(serverFromUrl);
      hasInitialized.current = true;
    } else {
      // Nếu không có tham số server, mặc định về server1
      setSelectedServer('server1');
      hasInitialized.current = true;
    }
  }, [searchParams]);

  // Sync selectedAudio when audioFromUrl changes
  useEffect(() => {
    const currentLinks = selectedServer === 'server3' ? server3Links : movieLinks;
    if (audioFromUrl === 'vietsub' && currentLinks.vietsub && selectedAudio !== 'vietsub') {
      setSelectedAudio('vietsub');
    } else if (audioFromUrl === 'dubbed' && currentLinks.dubbed && selectedAudio !== 'dubbed') {
      setSelectedAudio('dubbed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFromUrl, movieLinks.vietsub, movieLinks.dubbed, server3Links.vietsub, server3Links.dubbed, selectedAudio, selectedServer]);

  // Server 2 states
  const [server2Link, setServer2Link] = useState('');



  // Tự động chọn audio khi có sẵn, ưu tiên từ URL
  useEffect(() => {
    const currentLinks = selectedServer === 'server3' ? server3Links : movieLinks;
    if (!selectedAudio) {
      // Nếu URL có tham số audio, ưu tiên sử dụng audio từ URL
      if (audioFromUrl === 'dubbed' && currentLinks.dubbed) {
        setSelectedAudio('dubbed');
        return;
      }
      if (audioFromUrl === 'vietsub' && currentLinks.vietsub) {
        setSelectedAudio('vietsub');
        return;
      }

      // Nếu không có audio từ URL hoặc audio từ URL không khả dụng, chọn mặc định
      // Nếu có cả hai, ưu tiên Vietsub
      if (currentLinks.vietsub && currentLinks.dubbed) {
        setSelectedAudio('vietsub');
        return;
      }
      // Nếu chỉ có một loại audio, tự động chọn
      if (currentLinks.vietsub) {
        setSelectedAudio('vietsub');
        return;
      }
      if (currentLinks.dubbed) {
        setSelectedAudio('dubbed');
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieLinks.vietsub, movieLinks.dubbed, server3Links.vietsub, server3Links.dubbed, selectedAudio, audioFromUrl, selectedServer]);

  // Audio hiệu lực để hiển thị ngoài player
  const effectiveAudio = useMemo<('vietsub' | 'dubbed' | null)>(() => {
    const currentLinks = selectedServer === 'server3' ? server3Links : movieLinks;
    if (selectedAudio === 'vietsub' && currentLinks.vietsub) return 'vietsub';
    if (selectedAudio === 'dubbed' && currentLinks.dubbed) return 'dubbed';
    if (currentLinks.vietsub) return 'vietsub';
    if (currentLinks.dubbed) return 'dubbed';
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAudio, movieLinks.vietsub, movieLinks.dubbed, server3Links.vietsub, server3Links.dubbed, selectedServer]);

  // Stream URL hiệu lực cho nút Stream (chỉ Server 1)
  const effectiveStreamUrl = useMemo(() => {
    if (selectedServer !== 'server1') return '';
    if (!apiSearchCompleted || movieLinksLoading) return '';
    if (selectedAudio === 'vietsub' && movieLinks.vietsub) return movieLinks.vietsub;
    if (selectedAudio === 'dubbed' && movieLinks.dubbed) return movieLinks.dubbed;
    if (movieLinks.vietsub) return movieLinks.vietsub;
    if (movieLinks.dubbed) return movieLinks.dubbed;
    return movieLinks.m3u8;
  }, [selectedServer, apiSearchCompleted, movieLinksLoading, selectedAudio, movieLinks.vietsub, movieLinks.dubbed, movieLinks.m3u8]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [audioVideoElement, setAudioVideoElement] = useState<HTMLVideoElement | null>(null);
  const [audioSettings, setAudioSettings] = useState<AudioSettings>({ ...DEFAULT_AUDIO_SETTINGS });
  const audioSettingsRef = useRef(audioSettings);
  const audioNodesRef = useRef<AudioNodes | null>(null);

  // Auto-detect best audio preset on mount and on audio device changes
  useEffect(() => {
    let active = true;
    async function applyDetectedPreset() {
      const bestPresetId = await detectBestPresetId();
      if (!active) return;
      const matchedPreset = AUDIO_PRESETS.find(p => p.id === bestPresetId);
      if (matchedPreset) {
        setAudioSettings(prev => ({ ...prev, ...matchedPreset.settings }));
      }
    }
    applyDetectedPreset();
    const handleDeviceChange = () => { applyDetectedPreset(); };
    if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
      navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    }
    return () => {
      active = false;
      if (typeof window !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.removeEventListener) {
        navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
      }
    };
  }, []);

  const streamBtnRef = useRef<HTMLDivElement>(null);

  const handlePlayerRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setAudioVideoElement(node);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (streamBtnRef.current && !streamBtnRef.current.contains(event.target as Node)) {
        setStreamPopup(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    audioSettingsRef.current = audioSettings;
    if (audioNodesRef.current) {
      applyAudioSettings(audioNodesRef.current, audioSettings);
    }
  }, [audioSettings]);

  // Khởi tạo AudioContext cho trình phát inline của server 1
  useEffect(() => {
    if (selectedServer !== 'server1' || !audioVideoElement) return;
    let cancelled = false;

    (async () => {
      try {
        const nodes = await setupAudioNodes(audioVideoElement, audioSettingsRef.current);
        if (cancelled) {
          cleanupAudioNodes(nodes);
          return;
        }

        audioNodesRef.current = nodes;
      } catch (error) {
        if (!cancelled) {
          console.warn('Unable to setup server 1 audio controls:', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (audioNodesRef.current) {
        cleanupAudioNodes(audioNodesRef.current);
        audioNodesRef.current = null;
      }
    };
  }, [audioVideoElement, selectedServer]);

  // Handler cho nút Stream
  const handleStreamClick = async () => {
    if (!isAuthenticated) {
      setStreamPopup({ type: 'auth' });
      return;
    }
    if (!effectiveStreamUrl) return;

    // Determine effective audio for streaming
    const streamAudio = selectedAudio || (movieLinks.vietsub ? 'vietsub' : movieLinks.dubbed ? 'dubbed' : '');

    // Check for duplicate room first
    setIsCheckingStream(true);
    try {
      const res = await api.get(`/rooms/check-duplicate?movieId=${movie.id}&audio=${streamAudio}`);
      if (res.data.duplicate) {
        setStreamPopup({ type: 'duplicate', roomId: res.data.existing_room_id });
        setIsCheckingStream(false);
        return; // Don't navigate
      }
    } catch (error) {
      console.error('Error checking duplicate room:', error);
      // Proceed to lobby if check fails
    }
    setIsCheckingStream(false);

    const params = new URLSearchParams({
      streamUrl: effectiveStreamUrl,
      title: movie.title,
      movieId: String(movie.id),
      poster: movie.poster || '',
      audio: streamAudio,
    });
    router.push(`/streaming-lobby?${params.toString()}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">
      <h2 className="text-3xl font-bold mb-6">{t('watchNow')}</h2>

      {/* Server 1 Component */}
      <WatchNowMoviesServer1
        movie={movie}
        onLinksChange={(links) => setMovieLinks(links)}
        onLoadingChange={setMovieLinksLoading}
        onSearchComplete={setApiSearchCompleted}
      />

      {/* Server 2 Component */}
      <WatchNowMoviesServer2
        movie={movie}
        onLinkChange={setServer2Link}
      />

      {/* Server 3 Component - Load tự động sau Server 1 */}
      <WatchNowMoviesServer3
        movie={movie}
        server1Ready={apiSearchCompleted}
        onLinksChange={setServer3Links}
        onLoadingChange={setServer3Loading}
        onSearchComplete={setServer3SearchCompleted}
      />

      <div className="mb-4">
        {/* Server Buttons Row */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <button
            className={`whitespace-nowrap px-4 py-2 rounded-md text-sm font-semibold transition-colors ${selectedServer === 'server1' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
            onClick={() => handleServerChange('server1')}
          >
            {t('server1')}
          </button>

          <button
            className={`whitespace-nowrap px-4 py-2 rounded-md text-sm font-semibold transition-colors ${selectedServer === 'server2' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
            onClick={() => handleServerChange('server2')}
          >
            {t('server2')}
          </button>

          <button
            className={`whitespace-nowrap px-4 py-2 rounded-md text-sm font-semibold transition-colors ${selectedServer === 'server3' ? 'bg-amber-700 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
            onClick={() => handleServerChange('server3')}
          >
            {t('server3')}
          </button>
        </div>

        {/* Active Server Options Area */}
        <div className="min-h-[32px]">
          <div className="flex flex-wrap items-center gap-2">
          {selectedServer === 'server1' && (movieLinks.vietsub || movieLinks.dubbed) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300">{t('audio')}</span>
              {movieLinks.vietsub && (
                <button
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${selectedAudio === 'vietsub' ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                  onClick={() => {
                    setSelectedAudio('vietsub');
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('audio', 'vietsub');
                    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
                  }}
                >
                  {t('vietsub')}
                </button>
              )}
              {movieLinks.dubbed && (
                <button
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${selectedAudio === 'dubbed' ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                  onClick={() => {
                    setSelectedAudio('dubbed');
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('audio', 'dubbed');
                    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
                  }}
                >
                  {t('dubbed')}
                </button>
              )}
            </div>
          )}

          {selectedServer === 'server2' && (
            <span className="text-xs text-yellow-300 bg-yellow-900/40 px-2 py-1 rounded">
              {t('adsWarning')}
            </span>
          )}

          {selectedServer === 'server3' && (server3Links.vietsub || server3Links.dubbed) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300">{t('audio')}</span>
              {server3Links.vietsub && (
                <button
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${selectedAudio === 'vietsub' ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                  onClick={() => {
                    setSelectedAudio('vietsub');
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('audio', 'vietsub');
                    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
                  }}
                >
                  {t('vietsub')}
                </button>
              )}
              {server3Links.dubbed && (
                <button
                  className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${selectedAudio === 'dubbed' ? 'bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white' : 'bg-gray-700 text-gray-200 hover:bg-gray-600'}`}
                  onClick={() => {
                    setSelectedAudio('dubbed');
                    const params = new URLSearchParams(searchParams.toString());
                    params.set('audio', 'dubbed');
                    router.push(`${window.location.pathname}?${params.toString()}`, { scroll: false });
                  }}
                >
                  {t('dubbed')}
                </button>
              )}
            </div>
          )}
          </div>

        </div>
      </div>

      {/* Header ngoài player, co giãn theo khung hình */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h3 className="text-white text-xs sm:text-sm md:text-base font-semibold truncate" title={movie.title}>{movie.title}</h3>
          {((selectedServer === 'server1' || selectedServer === 'server3') && effectiveAudio) && (
            <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white whitespace-nowrap">
              {effectiveAudio === 'vietsub' ? t('vietsub') : t('vietnameseDubbed')}
            </span>
          )}
        </div>

        {/* Stream Button — chỉ hiện khi Server 1 đã load xong m3u8 */}
        {selectedServer === 'server1' && effectiveStreamUrl && (
          <div className="relative" ref={streamBtnRef}>
              <button
              onClick={handleStreamClick}
              disabled={isCheckingStream}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs sm:text-sm font-semibold hover:from-yellow-400 hover:to-amber-400 disabled:opacity-70 transition-all duration-300 shadow-lg shadow-yellow-500/20 hover:shadow-yellow-500/40 whitespace-nowrap"
              title={t('startWatchParty')}
            >
              {isCheckingStream ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Radio className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
              <span className="hidden sm:inline">{t('stream')}</span>
            </button>

            {/* Auth/Duplicate notification dropdown */}
            {streamPopup && (
              <div className="absolute top-full right-0 mt-2 p-3 bg-gray-900/95 backdrop-blur-sm border border-yellow-500/30 rounded-xl shadow-2xl z-50 w-64 md:w-72">
                {streamPopup.type === 'auth' ? (
                  <>
                    <p className="text-sm text-white mb-2.5">{t('signInRequired')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push('/login')}
                        className="flex-1 px-3 py-1.5 bg-yellow-500 text-black text-xs font-semibold rounded-lg hover:bg-yellow-400 transition-colors"
                      >
                        {t('signIn')}
                      </button>
                      <button
                        onClick={() => setStreamPopup(null)}
                        className="px-3 py-1.5 bg-gray-700 text-white text-xs font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-red-400 mb-2.5 font-medium leading-tight">{tStreaming('duplicateRoomError')}</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/streaming-room?room=${streamPopup.roomId}`)}
                        className="flex-1 px-3 py-1.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 transition-colors flex items-center justify-center gap-1.5"
                      >
                        <Radio className="w-3 h-3" />
                        {tStreaming('goToExistingRoom')}
                      </button>
                      <button
                        onClick={() => setStreamPopup(null)}
                        className="px-3 py-1.5 bg-gray-700 text-white text-xs font-semibold rounded-lg hover:bg-gray-600 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative w-full rounded-lg bg-black/50 aspect-video">
        {selectedServer === 'server1' && (
          (() => {
            let videoSrc = '';
            let effectiveAudio: 'vietsub' | 'dubbed' | null = null;
            if (selectedAudio === 'vietsub' && movieLinks.vietsub) {
              videoSrc = movieLinks.vietsub;
              effectiveAudio = 'vietsub';
            } else if (selectedAudio === 'dubbed' && movieLinks.dubbed) {
              videoSrc = movieLinks.dubbed;
              effectiveAudio = 'dubbed';
            } else if (movieLinks.vietsub) {
              videoSrc = movieLinks.vietsub;
              effectiveAudio = 'vietsub';
            } else if (movieLinks.dubbed) {
              videoSrc = movieLinks.dubbed;
              effectiveAudio = 'dubbed';
            } else {
              videoSrc = movieLinks.m3u8;
              effectiveAudio = null;
            }

            const canPlaySaved = activeWatchUrl && !isSavedLinkFatalError;

            if (!hasLoadedSavedProgress || (!canPlaySaved && (!apiSearchCompleted || movieLinksLoading))) {
              if (isSavedLinkFatalError) {
                return (
                  <div className="flex items-center justify-center h-full text-white">
                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                        className="w-12 h-12 border-4 border-yellow-500 border-t-transparent rounded-full"
                      />
                      <p className="text-sm text-gray-400">{t('oldSourceExpired')}</p>
                    </div>
                  </div>
                );
              }
              return (
                <div className="flex items-center justify-center h-full text-white">
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full"
                    />
                    <p className="text-sm text-gray-400">{t('pleaseWait')}</p>
                  </div>
                </div>
              );
            }

            const playUrl = activeWatchUrl || videoSrc;
            const hasVideoSource = playUrl || movieLinks.vietsub || movieLinks.dubbed || movieLinks.m3u8;

            if (!hasVideoSource) {
              return (
                <div className="flex items-center justify-center h-full text-white">
                  <div className="flex flex-col items-center gap-4">
                    <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-semibold">{t('noVideoSource')}</p>
                    <p className="text-sm text-gray-400">{t('tryAnotherServer')}</p>
                  </div>
                </div>
              );
            }

            return playUrl ? (
              (() => {
                const preparedPlaySource = prepareHlsPlayerSource(playUrl);

                return (
              <EnhancedMoviePlayer
                key={movie.id}
                ref={handlePlayerRef}
                src={preparedPlaySource.src}
                poster={movie.poster}
                autoPlay={false}
                movieId={movie.id}
                server={selectedServer}
                audio={effectiveAudio || undefined}
                title={movie.title}
                userId={typeof userId === 'string' ? userId : undefined}
                watchUrl={preparedPlaySource.watchUrl}
                cleanHlsInBrowser={preparedPlaySource.cleanHlsInBrowser}
                latestWatchUrl={apiSearchCompleted ? extractOriginalUrl(videoSrc) : undefined}
                savedTime={savedProgress?.currentTime}
                savedWatchUrl={savedProgress?.watchUrl}
                hasLoadedSavedProgress={hasLoadedSavedProgress}
                onUpdateSource={(newUrl) => {
                  const rawUrl = extractOriginalUrl(newUrl);
                  setActiveWatchUrl(rawUrl);
                  setSavedProgress(prev => prev ? { ...prev, watchUrl: rawUrl, currentTime: 0 } : { watchUrl: rawUrl, currentTime: 0 });
                }}
                onError={() => {
                  if (activeWatchUrl && !apiSearchCompleted) {
                    setIsSavedLinkFatalError(true);
                  }
                }}
                audioSettings={selectedServer === 'server1' ? audioSettings : undefined}
                onAudioSettingsChange={selectedServer === 'server1' ? setAudioSettings : undefined}
              />
                );
              })()
            ) : (
              <div className="flex items-center justify-center h-full text-white text-lg font-semibold">
                {t('noVideoSource')}
              </div>
            );
          })()
        )}
        {selectedServer === 'server2' && (
          <iframe
            src={server2Link}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={movie.title + ' - Server 2'}
            referrerPolicy="origin"
          />
        )}
        {selectedServer === 'server3' && (
          (() => {
            if (!server3SearchCompleted || server3Loading) {
              return (
                <div className="flex items-center justify-center h-full text-white">
                  <div className="flex flex-col items-center gap-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                      className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full"
                    />
                    <p className="text-sm text-gray-400">{t('pleaseWait')}</p>
                  </div>
                </div>
              );
            }

            const hasVideoSource = server3Links.vietsub || server3Links.dubbed || server3Links.m3u8;
            if (!hasVideoSource) {
              return (
                <div className="flex items-center justify-center h-full text-white">
                  <div className="flex flex-col items-center gap-4">
                    <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-semibold">{t('noVideoSource')}</p>
                    <p className="text-sm text-gray-400">{t('tryAnotherServer')}</p>
                  </div>
                </div>
              );
            }

            // Server 3 sử dụng iframe vì nguonc.com không cho phép embed trực tiếp
            let embedSrc = '';
            if (selectedAudio === 'vietsub' && server3Links.vietsub) {
              embedSrc = server3Links.vietsub;
            } else if (selectedAudio === 'dubbed' && server3Links.dubbed) {
              embedSrc = server3Links.dubbed;
            } else if (server3Links.vietsub) {
              embedSrc = server3Links.vietsub;
            } else if (server3Links.dubbed) {
              embedSrc = server3Links.dubbed;
            } else {
              embedSrc = server3Links.m3u8;
            }

            return embedSrc ? (
              <iframe
                key={embedSrc}
                src={embedSrc}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={movie.title + ' - Server 3'}
                referrerPolicy="origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white text-lg font-semibold">
                {t('noVideoSource')}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
