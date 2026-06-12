'use client'

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const FloatingChatbox = dynamic(() => import("@/components/FloatingChatbox"), { ssr: false });

export default function FloatingChatboxWrapper() {
  const pathname = usePathname();
  if (pathname === '/game-realtime') return null;
  return <FloatingChatbox />;
}
