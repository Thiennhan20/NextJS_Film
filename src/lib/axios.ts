import axios from 'axios';

let baseURL = process.env.NEXT_PUBLIC_API_URL;

if (typeof window !== 'undefined') {
  if (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  ) {
    baseURL = 'http://localhost:3001/api';
  }
}

let inMemoryToken: string | null = null;

export function setInMemoryToken(token: string | null) {
  inMemoryToken = token;
}

const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Add a request interceptor
api.interceptors.request.use(
  (config) => {
    if (inMemoryToken) {
      config.headers.Authorization = `Bearer ${inMemoryToken}`;
    }
    
    // Đọc ngôn ngữ từ cookies và gửi lên Server
    if (typeof document !== 'undefined') {
      const match = document.cookie.match(/(^| )locale=([^;]+)/);
      const locale = match ? match[2] : 'en';
      config.headers['Accept-Language'] = locale;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Queue for holding requests while refreshing token
interface FailedRequest {
  resolve: (token: string | null) => void;
  reject: (error: unknown) => void;
}

let isRefreshing = false;
let failedQueue: FailedRequest[] = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add a response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 and not already retried
    if (
      error.response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      originalRequest.url &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/google-login') &&
      !originalRequest.url.includes('/auth/refresh')
    ) {
      const errCode = error.response?.data?.code;
      
      // Check if it's explicitly a token expired error (or if the status is 401 and we have an active in-memory token, meaning it expired)
      if (errCode === 'TOKEN_EXPIRED' || inMemoryToken) {
        originalRequest._retry = true;
        
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        isRefreshing = true;

        try {
          const response = await api.post('/auth/refresh');
          const { token } = response.data;
          
          setInMemoryToken(token);
          
          // Sync with Zustand store
          if (typeof window !== 'undefined') {
            const authStoreMod = await import('@/store/useAuthStore');
            authStoreMod.default.setState({ token, isAuthenticated: true });
          }

          processQueue(null, token);
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        } catch (refreshError) {
          processQueue(refreshError, null);
          setInMemoryToken(null);
          
          if (typeof window !== 'undefined') {
            const authStoreMod = await import('@/store/useAuthStore');
            authStoreMod.default.getState().clearAuthState();
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }

    // Default 401 handler (logout if unauthorized and not a token expiration that can be refreshed)
    if (
      error.response?.status === 401 &&
      originalRequest &&
      originalRequest.url &&
      !originalRequest.url.includes('/auth/refresh') &&
      !originalRequest.url.includes('/auth/login') &&
      !originalRequest.url.includes('/auth/google-login')
    ) {
      setInMemoryToken(null);
      if (typeof window !== 'undefined') {
        import('@/store/useAuthStore').then((mod) => {
          mod.default.getState().clearAuthState();
        }).catch((err) => console.warn('Failed to clear auth state:', err));
      }
    }

    return Promise.reject(error);
  }
);

export default api;