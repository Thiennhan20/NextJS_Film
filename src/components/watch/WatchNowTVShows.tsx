'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
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
import { proxyHlsUrl, extractOriginalUrl, getCleanPlaylistUrl } from '@/lib/hlsProxy'

import WatchNowTVShowsServer1 from './WatchNowTVShowsServer1'
import WatchNowTVShowsServer2 from './WatchNowTVShowsServer2'
import WatchNowTVShowsServer3 from './WatchNowTVShowsServer3'
import { Radio, SkipForward, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import api from '@/lib/axios'

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

interface Episode {
  id: number
  name: string
  episode_number: number
  season_number: number
  still_path?: string
  overview?: string
  air_date?: string
}

interface WatchNowTVShowsProps {
  tvShow: TVShow;
  selectedSeason: number;
  selectedEpisode: number;
  episodes: Episode[];
}

export default function WatchNowTVShows({
  tvShow,
  selectedSeason,
  selectedEpisode,
  episodes: _episodes
}: WatchNowTVShowsProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = useAuthStore((s) => (s.user as any)?.id || (s.user as any)?._id)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [streamPopup, setStreamPopup] = useState<{ type: 'auth' } | { type: 'duplicate', roomId: string } | null>(null)
  const [isCheckingStream, setIsCheckingStream] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const episodes = _episodes;
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('Watch');
  const tStreaming = useTranslations('StreamingLobby');

  const [selectedServer, setSelectedServer] = useState<'server1' | 'server2' | 'server3'>('server1');
  const hasInitialized = useRef(false);

  // Read audio parameter from URL
  const audioFromUrl = searchParams.get('audio');

  const [selectedAudio, setSelectedAudio] = useState<'vietsub' | 'dubbed' | null>(null);
  const [server2Link, setServer2Link] = useState('');
  const [tvShowLinksLoading, setTVShowLinksLoading] = useState(false);
  const [apiSearchCompleted, setApiSearchCompleted] = useState(false);
  const [dataReady, setDataReady] = useState(false);

  // Video Ref
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

  const handlePlayerRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setAudioVideoElement(node);
  }, []);

  // TV Show Links State
  const [tvShowLinks, setTVShowLinks] = useState({
    embed: '',
    m3u8: '',
    vietsub: '', // Link cho Vietsub
    dubbed: '', // Link cho Lồng Tiếng
    seasonChanged: false,
    currentSeason: 0, // Lưu season hiện tại đã tìm kiếm
  });

  // Instant Playback States
  const [savedProgress, setSavedProgress] = useState<{ currentTime: number; watchUrl: string; audio?: string } | null>(null);
  const [hasLoadedSavedProgress, setHasLoadedSavedProgress] = useState(false);
  const [activeWatchUrl, setActiveWatchUrl] = useState<string>('');
  const [isSavedLinkFatalError, setIsSavedLinkFatalError] = useState(false);


  // Load Saved Progress on mount / episode change
  useEffect(() => {
    let cancelled = false;
    async function loadProgress() {
      // Clear old progress state first so we don't bleed previous episode's progress to current episode
      setSavedProgress(null);
      setActiveWatchUrl('');
      setIsSavedLinkFatalError(false);
      setHasLoadedSavedProgress(false);
      setApiSearchCompleted(false); // Trigger loading state immediately
      setDataReady(false);          // Trigger loading state immediately

      let savedTime = 0;
      let savedWatchUrl = '';
      let savedAudio = '';

      if (userId) {
        try {
          const params = {
            contentId: String(tvShow.id),
            isTVShow: 'true',
            season: String(selectedSeason),
            episode: String(selectedEpisode)
          };
          const resp = await api.get('/recently-watched', { params });
          if (cancelled) return;
          savedTime = resp.data?.item?.currentTime || 0;
          savedWatchUrl = resp.data?.item?.watchUrl || '';
          savedAudio = resp.data?.item?.audio || '';
        } catch { /* ignore */ }
      } else {
        const key = `tvshow-progress-${tvShow.id}-${selectedSeason}-${selectedEpisode}`;
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

    if (selectedSeason && selectedEpisode) {
      loadProgress();
    }
    return () => {
      cancelled = true;
    };
  }, [tvShow.id, selectedSeason, selectedEpisode, userId]);

  // Auto-swap on fatal error when background search completes
  useEffect(() => {
    let videoSrc = '';
    if (selectedAudio === 'vietsub' && tvShowLinks.vietsub) {
      videoSrc = tvShowLinks.vietsub;
    } else if (selectedAudio === 'dubbed' && tvShowLinks.dubbed) {
      videoSrc = tvShowLinks.dubbed;
    } else if (tvShowLinks.vietsub) {
      videoSrc = tvShowLinks.vietsub;
    } else if (tvShowLinks.dubbed) {
      videoSrc = tvShowLinks.dubbed;
    } else {
      videoSrc = tvShowLinks.m3u8;
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
          contentId: String(tvShow.id), isTVShow: true,
          season: selectedSeason, episode: selectedEpisode,
          server: selectedServer, audio: selectedAudio || '',
          currentTime: 0, duration: 0,
          title: tvShow.name, poster: tvShow.poster,
          watchUrl: rawVideoSrc
        }).catch(() => {});
      } else {
        const key = `tvshow-progress-${tvShow.id}-${selectedSeason}-${selectedEpisode}`;
        localStorage.setItem(key, JSON.stringify({
          currentTime: 0, duration: 0, title: tvShow.name, poster: tvShow.poster,
          server: selectedServer, audio: selectedAudio || '',
          watchUrl: rawVideoSrc,
          lastWatched: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          season: selectedSeason,
          episode: selectedEpisode
        }));
      }
    }
  }, [apiSearchCompleted, isSavedLinkFatalError, tvShowLinks, selectedAudio, userId, tvShow.id, tvShow.name, tvShow.poster, selectedSeason, selectedEpisode, selectedServer]);

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

  // ── Auto Next Episode states ──
  const [autoNextEnabled, setAutoNextEnabled] = useState(false);
  const [showNextEpisodePopup, setShowNextEpisodePopup] = useState(false);
  const [nextEpisodeCountdown, setNextEpisodeCountdown] = useState(5);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const streamBtnRef = useRef<HTMLDivElement>(null);

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
    const currentLinks = selectedServer === 'server3' ? server3Links : tvShowLinks;
    if (audioFromUrl === 'vietsub' && currentLinks.vietsub && selectedAudio !== 'vietsub') {
      setSelectedAudio('vietsub');
    } else if (audioFromUrl === 'dubbed' && currentLinks.dubbed && selectedAudio !== 'dubbed') {
      setSelectedAudio('dubbed');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioFromUrl, tvShowLinks.vietsub, tvShowLinks.dubbed, server3Links.vietsub, server3Links.dubbed, selectedAudio, selectedServer]);

  // Tự động chọn audio khi có sẵn, ưu tiên từ URL
  useEffect(() => {
    const currentLinks = selectedServer === 'server3' ? server3Links : tvShowLinks;
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
      if (currentLinks.vietsub && currentLinks.dubbed) {
        setSelectedAudio('vietsub'); // Default to vietsub
        return;
      }

      // Nếu chỉ có một loại audio, tự động chọn
      if (currentLinks.vietsub && !currentLinks.dubbed) {
        setSelectedAudio('vietsub');
        return;
      }
      if (currentLinks.dubbed && !currentLinks.vietsub) {
        setSelectedAudio('dubbed');
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tvShowLinks.vietsub, tvShowLinks.dubbed, server3Links.vietsub, server3Links.dubbed, selectedAudio, audioFromUrl, selectedServer]);

  // Stream URL hiệu lực cho nút Stream (chỉ Server 1)
  const effectiveStreamUrl = useMemo(() => {
    if (selectedServer !== 'server1') return '';
    if (!apiSearchCompleted || tvShowLinksLoading || !dataReady) return '';
    if (selectedAudio === 'vietsub' && tvShowLinks.vietsub) return tvShowLinks.vietsub;
    if (selectedAudio === 'dubbed' && tvShowLinks.dubbed) return tvShowLinks.dubbed;
    if (tvShowLinks.vietsub) return tvShowLinks.vietsub;
    if (tvShowLinks.dubbed) return tvShowLinks.dubbed;
    return tvShowLinks.m3u8;
  }, [selectedServer, apiSearchCompleted, tvShowLinksLoading, dataReady, selectedAudio, tvShowLinks.vietsub, tvShowLinks.dubbed, tvShowLinks.m3u8]);

  // ── Auto Next Episode Logic ──
  const hasNextEpisode = useMemo(() => {
    if (!_episodes || _episodes.length === 0) return false;
    const maxEp = Math.max(..._episodes.map(ep => ep.episode_number));
    return selectedEpisode < maxEp;
  }, [_episodes, selectedEpisode]);

  const goToNextEpisode = useCallback(() => {
    if (!hasNextEpisode) return;
    const nextEp = selectedEpisode + 1;
    setShowNextEpisodePopup(false);
    setNextEpisodeCountdown(5);
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    // Navigate via URL params
    const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
    params.set('season', String(selectedSeason));
    params.set('episode', String(nextEp));
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `${window.location.pathname}?${params.toString()}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, [hasNextEpisode, selectedEpisode, selectedSeason]);

  const handleVideoEnded = useCallback(() => {
    if (selectedServer !== 'server1') return;
    if (!hasNextEpisode) return;
    setShowNextEpisodePopup(true);
    setNextEpisodeCountdown(5);
    if (autoNextEnabled) {
      countdownIntervalRef.current = setInterval(() => {
        setNextEpisodeCountdown(prev => {
          if (prev <= 1) {
            if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [selectedServer, hasNextEpisode, autoNextEnabled]);

  // Auto-navigate when countdown reaches 0
  useEffect(() => {
    if (autoNextEnabled && nextEpisodeCountdown === 0 && showNextEpisodePopup) {
      goToNextEpisode();
    }
  }, [autoNextEnabled, nextEpisodeCountdown, showNextEpisodePopup, goToNextEpisode]);

  // Cleanup countdown on unmount or episode change
  useEffect(() => {
    return () => {
      if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
    };
  }, [selectedEpisode]);

  // Hide popup when episode changes
  useEffect(() => {
    setShowNextEpisodePopup(false);
    setNextEpisodeCountdown(5);
  }, [selectedEpisode]);

  const handleDismissPopup = useCallback(() => {
    setShowNextEpisodePopup(false);
    setNextEpisodeCountdown(5);
    if (countdownIntervalRef.current) { clearInterval(countdownIntervalRef.current); countdownIntervalRef.current = null; }
  }, []);

  // Handler cho nút Stream
  const handleStreamClick = async () => {
    if (!isAuthenticated) {
      setStreamPopup({ type: 'auth' });
      return;
    }
    if (!effectiveStreamUrl) return;

    // Determine effective audio for streaming
    const streamAudio = selectedAudio || (tvShowLinks.vietsub ? 'vietsub' : tvShowLinks.dubbed ? 'dubbed' : '');

    // Check for duplicate room first
    setIsCheckingStream(true);
    try {
      const res = await api.get(`/rooms/check-duplicate?movieId=${tvShow.id}&audio=${streamAudio}`);
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
      title: `${tvShow.name} - S${selectedSeason} E${selectedEpisode}`,
      movieId: String(tvShow.id),
      poster: tvShow.poster || '',
      type: 'tvshow',
      season: String(selectedSeason),
      episode: String(selectedEpisode),
      audio: streamAudio,
    });
    router.push(`/streaming-lobby?${params.toString()}`);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-white">
      <h2 className="text-3xl font-bold mb-6">{t('watchNow')}</h2>

      {/* Server 1 Component */}
      <WatchNowTVShowsServer1
        tvShow={tvShow}
        selectedSeason={selectedSeason}
        selectedEpisode={selectedEpisode}
        onLinksChange={(links) => {
          setTVShowLinks(prev => ({ ...prev, ...links }))
        }}
        onLoadingChange={(loading) => {
          setTVShowLinksLoading(loading)
        }}
        onSearchComplete={(completed) => {
          setApiSearchCompleted(completed)
        }}
        onDataReadyChange={(ready) => {
          setDataReady(ready)
        }}
      />

      {/* Server 2 Component */}
      <WatchNowTVShowsServer2
        tvShow={tvShow}
        selectedSeason={selectedSeason}
        selectedEpisode={selectedEpisode}
        onLinkChange={setServer2Link}
      />

      {/* Server 3 Component - Load tự động sau Server 1 */}
      <WatchNowTVShowsServer3
        tvShow={tvShow}
        selectedSeason={selectedSeason}
        selectedEpisode={selectedEpisode}
        server1Ready={apiSearchCompleted}
        onLinksChange={(links) => {
          setServer3Links(links)
        }}
        onLoadingChange={(loading) => {
          setServer3Loading(loading)
        }}
        onSearchComplete={(completed) => {
          setServer3SearchCompleted(completed)
        }}
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
          {selectedServer === 'server1' && (tvShowLinks.vietsub || tvShowLinks.dubbed) && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-300">{t('audio')}</span>
              {tvShowLinks.vietsub && (
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
              {tvShowLinks.dubbed && (
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
      {selectedEpisode > 0 && (
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-white text-xs sm:text-sm md:text-base font-semibold truncate" title={`${tvShow.name} - S${selectedSeason} E${selectedEpisode}`}>
              {tvShow.name} - Season {selectedSeason} Episode {selectedEpisode}
            </h3>
            {((selectedServer === 'server1' && (tvShowLinks.vietsub || tvShowLinks.dubbed)) ||
              (selectedServer === 'server3' && (server3Links.vietsub || server3Links.dubbed))) && (
                <span className="px-2 py-0.5 text-[10px] sm:text-xs font-semibold rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white whitespace-nowrap">
                  {selectedAudio === 'vietsub' ? t('vietsub') :
                    selectedAudio === 'dubbed' ? t('vietnameseDubbed') :
                      (selectedServer === 'server1' ? tvShowLinks.vietsub : server3Links.vietsub) ? t('vietsub') : t('vietnameseDubbed')}
                </span>
              )}
          </div>

          {/* Auto Next + Stream Buttons — Server 1 only */}
          {selectedServer === 'server1' && (
            <div className="flex items-center gap-2">
              {/* Auto Next Toggle */}
              {hasNextEpisode && (
                <button
                  onClick={() => setAutoNextEnabled(prev => !prev)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-300 whitespace-nowrap ${
                    autoNextEnabled
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  title={autoNextEnabled ? t('autoNextOn') : t('autoNextOff')}
                >
                  <SkipForward className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{t('autoNext')}</span>
                </button>
              )}

              {/* Stream Button */}
              {effectiveStreamUrl && (
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
          )}
        </div>
      )}

      <div className="relative w-full rounded-lg bg-black/50 aspect-video">
        {selectedEpisode === 0 ? (
          <div className="flex items-center justify-center h-full text-white">
            <div className="flex flex-col items-center gap-4">
              <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 110 2h-1v12a2 2 0 01-2 2H6a2 2 0 01-2-2V6H3a1 1 0 110-2h4z" />
              </svg>
              <p className="text-lg font-semibold">{t('selectEpisodeFirst')}</p>
              <p className="text-sm text-gray-400">{t('chooseEpisode')}</p>
            </div>
          </div>
        ) : selectedServer === 'server1' ? (
          (() => {
            let videoSrc = '';
            let effectiveAudio: 'vietsub' | 'dubbed' | null = null;
            if (selectedAudio === 'vietsub' && tvShowLinks.vietsub) {
              videoSrc = tvShowLinks.vietsub;
              effectiveAudio = 'vietsub';
            } else if (selectedAudio === 'dubbed' && tvShowLinks.dubbed) {
              videoSrc = tvShowLinks.dubbed;
              effectiveAudio = 'dubbed';
            } else if (tvShowLinks.vietsub) {
              videoSrc = tvShowLinks.vietsub;
              effectiveAudio = 'vietsub';
            } else if (tvShowLinks.dubbed) {
              videoSrc = tvShowLinks.dubbed;
              effectiveAudio = 'dubbed';
            } else {
              videoSrc = tvShowLinks.m3u8;
              effectiveAudio = null;
            }

            const canPlaySaved = activeWatchUrl && !isSavedLinkFatalError;

            if (!hasLoadedSavedProgress || (!canPlaySaved && (!apiSearchCompleted || tvShowLinksLoading || !dataReady))) {
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
            const hasVideoSource = playUrl || tvShowLinks.vietsub || tvShowLinks.dubbed || tvShowLinks.m3u8;

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
              <EnhancedMoviePlayer
                key={`${selectedSeason}-${selectedEpisode}`}
                ref={handlePlayerRef}
                src={selectedServer === 'server1' ? getCleanPlaylistUrl(playUrl) : proxyHlsUrl(playUrl)}
                poster={tvShow.poster}
                autoPlay={false}
                movieId={tvShow.id}
                server={selectedServer}
                audio={effectiveAudio || undefined}
                title={tvShow.name}
                season={selectedSeason}
                episode={selectedEpisode}
                isTVShow={true}
                userId={typeof userId === 'string' ? userId : undefined}
                onVideoEnded={handleVideoEnded}
                watchUrl={extractOriginalUrl(playUrl)}
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
                endOverlay={showNextEpisodePopup && hasNextEpisode ? (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/80 backdrop-blur-sm">
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="bg-gray-900/95 border border-gray-600 rounded-2xl px-6 py-5 sm:px-8 sm:py-6 flex flex-col items-center gap-4 shadow-2xl max-w-sm mx-4"
                    >
                      <SkipForward className="w-8 h-8 text-emerald-400" />
                      <h3 className="text-white text-base sm:text-lg font-bold text-center">
                        {t('nextEpisode')}: {selectedEpisode + 1}
                      </h3>

                      {autoNextEnabled ? (
                        <>
                          <p className="text-gray-300 text-sm text-center">
                            {t('playingNextIn')}
                          </p>
                          <div className="relative w-16 h-16 flex items-center justify-center">
                            <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 64 64">
                              <circle cx="32" cy="32" r="28" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="4" />
                              <circle
                                cx="32" cy="32" r="28" fill="none" stroke="url(#countdownGradient)" strokeWidth="4"
                                strokeLinecap="round"
                                strokeDasharray={`${2 * Math.PI * 28}`}
                                strokeDashoffset={`${2 * Math.PI * 28 * (1 - nextEpisodeCountdown / 5)}`}
                                style={{ transition: 'stroke-dashoffset 1s linear' }}
                              />
                              <defs>
                                <linearGradient id="countdownGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                  <stop offset="0%" stopColor="#10b981" />
                                  <stop offset="100%" stopColor="#14b8a6" />
                                </linearGradient>
                              </defs>
                            </svg>
                            <span className="text-2xl font-bold text-white">{nextEpisodeCountdown}</span>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={goToNextEpisode}
                              className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-emerald-500/30"
                            >
                              {t('playNow')}
                            </button>
                            <button
                              onClick={handleDismissPopup}
                              className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm transition-colors"
                            >
                              {t('cancel')}
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="flex gap-3">
                          <button
                            onClick={goToNextEpisode}
                            className="px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-white font-semibold text-sm transition-all shadow-lg hover:shadow-emerald-500/30 flex items-center gap-2"
                          >
                            <SkipForward className="w-4 h-4" />
                            {t('nextEpisode')}
                          </button>
                          <button
                            onClick={handleDismissPopup}
                            className="px-5 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white font-semibold text-sm transition-colors"
                          >
                            {t('dismiss')}
                          </button>
                        </div>
                      )}
                    </motion.div>
                  </div>
                ) : undefined}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white text-lg font-semibold">
                {t('noVideoSource')}
              </div>
            );
          })()
        ) : selectedServer === 'server2' && server2Link ? (
          <iframe
            src={server2Link}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={`${tvShow.name} - Season ${selectedSeason} Episode ${selectedEpisode} - Server 2`}
            referrerPolicy="origin"
          />
        ) : selectedServer === 'server3' ? (
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
            if (server3SearchCompleted && !server3Loading && !hasVideoSource) {
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
                key={`${selectedSeason}-${selectedEpisode}-${embedSrc}`}
                src={embedSrc}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title={`${tvShow.name} - Season ${selectedSeason} Episode ${selectedEpisode} - Server 3`}
                referrerPolicy="origin"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-white text-lg font-semibold">
                {t('noVideoSource')}
              </div>
            );
          })()
        ) : (
          <div className="flex items-center justify-center h-full text-white">
            <div className="flex flex-col items-center gap-4">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
                className="w-12 h-12 border-4 border-red-500 border-t-transparent rounded-full"
              />
              <p className="text-sm text-gray-400">{t('loading')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
