'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslations } from 'next-intl'

interface FilterIconProps {
  selectedYear: string | number
  selectedCategory: string
  selectedCountry: string
  onYearChange: (year: string | number) => void
  onCategoryChange: (category: string) => void
  onCountryChange: (country: string) => void
  years: (string | number)[]
  categories: string[]
  countries: string[]
  // Optional props for search page
  selectedContentType?: 'all' | 'movie' | 'tv'
  selectedSort?: 'relevance' | 'popularity' | 'rating' | 'date'
  onContentTypeChange?: (type: 'all' | 'movie' | 'tv') => void
  onSortChange?: (sort: 'relevance' | 'popularity' | 'rating' | 'date') => void
  showContentType?: boolean
  showSort?: boolean
}

export default function FilterIcon({
  selectedYear,
  selectedCategory,
  selectedCountry,
  onYearChange,
  onCategoryChange,
  onCountryChange,
  years,
  categories,
  countries,
  selectedContentType,
  selectedSort,
  onContentTypeChange,
  onSortChange,
  showContentType = false,
  showSort = false
}: FilterIconProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const t = useTranslations('Filter')

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close dropdown when filter changes
  useEffect(() => {
    setIsOpen(false)
  }, [selectedYear, selectedCategory, selectedCountry, selectedContentType, selectedSort])

  // Get active filters count
  const activeFiltersCount = [
    selectedYear !== 'All' ? 1 : 0,
    selectedCategory !== 'All' ? 1 : 0,
    selectedCountry !== 'All' ? 1 : 0,
    showContentType && selectedContentType !== 'all' ? 1 : 0,
    showSort && selectedSort !== 'relevance' ? 1 : 0
  ].reduce((a, b) => a + b, 0)

  // Helper to get translated content type label for footer
  const getContentTypeLabel = (type: string) => {
    if (type === 'movie') return t('movies')
    if (type === 'tv') return t('tvShows')
    return ''
  }

  // Helper to get translated sort label for footer
  const getSortLabel = (sort: string) => {
    if (sort === 'popularity') return t('popularity')
    if (sort === 'rating') return t('rating')
    if (sort === 'date') return t('date')
    return ''
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="group relative flex items-center gap-2 px-4 py-2.5 bg-gray-800/80 backdrop-blur-sm border border-gray-700/50 rounded-lg text-white hover:bg-gray-700/80 hover:border-gray-600/50 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:ring-offset-2 focus:ring-offset-black/50 transition-all duration-200"
      >
        {/* Filter Icon */}
        <div className="relative">
          <svg
            className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          
          {/* Active Filters Badge */}
          {activeFiltersCount > 0 && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center shadow-lg"
            >
              <span className="text-xs font-bold text-white">{activeFiltersCount}</span>
            </motion.div>
          )}
        </div>
        
        {/* Button Text */}
        <span className="text-sm font-medium">{t('filters')}</span>
        
        {/* Dropdown Arrow */}
        <motion.svg
          className="w-4 h-4 text-gray-400 group-hover:text-gray-300 transition-colors"
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </motion.svg>
      </button>

      {/* Dropdown Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute top-full left-0 sm:left-1/2 sm:-translate-x-1/2 mt-2 w-[calc(100vw-2rem)] sm:w-96 bg-gray-900/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-700/50 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-3 py-2.5 bg-gradient-to-r from-gray-800/80 to-gray-700/80 border-b border-gray-700/50">
              <h3 className="text-white font-semibold text-sm">{t('filterOptions')}</h3>
              <p className="text-gray-400 text-xs">{t('refineSearch')}</p>
            </div>

            {/* Filter Options */}
            <div className="p-2 sm:p-3 space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar">
              {/* Content Type Filter (for search page) */}
              {showContentType && onContentTypeChange && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('contentType')}
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['all', 'movie', 'tv'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => onContentTypeChange(type)}
                        className={`px-2 py-1.5 text-xs rounded-md transition-all duration-200 ${
                          selectedContentType === type
                            ? 'bg-purple-600 text-white font-medium shadow-lg ring-1 ring-purple-400/30'
                            : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white border border-gray-700/50 hover:border-gray-600/50'
                        }`}
                      >
                        {type === 'all' ? t('all') : type === 'movie' ? t('movies') : t('tvShows')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sort Filter (for search page) */}
              {showSort && onSortChange && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('sortBy')}
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {(['relevance', 'popularity', 'rating', 'date'] as const).map((sort) => (
                      <button
                        key={sort}
                        onClick={() => onSortChange(sort)}
                        className={`px-2 py-1.5 text-xs rounded-md transition-all duration-200 ${
                          selectedSort === sort
                            ? 'bg-purple-600 text-white font-medium shadow-lg ring-1 ring-purple-400/30'
                            : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white border border-gray-700/50 hover:border-gray-600/50'
                        }`}
                      >
                        {sort === 'relevance' ? t('relevance') : sort === 'popularity' ? t('popularity') : sort === 'rating' ? t('rating') : t('date')}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Year Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('year')}
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                  {years.map((year) => (
                    <button
                      key={year}
                      onClick={() => onYearChange(year === 'All' ? 'All' : Number(year))}
                      className={`px-2 py-1.5 text-xs rounded-md transition-all duration-200 ${
                        String(selectedYear) === String(year)
                          ? 'bg-purple-600 text-white font-medium shadow-lg ring-1 ring-purple-400/30'
                          : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white border border-gray-700/50 hover:border-gray-600/50'
                      }`}
                    >
                      {year === 'All' ? t('all') : year}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  {t('category')}
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => onCategoryChange(category)}
                      className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
                        selectedCategory === category
                          ? 'bg-purple-600 text-white font-medium shadow-lg ring-1 ring-purple-400/30'
                          : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white border border-gray-700/50 hover:border-gray-600/50'
                      }`}
                    >
                      {category === 'All' ? t('all') : category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Country Filter */}
              {countries.length > 1 && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    {t('country')}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {countries.map((country) => (
                      <button
                        key={country}
                        onClick={() => onCountryChange(country)}
                        className={`px-3 py-1.5 text-xs rounded-md transition-all duration-200 ${
                          selectedCountry === country
                            ? 'bg-purple-600 text-white font-medium shadow-lg ring-1 ring-purple-400/30'
                            : 'bg-gray-800/60 text-gray-300 hover:bg-gray-700/80 hover:text-white border border-gray-700/50 hover:border-gray-600/50'
                        }`}
                      >
                        {country === 'All' ? t('all') : country}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-3 py-2.5 bg-gray-950/80 border-t border-gray-700/50">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {activeFiltersCount > 0 ? (
                    <>
                      {showContentType && selectedContentType !== 'all' && getContentTypeLabel(selectedContentType!)}
                      {showSort && selectedSort !== 'relevance' && `${showContentType && selectedContentType !== 'all' ? ' • ' : ''}${getSortLabel(selectedSort!)}`}
                      {selectedYear !== 'All' && `${(showContentType && selectedContentType !== 'all') || (showSort && selectedSort !== 'relevance') ? ' • ' : ''}${selectedYear}`}
                      {selectedCategory !== 'All' && ` • ${selectedCategory}`}
                      {selectedCountry !== 'All' && ` • ${selectedCountry}`}
                    </>
                  ) : (
                    t('allFiltersActive')
                  )}
                </span>
                <button
                  onClick={() => {
                    onYearChange('All')
                    onCategoryChange('All')
                    onCountryChange('All')
                    if (onContentTypeChange) onContentTypeChange('all')
                    if (onSortChange) onSortChange('relevance')
                  }}
                  className="text-purple-400 hover:text-purple-300 transition-colors duration-200 px-2.5 py-1 rounded-md hover:bg-gray-800/60 text-xs font-medium"
                >
                  {t('resetAll')}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Custom Scrollbar */}
      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #4b5563;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  )
}
