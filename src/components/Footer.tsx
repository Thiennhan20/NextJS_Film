'use client'

import { motion } from 'framer-motion'
import { useUIStore } from '@/store/store'
import { FaApple, FaAndroid } from 'react-icons/fa'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'

export default function Footer() {
  const { setAppModalOpen } = useUIStore()
  const t = useTranslations('Footer')

  return (
    <footer className="bg-black text-gray-500 py-10 border-t border-gray-900 text-center text-sm relative overflow-hidden">
      {/* Sleek top ambient glow border line */}
      <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-red-500/20 to-transparent" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10 space-y-6">
        {/* Responsive App Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3.5">
          <motion.button
            onClick={() => setAppModalOpen(true, 'ios')}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2.5 px-4.5 py-2 bg-gray-950/80 hover:bg-gray-900 border border-gray-800 text-gray-200 hover:text-white rounded-full text-xs font-medium transition-all duration-300 shadow-lg shadow-black/50 hover:border-gray-700 cursor-pointer"
          >
            <FaApple className="h-4.5 w-4.5 text-gray-300" />
            <span>{t('downloadIOS')}</span>
          </motion.button>

          <motion.button
            onClick={() => setAppModalOpen(true, 'android')}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2.5 px-4.5 py-2 bg-gray-950/80 hover:bg-gray-900 border border-gray-800 text-gray-200 hover:text-white rounded-full text-xs font-medium transition-all duration-300 shadow-lg shadow-black/50 hover:border-gray-700 cursor-pointer"
          >
            <FaAndroid className="h-4.5 w-4.5 text-[#3DDC84]" />
            <span>{t('downloadAndroid')}</span>
          </motion.button>

          <motion.button
            onClick={() => setAppModalOpen(true, 'update')}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white rounded-full text-xs font-semibold transition-all duration-300 shadow-lg shadow-red-500/20 cursor-pointer group"
          >
            <ArrowPathIcon className="h-4 w-4 transition-transform duration-500 group-hover:rotate-180 text-white" />
            <span>{t('updateApp')}</span>
          </motion.button>
        </div>

        {/* Elegant glowing separator line */}
        <div className="h-[1px] w-full max-w-md mx-auto bg-gradient-to-r from-transparent via-gray-800 to-transparent" />

        {/* Copyright text */}
        <div className="font-light tracking-wider hover:text-gray-400 transition-colors duration-300">
          © {new Date().getFullYear()} MovieWorld. By NTN
        </div>
      </div>
    </footer>
  )
} 