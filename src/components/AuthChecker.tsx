"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import useAuthStore from "@/store/useAuthStore";

export default function AuthChecker() {
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Only check auth once on mount, not on every render
    if (!hasCheckedRef.current) {
      hasCheckedRef.current = true;
      // Khi mount, gọi checkAuth. Nếu access token hết hạn, axios interceptor sẽ
      // tự động refresh token bằng refreshToken cookie.
      if (!isAuthenticated) {
        useAuthStore.getState().checkAuth().catch(() => {
          // Interceptor đã xử lý logout nếu refresh thất bại.
        });
      }
    }

    let timeout: NodeJS.Timeout | null = null;
    function handleVisibilityChange() {
      // Suspend background re-checks when inside game-realtime to free CPU/RAM
      if (pathname === '/game-realtime') {
        return;
      }

      // Khi chuyển sang tab này và đã đăng nhập → checkAuth để đảm bảo session còn hợp lệ
      if (document.visibilityState === 'visible' && useAuthStore.getState().isAuthenticated) {
        // Debounce: chỉ check 1 lần khi visibility change
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => {
          useAuthStore.getState().checkAuth().catch(() => {
            // Interceptor đã xử lý refresh/logout
          });
        }, 500);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (timeout) clearTimeout(timeout);
    };
  }, [isAuthenticated, pathname]); // Include isAuthenticated & pathname dependency
  
  return null;
} 