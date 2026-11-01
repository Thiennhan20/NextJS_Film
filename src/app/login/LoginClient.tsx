'use client';

import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import RegisterForm from '@/components/auth/RegisterForm';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence, type Easing } from 'framer-motion';
import useAuthStore from '@/store/useAuthStore';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';

// Optimize ThreeBackground with better loading and performance
const ThreeBackground = dynamic(() => import('@/components/common/ThreeBackground'), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-black" />
});

// Memoize GoogleOAuthProvider to prevent re-renders
const GoogleOAuthProvider = dynamic(
  () => import('@react-oauth/google').then(mod => mod.GoogleOAuthProvider),
  {
    ssr: false,
    loading: () => null
  }
);


const pageVariants = {
  initial: {
    opacity: 0,
    scale: 0.95,
    y: 20,
  },
  animate: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: [0.4, 0, 0.2, 1] as Easing, // Custom easing for smoother animation
    },
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    y: -20,
    transition: {
      duration: 0.2,
      ease: [0.4, 0, 1, 1] as Easing,
    },
  },
};

const buttonEaseOut: Easing = 'easeOut';
const buttonEaseIn: Easing = 'easeIn';

const buttonVariants = {
  hover: {
    scale: 1.02,
    transition: {
      duration: 0.2,
      ease: buttonEaseOut,
    },
  },
  tap: {
    scale: 0.98,
    transition: {
      duration: 0.1,
      ease: buttonEaseIn,
    },
  },
};

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isChecking, setIsChecking] = useState(true);
  const [mounted, setMounted] = useState(false);
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const clearError = useAuthStore((state) => state.clearError);
  const t = useTranslations('LoginPage');

  // Memoize googleClientId to prevent re-computation
  const googleClientId = useMemo(() =>
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID as string | undefined,
    []
  );

  // Memoize button handlers to prevent re-renders and clear errors on tab switch
  const handleLoginClick = useMemo(
    () => () => {
      clearError();
      setIsLogin(true);
    },
    [clearError]
  );
  const handleRegisterClick = useMemo(
    () => () => {
      clearError();
      setIsLogin(false);
    },
    [clearError]
  );

  // Mount effect & Pre-warm backend
  useEffect(() => {
    setMounted(true);
    // Pre-warm backend (Lớp 2): gửi request ngầm đánh thức server ngay khi user vào trang đăng nhập
    api.get('/health').catch(() => {});
    return () => setMounted(false);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    // Give some time for the auth state to hydrate
    const timer = setTimeout(() => {
      setIsChecking(false);
      if (isAuthenticated) {
        router.push('/');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [isAuthenticated, router]);

  if (isChecking) {
    return (
      <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-black">
        <div className="text-white text-xl">{t('loading')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-start justify-center p-4 pt-8 overflow-hidden">
      {mounted && <ThreeBackground />}
      <div className="relative z-10 w-full max-w-sm">
        <div className="flex justify-center mb-8">
          <div className="bg-black/50 rounded-lg p-1 shadow-inner-lg shadow-red-900/50 border border-yellow-600">
            <motion.button
              onClick={handleLoginClick}
              className={`px-6 py-2 rounded-lg transition-colors duration-200 font-semibold ${isLogin ? 'bg-red-800 text-yellow-300 shadow-md' : 'text-gray-400 hover:bg-red-900 hover:text-yellow-300'
                }`}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              {t('login')}
            </motion.button>
            <motion.button
              onClick={handleRegisterClick}
              className={`px-6 py-2 rounded-lg transition-colors duration-200 font-semibold ${!isLogin ? 'bg-red-800 text-yellow-300 shadow-md' : 'text-gray-400 hover:bg-red-900 hover:text-yellow-300'
                }`}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
            >
              {t('register')}
            </motion.button>
          </div>
        </div>
        {mounted && googleClientId && (
          <GoogleOAuthProvider clientId={googleClientId}>
            <AnimatePresence mode="wait">
              <motion.div
                key={isLogin ? 'login' : 'register'}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="w-full"
              >
                {isLogin ? <LoginForm /> : <RegisterForm />}
              </motion.div>
            </AnimatePresence>
          </GoogleOAuthProvider>
        )}
        {mounted && !googleClientId && (
          <AnimatePresence mode="wait">
            <motion.div
              key={isLogin ? 'login' : 'register'}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full"
            >
              {isLogin ? <LoginForm /> : <RegisterForm />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
} 