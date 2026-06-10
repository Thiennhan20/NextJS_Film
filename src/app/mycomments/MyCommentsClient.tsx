'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import useAuthHydrated from '@/store/useAuthHydrated'
import Link from 'next/link'
import UserComments from '@/components/UserComments'
import { useTranslations } from 'next-intl'

export default function MyCommentsClient() {
  const t = useTranslations('Profile')
  const { isAuthenticated, isAuthChecked } = useAuthStore()
  const hydrated = useAuthHydrated()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !hydrated || !isAuthChecked) {
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
    <div className="min-h-screen bg-black text-white pb-12">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-red-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-10">
        {/* Back button */}
        <div className="mb-6">
          <Link href="/profile">
            <motion.button
              whileHover={{ scale: 1.02, x: -5 }}
              whileTap={{ scale: 0.98 }}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium bg-gray-900/50 hover:bg-gray-800/50 border border-gray-800 hover:border-gray-700 px-4 py-2 rounded-xl"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span>{t('backToProfile')}</span>
            </motion.button>
          </Link>
        </div>

        {/* User Comments Component */}
        <UserComments />
      </div>
    </div>
  )
}
