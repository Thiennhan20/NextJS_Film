"use client";

import { useEffect, useRef } from 'react';
import { useWatchlistStore } from '@/store/store';

/**
 * Đồng bộ watchlist từ server mỗi khi token thay đổi (đăng nhập/đăng xuất).
 * Token nên được lấy từ AuthStore và truyền vào hook này.
 */
export default function useSyncWatchlistWithToken(token: string | null) {
  const prevTokenRef = useRef<string | null>(null);
  
  useEffect(() => {
    // Only run when token actually changes, not when functions change
    if (prevTokenRef.current === token) {
      return;
    }
    
    prevTokenRef.current = token;
    
    if (token) {
      useWatchlistStore.getState().fetchWatchlistFromServer(token);
    } else {
      // Clear watchlist khi không có token (logout hoặc chưa đăng nhập)
      useWatchlistStore.getState().clearWatchlist();
    }
  }, [token]); // Only depend on token, not the functions
}
