'use client';

import useSyncWatchlistWithTokenHook from '@/hooks/useSyncWatchlistWithToken';

export default function useSyncWatchlistWithToken(token: string | null) {
  return useSyncWatchlistWithTokenHook(token);
}
