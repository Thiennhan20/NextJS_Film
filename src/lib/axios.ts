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

// Add a response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      setInMemoryToken(null);
      // Dynamically load auth store to clear state on 401 without circular import issues
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