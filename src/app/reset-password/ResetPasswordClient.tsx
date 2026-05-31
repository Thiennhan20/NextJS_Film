'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import api from '@/lib/axios';
import { toast } from 'react-hot-toast';
import { useTranslations } from 'next-intl';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations('ResetPassword');

  const token = searchParams.get('token') || '';
  const email = searchParams.get('email') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isTokenValid, setIsTokenValid] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);

  // Validate token on mount to avoid showing form when link is invalid/used/expired
  useEffect(() => {
    const validate = async () => {
      if (!email || !token) {
        setTokenError(t('invalidLinkOrExpired'));
        setIsTokenValid(false);
        setIsValidating(false);
        return;
      }
      try {
        setIsValidating(true);
        await api.get('/auth/check-reset-token', {
          params: { email, token },
        });
        setIsTokenValid(true);
        setTokenError(null);
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          t('linkExpiredRetry');
        setIsTokenValid(false);
        setTokenError(message);
      } finally {
        setIsValidating(false);
      }
    };

    validate();
  }, [email, token, t]);

  const validatePassword = (value: string) => {
    const hasMinLength = value.length >= 8;
    const hasUpper = /[A-Z]/.test(value);
    const hasLower = /[a-z]/.test(value);
    const hasDigit = /[0-9]/.test(value);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(value);
    return hasMinLength && hasUpper && hasLower && hasDigit && hasSpecial;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isTokenValid) {
      toast.error(tokenError || t('invalidLinkOrExpired'));
      return;
    }

    if (!email || !token) {
      toast.error(t('invalidLinkOrExpired'));
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error(t('passwordMismatch'));
      return;
    }

    if (!validatePassword(newPassword)) {
      toast.error(t('passwordRequirement'));
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post('/auth/reset-password', {
        email,
        token,
        newPassword,
        confirmPassword,
      });
      toast.success(t('resetSuccess'));
      setTimeout(() => router.push('/login'), 1200);
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        t('resetFailed');
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-black relative overflow-hidden">
      <div className="relative z-10 w-full max-w-sm">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full mx-auto p-6 bg-gradient-to-br from-red-900/80 to-black/80 backdrop-blur-lg rounded-xl shadow-2xl border border-yellow-600"
        >
          {isValidating ? (
            <p className="text-center text-yellow-100">{t('validating')}</p>
          ) : !isTokenValid ? (
            <div className="space-y-4 text-center">
              <h1 className="text-xl font-semibold text-yellow-200 mb-2">
                {t('invalidLinkTitle')}
              </h1>
              <p className="text-sm text-yellow-100/80 mb-4">
                {tokenError}
              </p>
              <button
                type="button"
                onClick={() => router.push('/forgot-password')}
                className="px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-black font-semibold rounded-lg transition duration-200 ease-in-out shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black mx-auto min-w-[220px]"
              >
                {t('requestNewLink')}
              </button>
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="block mx-auto mt-2 text-sm text-yellow-300 hover:text-yellow-100 transition-colors duration-200"
              >
                {t('backToLogin')}
              </button>
            </div>
          ) : (
            <>
          <h1 className="text-xl font-semibold text-yellow-200 mb-4 text-center">
            {t('title')}
          </h1>
          <p className="text-sm text-yellow-100/80 mb-6 text-center">
            {t.rich('subtitle', { email: email || '', span: (chunks) => <span className="font-semibold">{chunks}</span> })}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-yellow-200 mb-1">{t('newPassword')}
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 pr-10 bg-black/40 border border-yellow-700 rounded-lg text-white placeholder-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200"
                  placeholder={t('newPasswordPlaceholder')}
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-yellow-500 hover:text-yellow-300 focus:outline-none transition-colors duration-200"
                  aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting}
                >
                  {showNewPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-yellow-200 mb-1">{t('confirmPassword')}
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="mt-1 block w-full px-4 py-3 pr-10 bg-black/40 border border-yellow-700 rounded-lg text-white placeholder-yellow-500 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 transition-all duration-200"
                  placeholder={t('confirmPasswordPlaceholder')}
                  required
                  disabled={isSubmitting}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-yellow-500 hover:text-yellow-300 focus:outline-none transition-colors duration-200"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  disabled={isSubmitting}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5" />
                  ) : (
                    <EyeIcon className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <p className="text-xs text-yellow-100/70">
              {t('passwordHint')}
            </p>
            <motion.button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center justify-center px-6 py-2 bg-yellow-600 hover:bg-yellow-700 text-black font-semibold rounded-lg transition duration-200 ease-in-out shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 focus:ring-offset-black disabled:opacity-50 disabled:cursor-not-allowed mx-auto min-w-[220px]"
              whileHover={{ scale: isSubmitting ? 1 : 1.005 }}
              whileTap={{ scale: isSubmitting ? 1 : 0.995 }}
            >
              {isSubmitting ? t('updating') : t('updatePassword')}
            </motion.button>
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="block mx-auto mt-2 text-sm text-yellow-300 hover:text-yellow-100 transition-colors duration-200"
            >
              {t('backToLogin')}
              </button>
          </form>
          </>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center p-4 bg-black">
        <p className="text-yellow-100">Đang tải...</p>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}

