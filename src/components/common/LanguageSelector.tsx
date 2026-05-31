'use client'

import { useState, useEffect } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { usePathname, useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDownIcon, GlobeAltIcon } from '@heroicons/react/24/outline'

interface Language {
  code: string
  fullCode: string
  name: string
  flag: string
}

const languages: Language[] = [
  { code: 'en', fullCode: 'en-US', name: 'English', flag: '🇺🇸' },
  { code: 'vi', fullCode: 'vi-VN', name: 'Tiếng Việt', flag: '🇻🇳' },
]

interface LanguageSelectorProps {
  isScrolled?: boolean
  className?: string
}

export default function LanguageSelector({ isScrolled = false, className = '' }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const locale = useLocale()
  const t = useTranslations('Navigation')
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const selectedLanguage = languages.find(l => l.code === locale) || languages[0]

  useEffect(() => {
    // Detect mismatch between rendered locale and actual cookie
    const getCookie = (name: string) => {
      const value = `; ${document.cookie}`
      const parts = value.split(`; ${name}=`)
      if (parts.length === 2) return parts.pop()?.split(';').shift()
      return null
    }

    const cookieLocale = getCookie('locale')
    if (cookieLocale && cookieLocale !== locale) {
      // Reload/redirect to match cookie preference when browser history traversal leaves them out of sync
      const params = new URLSearchParams(window.location.search)
      if (cookieLocale === 'en') {
        params.delete('lang')
      } else {
        const fullCode = cookieLocale === 'vi' ? 'vi-VN' : 'en-US'
        params.set('lang', fullCode)
      }
      const query = params.toString()
      const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname
      window.location.replace(newUrl)
    }
  }, [locale])

  const handleLanguageChange = (language: Language) => {
    setIsOpen(false)

    // Save to cookie for persistence
    document.cookie = `locale=${language.code};path=/;max-age=31536000;SameSite=Lax`

    // Build new URL with ?lang= param
    const params = new URLSearchParams(searchParams.toString())

    if (language.code === 'en') {
      // Default language: remove ?lang= to keep URL clean
      params.delete('lang')
    } else {
      params.set('lang', language.fullCode)
    }

    const query = params.toString()
    const newUrl = query ? `${pathname}?${query}` : pathname

    // Use window.location.replace to avoid duplicating the same page in different languages on the history stack
    window.location.replace(newUrl)
  }

  return (
    <div className={`relative ${className}`}>
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center space-x-1 px-2 py-1.5 rounded-md transition-all duration-200 text-sm border ${
          isScrolled
            ? 'text-white border-white/30 hover:bg-white/10'
            : 'text-gray-700 border-gray-300 hover:bg-gray-50'
        }`}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        aria-label={t('selectLanguage')}
      >
        <GlobeAltIcon className="h-3.5 w-3.5" />
        <span className="font-medium text-xs">{selectedLanguage.code.toUpperCase()}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDownIcon className="h-3 w-3" />
        </motion.div>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -5, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-1 w-32 origin-top-right bg-white rounded-md shadow-lg border border-gray-200 z-50"
          >
            <div className="py-1">
              {languages.map((language) => (
                <button
                  key={language.code}
                  onClick={() => handleLanguageChange(language)}
                  className={`w-full flex items-center space-x-2 px-3 py-2 text-left text-sm transition-colors ${
                    language.code === selectedLanguage.code
                      ? 'bg-red-50 text-red-600'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <span className="text-base">{language.flag}</span>
                  <span className="font-medium">{language.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile */}
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  )
}