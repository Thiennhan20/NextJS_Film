'use client'

import { motion } from 'framer-motion'
import { usePathname } from 'next/navigation'

interface ContentWrapperProps {
  children: React.ReactNode
}

export default function ContentWrapper({ children }: ContentWrapperProps) {
  const pathname = usePathname()

  // Full-bleed hero banner pages only: Home, Movies [id], TV Shows [id]
  const isHeroPage = 
    pathname === '/' || 
    (pathname?.startsWith('/movies/') && pathname !== '/movies') ||
    (pathname?.startsWith('/movie/') && pathname !== '/movie') ||
    (pathname?.startsWith('/tvshows/') && pathname !== '/tvshows') ||
    (pathname?.startsWith('/tvshow/') && pathname !== '/tvshow')

  return (
    <motion.div
      className="flex-grow"
      style={{ paddingTop: isHeroPage ? '0px' : '64px' }}
    >
      {children}
    </motion.div>
  )
}
