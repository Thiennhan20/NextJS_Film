'use client'

import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react'
import { usePathname } from 'next/navigation'

const MIN_VISIBLE_MS = 260
const MAX_VISIBLE_MS = 5000
const TOAST_PULSE_MS = 700
const PAGE_TRANSITION_PULSE_EVENT = 'page-transition:pulse'

function isModifiedClick(event: MouseEvent) {
  return event.metaKey || event.ctrlKey || event.shiftKey || event.altKey
}

function getAnchorFromEvent(event: MouseEvent) {
  const target = event.target
  if (!(target instanceof Element)) return null
  return target.closest<HTMLAnchorElement>('a[href]')
}

function shouldTransitionTo(url: string | URL | null | undefined) {
  if (!url) return false

  try {
    const nextUrl = new URL(url, window.location.href)
    if (nextUrl.origin !== window.location.origin) return false

    const currentPath = `${window.location.pathname}${window.location.search}`
    const nextPath = `${nextUrl.pathname}${nextUrl.search}`

    return nextPath !== currentPath
  } catch {
    return false
  }
}

export default function PageTransition() {
  const pathname = usePathname()
  const [isPending, setIsPending] = useState(false)
  const [isCompleting, setIsCompleting] = useState(false)
  const isPendingRef = useRef(false)
  const startedAtRef = useRef(0)
  const finishTimerRef = useRef<number | null>(null)
  const maxTimerRef = useRef<number | null>(null)
  const scheduledStartTimerRef = useRef<number | null>(null)

  const clearTimer = useCallback((timerRef: MutableRefObject<number | null>) => {
    if (timerRef.current === null) return
    window.clearTimeout(timerRef.current)
    timerRef.current = null
  }, [])

  const resetTimers = useCallback(() => {
    clearTimer(finishTimerRef)
    clearTimer(maxTimerRef)
    clearTimer(scheduledStartTimerRef)
  }, [clearTimer])

  const finishTransition = useCallback(() => {
    if (!isPendingRef.current) return

    clearTimer(maxTimerRef)

    const elapsed = performance.now() - startedAtRef.current
    const remaining = Math.max(0, MIN_VISIBLE_MS - elapsed)

    setIsCompleting(true)
    finishTimerRef.current = window.setTimeout(() => {
      isPendingRef.current = false
      setIsPending(false)
      setIsCompleting(false)
      finishTimerRef.current = null
    }, remaining)
  }, [clearTimer])

  const startTransition = useCallback((autoFinishMs?: number) => {
    if (isPendingRef.current) return

    resetTimers()
    isPendingRef.current = true
    startedAtRef.current = performance.now()
    setIsPending(true)
    setIsCompleting(false)

    maxTimerRef.current = window.setTimeout(() => {
      finishTransition()
    }, autoFinishMs ?? MAX_VISIBLE_MS)
  }, [finishTransition, resetTimers])

  const scheduleTransition = useCallback((autoFinishMs?: number) => {
    clearTimer(scheduledStartTimerRef)
    scheduledStartTimerRef.current = window.setTimeout(() => {
      scheduledStartTimerRef.current = null
      startTransition(autoFinishMs)
    }, 0)
  }, [clearTimer, startTransition])

  useEffect(() => {
    if (isPendingRef.current) {
      finishTransition()
    }
  }, [pathname, finishTransition])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || isModifiedClick(event)) return

      const anchor = getAnchorFromEvent(event)
      if (!anchor) return
      if (anchor.target && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return
      if (anchor.dataset.noPageTransition === 'true') return
      if (!shouldTransitionTo(anchor.href)) return

      startTransition()
    }

    const handlePopState = () => {
      startTransition()
    }

    const handlePulse = () => {
      startTransition(TOAST_PULSE_MS)
    }

    const originalPushState = window.history.pushState
    const originalReplaceState = window.history.replaceState

    window.history.pushState = function pushState(data, unused, url) {
      if (shouldTransitionTo(url)) scheduleTransition()
      return originalPushState.call(window.history, data, unused, url)
    }

    window.history.replaceState = function replaceState(data, unused, url) {
      if (shouldTransitionTo(url)) scheduleTransition()
      return originalReplaceState.call(window.history, data, unused, url)
    }

    document.addEventListener('click', handleClick, true)
    window.addEventListener('popstate', handlePopState)
    window.addEventListener(PAGE_TRANSITION_PULSE_EVENT, handlePulse)

    return () => {
      document.removeEventListener('click', handleClick, true)
      window.removeEventListener('popstate', handlePopState)
      window.removeEventListener(PAGE_TRANSITION_PULSE_EVENT, handlePulse)
      window.history.pushState = originalPushState
      window.history.replaceState = originalReplaceState
      resetTimers()
    }
  }, [resetTimers, scheduleTransition, startTransition])

  if (!isPending) return null

  return (
    <div
      aria-live="polite"
      aria-busy={isPending}
      className="pointer-events-none fixed inset-x-0 top-0 z-[90]"
    >
      <div className="h-1 w-full overflow-hidden bg-black/20">
        <div
          className={`route-transition-progress h-full w-full origin-left bg-gradient-to-r from-red-500 via-amber-400 to-sky-400 shadow-[0_0_18px_rgba(248,113,113,0.65)] ${
            isCompleting ? 'route-transition-progress-complete' : ''
          }`}
        />
      </div>
    </div>
  )
}
