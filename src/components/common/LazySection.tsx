'use client'

import { ReactNode, useEffect } from 'react'
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver'

interface LazySectionProps {
  children: ReactNode
  fallback?: ReactNode
  className?: string
  rootMargin?: string
  minHeight?: string
  onIntersect?: () => void
}

/**
 * Wrapper component for lazy loading sections
 * Only renders children when section enters viewport
 */
export default function LazySection({
  children,
  fallback,
  className = '',
  rootMargin = '300px', // Load 300px before entering viewport
  minHeight = '400px',
  onIntersect,
}: LazySectionProps) {
  const { targetRef, hasIntersected } = useIntersectionObserver({
    rootMargin,
    triggerOnce: true,
  })

  useEffect(() => {
    if (hasIntersected) {
      onIntersect?.()
    }
  }, [hasIntersected, onIntersect])

  return (
    <div 
      ref={targetRef} 
      className={className}
      style={{ minHeight }}
    >
      {hasIntersected ? children : (fallback || <SectionSkeleton />)}
    </div>
  )
}

// Default static reserve for sections that have not intersected yet.
function SectionSkeleton() {
  return (
    <div className="py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="h-8 w-64 bg-gray-800 rounded-lg mb-6 mx-auto" />
        
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="min-w-[200px] h-64 bg-gray-800 rounded-xl"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
