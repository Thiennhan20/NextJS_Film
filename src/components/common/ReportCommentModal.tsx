'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FlagIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslations } from 'next-intl';

export type ReportReason =
  | 'spam'
  | 'harassment'
  | 'hate_speech'
  | 'spoiler'
  | 'inappropriate'
  | 'other';

interface ReportTargetPreview {
  _id: string;
  content: string;
  authorName: string;
}

interface ReportCommentModalProps {
  open: boolean;
  target: ReportTargetPreview | null;
  isSubmitting?: boolean;
  onSubmit: (reasonCategory: ReportReason, details: string) => void;
  onClose: () => void;
}

const REASON_OPTIONS: Array<{ value: ReportReason; labelKey: string }> = [
  { value: 'spam', labelKey: 'reportReasonSpam' },
  { value: 'harassment', labelKey: 'reportReasonHarassment' },
  { value: 'hate_speech', labelKey: 'reportReasonHateSpeech' },
  { value: 'spoiler', labelKey: 'reportReasonSpoiler' },
  { value: 'inappropriate', labelKey: 'reportReasonInappropriate' },
  { value: 'other', labelKey: 'reportReasonOther' },
];

export default function ReportCommentModal({
  open,
  target,
  isSubmitting = false,
  onSubmit,
  onClose,
}: ReportCommentModalProps) {
  const t = useTranslations('Comments');
  const [mounted, setMounted] = useState(false);
  const [reasonCategory, setReasonCategory] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setReasonCategory('spam');
      setDetails('');
      setValidationError(null);
    }
  }, [open, target?._id]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isSubmitting, onClose]);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  if (!mounted || typeof document === 'undefined') return null;

  const trimmedDetails = details.trim();
  const isOther = reasonCategory === 'other';

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!reasonCategory) {
      setValidationError(t('reportReasonRequired'));
      return;
    }
    if (isOther && trimmedDetails.length < 3) {
      setValidationError(t('reportDetailsMin'));
      return;
    }
    setValidationError(null);
    onSubmit(reasonCategory, trimmedDetails);
  };

  return createPortal(
    <AnimatePresence>
      {open && target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center px-3 sm:px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          aria-describedby="report-modal-subtitle"
        >
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => {
              if (!isSubmitting) onClose();
            }}
          />

          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.94, opacity: 0, y: 12 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="relative z-10 w-full max-w-lg mx-auto rounded-2xl bg-gray-950/95 border border-white/10 shadow-[0_25px_60px_rgba(0,0,0,0.95)] p-5 sm:p-6 text-white max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-start gap-3">
                <div className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
                  <FlagIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 id="report-modal-title" className="text-base sm:text-lg font-bold text-white">
                    {t('reportModalTitle')}
                  </h3>
                  <p id="report-modal-subtitle" className="text-xs sm:text-sm text-gray-400 mt-0.5">
                    {t('reportModalSubtitle')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={onClose}
                aria-label={t('cancel')}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.08] transition-colors disabled:opacity-40"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 rounded-xl bg-white/[0.04] border border-white/[0.08] p-3">
              <div className="text-[11px] uppercase tracking-wider text-gray-400 mb-1 font-semibold">
                {t('reportTargetPreview')} • {target.authorName || t('unknownUser')}
              </div>
              <p className="text-xs sm:text-sm text-gray-200 line-clamp-3 break-words whitespace-pre-wrap">
                {target.content}
              </p>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div>
                <div className="text-xs sm:text-sm font-semibold text-gray-200 mb-2">
                  {t('reportReasonLabel')}
                </div>
                <div className="grid grid-cols-1 gap-2" role="radiogroup" aria-label={t('reportReasonLabel')}>
                  {REASON_OPTIONS.map((option) => {
                    const selected = reasonCategory === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        disabled={isSubmitting}
                        onClick={() => {
                          setReasonCategory(option.value);
                          setValidationError(null);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm transition-all flex items-center justify-between gap-3 ${
                          selected
                            ? 'bg-red-500/15 border-red-500/60 text-white font-medium shadow-sm'
                            : 'bg-white/[0.03] border-white/[0.08] text-gray-300 hover:bg-white/[0.07] hover:border-white/20'
                        } disabled:opacity-50`}
                      >
                        <span>{t(option.labelKey)}</span>
                        <span
                          className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                            selected ? 'border-red-400 bg-red-500' : 'border-gray-500'
                          }`}
                        >
                          {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label
                  htmlFor="report-comment-details"
                  className="block text-xs sm:text-sm font-medium text-gray-300 mb-1.5"
                >
                  {isOther ? t('reportDetailsRequiredLabel') : t('reportDetailsLabel')}
                </label>
                <textarea
                  id="report-comment-details"
                  value={details}
                  onChange={(e) => {
                    setDetails(e.target.value);
                    if (validationError) setValidationError(null);
                  }}
                  disabled={isSubmitting}
                  maxLength={300}
                  rows={3}
                  placeholder={t('reportDetailsPlaceholder')}
                  className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500/70 focus:border-transparent resize-none text-[16px] sm:text-sm disabled:opacity-50"
                />
                <div className="flex items-center justify-between mt-1">
                  <span className="text-xs text-red-400 min-h-[1rem]">
                    {validationError || ''}
                  </span>
                  <span className={`text-xs ${details.length >= 280 ? 'text-amber-400' : 'text-gray-500'}`}>
                    {details.length}/300
                  </span>
                </div>
              </div>

              <div className="pt-1 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-gray-300 hover:text-white font-medium transition-all text-xs sm:text-sm disabled:opacity-50"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold transition-all text-xs sm:text-sm shadow-lg shadow-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting && (
                    <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>{isSubmitting ? t('reportSubmitting') : t('reportSubmit')}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

