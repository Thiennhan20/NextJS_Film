'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useTranslations } from 'next-intl';

// ─── Types ──────────────────────────────────────────────────

export interface RoomStatus {
  status: 'WAITING' | 'PLAYING' | 'PAUSED' | 'ENDED';
  position_sec: number;
  force_sync: boolean;
  member_count: number;
  max_users: number;
  title: string;
  host_name: string;
  is_host: boolean;
  stream_url: string;
  members?: {
    user_id: string;
    username: string;
    avatar?: string;
    is_host: boolean;
  }[];
}

export interface ChatMessage {
  user_id: string;
  username: string;
  message: string;
  sent_at: string;
  type?: 'user' | 'system';
  systemKind?: 'join' | 'leave' | 'play' | 'pause' | 'sync' | 'react';
}

export interface EmojiReaction {
  user_id: string;
  username: string;
  emoji: string;
  sent_at: string;
}

export interface UserEvent {
  user_id: string;
  username: string;
  avatar?: string;
  member_count: number;
  is_host?: boolean;
}

interface UseWatchPartySocketOptions {
  roomId: string | null;
  token: string | null;
  onRoomStatus?: (status: RoomStatus) => void;
  onPlay?: (data: { position_sec: number }) => void;
  onPause?: (data: { position_sec: number }) => void;
  onSeek?: (data: { position_sec: number }) => void;
  onSyncToggle?: (data: { force_sync: boolean }) => void;
  onChange?: (data: { stream_url: string; title: string }) => void;
  onUserJoined?: (data: UserEvent) => void;
  onUserLeft?: (data: UserEvent) => void;
  onKick?: (data: { user_id: string; message: string }) => void;
  onRoomClosed?: (data: { message: string }) => void;
  onRoomExpired?: (data: { message: string }) => void;
  onChat?: (msg: ChatMessage) => void;
  onEmojiReaction?: (data: EmojiReaction) => void;
  onSyncPosition?: (data: { position_sec: number }) => void;
  onHostBuffering?: () => void;
  onHostBufferEnd?: (data: { position_sec: number }) => void;
  onError?: (data: { message: string }) => void;
}

