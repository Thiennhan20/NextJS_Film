'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocale } from 'next-intl';
import useAuthStore from '@/store/useAuthStore';

export default function GameRealtimePage() {
  const locale = useLocale();
  const { token: storeToken, user, isAuthChecked } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [isGameReady, setIsGameReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const lockedIframeRef = useRef<{ key: string; src: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const originalTitleRef = useRef<string>('');
  const flashTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopTabFlash = useCallback(() => {
    if (flashTimerRef.current) {
      clearInterval(flashTimerRef.current);
      flashTimerRef.current = null;
    }
    if (typeof document !== 'undefined' && originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  }, []);

  const startTabFlash = useCallback((alertTitle: string) => {
    if (typeof document === 'undefined') return;

    if (!originalTitleRef.current) {
      originalTitleRef.current =
        document.title || 'Đấu Trường Đoán Số 1v1 (Bulls & Cows) — Realtime Arena | ENTN';
    }

    if (flashTimerRef.current) {
      clearInterval(flashTimerRef.current);
      flashTimerRef.current = null;
    }

    let showFlash = true;
    document.title = alertTitle;

    flashTimerRef.current = setInterval(() => {
      showFlash = !showFlash;
      document.title = showFlash
        ? alertTitle
        : (originalTitleRef.current || 'Đấu Trường Đoán Số 1v1 (Bulls & Cows) — Realtime Arena | ENTN');
    }, 1000);
  }, []);

  useEffect(() => {
    const handleReturn = () => {
      if (document.visibilityState === 'visible') {
        stopTabFlash();
      }
    };
    const handleFocus = () => {
      stopTabFlash();
    };

    document.addEventListener('visibilitychange', handleReturn);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleReturn);
      window.removeEventListener('focus', handleFocus);
      stopTabFlash();
    };
  }, [stopTabFlash]);

  // Level 1: Sanitize browser address bar immediately if any legacy ?token= parameter exists
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('token=')) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('token');
        const cleanPath = url.pathname + (url.search ? url.search : '') + (url.hash ? url.hash : '');
        window.history.replaceState({}, document.title, cleanPath);
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (isGameReady) {
      const timer = setTimeout(() => {
        setShowOverlay(false);
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [isGameReady]);

  useEffect(() => {
    setMounted(true);
    const localToken = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    setSavedToken(storeToken || localToken);

    // If session is not verified yet, ensure checkAuth is invoked immediately on mount / F5
    if (!isAuthChecked && !storeToken) {
      useAuthStore.getState().checkAuth().catch(() => {});
    }

    // Isolate rendering and freeze background scroll
    document.body.classList.add('game-fullscreen-active');
    return () => {
      document.body.classList.remove('game-fullscreen-active');
    };
  }, [storeToken, isAuthChecked]);

  const activeToken = storeToken || savedToken;

  useEffect(() => {
    if (activeToken && typeof window !== 'undefined') {
      try {
        localStorage.setItem('token', activeToken);
      } catch {}
    }
  }, [activeToken]);


  const sendAuthToIframe = useCallback(() => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.postMessage(
          {
            type: 'AUTH_TOKEN',
            token: activeToken || null,
            isAuthenticated: Boolean(activeToken),
            user: user
              ? {
                  id: user.id || user._id,
                  name: user.name || user.username || '',
                  avatar: user.avatar || '',
                }
              : null,
          },
          '*'
        );
      } catch (err) {
        console.warn('Failed to post AUTH_TOKEN to iframe:', err);
      }
    }
  }, [activeToken, user]);

  useEffect(() => {
    sendAuthToIframe();
  }, [sendAuthToIframe]);

  useEffect(() => {
    let fallbackTimer: NodeJS.Timeout | null = null;

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'REQUEST_AUTH_TOKEN') {
        sendAuthToIframe();
      }
      if (event.data?.type === 'GAME_READY') {
        setIsGameReady(true);
        if (fallbackTimer) clearTimeout(fallbackTimer);
      }
      if (event.data?.type === 'GAME_TAB_FLASH') {
        const { isAlert, alertTitle } = event.data;
        if (isAlert && alertTitle) {
          startTabFlash(alertTitle);
        } else {
          stopTabFlash();
        }
      }
    };
    window.addEventListener('message', handleMessage);

    // Fallback: maximum 6s wait so the screen never gets stuck if postMessage is blocked
    fallbackTimer = setTimeout(() => {
      setIsGameReady(true);
    }, 6000);

    return () => {
      window.removeEventListener('message', handleMessage);
      if (fallbackTimer) clearTimeout(fallbackTimer);
      stopTabFlash();
    };
  }, [sendAuthToIframe, startTabFlash, stopTabFlash]);

  const [authWaitTimeout, setAuthWaitTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAuthWaitTimeout(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const gameBaseUrl = isDevelopment ? 'http://localhost:3002' : 'https://p01--game-app--znbny2j8c2gp.code.run';

  const isReadyToLoadGame = mounted && (isAuthChecked || Boolean(user) || authWaitTimeout);

  // Stable iframeKey: Prevent iframe from reloading when user hydrates or switches
  const iframeKey = locale || 'vi';
  if (isReadyToLoadGame && lockedIframeRef.current?.key !== iframeKey) {
    const queryParams = new URLSearchParams();
    queryParams.set('embedded', '1');
    if (locale) queryParams.set('locale', locale);
    lockedIframeRef.current = {
      key: iframeKey,
      src: `${gameBaseUrl}?${queryParams.toString()}`,
    };
  }

  const iframeSrc = lockedIframeRef.current?.src;

  const isVi = locale === 'vi';

  return (
    <div className="fixed inset-0 w-full h-[100dvh] bg-black overflow-hidden z-[999]">
      {/* The Game Iframe - loads smoothly in background and fades in when ready */}
      {iframeSrc && (
        <iframe
          ref={iframeRef}
          onLoad={sendAuthToIframe}
          src={iframeSrc}
          className={`relative z-10 w-full h-full border-0 select-none overflow-hidden transition-opacity duration-700 ease-out ${
            isGameReady ? 'opacity-100' : 'opacity-0'
          }`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          title="Realtime Guessing Arena"
          style={{ overflow: 'hidden' }}
        />
      )}

      {/* Unified Single Loading Overlay - cleanly unmounts after fade-out to free up CPU/GPU */}
      {showOverlay && (
        <div
          className={`fixed inset-0 flex items-center justify-center bg-black z-30 overflow-hidden transition-all duration-700 ease-out ${
            isGameReady ? 'opacity-0 pointer-events-none scale-105' : 'opacity-100 scale-100'
          }`}
        >
          <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-1/4 left-1/4 w-80 h-80 bg-red-600/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse delay-1000" />
          </div>
          <div className="relative z-10 flex flex-col items-center gap-5 px-4 text-center">
            {/* Animated Glowing Ring */}
            <div className="relative flex items-center justify-center">
              <div className="w-16 h-16 rounded-full border-2 border-red-500/20 animate-ping absolute" />
              <div className="animate-spin rounded-full h-14 w-14 border-t-2 border-b-2 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]"></div>
            </div>
            <div className="space-y-2">
              <p className="text-white text-base sm:text-lg font-medium tracking-wider uppercase animate-pulse">
                {isVi ? 'Đang tải Đấu Trường Game...' : 'Loading Game Arena...'}
              </p>
              <p className="text-gray-400 text-xs sm:text-sm font-light">
                {isVi ? 'Chuẩn bị phòng chơi và đồng bộ tài khoản' : 'Preparing arena & syncing profile'}
              </p>
            </div>
            {/* Subtle animated bar */}
            <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
              <div className="h-full bg-gradient-to-r from-red-600 via-pink-500 to-red-500 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
