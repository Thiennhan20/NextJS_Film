'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useLocale } from 'next-intl'

interface BackButtonProps {
  fallbackHref?: string
  className?: string
  title?: string
  iconClassName?: string
}

export default function BackButton({
  fallbackHref = '/profile',
  className = '',
  title,
  iconClassName = 'w-5 h-5 text-gray-300 group-hover:text-white',
}: BackButtonProps) {
  const router = useRouter()
  const locale = useLocale()

  const defaultTitle = locale === 'vi' ? 'Quay lại' : 'Back'
  const label = title || defaultTitle

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // If middle click or key combos, let browser handle normally
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return

    e.preventDefault()
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push(fallbackHref)
    }
  }

  return (
    <Link
      href={fallbackHref}
      onClick={handleClick}
      aria-label={label}
      title={label}
      className={`group p-2 sm:p-2.5 rounded-xl bg-gray-800/60 hover:bg-gray-700/80 border border-gray-700/50 hover:border-gray-500/50 text-gray-300 hover:text-white transition-all duration-200 active:scale-95 flex items-center justify-center shadow-md backdrop-blur-sm shrink-0 ${className}`}
    >
      <ArrowLeftIcon className={`${iconClassName} transition-transform duration-200 group-hover:-translate-x-0.5`} />
    </Link>
  )
}
