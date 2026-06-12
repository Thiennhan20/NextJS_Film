'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import useAuthStore from '@/store/useAuthStore';
import useAuthHydrated from '@/store/useAuthHydrated';

export default function GameRealtimePage() {
  const router = useRouter();
  const locale = useLocale();
  const hydrated = useAuthHydrated();
  const { token, isAuthenticated, isAuthChecked } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Hide body scrollbar when entering the page
    document.body.style.overflow = 'hidden';
    return () => {
      // Restore scrollbar when leaving the page
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    if (mounted && hydrated && isAuthChecked && !isAuthenticated) {
      router.push('/login');
    }
  }, [mounted, hydrated, isAuthChecked, isAuthenticated, router]);

  if (!mounted || !hydrated || !isAuthChecked) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black z-[999] overflow-hidden">
        {/* Background gradients for premium aesthetic */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
          <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
          <p className="text-gray-400 text-sm font-light tracking-wide animate-pulse">Loading Game Arena...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !token) {
    return null; // Will redirect via useEffect
  }

  const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const gameBaseUrl = isDevelopment ? 'http://localhost:3002' : 'https://ntngame.fly.dev';
  const iframeSrc = `${gameBaseUrl}?token=${token}&locale=${locale}`;

  return (
    <div className="fixed inset-0 w-screen h-screen bg-black overflow-hidden z-[999]">
      {/* Background gradients behind the iframe in case of transparency or loading transition */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <iframe
        src={iframeSrc}
        className="relative z-10 w-full h-full border-0 select-none overflow-hidden"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        title="Realtime Guessing Arena"
        style={{ overflow: 'hidden' }}
      />
    </div>
  );
}
