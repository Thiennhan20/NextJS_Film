'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { io, Socket } from 'socket.io-client'
import { AnimatePresence, type Easing, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowPathIcon,
  BellIcon,
  ChatBubbleLeftIcon,
  HeartIcon,
  InformationCircleIcon,
  UserPlusIcon,
  CheckBadgeIcon
} from '@heroicons/react/24/outline'
import api from '@/lib/axios'
import useAuthStore from '@/store/useAuthStore'

const CURRENT_HASH = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev'
const HEADER_DROPDOWN_OPEN_EVENT = 'header-dropdown-open'

export type NotificationType = 'comment_liked' | 'comment_replied' | 'version_updated' | 'friend_request' | 'friend_accept'

interface NotificationActor {
  _id: string
  name?: string
  email?: string
  avatar?: string
}

interface NotificationMetadata {
  movieId?: number
  contentType?: 'movie' | 'tvshow'
  commentId?: string
  parentCommentId?: string
  commentPreview?: string
  versionHash?: string
  versionMessage?: string
}

interface ApiNotification {
  _id: string
  type: NotificationType
  read: boolean
  readAt?: string | null
  actor?: NotificationActor | null
  metadata?: NotificationMetadata
  createdAt: string
}

interface VersionNotification {
  id: string
  type: 'version_updated'
  read: boolean
  metadata: NotificationMetadata
  createdAt: string
}

interface NotificationsResponse {
  data: ApiNotification[]
  unreadCount: number
  total: number
  page: number
  totalPages: number
}

interface VersionInfo {
  hash: string
  changelog: string[]
  description: string
  updatedAt?: string
}

interface NotificationTarget {
  movieId: number
  contentType: 'movie' | 'tvshow'
  commentId?: string
  parentCommentId?: string
}

interface NotificationTargetResponse {
  data: NotificationTarget
}

interface NotificationBellProps {
  isScrolled?: boolean
  compact?: boolean
}

type DisplayNotification = ApiNotification | VersionNotification

