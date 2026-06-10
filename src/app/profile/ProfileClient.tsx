'use client'

import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  EnvelopeIcon,
  CalendarIcon,
  BookmarkIcon,
  ClockIcon,
  TrashIcon,
  PhotoIcon,
  EllipsisVerticalIcon,
  Cog6ToothIcon,
  UsersIcon,
  ChatBubbleLeftRightIcon,
  SignalIcon
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import { useWatchlistStore } from '@/store/store'
import useAuthHydrated from '@/store/useAuthHydrated'
import Link from 'next/link'
import api from '@/lib/axios'
import { toast } from 'react-hot-toast'
import imageCompression from 'browser-image-compression'
import { useTranslations } from 'next-intl'

export default function ProfilePage() {
  const t = useTranslations('Profile')
  const { user, isAuthenticated, checkAuth, isAuthChecked } = useAuthStore()
  const { watchlist } = useWatchlistStore()
  const hydrated = useAuthHydrated()
  const [mounted, setMounted] = useState(false)
  const [avatarError, setAvatarError] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [previewAvatar, setPreviewAvatar] = useState<string | null>(null)
  const [showAvatarMenu, setShowAvatarMenu] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  
  // Crop states
  const [showCropModal, setShowCropModal] = useState(false)
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null)
  const [cropZoom, setCropZoom] = useState(1)
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 })
  const [isDraggingCrop, setIsDraggingCrop] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const cropImageRef = useRef<HTMLImageElement>(null)
  
  // Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)

  // Session states
  interface Session {
    _id: string
    device: string
    ip: string
    lastActive: string
    isCurrent: boolean
  }
  const [sessions, setSessions] = useState<Session[]>([])
  const [isLoadingSessions, setIsLoadingSessions] = useState(false)
  const [isRevokingAll, setIsRevokingAll] = useState(false)

  // Confirm Modal state
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isDanger?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isDanger: false
  })

  const fetchSessions = useCallback(async () => {
    if (!isAuthenticated) return
    setIsLoadingSessions(true)
    try {
      const response = await api.get('/auth/sessions')
      setSessions(response.data || [])
    } catch {
      // ignore
    } finally {
      setIsLoadingSessions(false)
    }
  }, [isAuthenticated])

  const handleRevokeSession = (id: string) => {
    setConfirmModal({
      isOpen: true,
      title: t('confirmTitle') || 'Confirm Device Logout',
      message: t('revokeSessionConfirm'),
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        try {
          await api.delete(`/auth/sessions/${id}`)
          toast.success(t('revokeSuccess'))
          fetchSessions()
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } } }
          toast.error(err.response?.data?.message || 'Failed to revoke session')
        }
      }
    })
  }

  const handleRevokeAllOtherSessions = () => {
    setConfirmModal({
      isOpen: true,
      title: t('confirmAllTitle') || 'Confirm Logout from Other Devices',
      message: t('revokeAllConfirm'),
      isDanger: true,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }))
        setIsRevokingAll(true)
        try {
          await api.delete('/auth/sessions')
          toast.success(t('revokeAllSuccess'))
          fetchSessions()
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } } }
          toast.error(err.response?.data?.message || 'Failed to revoke other sessions')
        } finally {
          setIsRevokingAll(false)
        }
      }
    })
  }

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && isAuthenticated) {
      fetchSessions()
    }
  }, [mounted, isAuthenticated, fetchSessions])

  // Reset avatar error when user changes
  useEffect(() => {
    setAvatarError(false)
    setPreviewAvatar(null)
  }, [user?.avatar])

  // Preload avatar for instant display
  useEffect(() => {
    if (user?.avatar && user.avatar.startsWith('data:image/')) {
      // Create image object to preload
      const img = new Image()
      img.src = user.avatar
    }
  }, [user?.avatar])

  // Calculate account age
  const accountAge = useMemo(() => {
    if (!user?.createdAt) return 'N/A'
    const created = new Date(user.createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    
    if (diffDays < 30) return t('days', { count: diffDays })
    if (diffDays < 365) return t('months', { count: Math.floor(diffDays / 30) })
    return t('years', { count: Math.floor(diffDays / 365) })
  }, [user?.createdAt, t])

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

  // Check if avatar URL is valid
  const isValidAvatarUrl = (url: string | undefined): boolean => {
    if (!url || url.trim() === '') return false
    try {
      // Check if it's a data URL first
      if (url.startsWith('data:image/')) return true
      
      // Try to parse as URL
      const urlObj = new URL(url)
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
    } catch {
      return false
    }
  }

  // Get avatar URL to display
  const avatarUrl = useMemo(() => {
    if (previewAvatar) return previewAvatar
    if (user?.avatar && isValidAvatarUrl(user.avatar)) {
      return user.avatar
    }
    return null
  }, [user?.avatar, previewAvatar])

  // Avatar data validation
  useEffect(() => {
    // Validation logic runs silently
  }, [user, avatarUrl])

  // Panning handlers for crop modal
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDraggingCrop(true)
    setDragStart({ x: e.clientX - cropPosition.x, y: e.clientY - cropPosition.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingCrop) return
    setCropPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDraggingCrop(false)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    setIsDraggingCrop(true)
    const touch = e.touches[0]
    setDragStart({ x: touch.clientX - cropPosition.x, y: touch.clientY - cropPosition.y })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDraggingCrop || e.touches.length !== 1) return
    const touch = e.touches[0]
    setCropPosition({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    })
  }

  const handleTouchEnd = () => {
    setIsDraggingCrop(false)
  }

  // Handle avatar upload - open cropper first
  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      return
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image size must be less than 10MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setCropImageSrc(reader.result as string)
      setCropZoom(1)
      setCropPosition({ x: 0, y: 0 })
      setShowCropModal(true)
    }
    reader.onerror = () => {
      toast.error('Failed to read image file')
    }
    reader.readAsDataURL(file)

    // Reset file input
    if (event.target) {
      event.target.value = ''
    }
  }

  // Process visual crop using HTML5 Canvas & Upload
  const handleSaveCrop = async () => {
    if (!cropImageSrc || !cropImageRef.current) return
    setIsUploading(true)
    setShowCropModal(false)
    setAvatarError(false)

    try {
      const img = new Image()
      img.src = cropImageSrc
      await new Promise((resolve) => {
        img.onload = resolve
      })

      const canvas = document.createElement('canvas')
      canvas.width = 400
      canvas.height = 400
      const ctx = canvas.getContext('2d')

      if (ctx) {
        // Center the transform point on the canvas center
        ctx.translate(200, 200)
        ctx.scale(cropZoom, cropZoom)

        // Translate using visual offset scaled to canvas size
        const scaleFactor = 400 / 250
        ctx.translate((cropPosition.x * scaleFactor) / cropZoom, (cropPosition.y * scaleFactor) / cropZoom)

        // Draw image centered to cover
        const imgWidth = img.naturalWidth
        const imgHeight = img.naturalHeight
        const minRatio = Math.max(250 / imgWidth, 250 / imgHeight)
        
        const visualWidth = imgWidth * minRatio
        const visualHeight = imgHeight * minRatio
        
        const drawWidth = visualWidth * scaleFactor
        const drawHeight = visualHeight * scaleFactor

        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
      }

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9)

      // Convert base64 to File object to compress
      const resBlob = await fetch(croppedBase64).then((res) => res.blob())
      const croppedFile = new File([resBlob], 'avatar.jpg', { type: 'image/jpeg' })

      // Compress image
      const options = {
        maxSizeMB: 0.5, // 500KB
        maxWidthOrHeight: 400,
        useWebWorker: true,
        fileType: 'image/jpeg',
        initialQuality: 0.85,
      }
      
      const compressedFile = await imageCompression(croppedFile, options)

      const reader = new FileReader()
      reader.onloadend = async () => {
        try {
          const base64String = reader.result as string
          setPreviewAvatar(base64String)

          const response = await api.put('/auth/profile', {
            avatar: base64String,
          })

          if (response.data?.user) {
            await checkAuth()
            toast.success('Avatar updated successfully!')
            setPreviewAvatar(null)
          }
        } catch (error: unknown) {
          const err = error as { response?: { data?: { message?: string } } }
          toast.error(err.response?.data?.message || 'Failed to upload avatar')
          setPreviewAvatar(null)
          setAvatarError(true)
        } finally {
          setIsUploading(false)
        }
      }
      reader.onerror = () => {
        toast.error('Failed to read compressed file')
        setIsUploading(false)
        setPreviewAvatar(null)
      }
      reader.readAsDataURL(compressedFile)
    } catch {
      toast.error('Failed to process image cropping')
      setIsUploading(false)
      setPreviewAvatar(null)
    }
  }

  // Handle remove avatar
  const handleRemoveAvatar = async () => {
    if (!user?.avatar) {
      toast.error('No avatar to remove')
      return
    }

    // Check if user has custom avatar (not original)
    const hasCustomAvatar = user.avatar !== user.originalAvatar

    try {
      setIsUploading(true)
      setShowAvatarMenu(false)

      // Send empty string to remove/restore avatar
      const response = await api.put('/auth/profile', {
        avatar: '',
      })

      if (response.data?.user) {
        await checkAuth() // Refresh user data
        
        // Show different message based on whether we restored or removed
        if (hasCustomAvatar && user.originalAvatar) {
          toast.success('Avatar restored to original!')
        } else {
          toast.success('Avatar removed successfully!')
        }
        
        setPreviewAvatar(null)
        setAvatarError(false)
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { message?: string } } }
      toast.error(err.response?.data?.message || 'Failed to remove avatar')
    } finally {
      setIsUploading(false)
    }
  }

  // Handle change avatar (open file picker)
  const handleChangeAvatar = () => {
    setShowAvatarMenu(false)
    fileInputRef.current?.click()
  }

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowAvatarMenu(false)
      }
    }

    if (showAvatarMenu) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showAvatarMenu])

  // Toggle avatar menu
  const toggleAvatarMenu = () => {
    setShowAvatarMenu(!showAvatarMenu)
  }

  if (!mounted || !hydrated || !isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-white mb-4">{t('pleaseLogin')}</h1>
          <p className="text-gray-400 mb-6">{t('loginRequiredHint')}</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {t('goToLogin')}
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        {/* Hero Section - Responsive padding */}
        <section className="pt-6 sm:pt-10 lg:pt-14 xl:pt-16 pb-6 sm:pb-10 lg:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">

            {/* Profile Card - Compact on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-xl sm:rounded-2xl lg:rounded-3xl p-3 sm:p-5 lg:p-8 xl:p-10 border border-gray-700/50 shadow-2xl mb-4 sm:mb-6 lg:mb-10"
            >
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-3 sm:gap-5 lg:gap-8">
                {/* Avatar - Compact on mobile */}
                <div className="relative flex-shrink-0">
                  {avatarUrl && !avatarError ? (
                    <div 
                      onClick={() => setIsPreviewOpen(true)}
                      className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 rounded-full overflow-hidden shadow-xl border-3 sm:border-4 border-gray-700 relative bg-gray-800 cursor-pointer hover:brightness-110 active:scale-95 transition-all"
                      title="View full avatar"
                    >
                      {/* Avatar image */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarUrl}
                        alt={user.name}
                        className="w-full h-full object-cover"
                        onError={() => {
                          setAvatarError(true);
                        }}
                        onLoad={() => {
                          setAvatarError(false);
                        }}
                        loading="eager"
                      />
                      
                      {/* Upload progress */}
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                          <p className="text-white text-xs">{t('loading')}</p>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-20 h-20 sm:w-28 sm:h-28 lg:w-36 lg:h-36 rounded-full bg-gradient-to-br from-purple-500 to-red-500 flex items-center justify-center text-2xl sm:text-3xl lg:text-4xl font-bold text-white shadow-xl relative overflow-hidden">
                      <span className="relative z-10">{getInitials(user.name)}</span>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-br from-purple-400 to-red-400 opacity-50"
                        animate={{
                          rotate: [0, 360],
                        }}
                        transition={{
                          duration: 20,
                          repeat: Infinity,
                          ease: "linear"
                        }}
                      />
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                          <p className="text-white text-xs">{t('uploading')}</p>
                        </div>
                      )}
                    </div>
                  )}
                  
                  {/* Avatar Menu Button - Compact */}
                  <div className="relative z-50" ref={menuRef}>
                    <button
                      onClick={toggleAvatarMenu}
                      disabled={isUploading}
                      className="absolute -bottom-1 -right-1 sm:-bottom-2 sm:-right-2 w-8 h-8 sm:w-10 sm:h-10 bg-blue-500 rounded-full border-2 sm:border-3 border-gray-900 flex items-center justify-center shadow-lg disabled:opacity-50 disabled:cursor-not-allowed z-[60]"
                      title="Avatar options"
                    >
                      <EllipsisVerticalIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </button>

                    {/* Dropdown Menu - Responsive positioning */}
                    <AnimatePresence>
                      {showAvatarMenu && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full right-0 mt-2 sm:top-1/2 sm:left-full sm:right-auto sm:-translate-y-1/2 sm:mt-0 sm:ml-3 bg-gray-800/98 backdrop-blur-md border border-gray-700 rounded-lg shadow-2xl z-[100] min-w-[180px] overflow-hidden"
                        >
                          <button
                            onClick={handleChangeAvatar}
                            disabled={isUploading}
                            className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-gray-700/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <PhotoIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                            <span className="text-sm font-medium">{t('changeAvatar')}</span>
                          </button>
                          
                          {/* Chỉ hiển thị Remove/Restore nếu:
                              1. Có custom avatar (khác originalAvatar) → Restore
                              2. Có avatar nhưng không có originalAvatar → Remove
                              3. KHÔNG hiển thị nếu đang dùng originalAvatar */}
                          {user?.avatar && (
                            // Kiểm tra nếu có custom avatar hoặc có avatar mà không có original
                            (user.avatar !== user.originalAvatar || !user.originalAvatar) && (
                              <button
                                onClick={handleRemoveAvatar}
                                disabled={isUploading}
                                className="w-full flex items-center gap-3 px-4 py-3 text-left text-white hover:bg-gray-700/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-t border-gray-700"
                              >
                                <TrashIcon className="w-5 h-5 text-red-400 flex-shrink-0" />
                                <span className="text-sm font-medium">
                                  {user.avatar !== user.originalAvatar && user.originalAvatar 
                                    ? t('restoreOriginal') 
                                    : t('removeAvatar')}
                                </span>
                              </button>
                            )
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  
                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleAvatarUpload}
                    className="hidden"
                  />
                </div>

                {/* User Info - Compact on mobile */}
                <div className="flex-1 text-center sm:text-left w-full sm:w-auto">
                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2 sm:mb-3 break-words">
                    {user.name}
                  </h2>
                  <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-gray-300">
                      <EnvelopeIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-[11px] sm:text-xs lg:text-sm truncate">{user.email}</span>
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-gray-300">
                      <CalendarIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-[11px] sm:text-xs lg:text-sm">{t('memberSince', { date: formatDate(user.createdAt) })}</span>
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 text-gray-300">
                      <ClockIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 lg:w-5 lg:h-5 text-gray-400 flex-shrink-0" />
                      <span className="text-[11px] sm:text-xs lg:text-sm">{t('activeFor', { age: accountAge })}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Quick Actions - Responsive grid */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-gray-700/50 shadow-2xl mb-6 sm:mb-8 lg:mb-12"
            >
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <ClockIcon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-red-500" />
                <span>{t('quickActions')}</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <Link href="/watchlist">
                  <motion.div
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/50 hover:border-red-500/50 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-red-500/20 rounded-lg group-hover:bg-red-500/30 transition-colors flex-shrink-0">
                        <BookmarkIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white mb-0.5 sm:mb-1 text-sm sm:text-base truncate">{t('myWatchlist')}</h4>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">{t('itemsCount', { count: watchlist.length })}</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
                <Link href="/recently-watched">
                  <motion.div
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/50 hover:border-purple-500/50 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-purple-500/20 rounded-lg group-hover:bg-purple-500/30 transition-colors flex-shrink-0">
                        <ClockIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white mb-0.5 sm:mb-1 text-sm sm:text-base truncate">{t('recentlyWatched')}</h4>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">{t('continueWatching')}</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
                <Link href="/settings">
                  <motion.div
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-blue-500/20 rounded-lg group-hover:bg-blue-500/30 transition-colors flex-shrink-0">
                        <Cog6ToothIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white mb-0.5 sm:mb-1 text-sm sm:text-base truncate">{t('settings')}</h4>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">{t('accountInformation')}</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
                <Link href="/friends">
                  <motion.div
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/50 hover:border-green-500/50 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-green-500/20 rounded-lg group-hover:bg-green-500/30 transition-colors flex-shrink-0">
                        <UsersIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white mb-0.5 sm:mb-1 text-sm sm:text-base truncate">{t('friendsList')}</h4>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">{t('manageFriends')}</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
                <Link href="/mycomments">
                  <motion.div
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/50 hover:border-amber-500/50 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-amber-500/20 rounded-lg group-hover:bg-amber-500/30 transition-colors flex-shrink-0">
                        <ChatBubbleLeftRightIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white mb-0.5 sm:mb-1 text-sm sm:text-base truncate">{t('myComments')}</h4>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">{t('manageComments')}</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
                <Link href="/saved-streams">
                  <motion.div
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                    className="bg-gray-800/50 hover:bg-gray-700/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-gray-700/50 hover:border-emerald-500/50 transition-all duration-300 cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 bg-emerald-500/20 rounded-lg group-hover:bg-emerald-500/30 transition-colors flex-shrink-0">
                        <SignalIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-semibold text-white mb-0.5 sm:mb-1 text-sm sm:text-base truncate">{t('savedStreams')}</h4>
                        <p className="text-xs sm:text-sm text-gray-400 truncate">{t('manageSavedStreams')}</p>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </div>
            </motion.div>

            {/* Active Sessions Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-gray-700/50 shadow-2xl mb-6 sm:mb-8 lg:mb-12"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
                  <Cog6ToothIcon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-500" />
                  <span>{t('activeSessions')}</span>
                </h3>
                {sessions.length > 1 && (
                  <button
                    onClick={handleRevokeAllOtherSessions}
                    disabled={isRevokingAll}
                    className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-lg text-xs sm:text-sm font-semibold transition-all"
                  >
                    {t('logoutOtherDevices')}
                  </button>
                )}
              </div>

              {isLoadingSessions ? (
                <div className="flex justify-center py-6">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-4">{t('noActiveSessions')}</p>
              ) : (
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session._id}
                      className={`flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all ${
                        session.isCurrent
                          ? 'bg-blue-500/10 border-blue-500/30'
                          : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-800/50'
                      }`}
                    >
                      <div className="min-w-0 flex-1 flex items-start gap-3">
                        <div className={`p-2 rounded-lg flex-shrink-0 ${session.isCurrent ? 'bg-blue-500/20' : 'bg-gray-700/40'}`}>
                          {session.device.includes('iPhone') || session.device.includes('iOS') || session.device.includes('Android') ? (
                            <span className="text-lg">📱</span>
                          ) : (
                            <span className="text-lg">💻</span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-sm sm:text-base break-words">
                              {session.device}
                            </span>
                            {session.isCurrent && (
                              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] sm:text-xs rounded-full font-medium">
                                {t('currentDevice')}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 flex flex-wrap gap-x-2 gap-y-0.5">
                            <span>{t('ipAddress', { ip: session.ip })}</span>
                            <span>•</span>
                            <span>{t('lastActiveTime', { time: new Date(session.lastActive).toLocaleString() })}</span>
                          </p>
                        </div>
                      </div>

                      {!session.isCurrent && (
                        <button
                          onClick={() => handleRevokeSession(session._id)}
                          className="ml-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0"
                          title="Revoke session"
                        >
                          <TrashIcon className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </section>
      </div>
      
      {/* Interactive Avatar Cropper Modal */}
      <AnimatePresence>
        {showCropModal && cropImageSrc && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] px-4"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
            >
              <h3 className="text-xl font-bold text-white mb-4 text-center">
                {t('changeAvatar') || 'Cắt ảnh đại diện'}
              </h3>
              
              {/* Cropping box with circular mask */}
              <div 
                className="w-[250px] h-[250px] mx-auto rounded-full border-4 border-gray-700 relative overflow-hidden bg-black select-none cursor-move"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {/* Crop Image preview */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={cropImageRef}
                  src={cropImageSrc}
                  alt="Crop Preview"
                  className="absolute pointer-events-none select-none max-w-none origin-center"
                  style={{
                    transform: `translate(${cropPosition.x}px, ${cropPosition.y}px) scale(${cropZoom})`,
                    width: 'auto',
                    height: '100%',
                    top: 0,
                    left: 0,
                  }}
                />
              </div>
              
              <p className="text-xs text-gray-400 text-center mt-3">
                Kéo để di chuyển, dùng thanh trượt để phóng to/thu nhỏ
              </p>

              {/* Zoom Slider */}
              <div className="mt-6 flex items-center gap-4">
                <span className="text-gray-400 text-sm">Zoom</span>
                <input
                  type="range"
                  min="1"
                  max="3"
                  step="0.01"
                  value={cropZoom}
                  onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
                />
                <span className="text-white text-xs font-mono">{Math.round(cropZoom * 100)}%</span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowCropModal(false)}
                  className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
                >
                  Huỷ
                </button>
                <button
                  onClick={handleSaveCrop}
                  className="flex-1 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium transition-colors"
                >
                  Lưu & Tải lên
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Avatar Full-screen Preview Modal */}
      <AnimatePresence>
        {isPreviewOpen && avatarUrl && (
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
                src={avatarUrl}
                alt={user.name}
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

      {/* Custom Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[9999] px-4"
            onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-3 text-center">
                {confirmModal.title}
              </h3>
              <p className="text-gray-300 text-sm text-center mb-6 leading-relaxed">
                {confirmModal.message}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                  className="flex-1 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-medium transition-colors"
                >
                  {t('cancelBtn') || 'Cancel'}
                </button>
                <button
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 py-3 rounded-xl font-medium transition-colors text-white ${
                    confirmModal.isDanger 
                      ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20' 
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/20'
                  }`}
                >
                  {t('confirmBtn') || 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
} 
