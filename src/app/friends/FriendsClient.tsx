'use client'

import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  UserGroupIcon,
  UserPlusIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import useAuthHydrated from '@/store/useAuthHydrated'
import api from '@/lib/axios'
import Link from 'next/link'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'

interface Friend {
  _id: string;
  username?: string;
  hashId?: string;
  name: string;
  avatar: string;
  originalAvatar: string;
}

interface FriendItemCardProps {
  user: Friend;
  type: 'friend' | 'received' | 'sent';
  onAccept?: (user: Friend) => void;
  onReject?: (user: Friend) => void;
  onCancel?: (user: Friend) => void;
  onRemove?: (user: Friend) => void;
  viewProfileText: string;
  acceptText: string;
  declineText: string;
  cancelRequestText: string;
  unfriendText: string;
  initials: string;
}

const FriendItemCard = React.memo(function FriendItemCard({
  user,
  type,
  onAccept,
  onReject,
  onCancel,
  onRemove,
  viewProfileText,
  acceptText,
  declineText,
  cancelRequestText,
  unfriendText,
  initials
}: FriendItemCardProps) {
  const profileSlug = user.username || user.hashId || user._id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-2.5 sm:p-4 flex items-center justify-between hover:border-gray-600/70 transition-colors"
    >
      <Link href={`/profile/${profileSlug}`} className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 group">
        <div className="flex-shrink-0">
          {user.avatar ? (
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full overflow-hidden border-2 border-gray-600 group-hover:border-red-500 transition-colors">
              <Image
                src={user.avatar}
                alt={user.name}
                width={48}
                height={48}
                sizes="(max-width: 640px) 36px, 48px"
                className="w-full h-full object-cover"
                unoptimized={user.avatar.startsWith('http')}
              />
            </div>
          ) : (
            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-white font-bold text-sm sm:text-lg border-2 border-transparent group-hover:border-red-500 transition-colors">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base text-white font-medium truncate group-hover:text-red-400 transition-colors">{user.name}</h4>
          <p className="text-xs sm:text-sm text-gray-400 truncate">{user.username ? `@${user.username}` : viewProfileText}</p>
        </div>
      </Link>

      <div className="flex items-center gap-1.5 sm:gap-2 ml-2 sm:ml-4">
        {type === 'received' && onAccept && onReject && (
          <>
            <button
              onClick={() => onAccept(user)}
              className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-colors"
              title={acceptText}
            >
              <CheckIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onReject(user)}
              className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
              title={declineText}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </>
        )}
        
        {type === 'sent' && onCancel && (
          <button
            onClick={() => onCancel(user)}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            title={cancelRequestText}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}

        {type === 'friend' && onRemove && (
          <button
            onClick={() => onRemove(user)}
            className="p-2 bg-gray-700/50 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
            title={unfriendText}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  );
});

export default function FriendsClient() {
  const t = useTranslations('Friends')
  const { isAuthenticated, isAuthChecked } = useAuthStore()
  const hydrated = useAuthHydrated()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'friends' | 'received' | 'sent'>('friends')
  const [searchQuery, setSearchQuery] = useState('')

  const [friends, setFriends] = useState<Friend[]>([])
  const [friendRequests, setFriendRequests] = useState<Friend[]>([])
  const [sentRequests, setSentRequests] = useState<Friend[]>([])
  const [confirmRemoveTarget, setConfirmRemoveTarget] = useState<Friend | null>(null)

  const lastFetchTimeRef = useRef<number>(0)
  const isFetchingRef = useRef<boolean>(false)

  const fetchFriendsData = useCallback(async (isSilent = false) => {
    if (isFetchingRef.current) return
    isFetchingRef.current = true
    try {
      if (!isSilent) {
        setLoading(true)
      }
      const res = await api.get('/friends')
      setFriends(res.data.friends || [])
      setFriendRequests(res.data.friendRequests || [])
      setSentRequests(res.data.sentFriendRequests || [])
      lastFetchTimeRef.current = Date.now()
    } catch (error) {
      console.error('Error fetching friends data:', error)
      if (!isSilent) {
        toast.error(t('errorLoading'))
      }
    } finally {
      isFetchingRef.current = false
      if (!isSilent) {
        setLoading(false)
      }
    }
  }, [t])

  useEffect(() => {
    setMounted(true)
    const tab = searchParams.get('tab')
    if (tab === 'received' || tab === 'sent' || tab === 'friends') {
      setActiveTab(tab as 'friends' | 'received' | 'sent')
    }
  }, [searchParams])

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      fetchFriendsData(false)
    }
  }, [hydrated, isAuthenticated, fetchFriendsData])

  useEffect(() => {
    if (hydrated && isAuthChecked && !isAuthenticated) {
      setLoading(false)
    }
  }, [hydrated, isAuthChecked, isAuthenticated])

  // Re-fetch silently when user returns to this tab
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return

    const handleRefresh = () => {
      // Throttle: avoid re-fetching if last fetch was less than 15 seconds ago
      if (Date.now() - lastFetchTimeRef.current < 15000) return
      fetchFriendsData(true)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefresh()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleRefresh)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleRefresh)
    }
  }, [hydrated, isAuthenticated, fetchFriendsData])

  // Optimistic Accept
  const handleAccept = useCallback(async (targetUser: Friend) => {
    const targetIdentifier = targetUser.username || targetUser.hashId || targetUser._id;
    const prevRequests = [...friendRequests];
    const prevFriends = [...friends];

    // Optimistic UI update
    setFriendRequests(prev => prev.filter(f => f._id !== targetUser._id));
    setFriends(prev => [targetUser, ...prev.filter(f => f._id !== targetUser._id)]);
    toast.success(t('acceptSuccess'));

    try {
      await api.post(`/friends/accept/${targetIdentifier}`);
    } catch (error) {
      // Rollback on failure
      setFriendRequests(prevRequests);
      setFriends(prevFriends);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('acceptError'));
    }
  }, [friendRequests, friends, t]);

  // Optimistic Reject
  const handleReject = useCallback(async (targetUser: Friend) => {
    const targetIdentifier = targetUser.username || targetUser.hashId || targetUser._id;
    const prevRequests = [...friendRequests];

    // Optimistic UI update
    setFriendRequests(prev => prev.filter(f => f._id !== targetUser._id));
    toast.success(t('declineSuccess'));

    try {
      await api.post(`/friends/reject/${targetIdentifier}`);
    } catch (error) {
      // Rollback on failure
      setFriendRequests(prevRequests);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('declineError'));
    }
  }, [friendRequests, t]);

  // Optimistic Cancel
  const handleCancel = useCallback(async (targetUser: Friend) => {
    const targetIdentifier = targetUser.username || targetUser.hashId || targetUser._id;
    const prevSent = [...sentRequests];

    // Optimistic UI update
    setSentRequests(prev => prev.filter(f => f._id !== targetUser._id));
    toast.success(t('cancelSuccess'));

    try {
      await api.post(`/friends/cancel/${targetIdentifier}`);
    } catch (error) {
      // Rollback on failure
      setSentRequests(prevSent);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('cancelError'));
    }
  }, [sentRequests, t]);

  // Confirm remove trigger
  const handleRemove = useCallback((targetUser: Friend) => {
    setConfirmRemoveTarget(targetUser);
  }, []);

  // Optimistic Confirm Remove
  const handleConfirmRemove = useCallback(async () => {
    if (!confirmRemoveTarget) return;
    const targetUser = confirmRemoveTarget;
    const targetIdentifier = targetUser.username || targetUser.hashId || targetUser._id;
    const prevFriends = [...friends];

    setConfirmRemoveTarget(null);
    setFriends(prev => prev.filter(f => f._id !== targetUser._id));
    toast.success(t('unfriendSuccess'));

    try {
      await api.delete(`/friends/${targetIdentifier}`);
    } catch (error) {
      // Rollback on failure
      setFriends(prevFriends);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('unfriendError'));
    }
  }, [confirmRemoveTarget, friends, t]);

  const getInitials = useCallback((name: string) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }, []);

  // Filtered lists based on search query
  const filteredFriends = useMemo(() => {
    if (!searchQuery.trim()) return friends;
    const q = searchQuery.toLowerCase().trim();
    return friends.filter(u => u.name.toLowerCase().includes(q) || (u.username && u.username.toLowerCase().includes(q)));
  }, [friends, searchQuery]);

  const filteredRequests = useMemo(() => {
    if (!searchQuery.trim()) return friendRequests;
    const q = searchQuery.toLowerCase().trim();
    return friendRequests.filter(u => u.name.toLowerCase().includes(q) || (u.username && u.username.toLowerCase().includes(q)));
  }, [friendRequests, searchQuery]);

  const filteredSent = useMemo(() => {
    if (!searchQuery.trim()) return sentRequests;
    const q = searchQuery.toLowerCase().trim();
    return sentRequests.filter(u => u.name.toLowerCase().includes(q) || (u.username && u.username.toLowerCase().includes(q)));
  }, [sentRequests, searchQuery]);

  if (!mounted || !hydrated || !isAuthChecked || (isAuthenticated && loading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-white mb-4">{t('pleaseLogin')}</h1>
          <p className="text-gray-400 mb-6">{t('loginRequired')}</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('loginNow')}
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white pt-20 sm:pt-24 pb-8 sm:pb-12 px-3 sm:px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center gap-2 sm:gap-3 mb-5 sm:mb-8">
          <UserGroupIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-500" />
          <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-3 sm:pb-4 mb-4 sm:mb-6 border-b border-gray-800 scrollbar-hide">
          <button
            onClick={() => setActiveTab('friends')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium whitespace-nowrap transition-colors ${
              activeTab === 'friends' ? 'bg-blue-600 text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t('tabFriends', { count: friends.length })}
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${
              activeTab === 'received' ? 'bg-blue-600 text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t('tabReceived', { count: friendRequests.length })}
            {friendRequests.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium whitespace-nowrap transition-colors ${
              activeTab === 'sent' ? 'bg-blue-600 text-white' : 'bg-gray-800/50 text-gray-400 hover:text-white hover:bg-gray-800'
            }`}
          >
            {t('tabSent', { count: sentRequests.length })}
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-5">
          <MagnifyingGlassIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm theo tên hoặc @username..."
            className="w-full bg-gray-900/80 border border-gray-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-10 pr-9 py-2 text-white placeholder-gray-500 text-sm outline-none transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1 rounded-full"
            >
              <XMarkIcon className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="min-h-[400px]">
          <AnimatePresence mode="wait">
            {activeTab === 'friends' && (
              <motion.div
                key="friends"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4"
              >
                {filteredFriends.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{searchQuery ? `Không tìm thấy bạn bè nào phù hợp với "${searchQuery}"` : t('emptyFriends')}</p>
                  </div>
                ) : (
                  filteredFriends.map(u => (
                    <FriendItemCard
                      key={u._id}
                      user={u}
                      type="friend"
                      onRemove={handleRemove}
                      viewProfileText={t('viewProfile')}
                      acceptText={t('accept')}
                      declineText={t('decline')}
                      cancelRequestText={t('cancelRequest')}
                      unfriendText={t('unfriend')}
                      initials={getInitials(u.name)}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'received' && (
              <motion.div
                key="received"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4"
              >
                {filteredRequests.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <UserPlusIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{searchQuery ? `Không tìm thấy lời mời nào phù hợp với "${searchQuery}"` : t('emptyReceived')}</p>
                  </div>
                ) : (
                  filteredRequests.map(u => (
                    <FriendItemCard
                      key={u._id}
                      user={u}
                      type="received"
                      onAccept={handleAccept}
                      onReject={handleReject}
                      viewProfileText={t('viewProfile')}
                      acceptText={t('accept')}
                      declineText={t('decline')}
                      cancelRequestText={t('cancelRequest')}
                      unfriendText={t('unfriend')}
                      initials={getInitials(u.name)}
                    />
                  ))
                )}
              </motion.div>
            )}

            {activeTab === 'sent' && (
              <motion.div
                key="sent"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-4"
              >
                {filteredSent.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <p>{searchQuery ? `Không tìm thấy yêu cầu nào phù hợp với "${searchQuery}"` : t('emptySent')}</p>
                  </div>
                ) : (
                  filteredSent.map(u => (
                    <FriendItemCard
                      key={u._id}
                      user={u}
                      type="sent"
                      onCancel={handleCancel}
                      viewProfileText={t('viewProfile')}
                      acceptText={t('accept')}
                      declineText={t('decline')}
                      cancelRequestText={t('cancelRequest')}
                      unfriendText={t('unfriend')}
                      initials={getInitials(u.name)}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmRemoveTarget}
        title={t('confirmRemoveTitle')}
        description={t('confirmRemoveDesc')}
        confirmText={t('confirmText')}
        cancelText={t('cancelText')}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemoveTarget(null)}
      />
    </div>
  )
}