function sortNotificationsByNewest(items: ApiNotification[]) {
  return [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

function mergeNotifications(current: ApiNotification[], incoming: ApiNotification[]) {
  const merged = new Map<string, ApiNotification>()

  current.forEach((item) => merged.set(item._id, item))
  incoming.forEach((item) => {
    const existing = merged.get(item._id)
    merged.set(item._id, existing ? {
      ...existing,
      ...item,
      read: existing.read || item.read,
      readAt: existing.readAt || item.readAt,
      metadata: {
        ...(existing.metadata || {}),
        ...(item.metadata || {})
      }
    } : item)
  })

  return sortNotificationsByNewest(Array.from(merged.values())).slice(0, 20)
}

function notifyHeaderDropdownOpen() {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(HEADER_DROPDOWN_OPEN_EVENT, {
    detail: { source: 'notifications' }
  }))
}

function isApiNotification(notification: DisplayNotification): notification is ApiNotification {
  return '_id' in notification
}

function buildCommentTargetPath(target: NotificationMetadata | NotificationTarget, focusToken?: string) {
  if (!target.movieId || !target.contentType) return null

  const basePath = target.contentType === 'tvshow' ? 'tvshows' : 'movies'
  const targetCommentId = target.commentId ? String(target.commentId) : ''
  const parentCommentId = target.parentCommentId ? String(target.parentCommentId) : ''
  const searchParams = new URLSearchParams()

  if (targetCommentId) {
    searchParams.set('comment', targetCommentId)
  }
  if (parentCommentId && parentCommentId !== targetCommentId) {
    searchParams.set('parentComment', parentCommentId)
  }
  if (focusToken) {
    searchParams.set('focusComment', focusToken)
  }

  const query = searchParams.toString()
  const anchorId = targetCommentId || parentCommentId
  const hash = anchorId ? `#comment-${encodeURIComponent(anchorId)}` : '#comments'

  return `/${basePath}/${target.movieId}${query ? `?${query}` : ''}${hash}`
}

function getNotificationSocketUrl() {
  if (typeof window !== 'undefined') {
    const host = window.location.hostname
    if (host === 'localhost' || host === '127.0.0.1') {
      return 'http://localhost:3001/notifications'
    }
  }

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL
  if (wsUrl) return `${wsUrl.replace(/\/$/, '')}/notifications`

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || ''
  const serverUrl = apiUrl.replace(/\/api\/?$/, '')
  return serverUrl ? `${serverUrl}/notifications` : '/notifications'
}

export default function NotificationBell({ isScrolled = false, compact = false }: NotificationBellProps) {
  const { isAuthenticated, token } = useAuthStore()
  const router = useRouter()
  const t = useTranslations('Notifications')
  const locale = useLocale()
  const shouldReduceMotion = useReducedMotion()

  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<ApiNotification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [versionNotification, setVersionNotification] = useState<VersionNotification | null>(null)
  const [selectedVersionNotification, setSelectedVersionNotification] = useState<VersionNotification | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isMarkingAll, setIsMarkingAll] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const rootRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const notificationsRef = useRef<ApiNotification[]>([])
  const fetchRequestIdRef = useRef(0)

  const versionUnread = versionNotification && !versionNotification.read ? 1 : 0
  const totalUnread = unreadCount + versionUnread

  useEffect(() => {
    notificationsRef.current = notifications
  }, [notifications])

  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return

    try {
      const response = await api.get('/notifications/unread-count')
      setUnreadCount(response.data.unreadCount || 0)
    } catch {
      setUnreadCount(0)
    }
  }, [isAuthenticated])

  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return

    const requestId = ++fetchRequestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      const response = await api.get<NotificationsResponse>('/notifications?page=1&limit=20')
      if (requestId !== fetchRequestIdRef.current) return

      setNotifications((prev) => {
        const next = mergeNotifications(prev, response.data.data || [])
        notificationsRef.current = next
        return next
      })
      setUnreadCount(response.data.unreadCount || 0)
    } catch {
      if (requestId === fetchRequestIdRef.current) {
        setError(t('failedLoad'))
      }
    } finally {
      if (requestId === fetchRequestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [isAuthenticated, t])

  const checkVersionNotification = useCallback(async () => {
    try {
      const response = await fetch('/api/version', { cache: 'no-store' })
      if (!response.ok) return

      const data: VersionInfo = await response.json()
      if (!data.hash) {
        setVersionNotification(null)
        return
      }

      const readHash = localStorage.getItem('notification_version_read_hash')
      const notifiedHash = localStorage.getItem('notified_hash')
      const message = data.changelog?.[0] || data.description
      const isCurrentVersion = data.hash === CURRENT_HASH || CURRENT_HASH === 'dev'

      setVersionNotification({
        id: `version-${data.hash}`,
        type: 'version_updated',
        read: isCurrentVersion || readHash === data.hash || notifiedHash === data.hash,
        metadata: {
          versionHash: data.hash,
          versionMessage: message
        },
        createdAt: data.updatedAt || new Date().toISOString()
      })
    } catch {
      // Version notifications are best-effort and should never block the header.
    }
  }, [])

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([])
      setUnreadCount(0)
    } else {
      fetchUnreadCount()
    }

    checkVersionNotification()

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (useAuthStore.getState().isAuthenticated) {
          fetchUnreadCount()
        }
        checkVersionNotification()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [checkVersionNotification, fetchUnreadCount, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || !token) return

    const socket = io(getNotificationSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts: 10
    })

    socketRef.current = socket

    socket.on('notification:new', (notification: ApiNotification) => {
      const alreadyExists = notificationsRef.current.some((item) => item._id === notification._id)
      setNotifications((prev) => {
        const next = mergeNotifications(prev, [notification])
        notificationsRef.current = next
        return next
      })

      if (!alreadyExists && !notification.read) {
        setUnreadCount((prev) => prev + 1)
      }
    })

    socket.on('connect_error', () => {
      // API polling/fetch on open still keeps the bell correct if realtime is unavailable.
    })

    return () => {
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [isAuthenticated, token])

  useEffect(() => {
    if (!isOpen) return

    if (isAuthenticated) {
      fetchNotifications()
    }
    checkVersionNotification()
  }, [checkVersionNotification, fetchNotifications, isAuthenticated, isOpen])

  useEffect(() => {
    if (!isOpen) return

    const onDocumentMouseDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', onDocumentMouseDown)
    return () => document.removeEventListener('mousedown', onDocumentMouseDown)
  }, [isOpen])

  useEffect(() => {
    const onHeaderDropdownOpen = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source
      if (source && source !== 'notifications') {
        setIsOpen(false)
      }
    }

    window.addEventListener(HEADER_DROPDOWN_OPEN_EVENT, onHeaderDropdownOpen as EventListener)
    return () => window.removeEventListener(HEADER_DROPDOWN_OPEN_EVENT, onHeaderDropdownOpen as EventListener)
  }, [])

  const allNotifications = useMemo<DisplayNotification[]>(() => {
    const items: DisplayNotification[] = versionNotification
      ? [versionNotification, ...notifications]
      : [...notifications]

    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
  }, [notifications, versionNotification])

  const markVersionRead = () => {
    const hash = versionNotification?.metadata.versionHash
    if (!hash) return

    localStorage.setItem('notification_version_read_hash', hash)
    setVersionNotification((prev) => prev ? { ...prev, read: true } : prev)
  }

  const markServerNotificationRead = async (notification: ApiNotification) => {
    if (notification.read) return

    setNotifications((prev) => prev.map((item) => (
      item._id === notification._id ? { ...item, read: true, readAt: new Date().toISOString() } : item
    )))
    setUnreadCount((prev) => Math.max(0, prev - 1))

    try {
      await api.patch(`/notifications/${notification._id}/read`)
    } catch {
      fetchUnreadCount()
    }
  }

  const resolveNotificationTarget = async (notification: ApiNotification) => {
    const metadata = notification.metadata || {}
    const focusToken = `${notification._id}-${Date.now()}`

    if (notification.type === 'friend_request') {
      return '/friends?tab=received'
    }

    if (notification.type === 'friend_accept') {
      return `/profile/${notification.actor?._id}`
    }

    if (notification.type !== 'comment_liked' && notification.type !== 'comment_replied') {
      return buildCommentTargetPath(metadata, focusToken)
    }

    try {
      const response = await api.get<NotificationTargetResponse>(`/notifications/${notification._id}/target`)
      const target = response.data.data

      setNotifications((prev) => prev.map((item) => (
        item._id === notification._id
          ? {
              ...item,
              metadata: {
                ...(item.metadata || {}),
                ...target
              }
            }
          : item
      )))

      return buildCommentTargetPath(target, focusToken)
    } catch {
      return buildCommentTargetPath(metadata, focusToken)
    }
  }

  const handleNotificationClick = async (notification: DisplayNotification) => {
    if (!isApiNotification(notification)) {
      markVersionRead()
      setSelectedVersionNotification(notification as VersionNotification)
      setIsOpen(false)
      return
    }

    await markServerNotificationRead(notification)

    const targetPath = await resolveNotificationTarget(notification)
    if (targetPath) {
      setIsOpen(false)

      if (typeof window !== 'undefined') {
        const targetUrl = new URL(targetPath, window.location.origin)
        window.location.assign(targetUrl.toString())
        return
      }

      router.push(targetPath, { scroll: false })
    }
  }

  const handleMarkAllRead = async () => {
    setIsMarkingAll(true)

    try {
      if (isAuthenticated) {
        await api.patch('/notifications/read-all')
        setNotifications((prev) => prev.map((item) => ({
          ...item,
          read: true,
          readAt: item.readAt || new Date().toISOString()
        })))
        setUnreadCount(0)
      }
      markVersionRead()
    } finally {
      setIsMarkingAll(false)
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000)
    if (seconds < 60) return t('justNow')

    const minutes = Math.floor(seconds / 60)
    if (minutes < 60) return t('minutesAgo', { count: minutes })

    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('hoursAgo', { count: hours })

    const days = Math.floor(hours / 24)
    if (days < 7) return t('daysAgo', { count: days })

    return new Date(timestamp).toLocaleDateString()
  }

  const formatVersionDateTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (Number.isNaN(date.getTime())) return timestamp

    return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(date)
  }

  const formatNotificationTime = (notification: DisplayNotification) => {
    if (notification.type === 'version_updated') {
      return formatVersionDateTime(notification.createdAt)
    }

    return formatTimeAgo(notification.createdAt)
  }

  const getTitle = (notification: DisplayNotification) => {
    if (notification.type === 'version_updated') {
      return t('versionUpdated')
    }

    const actorName = notification.actor?.name || t('unknownUser')
    if (notification.type === 'comment_liked') {
      return t('commentLiked', { user: actorName })
    }
    if (notification.type === 'friend_request') {
      return t('friendRequest', { user: actorName })
    }
    if (notification.type === 'friend_accept') {
      return t('friendAccept', { user: actorName })
    }

    return t('commentReplied', { user: actorName })
  }

  const getPreview = (notification: DisplayNotification) => {
    const metadata = notification.metadata || {}
    if (notification.type === 'version_updated') {
      return metadata.versionMessage || t('versionPreview')
    }
    if (notification.type === 'friend_request') {
      return t('friendRequestPreview')
    }
    if (notification.type === 'friend_accept') {
      return t('friendAcceptPreview')
    }

    return metadata.commentPreview || t('commentPreviewFallback')
  }

  const renderIcon = (type: NotificationType) => {
    if (type === 'comment_liked') {
      return <HeartIcon className="h-4 w-4 text-red-400" />
    }
    if (type === 'comment_replied') {
      return <ChatBubbleLeftIcon className="h-4 w-4 text-blue-400" />
    }
    if (type === 'friend_request') {
      return <UserPlusIcon className="h-4 w-4 text-blue-400" />
    }
    if (type === 'friend_accept') {
      return <CheckBadgeIcon className="h-4 w-4 text-green-400" />
    }

    return <InformationCircleIcon className="h-4 w-4 text-purple-400" />
  }

  const renderAvatar = (notification: DisplayNotification) => {
    if (notification.type === 'version_updated' || !isApiNotification(notification)) {
      return (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-500/15 sm:h-9 sm:w-9">
          {renderIcon(notification.type)}
        </div>
      )
    }

    const avatar = notification.actor?.avatar
    const name = notification.actor?.name || t('unknownUser')

    if (avatar) {
      return (
        <Image
          src={avatar}
          alt={name}
          width={36}
          height={36}
          className="h-8 w-8 rounded-full object-cover sm:h-9 sm:w-9"
          unoptimized={avatar.startsWith('http') || avatar.startsWith('data:')}
        />
      )
    }

    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-700 text-xs font-semibold text-white sm:h-9 sm:w-9 sm:text-sm">
        {name.charAt(0).toUpperCase()}
      </div>
    )
  }

  const buttonClassName = compact
    ? 'relative p-1.5 rounded-full bg-white shadow border border-red-200 text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition'
    : `relative flex h-10 w-10 items-center justify-center rounded-full border shadow-sm backdrop-blur-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-red-500 active:scale-95 ${
        isScrolled
          ? 'border-white/15 bg-white/10 text-white hover:border-red-400/50 hover:bg-red-500/15 hover:text-red-300'
          : 'border-gray-200 bg-white/80 text-gray-700 hover:border-red-200 hover:bg-red-50 hover:text-red-600 hover:shadow-md'
      }`

  const panelClassName = compact
    ? 'fixed left-3 right-3 top-[4.25rem] z-[70] flex max-h-[min(72vh,34rem)] origin-top flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl will-change-transform'
    : 'absolute right-0 z-[70] mt-2 flex max-h-[min(72vh,34rem)] w-[min(24rem,calc(100vw-1.5rem))] origin-top-right flex-col overflow-hidden rounded-lg border border-gray-700 bg-gray-900 shadow-2xl will-change-transform'

  const ease: Easing = 'easeOut'

  const panelMotion = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.12 }
      }
    : {
        initial: { opacity: 0, y: -6, scale: 0.98 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.985 },
        transition: { duration: 0.18, ease }
      }

  const getItemMotion = (index: number) => (
    shouldReduceMotion
      ? {
          initial: { opacity: 0 },
          animate: { opacity: 1 },
          exit: { opacity: 0 },
          transition: { duration: 0.12 }
        }
      : {
          initial: { opacity: 0, y: 5 },
          animate: { opacity: 1, y: 0 },
          exit: { opacity: 0, y: -4 },
          transition: {
            duration: 0.18,
            delay: Math.min(index * 0.025, 0.14),
            ease
          }
        }
  )

  const showInitialLoading = isLoading && allNotifications.length === 0
  const showErrorState = !!error && allNotifications.length === 0
  const showEmptyState = !isLoading && !error && allNotifications.length === 0
  const showRefreshing = isLoading && allNotifications.length > 0
  const notificationBodyClassName = allNotifications.length > 0
    ? 'notification-scrollbar max-h-[min(58vh,28rem)] overflow-y-auto overscroll-contain'
    : 'overflow-hidden'

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setIsOpen((prev) => {
            const nextOpen = !prev
            if (nextOpen) notifyHeaderDropdownOpen()
            return nextOpen
          })
        }}
        className={buttonClassName}
        aria-label={t('label')}
        aria-expanded={isOpen}
      >
        <BellIcon className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        {totalUnread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-to-r from-red-600 to-pink-600 px-1 text-[10px] font-bold leading-none text-white shadow-md shadow-red-900/30 ring-2 ring-white">
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
        <motion.div className={panelClassName} {...panelMotion}>
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-800 px-3 py-2.5 sm:items-center sm:px-4 sm:py-3">
            <div className="min-w-0">
              <h3 className="truncate text-sm font-semibold text-white sm:text-base">{t('label')}</h3>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <p>{isAuthenticated ? t('unreadCount', { count: totalUnread }) : t('systemUpdates')}</p>
                {showRefreshing && (
                  <ArrowPathIcon className="h-3 w-3 animate-spin text-gray-500" aria-hidden="true" />
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={handleMarkAllRead}
              disabled={totalUnread === 0 || isMarkingAll}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-red-300 transition hover:bg-red-500/10 hover:text-red-200 disabled:cursor-not-allowed disabled:text-gray-600 sm:text-xs"
            >
              {isMarkingAll ? t('marking') : t('markAllRead')}
            </button>
          </div>

          <div className={notificationBodyClassName}>
            <AnimatePresence initial={false} mode="wait">
            {showInitialLoading && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="space-y-2 px-3 py-3 sm:px-4"
              >
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex gap-2.5 rounded-lg border border-gray-800/70 bg-gray-800/30 px-3 py-3 sm:gap-3">
                    <div className="h-8 w-8 shrink-0 rounded-full bg-gray-700/80 animate-pulse sm:h-9 sm:w-9" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="h-3.5 w-2/3 rounded bg-gray-700/80 animate-pulse" />
                      <div className="h-3 w-full rounded bg-gray-800 animate-pulse" />
                      <div className="h-2.5 w-20 rounded bg-gray-800 animate-pulse" />
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {showErrorState && (
              <motion.div
                key="error"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.14 }}
                className="px-4 py-6 text-center text-sm text-red-300"
              >
                {error}
              </motion.div>
            )}

            {showEmptyState && (
              <motion.div
                key="empty"
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="px-4 py-8 text-center"
              >
                <BellIcon className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                <p className="text-sm text-gray-400">{t('empty')}</p>
              </motion.div>
            )}

            {allNotifications.length > 0 && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
                <AnimatePresence initial={false}>
                  {allNotifications.map((notification, index) => (
                    <motion.button
                      key={isApiNotification(notification) ? notification._id : notification.id}
                      type="button"
                      onClick={() => handleNotificationClick(notification)}
                      layout="position"
                      {...getItemMotion(index)}
                      className={`flex min-h-[5.25rem] w-full gap-2.5 border-b border-gray-800 px-3 py-3 text-left transition-colors duration-200 last:border-b-0 sm:min-h-[5.5rem] sm:gap-3 sm:px-4 ${
                        notification.read ? 'bg-gray-900 hover:bg-gray-800/70' : 'bg-red-500/5 hover:bg-red-500/10'
                      }`}
                    >
                      <div className="relative shrink-0">
                        {renderAvatar(notification)}
                        {notification.type !== 'version_updated' && (
                          <div className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-900 ring-1 ring-gray-700 sm:h-5 sm:w-5">
                            {renderIcon(notification.type)}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <p className="min-w-0 break-words text-[13px] font-semibold leading-snug text-white sm:text-sm">{getTitle(notification)}</p>
                          {!notification.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500" />}
                        </div>
                        <p className="mt-1 line-clamp-2 break-words text-[12px] leading-relaxed text-gray-400 sm:text-xs">{getPreview(notification)}</p>
                        <p className="mt-1 text-[11px] text-gray-500">{formatNotificationTime(notification)}</p>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
            </AnimatePresence>
          </div>
        </motion.div>
        )}
      </AnimatePresence>

      {/* Version Notification Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {selectedVersionNotification && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedVersionNotification(null)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl"
              >
                <div className="p-6">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
                    <ArrowPathIcon className="h-6 w-6 text-orange-400" />
                  </div>
                  <h3 className="mb-2 text-center text-xl font-bold text-white">
                    {t('versionUpdated')}
                  </h3>
                  <div className="mb-6 text-center text-sm text-gray-300 whitespace-pre-wrap">
                    {selectedVersionNotification.metadata.versionMessage || t('versionPreview')}
                  </div>
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setSelectedVersionNotification(null)}
                      className="w-full rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-600"
                    >
                      {t('close')}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
