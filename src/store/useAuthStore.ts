import { create } from 'zustand';
import { AuthState, LoginCredentials, RegisterCredentials, User } from '@/types/auth';
import api, { setInMemoryToken } from '@/lib/axios';
import { isAxiosError } from 'axios';

interface AuthStore extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  register: (credentials: RegisterCredentials) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  loginWithGoogle: (payload: { email: string; sub: string; name?: string; avatar?: string; email_verified?: boolean }) => Promise<void>;
  clearAuthState: () => void;
}

// Guard to prevent duplicate checkAuth calls
let _checkAuthPromise: Promise<void> | null = null;

// Clear guest watch progress and watchlist from localStorage on login
function clearGuestWatchProgress() {
  const keysToRemove: string[] = ['watchlist-storage'];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('movie-progress-') || key.startsWith('tvshow-progress-'))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(k => localStorage.removeItem(k));
}

const useAuthStore = create<AuthStore>()(
  (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      loginError: null,
      registerError: null,

      login: async (credentials) => {
        try {
          set({ isLoading: true, loginError: null });
          const response = await api.post('/auth/login', credentials);
          const { token, user } = response.data;
          setInMemoryToken(token);
          clearGuestWatchProgress();
          set({
            user: user as User,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          if (isAxiosError(error)) {
            set({
              loginError: error.response?.data?.message || 'An error occurred during login',
              isLoading: false,
            });
          } else {
            set({
              loginError: 'An unexpected error occurred during login',
              isLoading: false,
            });
          }
          throw error;
        }
      },

      loginWithGoogle: async ({ email, sub, name, avatar, email_verified }) => {
        try {
          set({ isLoading: true, loginError: null });
          const response = await api.post('/auth/google-login', {
            email,
            sub,
            name,
            avatar,
            email_verified,
          });
          const { token, user } = response.data;
          setInMemoryToken(token);
          clearGuestWatchProgress();
          set({
            user: user as User,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error: unknown) {
          if (isAxiosError(error)) {
            set({
              loginError: error.response?.data?.message || 'An error occurred during Google login',
              isLoading: false,
            });
          } else {
            set({
              loginError: 'An unexpected error occurred during Google login',
              isLoading: false,
            });
          }
          throw error;
        }
      },

      register: async (credentials) => {
        try {
          set({ isLoading: true, registerError: null });
          console.log('Auth store: Sending registration request to:', api.defaults.baseURL + '/auth/register');
          const response = await api.post('/auth/register', credentials);
          console.log('Auth store: Registration response:', response.data);
          // Chỉ hiển thị thông báo, không tự đăng nhập
          set({ isLoading: false });
        } catch (error: unknown) {
          console.error('Auth store: Registration error:', error);
          if (isAxiosError(error)) {
            console.error('Auth store: Axios error details:', {
              status: error.response?.status,
              data: error.response?.data,
              message: error.message,
              baseURL: api.defaults.baseURL
            });
            set({
              registerError: error.response?.data?.message || 'An error occurred during registration',
              isLoading: false,
            });
          } else {
            set({
              registerError: 'An unexpected error occurred during registration',
              isLoading: false,
            });
          }
          throw error;
        }
      },

      logout: async () => {
        // Flush pending search history sync before logout
        try {
          const token = get().token;
          if (token) {
            window.dispatchEvent(new Event('searchhistory:flush'));
          }
        } catch {
          // Silently ignore — search history flush is best-effort
        }
        
        try {
          // Gọi API logout để blacklist token và clear cookie
          await api.post('/auth/logout');
        } catch (error) {
          console.warn('Logout API call failed:', error);
        }
        
        get().clearAuthState();
      },

      clearError: () => set({ loginError: null, registerError: null }),

      clearAuthState: () => {
        setInMemoryToken(null);
        // Clear watchlist & recently watched cache khi logout/clear auth
        try {
          import('./store').then(({ useWatchlistStore }) => {
            const { clearWatchlist } = useWatchlistStore.getState();
            clearWatchlist();
          });
          import('./useRecentlyWatchedStore').then(({ useRecentlyWatchedStore }) => {
            useRecentlyWatchedStore.getState().clearCache();
          });
        } catch (error) {
          console.warn('Could not clear stores:', error);
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false,
          loginError: null,
          registerError: null,
        });
      },

      checkAuth: async () => {
        // Deduplicate: if already checking, return existing promise
        if (_checkAuthPromise) return _checkAuthPromise;

        const doCheck = async () => {
          try {
            set({ isLoading: true });
            const response = await api.get('/auth/profile');
            const prof = response.data.user;
            const token = response.data.token || null;
            
            const normalizedUser: User = {
              id: prof.id || prof._id,
              name: prof.name,
              email: prof.email,
              avatar: prof.avatar && prof.avatar.trim() !== '' ? prof.avatar : undefined,
              originalAvatar: prof.originalAvatar && prof.originalAvatar.trim() !== '' ? prof.originalAvatar : undefined,
              authType: prof.authType,
              createdAt: prof.createdAt,
              updatedAt: prof.updatedAt,
            };
            
            setInMemoryToken(token);
            if (typeof window !== 'undefined') {
              localStorage.removeItem('watchlist-storage');
            }
            set({
              user: normalizedUser,
              token,
              isAuthenticated: true,
              isLoading: false,
            });
          } catch {
            setInMemoryToken(null);
            // Clear watchlist khi token không hợp lệ
            try {
              import('./store').then(({ useWatchlistStore }) => {
                const { clearWatchlist } = useWatchlistStore.getState();
                clearWatchlist();
              });
            } catch (error) {
              console.warn('Could not clear watchlist:', error);
            }
            set({
              user: null,
              token: null,
              isAuthenticated: false,
              isLoading: false,
            });
          }
        };

        _checkAuthPromise = doCheck().finally(() => { _checkAuthPromise = null; });
        return _checkAuthPromise;
      },
    })
);

if (typeof window !== 'undefined') {
  localStorage.removeItem('auth-storage');
}

export default useAuthStore;