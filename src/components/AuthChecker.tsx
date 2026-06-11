"use client";
import { useEffect, useRef } from "react";
import useAuthStore from "@/store/useAuthStore";

export default function AuthChecker() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasCheckedRef = useRef(false);

  useEffect(() => {
    // Only check auth once on mount, not on every render
    if (hasCheckedRef.current) {
      return;
    }
    
    hasCheckedRef.current = true;
    
    // Khi mount, gọi checkAuth. Nếu access token hết hạn, axios interceptor sẽ
    // tự động refresh token bằng refreshToken cookie. Chỉ khi refresh thất bại
    // (refreshToken hết hạn hoặc bị revoke), interceptor mới clear auth state.
    // KHÔNG gọi logout() ở đây vì sẽ race condition với interceptor refresh flow.
    if (!isAuthenticated) {
      useAuthStore.getState().checkAuth().catch(() => {
        // Interceptor đã xử lý logout nếu refresh thất bại.
        // Nếu checkAuth fail sau khi refresh cũng fail → auth state đã bị clear bởi interceptor.
        // Không cần làm gì thêm.
      });
    }

    let timeout: NodeJS.Timeout | null = null;
    function handleVisibilityChange() {
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
  }, [isAuthenticated]); // Include isAuthenticated dependency
  
  return null;
} 