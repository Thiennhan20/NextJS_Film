'use client'

import React, { useCallback, useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CalendarIcon,
  ClockIcon,
  UserPlusIcon,
  CheckIcon,
  XMarkIcon,
  TrashIcon
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import useAuthHydrated from '@/store/useAuthHydrated'
import api from '@/lib/axios'
import ConfirmDialog from '@/components/common/ConfirmDialog'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { toast } from 'react-hot-toast'
import Image from 'next/image'
import Link from 'next/link'
import { PlayCircleIcon } from '@heroicons/react/24/solid'

interface PublicUser {
  _id: string;
  name: string;
  avatar: string;
  createdAt: string;
}

interface RecentlyWatchedItem {
  contentId: number;
  isTVShow: boolean;
  title: string;
  poster: string;
}

export default function PublicProfileClient({ userId }: { userId: string }) {
  const t = useTranslations('Profile')
  const { user: authUser, isAuthenticated } = useAuthStore()
  const hydrated = useAuthHydrated()
  const [mounted, setMounted] = useState(false)
  const [profileUser, setProfileUser] = useState<PublicUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [avatarError, setAvatarError] = useState(false)
  const [friendStatus, setFriendStatus] = useState<'none' | 'friends' | 'request_sent' | 'request_received'>('none')
  const [showConfirm, setShowConfirm] = useState(false)
  const [recentlyWatched, setRecentlyWatched] = useState<RecentlyWatchedItem[]>([])
  
  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Nếu userId trùng với người đang đăng nhập, chuyển hướng về trang profile cá nhân
  useEffect(() => {
    if (hydrated && isAuthenticated && authUser && authUser.id === userId) {
      router.replace('/profile')
    }
  }, [hydrated, isAuthenticated, authUser, userId, router])

  // Fetch friend status
  const fetchFriendStatus = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      const friendsRes = await api.get('/friends')
      const { friends, friendRequests, sentFriendRequests } = friendsRes.data;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (friends.some((f: any) => f._id === userId)) {
        setFriendStatus('friends');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if (sentFriendRequests.some((f: any) => f._id === userId)) {
        setFriendStatus('request_sent');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } else if (friendRequests.some((f: any) => f._id === userId)) {
        setFriendStatus('request_received');
      } else {
        setFriendStatus('none');
      }
    } catch (e) {
      console.error('Error fetching friend status:', e);
    }
  }, [isAuthenticated, userId])

  // Fetch public profile
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get(`/auth/profile/${userId}`)
        setProfileUser(response.data.user)
        setRecentlyWatched(response.data.recentlyWatched || [])
        await fetchFriendStatus()
      } catch (error) {
        console.error('Error fetching public profile:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchProfile()
  }, [userId, isAuthenticated, fetchFriendStatus])

  // Re-fetch friend status when user returns to this tab
  useEffect(() => {
    if (!isAuthenticated) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchFriendStatus()
      }
    }
    const handleFocus = () => {
      fetchFriendStatus()
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [isAuthenticated, userId, fetchFriendStatus])

  // Calculate account age
  const accountAge = useMemo(() => {
    if (!profileUser?.createdAt) return 'N/A'
    const created = new Date(profileUser.createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 30) return t('days', { count: diffDays })
    if (diffDays < 365) return t('months', { count: Math.floor(diffDays / 30) })
    return t('years', { count: Math.floor(diffDays / 365) })
  }, [profileUser?.createdAt, t])

  // Format date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })
  }

  // Get user initials for avatar
  const getInitials = (name: string) => {
    if (!name) return 'U'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const isValidAvatarUrl = (url: string | undefined): boolean => {
    if (!url || url.trim() === '') return false
    try {
      if (url.startsWith('data:image/')) return true
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  const handleFriendAction = async () => {
    if (!isAuthenticated) {
      toast.error('Vui lòng đăng nhập để kết bạn!');
      router.push('/login');
      return;
    }
    
    try {
      if (friendStatus === 'none') {
        await api.post(`/friends/request/${userId}`);
        toast.success(t('requestSentSuccess'));
        setFriendStatus('request_sent');
      } else if (friendStatus === 'request_sent') {
        await api.post(`/friends/cancel/${userId}`);
        toast.success(t('cancelRequestSuccess'));
        setFriendStatus('none');
      } else if (friendStatus === 'request_received') {
        await api.post(`/friends/accept/${userId}`);
        toast.success(t('acceptRequestSuccess'));
        setFriendStatus('friends');
      } else if (friendStatus === 'friends') {
        setShowConfirm(true);
      }
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('actionError'));
    }
  }

  const handleConfirmRemoveFriend = async () => {
    setShowConfirm(false);
    try {
      await api.delete(`/friends/${userId}`);
      toast.success(t('unfriendSuccess'));
      setFriendStatus('none');
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any).response?.data?.message || t('actionError'));
    }
  }

  if (!mounted || !hydrated || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-white mb-4">Người dùng không tồn tại</h1>
          <p className="text-gray-400 mb-6">Profile you are looking for does not exist or has been removed.</p>
          <button
            onClick={() => router.back()}
            className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            Quay lại
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <section className="pt-6 sm:pt-10 lg:pt-14 xl:pt-16 pb-6 sm:pb-10 lg:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-xl sm:rounded-2xl lg:rounded-3xl p-3 sm:p-5 lg:p-8 xl:p-10 border border-gray-700/50 shadow-2xl mb-4 sm:mb-6 lg:mb-10"
            >
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6 lg:gap-8">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6">
                  <div className="relative flex-shrink-0">
                    {profileUser.avatar && isValidAvatarUrl(profileUser.avatar) && !avatarError ? (
                      <div 
                        onClick={() => setIsPreviewOpen(true)}
                        className="w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden shadow-xl border-2 sm:border-4 border-gray-700/50 relative bg-gray-800 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                        title="View full avatar"
                      >
                        <Image
                          src={profileUser.avatar}
                          alt={profileUser.name}
                          fill
                          sizes="(max-width: 640px) 80px, (max-width: 1024px) 112px, 128px"
                          className="object-cover"
                          onError={() => setAvatarError(true)}
                          unoptimized={profileUser.avatar.startsWith('http')}
                        />
                      </div>
                    ) : (
                      <div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-full bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-2xl sm:text-3xl lg:text-4xl font-bold text-white shadow-xl relative overflow-hidden border-2 sm:border-4 border-gray-700/50">
                        <span className="relative z-10">{getInitials(profileUser.name)}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left flex flex-col justify-center py-2">
                    <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-2 sm:mb-3 break-words tracking-tight">
                      {profileUser.name}
                    </h2>
                    <div className="space-y-2">
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-300">
                        <CalendarIcon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm lg:text-base">{t('memberSince', { date: formatDate(profileUser.createdAt) })}</span>
                      </div>
                      <div className="flex items-center justify-center sm:justify-start gap-2 text-gray-300">
                        <ClockIcon className="w-4 h-4 lg:w-5 lg:h-5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm lg:text-base">{t('activeFor', { age: accountAge })}</span>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 sm:mt-0 flex justify-center sm:justify-end gap-2 shrink-0">
                  {friendStatus === 'none' && (
                    <button 
                      onClick={handleFriendAction}
                      className="flex items-center gap-2 bg-blue-600/90 hover:bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-blue-500/25 active:scale-95"
                    >
                      <UserPlusIcon className="w-5 h-5" />
                      {t('addFriend')}
                    </button>
                  )}
                  
                  {friendStatus === 'request_sent' && (
                    <button 
                      onClick={handleFriendAction}
                      className="flex items-center gap-2 bg-gray-700/80 hover:bg-gray-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all active:scale-95 border border-gray-600/50"
                    >
                      <XMarkIcon className="w-5 h-5" />
                      {t('cancelRequest')}
                    </button>
                  )}

                  {friendStatus === 'request_received' && (
                    <button 
                      onClick={handleFriendAction}
                      className="flex items-center gap-2 bg-green-600/90 hover:bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-green-500/25 active:scale-95"
                    >
                      <CheckIcon className="w-5 h-5" />
                      {t('acceptRequest')}
                    </button>
                  )}

                  {friendStatus === 'friends' && (
                    <button 
                      onClick={handleFriendAction}
                      className="flex items-center gap-2 bg-red-600/90 hover:bg-red-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium transition-all shadow-lg hover:shadow-red-500/25 active:scale-95"
                    >
                      <TrashIcon className="w-5 h-5" />
                      {t('unfriend')}
                    </button>
                  )}
                </div>
              </div>
            </motion.div>

            {recentlyWatched && recentlyWatched.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="mt-8 sm:mt-12"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
                    <PlayCircleIcon className="w-6 h-6 text-red-500" />
                    {friendStatus === 'friends' ? t('friendWatchedMovies') : t('recentlyWatched')}
                  </h3>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                  {recentlyWatched.map((item) => (
                    <Link 
                      href={item.isTVShow ? `/tvshows/${item.contentId}` : `/movie/${item.contentId}`}
                      key={`${item.isTVShow ? 'tv' : 'movie'}-${item.contentId}`}
                      className="group relative aspect-[2/3] rounded-lg sm:rounded-xl overflow-hidden bg-gray-800 transition-transform hover:-translate-y-1 hover:shadow-xl hover:shadow-red-500/20"
                    >
                      {item.poster ? (
                        <Image
                          src={item.poster}
                          alt={item.title || 'Movie Poster'}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-110"
                          sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 text-xs">
                          No Image
                        </div>
                      )}
                      
                      {/* Gradient Overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300" />
                      
                      {/* Content Info */}
                      <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-0 sm:translate-y-4 sm:group-hover:translate-y-0 transition-transform duration-300">
                        <h4 className="text-white font-medium text-sm sm:text-base line-clamp-2 leading-snug mb-1">
                          {item.title}
                        </h4>
                        
                        <div className="flex items-center justify-between text-xs text-gray-300 mt-2">
                          {item.isTVShow ? (
                            <span className="bg-red-600/80 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                              {t('tvShowBadge')}
                            </span>
                          ) : (
                            <span className="bg-blue-600/80 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                              {t('movieBadge')}
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </section>
      </div>

      <ConfirmDialog
        open={showConfirm}
        title="Hủy kết bạn"
        description="Bạn có chắc chắn muốn hủy kết bạn với người này không?"
        confirmText="Hủy kết bạn"
        cancelText="Quay lại"
        onConfirm={handleConfirmRemoveFriend}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Avatar Full-screen Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && profileUser.avatar && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsPreviewOpen(false)}
            className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4 cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-[300px] h-[300px] sm:w-[360px] sm:h-[360px] bg-gray-900 border border-gray-800 p-2 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={profileUser.avatar}
                alt={profileUser.name}
                className="w-full h-full object-cover rounded-xl"
              />
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="absolute top-4 right-4 w-9 h-9 bg-black/75 hover:bg-black/90 rounded-full border border-gray-700/80 flex items-center justify-center text-white text-sm transition-colors cursor-pointer shadow-lg"
                title="Close"
              >
                ✕
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
