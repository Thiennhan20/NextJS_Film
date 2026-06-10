'use client'

import React, { useEffect, useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  UserIcon,
  CalendarIcon,
  ClockIcon,
  Cog6ToothIcon,
  ArrowLeftIcon,
  CheckIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import useAuthHydrated from '@/store/useAuthHydrated'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useSearchParams } from 'next/navigation'

const languages = [
  { code: 'en', fullCode: 'en-US', label: 'English', shortLabel: 'EN' },
  { code: 'vi', fullCode: 'vi-VN', label: 'Tiếng Việt', shortLabel: 'VI' },
]

export default function SettingsClient() {
  const { user, isAuthenticated, isAuthChecked } = useAuthStore()
  const hydrated = useAuthHydrated()
  const [mounted, setMounted] = useState(false)
  const t = useTranslations('Profile')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isLoggedIn = isAuthenticated && !!user
  const selectedLanguage = languages.find((language) => language.code === locale) || languages[0]

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate account age
  const accountAge = useMemo(() => {
    if (!isLoggedIn || !user?.createdAt) return t('notAvailable')
    const created = new Date(user.createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays < 30) return t('days', { count: diffDays })
    if (diffDays < 365) return t('months', { count: Math.floor(diffDays / 30) })
    return t('years', { count: Math.floor(diffDays / 365) })
  }, [isLoggedIn, t, user?.createdAt])

  // Format date
  const formatDate = (dateString?: string) => {
    if (!dateString) return t('notAvailable')
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleLanguageChange = (language: typeof languages[number]) => {
    document.cookie = `locale=${language.code};path=/;max-age=31536000;SameSite=Lax`

    const params = new URLSearchParams(searchParams.toString())
    if (language.code === 'en') {
      params.delete('lang')
    } else {
      params.set('lang', language.fullCode)
    }

    const query = params.toString()
    window.location.href = query ? `${pathname}?${query}` : pathname
  }

  if (!mounted || !hydrated || !isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <section className="pt-6 sm:pt-10 lg:pt-14 xl:pt-16 pb-6 sm:pb-10 lg:pb-12 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Header with back button */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 mb-6 sm:mb-8"
            >
              <Link
                href={isLoggedIn ? '/profile' : '/'}
                className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-300" />
              </Link>
              <div className="flex items-center gap-2">
                <Cog6ToothIcon className="w-6 h-6 sm:w-7 sm:h-7 text-red-500" />
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white">{t('settings')}</h1>
              </div>
            </motion.div>

            {/* Language Settings */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-4 sm:mb-6 bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 border border-gray-700/50 shadow-2xl"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/20">
                    <GlobeAltIcon className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base sm:text-lg font-bold text-white">{t('languageSettings')}</h2>
                    <p className="mt-1 text-xs sm:text-sm text-gray-400">{t('languageDescription')}</p>
                    <p className="mt-2 text-xs text-gray-500">
                      {t('currentLanguage')}: <span className="text-gray-300">{selectedLanguage.label}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:w-72">
                  {languages.map((language) => {
                    const isSelected = selectedLanguage.code === language.code

                    return (
                      <button
                        key={language.code}
                        type="button"
                        onClick={() => handleLanguageChange(language)}
                        className={`flex min-h-12 items-center justify-between rounded-xl border px-3 py-2 text-left transition ${
                          isSelected
                            ? 'border-red-500 bg-red-500/15 text-white'
                            : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-700/60'
                        }`}
                        aria-pressed={isSelected}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold">{language.shortLabel}</p>
                          <p className="truncate text-[11px] text-gray-400">{language.label}</p>
                        </div>
                        {isSelected && <CheckIcon className="h-4 w-4 shrink-0 text-red-300" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            </motion.div>

            {/* Account Information */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl rounded-2xl sm:rounded-3xl p-4 sm:p-6 lg:p-8 border border-gray-700/50 shadow-2xl"
            >
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-4 sm:mb-6 flex items-center gap-2 sm:gap-3">
                <UserIcon className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-red-500" />
                <span>{t('accountInformation')}</span>
              </h3>
              <div className="space-y-3 sm:space-y-4">
                {isLoggedIn ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                      <div className="mb-2 sm:mb-0 min-w-0 flex-1">
                        <p className="text-gray-400 text-xs sm:text-sm mb-1">{t('userId')}</p>
                        <p className="text-white font-mono text-xs sm:text-sm break-all">{user!.id}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                      <div className="mb-2 sm:mb-0 min-w-0 flex-1">
                        <p className="text-gray-400 text-xs sm:text-sm mb-1">{t('emailAddress')}</p>
                        <p className="text-white text-sm sm:text-base break-all">{user!.email}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                      <div className="mb-2 sm:mb-0 min-w-0 flex-1">
                        <p className="text-gray-400 text-xs sm:text-sm mb-1">{t('accountCreated')}</p>
                        <p className="text-white text-sm sm:text-base">{formatDate(user!.createdAt)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                      <div className="mb-2 sm:mb-0 min-w-0 flex-1">
                        <p className="text-gray-400 text-xs sm:text-sm mb-1">{t('activeForLabel')}</p>
                        <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                          <ClockIcon className="w-4 h-4 text-gray-400" />
                          <span>{accountAge}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                      <div className="mb-2 sm:mb-0 min-w-0 flex-1">
                        <p className="text-gray-400 text-xs sm:text-sm mb-1">{t('memberSinceLabel')}</p>
                        <div className="flex items-center gap-2 text-white text-sm sm:text-base">
                          <CalendarIcon className="w-4 h-4 text-gray-400" />
                          <span>{formatDate(user!.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                      <div className="mb-2 sm:mb-0 min-w-0 flex-1">
                        <p className="text-gray-400 text-xs sm:text-sm mb-1">{t('lastUpdated')}</p>
                        <p className="text-white text-sm sm:text-base">{formatDate(user!.updatedAt)}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-3 p-4 sm:p-5 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15">
                      <UserIcon className="h-5 w-5 text-red-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm sm:text-base font-semibold">{t('guestNotLoggedIn')}</p>
                      <p className="text-gray-400 text-xs sm:text-sm mt-1">{t('guestLoginHint')}</p>
                    </div>
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 sm:p-4 bg-gray-800/50 rounded-lg sm:rounded-xl border border-gray-700/50">
                  <div className="mb-2 sm:mb-0 min-w-0 flex-1">
                    <p className="text-gray-400 text-xs sm:text-sm mb-1">{t('webVersion')}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-white font-mono text-sm sm:text-base">
                        #{process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'dev'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="mt-3 sm:mt-0 px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 border border-gray-600 text-white font-medium text-xs sm:text-sm transition-colors"
                  >
                    {t('checkForUpdates')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      </div>
    </div>
  )
}
