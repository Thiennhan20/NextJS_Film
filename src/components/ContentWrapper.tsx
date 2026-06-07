'use client'

import { motion } from 'framer-motion'
import { useHeader } from '@/contexts/HeaderContext'

interface ContentWrapperProps {
  children: React.ReactNode
}

export default function ContentWrapper({ children }: ContentWrapperProps) {
  const { isCollapsed } = useHeader()

  return (
    <motion.div
      className="flex-grow"
      initial={false}
      style={{ paddingTop: isCollapsed ? '0px' : '64px' }}
      animate={{
        paddingTop: isCollapsed ? '0px' : '64px', // 64px = 4rem = pt-16
      }}
      transition={{
        duration: 0.3,
        ease: 'easeInOut'
      }}
    >
      {children}
    </motion.div>
  )
}
