'use client';

import { useState, useEffect, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  LockClosedIcon as Lock,
  ClockIcon as Clock,
  ArrowRightOnRectangleIcon as LogIn,
  XMarkIcon as X,
  EyeIcon,
  EyeSlashIcon,
} from '@heroicons/react/24/outline';
import api from '@/lib/axios';
import useAuthStore from '@/store/useAuthStore';

export interface ActiveRoom {
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
  has_password?: boolean;
}

export const isTvShowRoom = (room: ActiveRoom): boolean => {
  if (room.content_type === 'tvshow') return true;
  if (room.content_type === 'movie') return false;
  if (room.season || room.current_episode) return true;
  const title = room.title || '';
  return (
    /\b(s\d+\s*e\d+|s\d+|e\d+|ep\s*\d+|ep\.\d+|season\s*\d+|tập\s*\d+|episode\s*\d+|ss\d+|ss\s*\d+)\b/i.test(title) ||
    /[-_\s](s\d+|e\d+|ep\d+|tập\s*\d+)/i.test(title)
  );
};

interface ProtectedRoomModalProps {
  room: ActiveRoom | null;
  onClose: () => void;
}

function ProtectedRoomModal({ room, onClose }: ProtectedRoomModalProps) {
  const router = useRouter();
  const t = useTranslations('StreamingLobby');
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const [joinPassword, setJoinPassword] = useState('');
  const [showJoinPassword, setShowJoinPassword] = useState(false);
  const [joinPasswordError, setJoinPasswordError] = useState('');
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [joinLockTimer, setJoinLockTimer] = useState<number>(0);

  // Rate-limit countdown timer for join modal - isolated inside this component!
  useEffect(() => {
    if (joinLockTimer <= 0) return;
    const interval = setInterval(() => {
      setJoinLockTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setJoinPasswordError('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [joinLockTimer]);

  // Reset inputs when switching room
  useEffect(() => {
    if (room) {
      setJoinPassword('');
      setJoinPasswordError('');
    }
  }, [room]);

  const formatLockTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const submitJoinPassword = async () => {
    if (!room) return;
    if (!isAuthenticated) {
      onClose();
      router.push('/login');
      return;
    }
    if (joinLockTimer > 0) return;
    const cleanPin = joinPassword.trim();
    if (!cleanPin) {
      setJoinPasswordError(t('enterPasswordTitle'));
      return;
    }
    if (cleanPin.length !== 6) {
      setJoinPasswordError(t('pinMustBe6Digits'));
      return;
    }
    setIsVerifyingPassword(true);
    setJoinPasswordError('');
    try {
      const res = await api.post(`/rooms/${encodeURIComponent(room.room_id)}/verify-password`, {
        password: cleanPin,
      });
      if (res.data?.success) {
        try {
          sessionStorage.setItem(`room_pin_${room.room_id}`, cleanPin);
        } catch {}
        const roomType = isTvShowRoom(room) ? 'tvshow' : 'movie';
        router.push(
          `/streaming-room?room=${encodeURIComponent(room.room_id)}&type=${roomType}&title=${encodeURIComponent(
            room.title || ''
          )}`
        );
        onClose();
      } else {
        setJoinPasswordError(t('incorrectPassword'));
      }
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: {
          status?: number;
          data?: { error?: string; locked?: boolean; remaining_seconds?: number; attempts_left?: number };
        };
      };
      const data = axiosErr?.response?.data;
      if (data?.locked && data?.remaining_seconds) {
        setJoinLockTimer(data.remaining_seconds);
      }
      if (data?.attempts_left !== undefined && data.attempts_left > 0 && !data.locked) {
        setJoinPasswordError(`${t('incorrectPassword')} (${t('attemptsLeft', { count: data.attempts_left })})`);
      } else {
        setJoinPasswordError(data?.error || t('incorrectPassword'));
      }
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  return (
    <AnimatePresence>
      {room && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          {!isAuthenticated ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-gray-800/95 backdrop-blur-xl border border-gray-700/60 rounded-2xl p-6 shadow-2xl relative text-center"
            >
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3 right-3 p-1 text-gray-500 hover:text-white transition-colors rounded-lg hover:bg-gray-700/50"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-gradient-to-br from-yellow-500/20 to-amber-500/20 border border-yellow-500/30 flex items-center justify-center">
                <LogIn className="h-7 w-7 text-yellow-400" />
              </div>
              <h3 className="text-lg font-bold text-white mb-1">{t('signInRequired')}</h3>
              <p className="text-sm text-gray-400 mb-5">{t('pleaseSignIn')}</p>
              <div className="flex gap-2.5 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/login');
                  }}
                  className="px-5 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 transition-all text-sm shadow-lg shadow-yellow-500/20"
                >
                  {t('signIn')}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 bg-gray-700 text-gray-300 font-semibold rounded-lg hover:bg-gray-600 transition-all text-sm border border-gray-600"
                >
                  {t('cancel')}
                </button>
              </div>
            </motion.div>
          ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm bg-gradient-to-br from-zinc-900 via-zinc-900 to-black border border-amber-500/30 rounded-2xl p-5 shadow-2xl relative"
          >
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div className="min-w-0 pr-6">
                <h3 className="text-base font-bold text-white truncate">{t('enterPasswordTitle')}</h3>
                <p className="text-xs text-gray-400 truncate">{room.title}</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 mb-3">{t('enterPasswordDesc')}</p>

            <div className="space-y-3">
              {joinLockTimer > 0 && (
                <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs">
                  <Clock className="w-4 h-4 shrink-0 animate-pulse text-amber-400" />
                  <span className="font-medium">
                    {t('rateLimitedMessage', { time: formatLockTime(joinLockTimer) })}
                  </span>
                </div>
              )}

              <div className="relative">
                <input
                  type={showJoinPassword ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  disabled={joinLockTimer > 0 || isVerifyingPassword}
                  value={joinPassword}
                  onChange={(e) => {
                    setJoinPassword(e.target.value.replace(/\D/g, '').slice(0, 6));
                    setJoinPasswordError('');
                  }}
                  placeholder={t('passwordPlaceholder')}
                  className="w-full px-3.5 py-2.5 pr-10 bg-zinc-950/80 border border-white/15 rounded-xl text-[16px] sm:text-base text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 font-mono text-center tracking-widest disabled:opacity-40 disabled:cursor-not-allowed"
                  autoFocus
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await submitJoinPassword();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={joinLockTimer > 0}
                  onClick={() => setShowJoinPassword(!showJoinPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white disabled:opacity-40"
                >
                  {showJoinPassword ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                </button>
              </div>

              {joinPasswordError && (
                <p className="text-xs text-red-400 bg-red-950/40 p-2 rounded-lg border border-red-500/20">
                  {joinPasswordError}
                </p>
              )}

              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 text-gray-300 font-semibold text-xs rounded-xl transition-all"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  onClick={submitJoinPassword}
                  disabled={isVerifyingPassword || joinLockTimer > 0}
                  className="flex-1 py-2 px-3 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-1.5 active:scale-98"
                >
                  {isVerifyingPassword ? (
                    <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                  ) : (
                    <LogIn className="w-3.5 h-3.5" />
                  )}
                  <span>{t('confirmJoin')}</span>
                </button>
              </div>
            </div>
          </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}

export default memo(ProtectedRoomModal);