export function useWatchPartySocket({
  roomId,
  token,
  onRoomStatus,
  onPlay,
  onPause,
  onSeek,
  onSyncToggle,
  onChange,
  onUserJoined,
  onUserLeft,
  onKick,
  onRoomClosed,
  onRoomExpired,
  onChat,
  onEmojiReaction,
  onSyncPosition,
  onHostBuffering,
  onHostBufferEnd,
  onError,
}: UseWatchPartySocketOptions) {
  const t = useTranslations('StreamingRoom');
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);

  // Store latest callbacks in refs to avoid reconnection on callback changes
  const callbacksRef = useRef({
    onRoomStatus, onPlay, onPause, onSeek, onSyncToggle,
    onChange, onUserJoined, onUserLeft, onKick, onRoomClosed,
    onRoomExpired, onChat, onEmojiReaction, onSyncPosition,
    onHostBuffering, onHostBufferEnd, onError,
  });

  useEffect(() => {
    callbacksRef.current = {
      onRoomStatus, onPlay, onPause, onSeek, onSyncToggle,
      onChange, onUserJoined, onUserLeft, onKick, onRoomClosed,
      onRoomExpired, onChat, onEmojiReaction, onSyncPosition,
      onHostBuffering, onHostBufferEnd, onError,
    };
  });

  // Connect to /watch-party namespace
  useEffect(() => {
    if (!roomId || !token) return;

    const wsUrl = typeof window !== 'undefined' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:3001/watch-party'
      : `${process.env.NEXT_PUBLIC_WS_URL || ''}/watch-party`;

    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WP] Connected to /watch-party');
      setIsConnected(true);

      // Join room
      socket.emit('JOIN_ROOM', { room_id: roomId });

      // Start heartbeat (every 15s)
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      heartbeatRef.current = setInterval(() => {
        socket.emit('HEARTBEAT');
      }, 15000);
    });

    socket.on('disconnect', () => {
      console.log('[WP] Disconnected');
      setIsConnected(false);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    });

    socket.on('connect_error', (err) => {
      console.error('[WP] Connection error:', err.message);
      if (err.message.includes('AUTH_ERROR')) {
        callbacksRef.current.onError?.({ message: t('authFailed') });
      }
    });

    // ─── Room Events ───────────────────────────────────────

    socket.on('ROOM_STATUS', (data: RoomStatus) => {
      callbacksRef.current.onRoomStatus?.(data);
    });

    socket.on('PLAY', (data: { position_sec: number }) => {
      callbacksRef.current.onPlay?.(data);
    });

    socket.on('PAUSE', (data: { position_sec: number }) => {
      callbacksRef.current.onPause?.(data);
    });

    socket.on('SEEK', (data: { position_sec: number }) => {
      callbacksRef.current.onSeek?.(data);
    });

    socket.on('SYNC_TOGGLE', (data: { force_sync: boolean }) => {
      callbacksRef.current.onSyncToggle?.(data);
    });

    socket.on('CHANGE', (data: { stream_url: string; title: string }) => {
      callbacksRef.current.onChange?.(data);
    });

    socket.on('USER_JOINED', (data: UserEvent) => {
      callbacksRef.current.onUserJoined?.(data);
    });

    socket.on('USER_LEFT', (data: UserEvent) => {
      callbacksRef.current.onUserLeft?.(data);
    });

    socket.on('KICK', (data: { user_id: string; message: string }) => {
      callbacksRef.current.onKick?.(data);
    });

    socket.on('ROOM_CLOSED', (data: { message: string }) => {
      callbacksRef.current.onRoomClosed?.(data);
    });

    socket.on('ROOM_EXPIRED', (data: { message: string }) => {
      callbacksRef.current.onRoomExpired?.(data);
    });

    socket.on('CHAT', (msg: ChatMessage) => {
      callbacksRef.current.onChat?.(msg);
    });

    socket.on('EMOJI_REACTION', (data: EmojiReaction) => {
      callbacksRef.current.onEmojiReaction?.(data);
    });

    socket.on('ERROR', (data: { message: string }) => {
      callbacksRef.current.onError?.(data);
    });

    socket.on('SYNC_POSITION', (data: { position_sec: number }) => {
      callbacksRef.current.onSyncPosition?.(data);
    });

    socket.on('HOST_BUFFERING', () => {
      callbacksRef.current.onHostBuffering?.();
    });

    socket.on('HOST_BUFFER_END', (data: { position_sec: number }) => {
      callbacksRef.current.onHostBufferEnd?.(data);
    });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      // Intentional leave — tell server to skip grace period
      socket.emit('LEAVE_ROOM');
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [roomId, token, t]);

  // ─── Emit functions ───────────────────────────────────────

  const emitPlay = useCallback((positionSec: number) => {
    socketRef.current?.emit('PLAY', { position_sec: positionSec });
  }, []);

  const emitPause = useCallback((positionSec: number) => {
    socketRef.current?.emit('PAUSE', { position_sec: positionSec });
  }, []);

  const emitSeek = useCallback((positionSec: number) => {
    socketRef.current?.emit('SEEK', { position_sec: positionSec });
  }, []);

  const emitSyncToggle = useCallback((forceSync: boolean) => {
    socketRef.current?.emit('SYNC_TOGGLE', { force_sync: forceSync });
  }, []);

  const emitChange = useCallback((streamUrl: string, title: string) => {
    socketRef.current?.emit('CHANGE', { stream_url: streamUrl, title });
  }, []);

  const emitKick = useCallback((targetUserId: string) => {
    socketRef.current?.emit('KICK', { target_user_id: targetUserId });
  }, []);

  const emitChat = useCallback((message: string) => {
    socketRef.current?.emit('CHAT', { message });
  }, []);

  const emitEmoji = useCallback((emoji: string) => {
    socketRef.current?.emit('EMOJI_REACTION', { emoji });
  }, []);

  const emitSyncPosition = useCallback((positionSec: number) => {
    socketRef.current?.emit('SYNC_POSITION', { position_sec: positionSec });
  }, []);

  const emitHostBuffering = useCallback(() => {
    socketRef.current?.emit('HOST_BUFFERING');
  }, []);

  const emitHostBufferEnd = useCallback((positionSec: number) => {
    socketRef.current?.emit('HOST_BUFFER_END', { position_sec: positionSec });
  }, []);

  const emitLeaveRoom = useCallback(() => {
    socketRef.current?.emit('LEAVE_ROOM');
  }, []);

  return {
    isConnected,
    emitPlay,
    emitPause,
    emitSeek,
    emitSyncToggle,
    emitChange,
    emitKick,
    emitChat,
    emitEmoji,
    emitSyncPosition,
    emitHostBuffering,
    emitHostBufferEnd,
    emitLeaveRoom,
  };
}
