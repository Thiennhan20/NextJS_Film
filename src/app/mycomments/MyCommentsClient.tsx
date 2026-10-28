'use client'

import React, { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import useAuthStore from '@/store/useAuthStore'
import useAuthHydrated from '@/store/useAuthHydrated'
import Link from 'next/link'
import UserComments from '@/components/UserComments'
import BackButton from '@/components/common/BackButton'
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
    <div className="min-h-screen bg-black text-white pt-6 sm:pt-10 pb-10 sm:pb-16 px-3 sm:px-4 md:px-6 lg:px-8">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header đồng bộ chuẩn */}
        <div className="flex items-center gap-3 mb-6 sm:mb-8">
          <BackButton />
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500 text-transparent bg-clip-text">
              {t('myComments')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
              {t('manageComments')}
            </p>
          </div>
        </div>

        {/* User Comments Component */}
        <UserComments hideTitle />
      </div>
    </div>
  )
}
