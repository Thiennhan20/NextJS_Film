'use client';

import { useState, useEffect, Suspense } from 'react';
import { Plus, Hash, ArrowRight, Radio, Copy, Check, LogIn, Film, Tv, Clock, Users, Trash2, RefreshCw, AlertTriangle, X, Info, Sparkles, Activity, TrendingUp, HelpCircle } from 'lucide-react';
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _posterFromParams = searchParams.get('poster') || '';
  const typeFromParams = searchParams.get('type') || 'movie'; // 'movie' | 'tvshow'
  const seasonFromParams = searchParams.get('season') || '';
  const episodeFromParams = searchParams.get('episode') || '';
  const audioFromParams = searchParams.get('audio') || '';

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
  const [copied, setCopied] = useState(false);
  const [showAuthPopup, setShowAuthPopup] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [deleteConfirmRoomId, setDeleteConfirmRoomId] = useState<string | null>(null);
  const [createdRoom, setCreatedRoom] = useState<{
    roomId: string;
    title: string;
    streamUrl: string;
    hostName: string;
    expiresAt: string;
  } | null>(null);

  // Has stream info from player
  const hasStreamInfo = !!streamUrlFromParams;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (user as any)?.id || (user as any)?._id || '';

  // Active rooms list
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
  }
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
  const [maxRooms, setMaxRooms] = useState(30);

  useEffect(() => {
    const newParticles = Array.from({ length: 25 }).map(() => ({
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 6 + 4, // 4px to 10px
      duration: Math.random() * 20 + 15,
      xOffset: Math.random() * 60 - 30,
      yOffset: Math.random() * -100 - 40,
      scale: Math.random() * 0.8 + 1.2,
    }));
    setParticles(newParticles);
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

  const handleCreateRoom = async () => {
    if (!requireAuth()) return;
    if (!streamUrlFromParams) return;

    setLoading(true);
    setError('');
    setDuplicateInfo(null);
    try {
      const response = await api.post('/rooms', {
        title: titleFromParams,
        stream_url: streamUrlFromParams,
        movie_id: movieIdFromParams,
        audio: audioFromParams,
      });

      const { room_id, expires_at } = response.data;

      setCreatedRoom({
        roomId: room_id,
        title: titleFromParams,
        streamUrl: streamUrlFromParams,
        hostName: user?.name || 'Host',
        expiresAt: new Date(expires_at).toISOString(),
      });
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
      });
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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex justify-center px-4 py-6 relative overflow-y-auto">
      {/* Background Particles */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        {particles.map((p, i) => (
          <motion.div
            key={i}
            className={`absolute rounded-full blur-[2px] ${
              i % 5 === 0 ? 'bg-yellow-400/25' :
              i % 5 === 1 ? 'bg-purple-400/20' :
              i % 5 === 2 ? 'bg-blue-400/15' :
              i % 5 === 3 ? 'bg-pink-400/15' :
              'bg-green-400/10'
            }`}
            animate={{
              x: [0, p.xOffset, 0],
              y: [0, p.yOffset, 0],
              scale: [1, p.scale, 1],
              opacity: [0.1, 0.4, 0.1],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut"
            }}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size
            }}
          />
        ))}
      </div>

      {/* Glow Effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 -right-20 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-20 -left-20 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
      </div>

      <div className="relative z-10 w-full max-w-7xl px-0 sm:px-4">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* ─── Left Sidebar (Desktop only) ─── */}
          <div className="hidden lg:flex flex-col gap-4 col-span-1">
            {/* Quick Start Guide */}
            <div className="bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-2xl p-4 shadow-lg">
              <h3 className="text-xs font-bold text-yellow-400 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="w-3.5 h-3.5 text-yellow-400" />
                {t('experienceGuide')}
              </h3>
              <div className="space-y-3.5 text-xs text-gray-400">
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center font-bold text-yellow-400 shrink-0">1</div>
                  <p className="leading-relaxed">{t('experienceStep1')}</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center font-bold text-yellow-400 shrink-0">2</div>
                  <p className="leading-relaxed">{t('experienceStep2')}</p>
                </div>
                <div className="flex gap-2">
                  <div className="w-5 h-5 rounded bg-white/5 flex items-center justify-center font-bold text-yellow-400 shrink-0">3</div>
                  <p className="leading-relaxed">{t('experienceStep3')}</p>
                </div>
              </div>
            </div>

            {/* System Status dashboard */}
            <div className="bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-2xl p-4 shadow-lg">
              <h3 className="text-xs font-bold text-blue-400 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <Activity className="w-3.5 h-3.5 text-blue-400" />
                {t('systemStatus')}
              </h3>
              <div className="space-y-2.5 text-xs text-gray-400">
                <div className="flex items-center justify-between">
                  <span>{t('serverStatus')}</span>
                  <span className="flex items-center gap-1 text-green-400 font-medium">
                    <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                    {t('online')}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('activeRooms')}</span>
                  <span className="text-white font-medium">{activeRooms.length} / {maxRooms}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('maxUsersPerRoom')}</span>
                  <span className="text-white font-medium">{t('twoUsers')}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{t('sessionLimit')}</span>
                  <span className="text-white font-medium">{t('sixHours')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Center Column (Main Content) ─── */}
          <div className="col-span-1 lg:col-span-2 flex flex-col gap-4">
            {/* Title */}
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8"
            >
              <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 bg-clip-text text-transparent mb-2">
                {t('title')}
              </h1>
              <p className="text-sm text-gray-400">{t('subtitle')}</p>
            </motion.div>

        {/* Room Created Card */}
        <AnimatePresence>
          {createdRoom && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="mb-6 bg-gradient-to-br from-gray-800/60 to-gray-900/60 backdrop-blur-sm rounded-xl p-5 border border-yellow-500/30 shadow-2xl"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <h2 className="text-lg font-bold text-green-300">{t('roomCreatedSuccessfully')}</h2>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm mb-5">
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-400 text-xs">{t('roomId')}</span>
                  <p className="text-yellow-300 font-mono font-bold text-base">{createdRoom.roomId}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-400 text-xs">{t('host')}</span>
                  <p className="text-white font-semibold truncate">{createdRoom.hostName}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 col-span-2">
                  <span className="text-gray-400 text-xs">{t('movie')}</span>
                  <p className="text-white font-semibold truncate">{createdRoom.title}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-400 text-xs">{t('status')}</span>
                  <p className="text-blue-300 font-semibold">{t('waiting')}</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3">
                  <span className="text-gray-400 text-xs flex items-center gap-1"><Clock className="h-3 w-3" /> {t('expires')}</span>
                  <p className="text-gray-300 font-semibold">{t('sixHours')}</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleGoToRoom}
                  className="flex-1 px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 transition-all duration-300 flex items-center justify-center gap-2 text-sm shadow-lg shadow-yellow-500/20"
                >
                  <Radio className="h-4 w-4" />
                  {t('enterRoom')}
                </button>
                <button
                  onClick={handleCopyInvite}
                  className="px-4 py-2.5 bg-gray-700 text-white font-semibold rounded-lg hover:bg-gray-600 transition-all duration-300 flex items-center justify-center gap-2 text-sm border border-gray-600"
                >
                  {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? t('copied') : t('copyInvite')}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Create Room */}
          <motion.div
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-yellow-500/30 transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/15 flex items-center justify-center">
                <Plus className="h-4 w-4 text-yellow-400" />
              </div>
              <h2 className="text-lg font-bold text-yellow-300">{t('createRoom')}</h2>
            </div>

            {hasStreamInfo ? (
              <div className="space-y-3">
                {/* Stream info preview */}
                <div className="bg-gray-900/60 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-center gap-2 mb-2">
                    {typeFromParams === 'tvshow' ? (
                      <Tv className="h-4 w-4 text-blue-400" />
                    ) : (
                      <Film className="h-4 w-4 text-purple-400" />
                    )}
                    <span className="text-xs text-gray-400 uppercase tracking-wide">
                      {typeFromParams === 'tvshow' ? t('tvShow') : t('movie')}
                    </span>
                  </div>
                  <p className="text-sm text-white font-medium truncate" title={titleFromParams}>
                    {titleFromParams}
                  </p>
                  {typeFromParams === 'tvshow' && seasonFromParams && episodeFromParams && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {t('seasonEpisode', { season: seasonFromParams, episode: episodeFromParams })}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="w-1.5 h-1.5 bg-green-400 rounded-full" />
                    <span className="text-xs text-green-400">{t('streamReady')}</span>
                    {audioFromParams && (
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded bg-gradient-to-r from-fuchsia-600 to-pink-600 text-white uppercase">
                        {audioFromParams}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={handleCreateRoom}
                  disabled={loading || !!createdRoom || activeRooms.length >= maxRooms}
                  className="w-full px-4 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 text-sm shadow-lg shadow-yellow-500/20 disabled:shadow-none"
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-black/50 border-t-transparent rounded-full animate-spin" />
                      {t('creating')}
                    </>
                  ) : createdRoom ? (
                    <>
                      <Check className="h-4 w-4" />
                      {t('roomCreated')}
                    </>
                  ) : activeRooms.length >= maxRooms ? (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      {t('serverFullWait')}
                    </>
                  ) : (
                    <>
                      <Radio className="h-4 w-4" />
                      {t('createWatchParty')}
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
              <div className="text-center py-4">
                <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-gray-700/50 flex items-center justify-center">
                  <Film className="h-5 w-5 text-gray-500" />
                </div>
                <p className="text-sm text-gray-400 mb-3">{t('noStreamSelected')}</p>
                <button
                  onClick={() => setShowInstructions(true)}
                  className="px-4 py-2 bg-gray-800/80 hover:bg-gray-700 text-blue-400 font-medium text-xs rounded-lg transition-colors border border-gray-700 hover:border-blue-500/50 flex items-center gap-2 mx-auto"
                >
                  <Info className="w-4 h-4" />
                  {t('instructionBtn')}
                </button>
              </div>
            )}
          </motion.div>

          {/* Join Room */}
          <motion.div
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-gray-800/40 backdrop-blur-sm rounded-xl p-5 border border-gray-700/50 hover:border-yellow-500/30 transition-all duration-300"
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center">
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
                className="w-full px-3.5 py-2.5 bg-gray-900/60 border border-gray-600/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500/50 transition-all duration-300 font-mono"
                onKeyDown={(e) => e.key === 'Enter' && handleJoinById()}
              />

              <button
                onClick={handleJoinById}
                disabled={!joinRoomId.trim() || isJoining}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white font-semibold rounded-lg hover:from-purple-500 hover:to-purple-600 disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400 disabled:cursor-not-allowed transition-all duration-300 flex items-center justify-center gap-2 text-sm shadow-lg shadow-purple-500/10 disabled:shadow-none"
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
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2 text-center">
                  {joinError}
                </p>
              )}

              <p className="text-xs text-gray-500 text-center">
                {t('askHostJoin')}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Footer info */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mt-6 text-center"
        >
          <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-yellow-500 rounded-full" />
              {t('maxPerRoom')}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {t('hourSessions')}
            </span>
            <span className="flex items-center gap-1">
              <Radio className="h-3 w-3" />
              {t('hlsStreaming')}
            </span>
          </div>
        </motion.div>

        {/* ─── Active Rooms List ──────────────────────────── */}
        <motion.div
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
              className="p-1.5 text-gray-500 hover:text-yellow-400 transition-colors rounded-lg hover:bg-gray-800"
              title={t('refresh')}
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
            <div className="space-y-3 max-h-[420px] overflow-y-auto chat-scrollbar pr-1 pb-2">
              {activeRooms.map((room) => (
                <motion.div
                  key={room.room_id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white/[0.03] backdrop-blur-md rounded-xl p-3 sm:p-4 border border-white/[0.08] hover:border-yellow-500/40 hover:shadow-[0_0_20px_rgba(234,179,8,0.12)] transition-all duration-300 hover:-translate-y-0.5 group flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-grow">
                    {/* Host Avatar */}
                    {room.host_avatar ? (
                      <Image
                        src={room.host_avatar}
                        alt={room.host_name}
                        width={36}
                        height={36}
                        unoptimized
                        className="w-9 h-9 rounded-full object-cover shrink-0 shadow-md border border-gray-600/50"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                      />
                    ) : null}
                    <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(room.host_id)} flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-md ${room.host_avatar ? 'hidden' : ''}`}>
                      {room.host_name?.charAt(0)?.toUpperCase() || '?'}
                    </div>

                    <div className="min-w-0 flex-grow">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-bold text-yellow-300">#{room.room_id}</span>
                        {room.title?.toLowerCase().includes('tập') || room.title?.toLowerCase().includes('episode') || room.title?.toLowerCase().includes('season') || room.title?.toLowerCase().includes('ss') ? (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/10 uppercase tracking-wider">📺 {t('showBadge')}</span>
                        ) : (
                          <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/10 uppercase tracking-wider">🎬 {t('movieBadge')}</span>
                        )}
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full border ${
                          room.status === 'PLAYING' ? 'bg-green-500/20 text-green-400 border-green-500/10' :
                          room.status === 'PAUSED' ? 'bg-amber-500/20 text-amber-400 border-amber-500/10' :
                          'bg-blue-500/20 text-blue-400 border-blue-500/10'
                        }`}>
                          {getRoomStatusLabel(room.status)}
                        </span>
                      </div>

                      <p className="text-sm text-white font-semibold truncate" title={room.title || t('untitledRoom')}>
                        {room.title || t('untitledRoom')}
                      </p>

                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500">
                        <span>{t('host')}: <span className="text-gray-400">{room.host_name}</span></span>
                        <span className="flex items-center gap-0.5">
                          <Users className="h-3 w-3" />
                          {room.member_count}/{room.max_users}
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Clock className="h-3 w-3" />
                          {formatTimeLeft(room.ttl_seconds)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {userId === room.host_id && (
                      <button
                        onClick={() => setDeleteConfirmRoomId(room.room_id)}
                        disabled={deletingRoomId === room.room_id}
                        className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                        title={t('deleteRoomTitle')}
                      >
                        <Trash2 className={`h-3.5 w-3.5 ${deletingRoomId === room.room_id ? 'animate-spin' : ''}`} />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (!requireAuth()) return;
                        router.push(`/streaming-room?room=${room.room_id}`);
                      }}
                      disabled={room.member_count >= room.max_users && userId !== room.host_id}
                      className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold rounded-lg hover:from-yellow-400 hover:to-amber-400 disabled:from-gray-600 disabled:to-gray-700 disabled:text-gray-400 transition-all shadow-sm text-center min-w-[70px]"
                    >
                      {room.member_count >= room.max_users && userId !== room.host_id ? t('full') : t('join')}
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

          {/* ─── Right Sidebar (Desktop only) ─── */}
          <div className="hidden lg:flex flex-col gap-4 col-span-1">
            {/* Trending Watch Party Movies */}
            <div className="bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-2xl p-4 shadow-lg">
              <h3 className="text-xs font-bold text-purple-400 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
                {t('trendingShows')}
              </h3>
              <div className="space-y-3">
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-12 bg-gradient-to-br from-red-600 to-amber-600 rounded flex items-center justify-center shrink-0 shadow-md">
                    <Film className="w-4 h-4 text-white/70" />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-xs text-white font-semibold truncate">{t('trendingTitle1')}</p>
                    <span className="px-1 py-0.5 text-[8px] bg-red-500/20 text-red-400 rounded uppercase font-bold tracking-wider">{t('movieBadge')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-12 bg-gradient-to-br from-blue-600 to-cyan-600 rounded flex items-center justify-center shrink-0 shadow-md">
                    <Tv className="w-4 h-4 text-white/70" />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-xs text-white font-semibold truncate">{t('trendingTitle2')}</p>
                    <span className="px-1 py-0.5 text-[8px] bg-blue-500/20 text-blue-400 rounded uppercase font-bold tracking-wider">{t('showBadge')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <div className="w-9 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded flex items-center justify-center shrink-0 shadow-md">
                    <Film className="w-4 h-4 text-white/70" />
                  </div>
                  <div className="min-w-0 flex-grow">
                    <p className="text-xs text-white font-semibold truncate">{t('trendingTitle3')}</p>
                    <span className="px-1 py-0.5 text-[8px] bg-purple-500/20 text-purple-400 rounded uppercase font-bold tracking-wider">{t('movieBadge')}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Cinematic Watch Rules */}
            <div className="bg-white/[0.02] backdrop-blur-md border border-white/[0.06] rounded-2xl p-4 shadow-lg text-xs text-gray-400">
              <h3 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-1.5 uppercase tracking-wider">
                <HelpCircle className="w-3.5 h-3.5 text-emerald-400" />
                {t('watchPartyRules')}
              </h3>
              <ul className="space-y-2 list-disc list-inside leading-relaxed text-gray-400">
                <li>{t('ruleRespect')}</li>
                <li>{t('ruleNoSensitiveSpam')}</li>
                <li>{t('ruleHeadphones')}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      {/* Auth Required Popup */}
      <AnimatePresence>
        {showAuthPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
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
    </div>
  );
}

export default function StreamingLobby() {
  const t = useTranslations('StreamingLobby');
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
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
