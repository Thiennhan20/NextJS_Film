'use client'

import { useEffect, useState, useCallback } from 'react'

const CURRENT_HASH = process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'dev'

interface VersionInfo {
  hash: string
  changelog: string[]
  description: string
}

export default function VersionChecker() {
  const [serverVersion, setServerVersion] = useState<VersionInfo | null>(null)
  const [showModal, setShowModal] = useState(false)

  const checkVersion = useCallback(async () => {
    // Do not run check in dev environment to avoid noise
    if (process.env.NODE_ENV === 'development' || CURRENT_HASH === 'dev') return;

    const now = Date.now()
    const lastCheck = localStorage.getItem('last_version_check_timestamp')
    
    // Throttle checks to once every 10 minutes (10 * 60 * 1000 ms)
    if (lastCheck && now - parseInt(lastCheck, 10) < 10 * 60 * 1000) {
      // Try to load cached update if there was one
      const cachedUpdate = localStorage.getItem('cached_version_update')
      if (cachedUpdate) {
        try {
          const data: VersionInfo = JSON.parse(cachedUpdate)
          if (data.hash !== CURRENT_HASH) {
            const notified = localStorage.getItem('notified_hash')
            if (notified !== data.hash) {
              setServerVersion(data)
              setShowModal(true)
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
      return;
    }

    try {
      const res = await fetch('/api/version', { cache: 'no-store' })
      if (!res.ok) return
      const data: VersionInfo = await res.json()

      // Save check timestamp
      localStorage.setItem('last_version_check_timestamp', String(now))

      // If matches, clear cache and do nothing
      if (data.hash === CURRENT_HASH) {
        localStorage.removeItem('cached_version_update')
        return
      }

      // Cache the version info for offline/throttled checks
      localStorage.setItem('cached_version_update', JSON.stringify(data))

      // Already notified
      const notified = localStorage.getItem('notified_hash')
      if (notified === data.hash) return

      setServerVersion(data)
      setShowModal(true)
    } catch {
      // Fail silently
    }
  }, [])

  useEffect(() => {
    // Initial check after 5s
    const initTimeout = setTimeout(checkVersion, 5000)

    // Check only when tab becomes active (throttled inside checkVersion)
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkVersion()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearTimeout(initTimeout)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [checkVersion])

  const handleUpdate = () => {
    if (serverVersion) localStorage.setItem('notified_hash', serverVersion.hash)
    window.location.reload()
  }

  if (!showModal || !serverVersion) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
    >
      <div
        className="relative w-full max-w-[360px] rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: 'linear-gradient(180deg, #1a1a2e 0%, #16162a 100%)', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* Top accent bar (Đồng nhất 1 giao diện đỏ - Bắt buộc) */}
        <div className="h-1 w-full bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

        <div className="p-6">
          {/* Badge */}
          <div className="flex justify-center mb-4">
            <span className="px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase bg-red-500/20 text-red-400 border border-red-500/30">
              ⚡ Bản cập nhật bắt buộc
            </span>
          </div>

          {/* Title */}
          <h2 className="text-center text-lg font-bold text-white mb-2">
            Đã có phiên bản Web mới
          </h2>

          {/* Description */}
          <p className="text-center text-sm text-gray-400 mb-4">
            {serverVersion.description}
          </p>

          {/* Version Hash pills */}
          <div className="flex items-center justify-center gap-2 mb-5">
            <span className="px-2.5 py-1 rounded-lg bg-gray-800 text-gray-400 text-xs font-mono">
              #{CURRENT_HASH.substring(0, 7)}
            </span>
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-red-500/20 text-red-300">
              #{serverVersion.hash.substring(0, 7)}
            </span>
          </div>

          {/* Changelog */}
          {serverVersion.changelog.length > 0 && (
            <div className="bg-white/5 rounded-xl p-3.5 mb-5">
              <p className="text-xs font-semibold text-gray-300 mb-2 uppercase tracking-wider">Lý do cập nhật:</p>
              <ul className="space-y-1.5">
                {serverVersion.changelog.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 bg-red-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Button duy nhất: Bắt buộc tải lại */}
          <button
            onClick={handleUpdate}
            className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-200 active:scale-[0.98] bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-500 hover:to-orange-500 shadow-lg shadow-red-500/20"
          >
            Tải lại web ngay
          </button>
        </div>
      </div>
    </div>
  )
}
