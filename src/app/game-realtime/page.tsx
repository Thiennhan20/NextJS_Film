'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import useAuthStore from '@/store/useAuthStore';
import useAuthHydrated from '@/hooks/useAuthHydrated';

export default function GameRealtimePage() {
  const router = useRouter();
  const locale = useLocale();
  const hydrated = useAuthHydrated();
  const { token: storeToken, user, isAuthenticated, isAuthChecked } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [savedToken, setSavedToken] = useState<string | null>(null);
  const [isGameReady, setIsGameReady] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const lockedIframeRef = useRef<{ key: string; src: string } | null>(null);

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
    // Hide body scrollbar when entering the page
    document.body.style.overflow = 'hidden';
    return () => {
      // Restore scrollbar when leaving the page
      document.body.style.overflow = 'unset';
    };
  }, [storeToken]);

  const activeToken = storeToken || savedToken;

  useEffect(() => {
    if (mounted && hydrated && isAuthChecked && !isAuthenticated && !activeToken) {
      router.push('/login');
    }
  }, [mounted, hydrated, isAuthChecked, isAuthenticated, activeToken, router]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'GAME_READY') {
        setIsGameReady(true);
      }
    };
    window.addEventListener('message', handleMessage);

    // Fallback: maximum 6s wait so the screen never gets stuck if postMessage is blocked
    const fallbackTimer = setTimeout(() => {
      setIsGameReady(true);
    }, 6000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(fallbackTimer);
    };
  }, []);

  const [authWaitTimeout, setAuthWaitTimeout] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setAuthWaitTimeout(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  if (!activeToken && isAuthChecked && !isAuthenticated) {
    return null; // Will redirect via useEffect
  }

  const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const gameBaseUrl = isDevelopment ? 'http://localhost:3002' : 'https://p01--game-app--znbny2j8c2gp.code.run';

  const isReadyToLoadGame = mounted && Boolean(activeToken) && (isAuthChecked || Boolean(user) || authWaitTimeout);

  const iframeKey = `${activeToken || ''}::${locale || ''}::${user?.name || user?.username || ''}`;
  if (isReadyToLoadGame && activeToken && lockedIframeRef.current?.key !== iframeKey) {
    const queryParams = new URLSearchParams();
    queryParams.set('token', activeToken);
    queryParams.set('embedded', '1');
    if (locale) queryParams.set('locale', locale);
    if (user?.name || user?.username) {
      queryParams.set('userName', user.name || user.username || '');
    }
    if (user?.avatar) {
      queryParams.set('userAvatar', user.avatar);
    }
    if (user?.id || user?._id) {
      queryParams.set('userId', user.id || user._id || '');
    }
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
