"use client";
import { usePathname } from "next/navigation";
import useSyncWatchlistWithToken from "@/hooks/useSyncWatchlistWithToken";
import useAuthStore from "@/store/useAuthStore";

export default function WatchlistSyncer() {
  const pathname = usePathname();
  const { token, isAuthenticated } = useAuthStore();
  const shouldSync = pathname !== '/game-realtime' && isAuthenticated;
  useSyncWatchlistWithToken(shouldSync ? token : null);
  return null;
}
