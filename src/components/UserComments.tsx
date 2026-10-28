import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChatBubbleLeftRightIcon, ChevronRightIcon, TrashIcon } from '@heroicons/react/24/outline'
import Link from 'next/link'
import api from '@/lib/axios'
import { toast } from 'react-hot-toast'
import { useTranslations } from 'next-intl'
import ConfirmDialog from '@/components/common/ConfirmDialog'

interface Comment {
  _id: string
  movieId: number
  type: string
  content: string
  createdAt: string
  parentId: string | null
  likes: number
}

const timeAgo = (dateString: string, t: (key: string, values?: Record<string, string | number>) => string) => {
  const date = new Date(dateString)
  const now = new Date()
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return t('justNow')
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return t('minAgo', { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t('hrAgo', { count: hours })
  const days = Math.floor(hours / 24)
  if (days < 30) return t('dayAgo', { count: days })
  const months = Math.floor(days / 30)
  if (months < 12) return t('moAgo', { count: months })
  const years = Math.floor(months / 12)
  return t('yrAgo', { count: years })
}

const getLinkText = (comment: Comment, filter: string, t: (key: string, values?: Record<string, string>) => string) => {
  const typeText = comment.type === 'tvshow' ? t('tvShow') : t('movie')
  if (filter === 'liked') {
    return t(comment.parentId ? 'viewLikedReply' : 'viewLikedComment', { type: typeText })
  }
  return t(comment.parentId ? 'viewReply' : 'viewComment', { type: typeText })
}

interface UserCommentsProps {
  hideTitle?: boolean
  className?: string
}

export default function UserComments({ hideTitle = false, className = '' }: UserCommentsProps = {}) {
  const t = useTranslations('UserComments')
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<'comments' | 'replies' | 'liked'>('comments')

  const fetchComments = React.useCallback(async (pageNum: number, filterType: string = activeFilter) => {
    if (pageNum === 1) setLoading(true)
    try {
      const res = await api.get(`/comments/user/me?page=${pageNum}&limit=10&filter=${filterType}`)
      if (res.data?.success) {
        if (pageNum === 1) {
          setComments(res.data.data)
        } else {
          setComments(prev => [...prev, ...res.data.data])
        }
        setHasMore(res.data.page < res.data.totalPages)
        setPage(pageNum)
      }
    } catch (error) {
      console.error('Error fetching user comments:', error)
      toast.error(t('loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [activeFilter, t])

  useEffect(() => {
    fetchComments(1, activeFilter)
  }, [activeFilter, fetchComments])

  const handleFilterChange = (newFilter: 'comments' | 'replies' | 'liked') => {
    if (newFilter === activeFilter) return
    setActiveFilter(newFilter)
    setComments([])
    setPage(1)
    setHasMore(false)
  }

  const handleConfirmAction = async (id: string) => {
    setDeletingId(id)
    try {
      if (activeFilter === 'liked') {
        await api.put(`/comments/${id}/like`)
        setComments(prev => prev.filter(c => c._id !== id))
        toast.success(t('likeRemoved'))
        return
      }

      await api.delete(`/comments/${id}`)
      setComments(prev => prev.filter(c => c._id !== id))
      toast.success(t('commentDeleted'))
    } catch {
      toast.error(activeFilter === 'liked' ? t('removeLikeFailed') : t('deleteFailed'))
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: hideTitle ? 0.2 : 0.9 }}
      className={`bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-gray-700/50 shadow-2xl ${hideTitle ? 'mt-0' : 'mt-6 sm:mt-8 lg:mt-12'} ${className}`}
    >
      <ConfirmDialog
        open={!!confirmDeleteId}
        title={activeFilter === 'liked' ? t('removeLikeTitle') : t('deleteTitle')}
        description={activeFilter === 'liked' ? t('removeLikeDescription') : t('deleteDescription')}
        confirmText={activeFilter === 'liked' ? t('removeLikeAction') : t('deleteAction')}
        cancelText={t('cancel')}
        onConfirm={() => confirmDeleteId && handleConfirmAction(confirmDeleteId)}
        onCancel={() => setConfirmDeleteId(null)}
      />

      <div className={`flex flex-col sm:flex-row ${hideTitle ? 'justify-start' : 'sm:items-center sm:justify-between'} mb-4 sm:mb-6 gap-3 sm:gap-0`}>
        {!hideTitle && (
          <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-white flex items-center gap-2 sm:gap-3">
            <ChatBubbleLeftRightIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-500" />
            <span>{t('title')}</span>
          </h3>
        )}
        
        {/* Filter Tabs */}
        <div className="flex bg-gray-900/80 p-1 rounded-lg border border-gray-700/50 self-start w-full sm:w-auto">
          {[ 
            { id: 'comments', label: t('filterComments') },
            { id: 'replies', label: t('filterReplies') },
            { id: 'liked', label: t('filterLiked') }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleFilterChange(tab.id as 'comments' | 'replies' | 'liked')}
              className={`flex-1 sm:flex-none px-3 sm:px-5 py-1.5 sm:py-2 rounded-md text-xs sm:text-sm font-medium transition-all duration-300 ${
                activeFilter === tab.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && comments.length === 0 ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500"></div>
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 bg-gray-800/20 rounded-xl border border-gray-800/50">
          <p className="text-gray-400">
            {t('noCommentsFound', { filter: activeFilter === 'comments' ? t('filterComments').toLowerCase() : activeFilter === 'replies' ? t('filterReplies').toLowerCase() : t('filterLiked').toLowerCase() })}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence>
            {comments.map((comment, index) => (
              <motion.div
                key={comment._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                className={`rounded-xl p-4 border flex flex-col gap-3 group transition-colors ${
                  activeFilter === 'liked' 
                    ? 'bg-red-900/10 border-red-500/20 hover:border-red-500/40' 
                    : activeFilter === 'replies' || comment.parentId
                      ? 'bg-indigo-900/10 border-indigo-500/20 hover:border-indigo-500/40'
                      : 'bg-gray-800/40 border-gray-700/50 hover:border-gray-600/50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <Link 
                    href={`/${comment.type === 'tvshow' ? 'tvshows' : 'movies'}/${comment.movieId}`}
                    className={`text-sm font-medium transition-colors flex items-center gap-1 ${
                      activeFilter === 'liked' ? 'text-red-400 hover:text-red-300' : 'text-blue-400 hover:text-blue-300'
                    }`}
                  >
                    {getLinkText(comment, activeFilter, t)}
                    <ChevronRightIcon className="w-4 h-4" />
                  </Link>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {timeAgo(comment.createdAt, t)}
                    </span>
                    <button
                      onClick={() => setConfirmDeleteId(comment._id)}
                      disabled={deletingId === comment._id}
                      className="text-gray-500 hover:text-red-400 transition-colors disabled:opacity-50"
                      title={t('deleteButtonLabel')}
                      aria-label={t('deleteButtonLabel')}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                {comment.parentId && (
                  <div className={`text-xs font-semibold px-2 py-0.5 rounded inline-block w-fit ${
                    activeFilter === 'liked' ? 'bg-red-900/30 text-red-400' : 'bg-indigo-900/40 text-indigo-300'
                  }`}>
                    {t('reply')}
                  </div>
                )}
                
                <p className="text-gray-200 text-sm leading-relaxed">{comment.content}</p>
                
                {comment.likes > 0 && (
                  <div className="text-xs text-red-400 flex items-center gap-1">
                    ❤️ {comment.likes === 1 ? t('like', { count: 1 }) : t('likes', { count: comment.likes })}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          
          {hasMore && (
            <button
              onClick={() => fetchComments(page + 1)}
              className="w-full py-3 mt-2 text-center text-sm font-medium text-gray-400 hover:text-white bg-gray-800/30 hover:bg-gray-800/60 rounded-xl border border-gray-700/50 transition-colors"
            >
              {t('loadMore')}
            </button>
          )}
        </div>
      )}
    </motion.div>
  )
}
