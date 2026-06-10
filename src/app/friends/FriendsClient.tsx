'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  UserGroupIcon,
  UserPlusIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon
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
  name: string;
  avatar: string;
  originalAvatar: string;
}

export default function FriendsClient() {
  const t = useTranslations('Friends')
  const { isAuthenticated, isAuthChecked } = useAuthStore()
  const hydrated = useAuthHydrated()
  const searchParams = useSearchParams()
  const [mounted, setMounted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'friends' | 'received' | 'sent'>('friends')

  const [friends, setFriends] = useState<Friend[]>([])
  const [friendRequests, setFriendRequests] = useState<Friend[]>([])
  const [sentRequests, setSentRequests] = useState<Friend[]>([])
  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null)

  const fetchFriendsData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await api.get('/friends')
      setFriends(res.data.friends || [])
      setFriendRequests(res.data.friendRequests || [])
      setSentRequests(res.data.sentFriendRequests || [])
    } catch (error) {
      console.error('Error fetching friends data:', error)
      toast.error(t('errorLoading'))
    } finally {
      setLoading(false)
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
      fetchFriendsData()
    }
  }, [hydrated, isAuthenticated, fetchFriendsData])

  useEffect(() => {
    if (hydrated && isAuthChecked && !isAuthenticated) {
      setLoading(false)
    }
  }, [hydrated, isAuthChecked, isAuthenticated])

  // Re-fetch when user returns to this tab (e.g. after unfriending from profile page)
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchFriendsData()
      }
    }
    const handleFocus = () => {
      fetchFriendsData()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [hydrated, isAuthenticated, fetchFriendsData])

  const handleAccept = async (id: string) => {
    try {
      await api.post(`/friends/accept/${id}`)
      toast.success(t('acceptSuccess'))
      fetchFriendsData() // Refresh
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('acceptError'))
    }
  }

  const handleReject = async (id: string) => {
    try {
      await api.post(`/friends/reject/${id}`)
      toast.success(t('declineSuccess'))
      fetchFriendsData()
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('declineError'))
    }
  }

  const handleCancel = async (id: string) => {
    try {
      await api.post(`/friends/cancel/${id}`)
      toast.success(t('cancelSuccess'))
      fetchFriendsData()
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('cancelError'))
    }
  }

  const handleRemove = (id: string) => {
    setConfirmRemoveUserId(id);
  }

  const handleConfirmRemove = async () => {
    if (!confirmRemoveUserId) return;
    try {
      await api.delete(`/friends/${confirmRemoveUserId}`)
      toast.success(t('unfriendSuccess'))
      setConfirmRemoveUserId(null)
      fetchFriendsData()
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('unfriendError'))
      setConfirmRemoveUserId(null)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return 'U'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

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

  const renderUserCard = (user: Friend, type: 'friend' | 'received' | 'sent') => (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      key={user._id}
      className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-xl p-2.5 sm:p-4 flex items-center justify-between"
    >
      <Link href={`/profile/${user._id}`} className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 group">
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
              {getInitials(user.name)}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm sm:text-base text-white font-medium truncate group-hover:text-red-400 transition-colors">{user.name}</h4>
          <p className="text-xs sm:text-sm text-gray-400 truncate">{t('viewProfile')}</p>
        </div>
      </Link>

      <div className="flex items-center gap-1.5 sm:gap-2 ml-2 sm:ml-4">
        {type === 'received' && (
          <>
            <button
              onClick={() => handleAccept(user._id)}
              className="p-2 bg-green-500/20 text-green-400 hover:bg-green-500 hover:text-white rounded-lg transition-colors"
              title={t('accept')}
            >
              <CheckIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => handleReject(user._id)}
              className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500 hover:text-white rounded-lg transition-colors"
              title={t('decline')}
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </>
        )}
        
        {type === 'sent' && (
          <button
            onClick={() => handleCancel(user._id)}
            className="p-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            title={t('cancelRequest')}
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        )}

        {type === 'friend' && (
          <button
            onClick={() => handleRemove(user._id)}
            className="p-2 bg-gray-700/50 hover:bg-red-500/20 text-gray-400 hover:text-red-500 rounded-lg transition-colors"
            title={t('unfriend')}
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        )}
      </div>
    </motion.div>
  )

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
                {friends.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <UserGroupIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('emptyFriends')}</p>
                  </div>
                ) : (
                  friends.map(u => renderUserCard(u, 'friend'))
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
                {friendRequests.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <UserPlusIcon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('emptyReceived')}</p>
                  </div>
                ) : (
                  friendRequests.map(u => renderUserCard(u, 'received'))
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
                {sentRequests.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    <p>{t('emptySent')}</p>
                  </div>
                ) : (
                  sentRequests.map(u => renderUserCard(u, 'sent'))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <ConfirmDialog
        open={!!confirmRemoveUserId}
        title={t('confirmRemoveTitle')}
        description={t('confirmRemoveDesc')}
        confirmText={t('confirmText')}
        cancelText={t('cancelText')}
        onConfirm={handleConfirmRemove}
        onCancel={() => setConfirmRemoveUserId(null)}
      />
    </div>
  )
}
