'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  XMarkIcon,
  MagnifyingGlassIcon,
  UserPlusIcon,
  CheckIcon,
  ArrowPathIcon,
  ShareIcon,
  UserGroupIcon,
  FilmIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import api from '@/lib/axios';

// Module-level map to preserve countdown timers even if the modal is closed and reopened
const inviteCooldownTimestamps: Record<string, number> = {};

interface Friend {
  _id: string;
  name: string;
  username?: string;
  avatar?: string;
}

interface RoomMember {
  user_id: string;
  username: string;
  avatar?: string;
  is_host: boolean;
}

interface InviteFriendsModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  roomTitle: string;
  roomMembers: RoomMember[];
  memberCount?: number;
  maxUsers?: number;
  onShowToast: (message: string) => void;
}

export default function InviteFriendsModal({
  isOpen,
  onClose,
  roomId,
  roomTitle,
  roomMembers,
  memberCount,
  maxUsers = 2,
  onShowToast
}: InviteFriendsModalProps) {
  const t = useTranslations('StreamingRoom');
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [invitingId, setInvitingId] = useState<string | null>(null);
  const [hasInvitedOnce, setHasInvitedOnce] = useState<Set<string>>(new Set());
  const [copiedLink, setCopiedLink] = useState<boolean>(false);

  const currentMemberCount = Math.max(roomMembers.length, Number(memberCount) || 0);
  const isRoomFull = currentMemberCount >= maxUsers;

  // Initialize countdown state from timestamps
  const [cooldowns, setCooldowns] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    const now = Date.now();
    for (const [id, expiresAt] of Object.entries(inviteCooldownTimestamps)) {
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      if (remaining > 0) {
        initial[id] = remaining;
      }
    }
    return initial;
  });

  // Re-sync countdown when modal opens
  useEffect(() => {
    if (!isOpen) return;
    const now = Date.now();
    const updated: Record<string, number> = {};
    for (const [id, expiresAt] of Object.entries(inviteCooldownTimestamps)) {
      const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
      if (remaining > 0) {
        updated[id] = remaining;
      }
    }
    setCooldowns(updated);
  }, [isOpen]);

  // Tick countdown every 1 second
  useEffect(() => {
    const hasActive = Object.values(cooldowns).some((sec) => sec > 0);
    if (!hasActive) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setCooldowns((prev) => {
        const next: Record<string, number> = {};
        let changed = false;
        for (const [id, expiresAt] of Object.entries(inviteCooldownTimestamps)) {
          const remaining = Math.max(0, Math.ceil((expiresAt - now) / 1000));
          if (remaining > 0) {
            next[id] = remaining;
            if (prev[id] !== remaining) changed = true;
          } else {
            delete inviteCooldownTimestamps[id];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [cooldowns]);

  // Fetch friends list when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const fetchFriends = async () => {
      setLoading(true);
      try {
        const res = await api.get('/friends');
        if (isMounted) {
          setFriends(res.data?.friends || []);
        }
      } catch (err) {
        console.error('Failed to load friends:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchFriends();

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Check if member already in room
  const isMemberInRoom = useCallback((friend: Friend) => {
    return roomMembers.some(
      (m) =>
        m.user_id === friend._id ||
        (friend.username && m.username?.toLowerCase() === friend.username.toLowerCase())
    );
  }, [roomMembers]);

  // Filter friends based on search query
  const filteredFriends = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return friends;
    return friends.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.username && f.username.toLowerCase().includes(q))
    );
  }, [friends, searchQuery]);

  // Send invite handler with 30s countdown
  const handleInvite = async (friend: Friend) => {
    if (invitingId || (cooldowns[friend._id] && cooldowns[friend._id] > 0)) return;

    if (isRoomFull) {
      onShowToast(t('roomFullCannotInvite', { current: currentMemberCount, max: maxUsers }));
      return;
    }

    setInvitingId(friend._id);
    try {
      await api.post(`/rooms/${roomId}/invite`, {
        friendId: friend._id
      });

      // Start 30 seconds cooldown
      inviteCooldownTimestamps[friend._id] = Date.now() + 30000;
      setCooldowns((prev) => ({ ...prev, [friend._id]: 30 }));
      setHasInvitedOnce((prev) => new Set(prev).add(friend._id));
      onShowToast(t('inviteSuccess', { name: friend.name }));
    } catch (err: unknown) {
      console.error('Invite error:', err);
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const errMsg = axiosErr?.response?.data?.error || t('inviteFailed');
      onShowToast(errMsg);
    } finally {
      setInvitingId(null);
    }
  };

  // Copy room link
  const handleCopyLink = () => {
    if (typeof window === 'undefined') return;
    const url = `${window.location.origin}/streaming-room?room=${roomId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      onShowToast(t('linkCopied'));
      setTimeout(() => setCopiedLink(false), 2000);
    });
  };

  // Deterministic avatar gradient
  const getAvatarGradient = (id: string) => {
    const gradients = [
      'from-pink-500 to-rose-500',
      'from-purple-500 to-indigo-500',
      'from-cyan-500 to-blue-500',
      'from-emerald-500 to-teal-500',
      'from-amber-500 to-orange-500',
      'from-violet-500 to-purple-600',
    ];
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return gradients[Math.abs(hash) % gradients.length];
  };

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted || typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 overflow-hidden">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-md"
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative w-full max-w-sm sm:max-w-md max-h-[85vh] sm:max-h-[80vh] flex flex-col bg-gray-950/95 border border-white/10 rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] overflow-hidden z-[130]"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-4 sm:p-5 border-b border-white/[0.08] shrink-0 bg-gradient-to-b from-white/[0.03] to-transparent">
            <div className="flex items-center gap-3 min-w-0 pr-2">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/15 border border-yellow-500/25 flex items-center justify-center text-yellow-400 shrink-0 shadow-inner">
                <UserPlusIcon className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-bold text-white truncate">
                  {t('inviteFriendsTitle')}
                </h3>
                <p className="text-xs text-gray-400 truncate flex items-center gap-1.5 mt-0.5">
                  <FilmIcon className="w-3.5 h-3.5 text-yellow-500/80 shrink-0" />
                  <span className="truncate">{roomTitle || t('watchParty')}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors shrink-0"
              aria-label={t('close')}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="px-4 py-3 border-b border-white/[0.06] shrink-0 bg-white/[0.01]">
            <div className="relative flex items-center">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center pointer-events-none text-gray-400 z-10">
                <MagnifyingGlassIcon className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('searchFriendsPlaceholder')}
                style={{ paddingLeft: '2.5rem', paddingRight: '2.25rem' }}
                className="w-full bg-white/[0.05] hover:bg-white/[0.08] focus:bg-white/[0.08] border border-white/10 focus:border-yellow-500/50 rounded-xl py-2 text-xs sm:text-sm text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-yellow-500/40 transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                  <XMarkIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Room Full Alert Banner */}
          {isRoomFull && (
            <div className="mx-4 mt-3 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/25 flex items-center gap-2.5 text-amber-300 text-xs shrink-0">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="leading-relaxed font-medium">{t('roomFullBanner', { current: currentMemberCount, max: maxUsers })}</span>
            </div>
          )}

          {/* Friends List Container */}
          <div className="flex-1 overflow-y-auto chat-scrollbar p-3 sm:p-4 space-y-2 overscroll-contain">
            {loading ? (
              // Skeleton loading
              <div className="space-y-2.5 py-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.02] border border-white/[0.04] animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white/10" />
                      <div className="space-y-1.5">
                        <div className="w-24 h-3 bg-white/10 rounded" />
                        <div className="w-16 h-2 bg-white/5 rounded" />
                      </div>
                    </div>
                    <div className="w-16 h-7 bg-white/10 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : friends.length === 0 ? (
              // Empty: No friends yet
              <div className="py-8 px-4 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-gray-500 mb-3">
                  <UserGroupIcon className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-white mb-1">
                  {t('noFriends')}
                </h4>
                <p className="text-xs text-gray-400 max-w-xs mb-4">
                  {t('noFriendsDesc')}
                </p>
                <Link
                  href="/friends"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-yellow-500 hover:yellow-400 text-gray-950 text-xs font-bold transition-all shadow-md active:scale-95"
                >
                  {t('findFriendsBtn')}
                </Link>
              </div>
            ) : filteredFriends.length === 0 ? (
              // Empty search results
              <div className="py-8 px-4 text-center">
                <p className="text-xs sm:text-sm text-gray-400">
                  {t('noFriendsFound')}
                </p>
              </div>
            ) : (
              // Friend Items
              filteredFriends.map((friend) => {
                const inRoom = isMemberInRoom(friend);
                const isInviting = invitingId === friend._id;

                return (
                  <div
                    key={friend._id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] transition-all"
                  >
                    {/* User info */}
                    <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
                      {friend.avatar ? (
                        <Image
                          src={friend.avatar}
                          alt={friend.name}
                          width={36}
                          height={36}
                          unoptimized
                          className="w-9 h-9 rounded-full object-cover shrink-0 border border-white/10 shadow-sm"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div
                        className={`w-9 h-9 rounded-full bg-gradient-to-br ${getAvatarGradient(
                          friend._id
                        )} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm ${
                          friend.avatar ? 'hidden' : ''
                        }`}
                      >
                        {friend.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-semibold text-white truncate">
                          {friend.name}
                        </p>
                        {friend.username && (
                          <p className="text-[11px] text-gray-400 truncate">
                            @{friend.username}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Action button */}
                    <div className="shrink-0">
                      {inRoom ? (
                        <span className="px-2.5 py-1 text-[11px] font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-1 select-none">
                          <CheckIcon className="w-3.5 h-3.5" />
                          <span>{t('alreadyInRoom')}</span>
                        </span>
                      ) : cooldowns[friend._id] && cooldowns[friend._id] > 0 ? (
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/15 border border-amber-500/30 rounded-lg flex items-center gap-1.5 cursor-not-allowed select-none shadow-xs"
                          title={t('invitedWithCountdown', { seconds: cooldowns[friend._id] })}
                        >
                          <CheckIcon className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>{t('invitedWithCountdown', { seconds: cooldowns[friend._id] })}</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isInviting || isRoomFull}
                          onClick={() => handleInvite(friend)}
                          className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-yellow-500 to-amber-500 hover:from-yellow-400 hover:to-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-gray-950 text-xs font-bold shadow-md shadow-yellow-500/20 hover:shadow-yellow-500/30 active:scale-95 transition-all flex items-center gap-1.5"
                          title={isRoomFull ? t('roomFullCannotInvite', { current: currentMemberCount, max: maxUsers }) : undefined}
                        >
                          {isInviting ? (
                            <>
                              <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" />
                              <span>{t('inviting')}</span>
                            </>
                          ) : (
                            <>
                              <UserPlusIcon className="w-3.5 h-3.5" />
                              <span>{hasInvitedOnce.has(friend._id) ? t('inviteAgain') : t('invite')}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Modal Footer / Direct Link Sharing */}
          <div className="p-3 sm:p-4 border-t border-white/[0.08] bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={handleCopyLink}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 hover:border-white/20 text-gray-200 hover:text-white text-xs font-medium transition-all active:scale-98"
            >
              {copiedLink ? (
                <>
                  <CheckIcon className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-emerald-400">{t('linkCopied')}</span>
                </>
              ) : (
                <>
                  <ShareIcon className="w-3.5 h-3.5 text-gray-400" />
                  <span>{t('copyRoomLink')}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl bg-white/[0.05] hover:bg-white/10 text-gray-400 hover:text-white text-xs font-medium transition-colors"
            >
              {t('close')}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
