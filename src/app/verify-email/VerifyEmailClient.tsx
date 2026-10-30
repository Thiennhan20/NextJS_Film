"use client";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import axios from "axios";
import { motion } from "framer-motion";
import { CheckCircleIcon, XCircleIcon, ClockIcon } from '@heroicons/react/24/solid';
import { Suspense } from "react";
import { useTranslations } from 'next-intl';

export default function VerifyEmailPage() {
  const t = useTranslations('VerifyEmail');
  return (
    <Suspense fallback={<div>{t('loading')}</div>}>
      <VerifyEmailPageInner />
    </Suspense>
  );
}

function VerifyEmailPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "success" | "error">("pending");
  const [message, setMessage] = useState("");
  const t = useTranslations('VerifyEmail');

  useEffect(() => {
    const token = searchParams.get("token");
    const email = searchParams.get("email");
    if (!token || !email) {
      setStatus("error");
      setMessage(t('missingInfo'));
      return;
    }
    const verify = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api"}/auth/verify-email`,
          { params: { token, email } }
        );
        const msg = typeof res.data === 'string' ? res.data : res.data?.message;
        if (msg && (msg.includes('thành công') || msg.toLowerCase().includes('success'))) {
          setStatus("success");
          localStorage.setItem('email_verified_success', 'true');
          setTimeout(() => {
            localStorage.removeItem('email_verified_success');
            router.push("/login");
          }, 2000);
        } else {
          setStatus("error");
          setMessage(msg || t('failedMsg'));
        }
      } catch (err: unknown) {
        let msg: string | undefined = undefined;
        if (err && typeof err === 'object' && 'response' in err && err.response && typeof err.response === 'object' && 'data' in err.response) {
          const data = (err.response as { data?: unknown }).data;
          if (typeof data === 'object' && data && 'message' in data) {
            msg = (data as { message?: string }).message;
          } else if (typeof data === 'string') {
            msg = data;
          }
        }
        setStatus("error");
        setMessage(
          msg || t('failedMsg')
        );
      }
    };
    verify();
  }, [searchParams, router, t]);

  // Cleanup flag nếu reload hoặc đóng tab (chỉ khi flag còn)
  useEffect(() => {
    const cleanup = () => {
      if (localStorage.getItem('email_verified_success') === 'true') {
        localStorage.removeItem('email_verified_success');
      }
    };
    window.addEventListener('beforeunload', cleanup);
    return () => window.removeEventListener('beforeunload', cleanup);
  }, []);

  if (status === "pending") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto p-4 sm:p-8 mt-10 sm:mt-20 bg-gradient-to-br from-green-900/95 to-black/95 backdrop-blur-lg rounded-2xl shadow-2xl border-4 border-yellow-500 text-center relative overflow-hidden"
      >
        <div className="flex justify-center mb-4 sm:mb-6">
          <ClockIcon className="h-10 w-10 sm:h-14 sm:w-14 text-yellow-400 animate-pulse" />
        </div>
        <h2 className="text-xl sm:text-3xl font-extrabold mb-3 sm:mb-4 text-yellow-400 drop-shadow-lg tracking-wide">
          {t('title')}
        </h2>
        <div className="text-yellow-200 text-base sm:text-lg">{t('verifying')}</div>
      </motion.div>
    );
  }
  if (status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto p-4 sm:p-8 mt-10 sm:mt-20 bg-gradient-to-br from-green-900/95 to-black/95 backdrop-blur-lg rounded-2xl shadow-2xl border-4 border-green-500 text-center relative overflow-hidden"
      >
        <div className="flex justify-center mb-4 sm:mb-6">
          <CheckCircleIcon className="h-10 w-10 sm:h-14 sm:w-14 text-green-400 animate-pulse" />
        </div>
        <h2 className="text-xl sm:text-3xl font-extrabold mb-3 sm:mb-4 text-green-400 drop-shadow-lg tracking-wide">
          {t('title')}
        </h2>
        <div className="text-green-400 font-bold text-base sm:text-lg">{t('successMsg')}</div>
        <div className="text-yellow-200 text-sm sm:text-base mt-2">{t('redirecting')}</div>
        <div className="absolute -bottom-6 -right-6 sm:-bottom-10 sm:-right-10 opacity-30 pointer-events-none select-none">
          <svg width="80" height="80" className="sm:w-[120px] sm:h-[120px]" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="60" fill="#00FF99" /></svg>
        </div>
      </motion.div>
    );
  }
  if (status === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto p-4 sm:p-8 mt-10 sm:mt-20 bg-gradient-to-br from-red-900/95 to-black/95 backdrop-blur-lg rounded-2xl shadow-2xl border-4 border-red-500 text-center relative overflow-hidden"
      >
        <div className="flex justify-center mb-4 sm:mb-6">
          <XCircleIcon className="h-10 w-10 sm:h-14 sm:w-14 text-red-400 animate-shake" />
        </div>
        <h2 className="text-xl sm:text-3xl font-extrabold mb-3 sm:mb-4 text-red-400 drop-shadow-lg tracking-wide">
          {t('title')}
        </h2>
        <div className="text-red-400 font-bold text-base sm:text-lg">{message}</div>
        <div className="absolute -bottom-6 -right-6 sm:-bottom-10 sm:-right-10 opacity-30 pointer-events-none select-none">
          <svg width="80" height="80" className="sm:w-[120px] sm:h-[120px]" viewBox="0 0 120 120" fill="none"><circle cx="60" cy="60" r="60" fill="#FF5555" /></svg>
        </div>
      </motion.div>
    );
  }
  return null;
}