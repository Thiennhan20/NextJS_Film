'use client';

import { useEffect, useRef, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import {
  Copy, Check, ArrowLeft, Users, Hash, Send, Smile,
  Crown, Lock, Unlock, LogOut, Radio, Clock, AlertTriangle, Share2, ChevronDown
} from 'lucide-react';
import useAuthStore from '@/store/useAuthStore';
import EnhancedMoviePlayer from '@/components/common/video-player/EnhancedMoviePlayer';
import { proxyHlsUrl } from '@/lib/hlsProxy';
import { useWatchPartySocket, type RoomStatus, type ChatMessage } from '@/hooks/useWatchPartySocket';
import { useTranslations } from 'next-intl';

// ─── Streaming Room Content ─────────────────────────────────

function StreamingRoomContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const roomId = searchParams.get('room');
  const streamUrlFromParams = searchParams.get('streamUrl') || '';
  const titleFromParams = searchParams.get('title') || '';
  const t = useTranslations('StreamingRoom');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userId = (user as any)?.id || (user as any)?._id || '';

  // ─── State ──────────────────────────────────────────────

  const [roomStatus, setRoomStatus] = useState<RoomStatus | null>(null);
  const [streamUrl, setStreamUrl] = useState(streamUrlFromParams);
  const [roomTitle, setRoomTitle] = useState(titleFromParams);
  const [isHost, setIsHost] = useState(false);
  const [memberCount, setMemberCount] = useState(0);
  const [forceSync, setForceSync] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [notification, setNotification] = useState('');
  const [roomClosed, setRoomClosed] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<{ id: number; emoji: string; x: number }[]>([]);
  const [showChat, setShowChat] = useState(true);
  const [hostHasPlayed, setHostHasPlayed] = useState(false);
  const [waitingForHost, setWaitingForHost] = useState(false);
  const [waitReason, setWaitReason] = useState<'host_paused' | 'syncing' | 'host_buffering' | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [hasNewMessage, setHasNewMessage] = useState(false);
  const [roomMembers, setRoomMembers] = useState<{ user_id: string; username: string; avatar?: string; is_host: boolean }[]>([]);
  const [showMembers, setShowMembers] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const syncLockRef = useRef(false); // Prevents feedback loops
  const syncPositionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const emojiIdRef = useRef(0);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [isPlayerFullscreen, setIsPlayerFullscreen] = useState(false);
  const hostPausePositionRef = useRef<number | null>(null);
  const showChatRef = useRef(showChat);

  const EMOJIS = [
    '👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉',
    '🤣', '😍', '🥺', '😡', '💀', '🤔', '😱', '🙌',
    '💯', '🫡', '😎', '🤗', '🎬', '🍿', '👀', '💤',
  ];

  // Generate deterministic gradient color for user avatar
  const getAvatarGradient = (id: string) => {
    const gradients = [
      'from-rose-500/40 to-pink-500/40',
      'from-violet-500/40 to-purple-500/40',
      'from-blue-500/40 to-cyan-500/40',
      'from-emerald-500/40 to-teal-500/40',
      'from-amber-500/40 to-orange-500/40',
      'from-red-500/40 to-rose-500/40',
      'from-indigo-500/40 to-blue-500/40',
      'from-fuchsia-500/40 to-pink-500/40',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
    return gradients[Math.abs(hash) % gradients.length];
  };

  // ─── Show notification helper ───────────────────────────

  const showNotification = useCallback((msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(''), 4000);
  }, []);

  const getStatusLabel = (status: RoomStatus['status']) => {
    switch (status) {
      case 'PLAYING':
        return t('statusPlaying');
      case 'PAUSED':
        return t('statusPaused');
      case 'ENDED':
        return t('statusEnded');
      default:
        return t('statusWaiting');
    }
  };

  // ─── WebSocket ──────────────────────────────────────────

  const {
    isConnected,
    emitPlay,
    emitPause,
    emitSeek,
    emitSyncToggle,
    emitChat,
    emitEmoji,
    emitSyncPosition,
    emitHostBuffering,
    emitHostBufferEnd,
    emitLeaveRoom,
  } = useWatchPartySocket({
    roomId,
    token,

    onRoomStatus: (status) => {
      setRoomStatus(status);
      setIsHost(status.is_host);
      setMemberCount(status.member_count);
      setForceSync(status.force_sync);
      setRoomTitle(status.title || titleFromParams);

      if (status.stream_url) {
        setStreamUrl(status.stream_url);
      }

      // Sync members list
      if (status.members) {
        setRoomMembers(status.members);
      } else {
        setRoomMembers([
          { user_id: status.is_host ? userId : 'host', username: status.host_name, is_host: true }
        ]);
      }

      // Apply initial position + auto-play if host is playing
      // Use timeout to let EnhancedMoviePlayer mount the video element
      setTimeout(() => {
        if (!videoRef.current) return;
        syncLockRef.current = true;
        if (status.position_sec > 0) {
          videoRef.current.currentTime = status.position_sec;
        }
        // Auto-play for viewer when host is already playing
        if (!status.is_host && status.status === 'PLAYING') {
          setHostHasPlayed(true);
          videoRef.current.play().catch(() => {});
        }
        setTimeout(() => { syncLockRef.current = false; }, 500);
      }, 800);

      // If host, start syncing position every 5s
      if (status.is_host) {
        if (syncPositionIntervalRef.current) clearInterval(syncPositionIntervalRef.current);
        syncPositionIntervalRef.current = setInterval(() => {
          if (videoRef.current && !videoRef.current.paused) {
            emitSyncPosition(videoRef.current.currentTime);
          }
        }, 5000);
      }
    },

    onPlay: ({ position_sec }) => {
      if (!videoRef.current) return;
      setHostHasPlayed(true);
      setWaitingForHost(false);
      setWaitReason(null);
      hostPausePositionRef.current = null; // Clear pause position limit
      syncLockRef.current = true;
      videoRef.current.currentTime = position_sec;
      videoRef.current.play().catch(() => {});
      setRoomStatus(prev => prev ? { ...prev, status: 'PLAYING' } : prev);
      setTimeout(() => { syncLockRef.current = false; }, 500);

      // Add system message
      setChatMessages(prev => [...prev, {
        user_id: 'system', username: t('systemUser'),
        message: t('playedVideo', { host: roomStatus?.host_name || t('hostFallback') }),
        sent_at: new Date().toISOString(), type: 'system', systemKind: 'play',
      }]);
    },

    onPause: ({ position_sec }) => {
      if (!videoRef.current) return;
      hostPausePositionRef.current = position_sec; // Store host pause position
      syncLockRef.current = true;
      videoRef.current.currentTime = position_sec;
      videoRef.current.pause();
      setWaitingForHost(false);
      setWaitReason(null);
      setRoomStatus(prev => prev ? { ...prev, status: 'PAUSED' } : prev);
      setTimeout(() => { syncLockRef.current = false; }, 500);

      // Add system message
      setChatMessages(prev => [...prev, {
        user_id: 'system', username: t('systemUser'),
        message: t('pausedVideo', { host: roomStatus?.host_name || t('hostFallback') }),
        sent_at: new Date().toISOString(), type: 'system', systemKind: 'pause',
      }]);
    },

    onSeek: ({ position_sec }) => {
      if (!videoRef.current) return;
      syncLockRef.current = true;
      videoRef.current.currentTime = position_sec;
      setTimeout(() => { syncLockRef.current = false; }, 500);
    },

    onSyncToggle: ({ force_sync }) => {
      setForceSync(force_sync);
      const toggleMsg = force_sync ? t('forceSyncEnabledNotice') : t('freeSeekEnabledNotice');
      showNotification(`🔒 ${toggleMsg}`);
      setChatMessages(prev => [...prev, {
        user_id: 'system', username: t('systemUser'),
        message: force_sync
          ? t('forceSyncEnabledMessage', { host: roomStatus?.host_name || t('hostFallback') })
          : t('freeSeekEnabledMessage', { host: roomStatus?.host_name || t('hostFallback') }),
        sent_at: new Date().toISOString(), type: 'system', systemKind: 'sync',
      }]);
    },

    onChange: ({ stream_url, title }) => {
      setStreamUrl(stream_url);
      if (title) setRoomTitle(title);
      showNotification(`🎬 ${t('streamChanged')}`);
    },

    onUserJoined: ({ username, user_id, avatar, member_count }) => {
      setMemberCount(member_count);
      showNotification(`👋 ${t('userJoined', { user: username })}`);
      setChatMessages(prev => [...prev, {
        user_id: 'system', username: t('systemUser'),
        message: t('userJoined', { user: username }),
        sent_at: new Date().toISOString(), type: 'system', systemKind: 'join',
      }]);
      // Update roomMembers
      setRoomMembers(prev => {
        if (prev.some(m => m.user_id === user_id)) return prev;
        return [...prev, { user_id, username, avatar, is_host: false }];
      });
    },

    onUserLeft: ({ username, user_id, member_count }) => {
      setMemberCount(member_count);
      showNotification(`🚪 ${t('userLeft', { user: username })}`);
      setChatMessages(prev => [...prev, {
        user_id: 'system', username: t('systemUser'),
        message: t('userLeft', { user: username }),
        sent_at: new Date().toISOString(), type: 'system', systemKind: 'leave',
      }]);
      // Update roomMembers
      setRoomMembers(prev => prev.filter(m => m.user_id !== user_id));
    },

    onKick: () => {
      showNotification(t('removedFromRoom'));
      setTimeout(() => router.push('/streaming-lobby'), 3000);
    },

    onRoomClosed: ({ message }) => {
      setRoomClosed(true);
      showNotification(message);
      setTimeout(() => router.push('/streaming-lobby'), 5000);
    },

    onRoomExpired: ({ message }) => {
      setRoomClosed(true);
      showNotification(message);
      setTimeout(() => router.push('/streaming-lobby'), 5000);
    },

    // Drift correction: host sends position every 5s
    // If viewer is more than 1 second ahead, show loading and wait
    onSyncPosition: ({ position_sec }) => {
      if (!videoRef.current || isHost) return;
      const viewerTime = videoRef.current.currentTime;
      const drift = viewerTime - position_sec; // positive = viewer ahead

      if (drift > 1) {
        // Viewer is ahead → show loading, pause, seek to host position
        setWaitingForHost(true);
        setWaitReason('syncing');
        syncLockRef.current = true;
        videoRef.current.pause();
        videoRef.current.currentTime = position_sec;
        setTimeout(() => { syncLockRef.current = false; }, 500);
      } else if (drift < -2) {
        // Viewer is behind by more than 2s → seek forward
        syncLockRef.current = true;
        videoRef.current.currentTime = position_sec;
        setTimeout(() => { syncLockRef.current = false; }, 500);
      } else if (waitingForHost && Math.abs(drift) <= 1) {
        // Drift resolved → resume
        setWaitingForHost(false);
        setWaitReason(null);
        if (roomStatus?.status === 'PLAYING') {
          videoRef.current.play().catch(() => {});
        }
      }
    },

    // Host buffering → viewer shows loading overlay
    onHostBuffering: () => {
      if (isHost) return;
      setWaitingForHost(true);
      setWaitReason('host_buffering');
      if (videoRef.current) {
        syncLockRef.current = true;
        videoRef.current.pause();
        setTimeout(() => { syncLockRef.current = false; }, 500);
      }
    },

    // Host done buffering → viewer resumes
    onHostBufferEnd: ({ position_sec }) => {
      if (isHost) return;
      setWaitingForHost(false);
      setWaitReason(null);
      if (videoRef.current) {
        syncLockRef.current = true;
        videoRef.current.currentTime = position_sec;
        if (roomStatus?.status === 'PLAYING') {
          videoRef.current.play().catch(() => {});
        }
        setTimeout(() => { syncLockRef.current = false; }, 500);
      }
    },

    onChat: (msg) => {
      setChatMessages(prev => [...prev, { ...msg, type: 'user' }]);
      // Track unread if chat is closed
      if (!showChatRef.current) {
        setUnreadCount(prev => prev + 1);
      }
    },

    onEmojiReaction: ({ emoji, username: emojiUser, user_id: senderUserId }) => {
      // Only show floating emoji if it's from another user (sender handles it instantly locally)
      if (senderUserId !== userId) {
        const id = ++emojiIdRef.current;
        setFloatingEmojis(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
        setTimeout(() => {
          setFloatingEmojis(prev => prev.filter(e => e.id !== id));
        }, 5500); // Float for 5.5 seconds
      }
      setChatMessages(prev => [...prev, {
        user_id: 'system', username: t('systemUser'),
        message: t('reactedWithEmoji', { user: emojiUser, emoji }),
        sent_at: new Date().toISOString(), type: 'system', systemKind: 'react',
      }]);
    },

    onError: ({ message }) => {
      showNotification(`⚠️ ${message}`);
    },
  });

  // ─── Video event handlers (host broadcasts) ─────────────

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isHost) return;

    const handlePlay = () => {
      if (syncLockRef.current) return;
      emitPlay(video.currentTime);
    };

    const handlePause = () => {
      if (syncLockRef.current) return;
      emitPause(video.currentTime);
    };

    const handleSeeked = () => {
      if (syncLockRef.current) return;
      emitSeek(video.currentTime);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);

    // Host: detect buffering and broadcast to viewers
    const handleWaiting = () => {
      emitHostBuffering();
    };
    const handleCanPlay = () => {
      emitHostBufferEnd(video.currentTime);
    };
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [isHost, emitPlay, emitPause, emitSeek, emitHostBuffering, emitHostBufferEnd]);

  // Viewer: enforce host pause position limit
  useEffect(() => {
    const video = videoRef.current;
    if (!video || isHost) return;

    const handleTimeUpdate = () => {
      const pausePos = hostPausePositionRef.current;
      if (pausePos !== null && roomStatus?.status === 'PAUSED' && video.currentTime >= pausePos) {
        syncLockRef.current = true;
        video.currentTime = pausePos;
        video.pause();
        setWaitingForHost(true);
        setWaitReason('host_paused');
        setTimeout(() => { syncLockRef.current = false; }, 500);
      }
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    return () => video.removeEventListener('timeupdate', handleTimeUpdate);
  }, [isHost, roomStatus?.status]);

  // Auto-scroll chat (only scroll chat container, not the page)
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({
        top: chatScrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
      setIsAtBottom(true);
      setHasNewMessage(false);
    }
  }, []);

  const handleChatScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const atBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(atBottom);
    if (atBottom) {
      setHasNewMessage(false);
    }
  }, []);

  useEffect(() => {
    if (chatScrollRef.current) {
      if (isAtBottom) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
      } else {
        setHasNewMessage(true);
      }
    }
  }, [chatMessages, isAtBottom]);

  // Emit LEAVE_ROOM on tab close / page refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      emitLeaveRoom();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [emitLeaveRoom]);

  // Track showChat in ref (for unread counting)
  useEffect(() => {
    showChatRef.current = showChat;
    if (showChat) setUnreadCount(0);
  }, [showChat]);

  // Cleanup sync interval on unmount
  useEffect(() => {
    return () => {
      if (syncPositionIntervalRef.current) clearInterval(syncPositionIntervalRef.current);
    };
  }, []);

  // ─── Fullscreen tracking ─────────────────────────────────
  useEffect(() => {
    const handler = () => {
      const fs = !!(document.fullscreenElement ||
        (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement);
      setIsPlayerFullscreen(fs);
    };
    document.addEventListener('fullscreenchange', handler);
    document.addEventListener('webkitfullscreenchange', handler);
    return () => {
      document.removeEventListener('fullscreenchange', handler);
      document.removeEventListener('webkitfullscreenchange', handler);
    };
  }, []);

  // ─── Handlers ───────────────────────────────────────────

  const handleSendChat = () => {
    if (!chatInput.trim()) return;
    emitChat(chatInput.trim());
    setChatInput('');
  };

  const handleEmojiReaction = (emoji: string) => {
    emitEmoji(emoji);
    setShowEmojis(false);

    // Show floating emoji immediately (local feedback) with no lag
    const id = ++emojiIdRef.current;
    setFloatingEmojis(prev => [...prev, { id, emoji, x: Math.random() * 80 + 10 }]);
    setTimeout(() => {
      setFloatingEmojis(prev => prev.filter(e => e.id !== id));
    }, 5500); // Float for 5.5 seconds
  };

  const handleCopyInvite = () => {
    const inviteUrl = `${window.location.origin}/streaming-room?room=${roomId}`;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const handleCopyRoomId = () => {
    if (!roomId) return;
    navigator.clipboard.writeText(roomId).then(() => {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2500);
    });
  };

  const handleToggleSync = () => {
    emitSyncToggle(!forceSync);
  };

  // ─── Auth Gate ──────────────────────────────────────────

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="mb-6 mx-auto w-20 h-20 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
            <AlertTriangle className="h-9 w-9 text-yellow-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3 bg-gradient-to-r from-yellow-400 to-amber-400 bg-clip-text text-transparent">{t('signInRequired')}</h1>
          <p className="text-gray-400 mb-6 text-sm">{t('signInDesc')}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => router.push('/login')} className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 transition-all text-sm">{t('signIn')}</button>
            <button onClick={() => router.push('/streaming-lobby')} className="px-6 py-2.5 bg-gray-800 text-gray-300 font-semibold rounded-lg hover:bg-gray-700 transition-all border border-gray-700 text-sm">{t('backToLobby')}</button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (!roomId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center max-w-md">
          <Hash className="h-12 w-12 text-gray-500 mx-auto mb-4" />
          <h1 className="text-xl font-bold mb-2">{t('noRoomId')}</h1>
          <p className="text-gray-400 text-sm mb-6">{t('noRoomDesc')}</p>
          <button onClick={() => router.push('/streaming-lobby')} className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-lg text-sm">{t('goToLobby')}</button>
        </motion.div>
      </div>
    );
  }

  // ─── Room Closed Overlay ────────────────────────────────

  if (roomClosed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center px-4">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center max-w-md">
          <div className="mb-6 mx-auto w-20 h-20 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <LogOut className="h-9 w-9 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold mb-3 text-red-300">{t('sessionEnded')}</h1>
          <p className="text-gray-400 text-sm mb-2">{notification || t('sessionEndedDefaultDesc')}</p>
          <p className="text-gray-500 text-xs">{t('redirectingLobby')}</p>
        </motion.div>
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex flex-col">
      {/* ─── Top HUD Bar (Floating in non-fullscreen) ─── */}
      <div className={`z-40 w-full ${isPlayerFullscreen ? 'bg-black/60 border-b border-gray-800' : 'max-w-7xl mx-auto px-2 sm:px-6 pt-3 shrink-0'}`}>
        <div className={isPlayerFullscreen ? 'px-3 sm:px-6 py-2.5' : 'bg-black/40 backdrop-blur-xl border border-white/[0.05] rounded-xl px-4 py-2.5 shadow-2xl'}>
          <div className="flex items-center justify-between">
            {/* Left */}
            <div className="flex items-center gap-3 sm:gap-5 min-w-0">
              <button onClick={() => router.push('/streaming-lobby')} className="flex items-center gap-1.5 text-gray-400 hover:text-yellow-400 transition-colors text-sm shrink-0">
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t('lobby')}</span>
              </button>

              <div className="flex items-center gap-1.5 text-yellow-400 shrink-0">
                <Hash className="h-3.5 w-3.5" />
                <span className="text-sm font-mono font-bold">{roomId}</span>
                <button
                  onClick={handleCopyRoomId}
                  className="p-1 text-gray-500 hover:text-yellow-400 transition-colors rounded"
                  title={t('copyRoomId')}
                >
                  {copiedId ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-1.5">
                {isConnected ? (
                  <><div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" /><span className="text-xs text-green-400">{t('connected')}</span></>
                ) : (
                  <><div className="w-2 h-2 bg-red-400 rounded-full" /><span className="text-xs text-red-400">{t('disconnected')}</span></>
                )}
              </div>
            </div>

            {/* Right */}
            <div className="flex items-center gap-2 sm:gap-4">
              {isHost && (
                <span className="flex items-center gap-1 text-yellow-400 text-xs font-semibold bg-yellow-500/10 px-2 py-1 rounded-md">
                  <Crown className="h-3 w-3 animate-pulse" /> {t('hostBadge')}
                </span>
              )}

              {/* Dynamic Member Popover Button */}
              <div className="relative">
                <button
                  onClick={() => setShowMembers(prev => !prev)}
                  className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors text-xs sm:text-sm px-2 py-1 rounded-lg hover:bg-white/[0.05] border border-transparent hover:border-white/[0.08]"
                  title={t('viewActiveMembers')}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>{memberCount}/{roomStatus?.max_users || 2}</span>
                  <ChevronDown className={`h-3 w-3 transition-transform ${showMembers ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showMembers && (
                    <motion.div
                      initial={{ opacity: 0, y: 8, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 8, scale: 0.95 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 mt-2 w-48 bg-gray-950/95 backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-2 z-[60]"
                    >
                      <div className="text-[10px] text-gray-500 px-2 py-1 uppercase tracking-wider font-semibold border-b border-white/[0.05] mb-1">
                        {t('activeMembersCount', { count: roomMembers.length })}
                      </div>
                      <div className="space-y-0.5 max-h-[160px] overflow-y-auto chat-scrollbar">
                        {roomMembers.length === 0 ? (
                          <div className="text-center py-2 text-xs text-gray-600">{t('noMembers')}</div>
                        ) : (
                          roomMembers.map(member => (
                            <div key={member.user_id} className="flex items-center justify-between px-2 py-1 rounded hover:bg-white/[0.03] transition-colors">
                              <div className="flex items-center gap-1.5 min-w-0">
                                {member.avatar ? (
                                  <Image
                                    src={member.avatar}
                                    alt={member.username}
                                    width={22}
                                    height={22}
                                    unoptimized
                                    className="w-5.5 h-5.5 rounded-full object-cover shrink-0 shadow-sm border border-gray-600/50"
                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
                                  />
                                ) : null}
                                <div className={`w-5.5 h-5.5 rounded-full bg-gradient-to-br ${getAvatarGradient(member.user_id)} flex items-center justify-center text-white text-[9px] font-bold shrink-0 shadow-sm ${member.avatar ? 'hidden' : ''}`}>
                                  {member.username?.charAt(0)?.toUpperCase() || '?'}
                                </div>
                                <span className="text-xs text-gray-300 truncate max-w-[100px]" title={member.username}>
                                  {member.username}
                                </span>
                              </div>
                              {member.is_host && (
                                <span title={t('roomHost')} className="shrink-0">
                                  <Crown className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500/20" />
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <button onClick={handleCopyInvite} className="flex items-center gap-1 px-2.5 py-1.5 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-all text-xs border border-gray-700">
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Share2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{copied ? t('copied') : t('share')}</span>
              </button>

              {isHost && (
                <button onClick={handleToggleSync} title={forceSync ? t('forceSyncOn') : t('freeSeekOn')}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs border transition-all ${forceSync ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                >
                  {forceSync ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{forceSync ? t('syncLabel') : t('freeLabel')}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Notification Toast ──────────────────────────── */}
      <AnimatePresence>
        {notification && !roomClosed && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] px-4 py-2.5 bg-gray-800/95 backdrop-blur-sm border border-yellow-500/30 rounded-xl shadow-2xl text-sm text-yellow-300 whitespace-nowrap"
          >
            {notification}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Main Content ────────────────────────────────── */}
      <div className="flex-grow flex flex-col max-w-7xl mx-auto w-full px-2 sm:px-6 py-2 sm:py-3 gap-2">
        {/* Title bar (hidden in fullscreen) */}
        {!isPlayerFullscreen && (
          <div className="flex items-center gap-2 min-w-0">
            <Radio className="h-4 w-4 text-yellow-400 shrink-0" />
            <h1 className="text-sm sm:text-base font-semibold truncate">{roomTitle || t('watchParty')}</h1>
            {roomStatus && (
              <span className={`shrink-0 px-2 py-0.5 text-[10px] font-bold rounded-full ${
                roomStatus.status === 'PLAYING' ? 'bg-green-500/20 text-green-400' :
                roomStatus.status === 'PAUSED' ? 'bg-yellow-500/20 text-yellow-400' :
                roomStatus.status === 'WAITING' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>
                {getStatusLabel(roomStatus.status)}
              </span>
            )}
          </div>
        )}

        {/* ─── Player + Chat Container (this goes fullscreen) ─── */}
        <div
          ref={playerContainerRef}
          className={`${
            isPlayerFullscreen
              ? 'flex flex-row w-full h-full bg-black'
              : 'flex flex-col flex-grow gap-3 sm:gap-4 sm:flex-row sm:flex-grow-0 sm:h-[50vh] md:h-[55vh] lg:h-[60vh] xl:h-[65vh] 2xl:h-[68vh]'
          }`}
        >
          {/* Video Player */}
          <div className={`relative ${isPlayerFullscreen ? 'flex-grow h-full' : 'shrink-0 min-w-0 sm:shrink sm:flex-grow sm:h-full'}`}>
            <div className={`relative overflow-hidden bg-black ${
              isPlayerFullscreen
                ? 'w-full h-full'
                : 'rounded-xl border border-white/[0.08] shadow-2xl w-full max-h-[30vh] sm:max-h-none sm:h-full'
            }`}>
              {streamUrl ? (
                <EnhancedMoviePlayer
                  ref={videoRef}
                  key={streamUrl}
                  src={proxyHlsUrl(streamUrl)}
                  autoPlay={false}
                  title={roomTitle}
                  userId={userId}
                  viewerMode={!isHost && forceSync}
                  hostHasPlayed={hostHasPlayed}
                  waitingForHost={waitingForHost}
                  chatUnreadCount={unreadCount}
                  onToggleChat={() => setShowChat(prev => !prev)}
                  isStreamingRoom={true}
                  fullscreenTarget={playerContainerRef as React.RefObject<HTMLDivElement>}
                />
              ) : (
                <div className="flex items-center justify-center h-full min-h-[200px]">
                  <div className="text-center">
                    <Clock className="h-8 w-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm font-medium">{t('waitingForStream')}</p>
                    <p className="text-gray-500 text-xs mt-1">{t('hostWillStartSoon')}</p>
                  </div>
                </div>
              )}

              {/* Wobble Sinusoidal reactions floating animation */}
              <AnimatePresence>
                {floatingEmojis.map(({ id, emoji, x }) => (
                  <motion.div
                    key={id}
                    initial={{ opacity: 0, y: 0, scale: 0, rotate: 0 }}
                    animate={{
                      opacity: [0, 1, 1, 0.8, 0],
                      scale: [0, 1.4, 1.1, 1.2, 1, 0],
                      y: [0, -50, -100, -150, -200, -250, -300],
                      x: [0, Math.sin(id) * 30, Math.sin(id + 1) * -35, Math.sin(id + 2) * 25, Math.sin(id + 3) * -20, 0],
                      rotate: [0, -10, 10, -5, 5, 0],
                    }}
                    exit={{ opacity: 0, scale: 0.3 }}
                    transition={{
                      duration: 5,
                      ease: [0.25, 0.1, 0.25, 1],
                      opacity: { duration: 5, times: [0, 0.05, 0.8, 0.9, 1] },
                      scale: { duration: 5, times: [0, 0.05, 0.15, 0.8, 0.9, 1] },
                      y: { duration: 5, ease: 'easeOut' },
                      x: { duration: 5, ease: 'easeInOut' },
                      rotate: { duration: 5, ease: 'easeInOut' },
                    }}
                    className="absolute bottom-6 text-4xl pointer-events-none z-50 select-none filter drop-shadow-[0_2px_12px_rgba(0,0,0,0.7)]"
                    style={{ left: `${x}%` }}
                  >
                    {emoji}
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Waiting notification pill */}
              <AnimatePresence>
                {waitingForHost && !isHost && (
                  <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.3 }}
                    className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-none"
                  >
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 backdrop-blur-md border border-gray-600/40 shadow-lg">
                      <div className="w-3.5 h-3.5 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                      <span className="text-[11px] text-gray-200 font-medium whitespace-nowrap">
                        {waitReason === 'host_paused' ? t('hostPausedWaiting') :
                         waitReason === 'host_buffering' ? t('hostBuffering') :
                         t('syncingWithHost')}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ─── Chat Panel (Ultra Glassmorphism Sidebar) ─── */}
          {showChat && (
            <div
              className={`flex flex-col shrink-0 overflow-hidden relative ${
                isPlayerFullscreen
                  ? 'w-[340px] h-full bg-gray-950/95 backdrop-blur-md border-l border-gray-700/50'
                  : 'w-full h-[40vh] sm:h-full sm:flex-grow-0 sm:w-[280px] md:w-[300px] lg:w-[320px] xl:w-[340px] bg-white/[0.02] backdrop-blur-md border border-white/[0.08] rounded-xl shadow-2xl'
              }`}
            >
              {/* Chat Header */}
              <div className="px-3 sm:px-4 py-2 sm:py-2.5 border-b border-white/[0.05] flex items-center justify-between shrink-0">
                <span className="text-xs sm:text-sm font-semibold text-gray-200">{t('roomChat')}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] sm:text-[11px] text-gray-500">{chatMessages.length}</span>
                  <button
                    onClick={() => setShowChat(false)}
                    className="text-gray-400 hover:text-white transition-colors p-1 rounded-md hover:bg-gray-700/50"
                    title={t('closeChat')}
                  >
                    <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div
                ref={chatScrollRef}
                onScroll={handleChatScroll}
                className="chat-scrollbar flex-grow overflow-y-auto px-2 sm:px-3 py-1.5 sm:py-2 space-y-1.5 sm:space-y-2"
              >
                {chatMessages.length === 0 && (
                  <div className="text-center text-gray-600 text-xs py-4 sm:py-8">
                    No messages yet. Say hi! 👋
                  </div>
                )}

                {chatMessages.map((msg, i) => (
                  msg.type === 'system' ? (() => {
                    const isJoin = msg.systemKind === 'join';
                    const isLeave = msg.systemKind === 'leave';
                    const isPause = msg.systemKind === 'pause';
                    const isPlay = msg.systemKind === 'play';
                    const isReact = msg.systemKind === 'react';

                    let bgClass = 'bg-gray-800/40 text-gray-400 border-gray-700/30';
                    let icon = '📢';

                    if (isJoin) {
                      bgClass = 'bg-green-500/10 text-green-400 border-green-500/20';
                      icon = '👋';
                    } else if (isLeave) {
                      bgClass = 'bg-red-500/10 text-red-400 border-red-500/20';
                      icon = '🚪';
                    } else if (isPause) {
                      bgClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
                      icon = '👑';
                    } else if (isPlay) {
                      bgClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                      icon = '▶️';
                    } else if (isReact) {
                      bgClass = 'bg-purple-500/10 text-purple-400 border-purple-500/20';
                      icon = '✨';
                    }

                    return (
                      <div key={i} className="flex justify-center py-1 sm:py-1.5">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] sm:text-[11px] border shadow-sm ${bgClass}`}>
                          <span>{icon}</span>
                          <span className="font-semibold">{msg.message}</span>
                        </span>
                      </div>
                    );
                  })() : (
                    <div key={i} className="flex items-start gap-1.5 sm:gap-2 py-0.5 hover:bg-white/[0.03] rounded px-1 -mx-1 transition-colors">
                      <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br ${getAvatarGradient(msg.user_id)} flex items-center justify-center text-[9px] sm:text-[10px] font-bold text-white shrink-0 mt-0.5`}>
                        {msg.username?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div className="min-w-0 flex-grow">
                        <span className="text-[11px] sm:text-xs font-semibold text-yellow-300 mr-1">{msg.username}</span>
                        <span className="text-xs sm:text-sm text-gray-300 break-words leading-relaxed">{msg.message}</span>
                      </div>
                    </div>
                  )
                ))}
              </div>

              {/* Scroll To Bottom Button */}
              <AnimatePresence>
                {!isAtBottom && hasNewMessage && (
                  <motion.button
                    initial={{ opacity: 0, y: 10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.9 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-16 sm:bottom-20 left-1/2 -translate-x-1/2 bg-yellow-500 text-black px-4 py-1.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.5)] font-semibold text-xs sm:text-sm flex items-center gap-1.5 hover:bg-yellow-400 z-50 transition-colors border border-yellow-600/50"
                  >
                    <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 stroke-[3]" />
                    New message
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Emoji Bar — Absolute Popover nổi lên trên tin nhắn */}
              <AnimatePresence>
                {showEmojis && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.15, ease: 'easeOut' }}
                    className="absolute bottom-12 left-2 right-2 z-50 bg-gray-950/95 backdrop-blur-md border border-gray-800 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] p-2 max-h-[150px] overflow-y-auto chat-scrollbar"
                  >
                    <div className="grid grid-cols-6 sm:grid-cols-8 gap-1.5 justify-items-center">
                      {EMOJIS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => handleEmojiReaction(emoji)}
                          className="text-xl hover:scale-125 active:scale-95 transition-transform p-1 rounded hover:bg-white/10"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chat Input */}
              <div className="px-2 sm:px-3 py-1.5 sm:py-2 border-t border-gray-800/80 shrink-0">
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <button
                    onClick={() => setShowEmojis(!showEmojis)}
                    className={`p-1 sm:p-1.5 rounded-lg transition-colors shrink-0 ${showEmojis ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800'}`}
                  >
                    <Smile className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
                    placeholder={t('chatPlaceholder')}
                    className="flex-grow bg-gray-800/50 border border-gray-700/40 rounded-full px-3 py-1 sm:py-1.5 text-base text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/30 focus:border-yellow-500/30 transition-all"
                    maxLength={500}
                  />
                  <button
                    onClick={handleSendChat}
                    disabled={!chatInput.trim()}
                    className="p-1 sm:p-1.5 bg-yellow-500 text-black rounded-full hover:bg-yellow-400 disabled:bg-gray-700 disabled:text-gray-500 transition-colors shrink-0"
                  >
                    <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Host info bar (hidden in fullscreen) */}
        {!isPlayerFullscreen && roomStatus && (
          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>{t('hostedBy')} <span className="text-gray-300 font-medium">{roomStatus.host_name}</span></span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {forceSync ? t('syncedPlayback') : t('freeSeekEnabled')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page Export with Suspense ───────────────────────────────

export default function StreamingRoomPage() {
  const t = useTranslations('StreamingRoom');

  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-400">{t('joiningRoom')}</span>
        </div>
      </div>
    }>
      <StreamingRoomContent />
    </Suspense>
  );
}
