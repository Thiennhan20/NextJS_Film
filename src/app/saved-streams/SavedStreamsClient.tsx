'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeftIcon, 
  TrashIcon as Trash2, 
  ArrowPathIcon as RefreshCw, 
  TvIcon as Tv, 
  FilmIcon as Film, 
  ClockIcon as Clock,
  SignalIcon as Radio,
  ExclamationTriangleIcon as AlertTriangle
} from '@heroicons/react/24/outline';
import useAuthStore from '@/store/useAuthStore';
import useAuthHydrated from '@/store/useAuthHydrated';
import api from '@/lib/axios';
import { useTranslations } from 'next-intl';

interface StreamHistoryItem {
  id: string;
  room_id: string;
  title: string;
  stream_url: string;
  movie_id: string;
  audio: string;
  content_type: 'movie' | 'tvshow' | '';
  season: number | null;
  episode: number | null;
  created_count: number;
  last_created_at: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  episode_playlist?: any[];
  poster?: string;
}

export default function SavedStreamsClient() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const isAuthChecked = useAuthStore((s) => s.isAuthChecked);
  const hydrated = useAuthHydrated();
  
  const tLobby = useTranslations('StreamingLobby');
  const tProfile = useTranslations('Profile');

  const [streamHistory, setStreamHistory] = useState<StreamHistoryItem[]>([]);
  const [loadingStreamHistory, setLoadingStreamHistory] = useState(false);
  const [creatingHistoryId, setCreatingHistoryId] = useState<string | null>(null);
  const [deletingHistoryId, setDeletingHistoryId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState('');
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingRoomId: string;
    audio: string;
  } | null>(null);

  const fetchStreamHistory = useCallback(async () => {
    if (!isAuthenticated) {
      setStreamHistory([]);
      setLoadingStreamHistory(false);
      return;
    }

    setLoadingStreamHistory(true);
    setHistoryError('');
    try {
      const res = await api.get('/rooms/history?limit=50');
      setStreamHistory(res.data.items || []);
    } catch (err) {
      console.error('Failed to fetch stream history', err);
      setHistoryError(tLobby('loadingSavedStreams') || 'Failed to load saved streams.');
    } finally {
      setLoadingStreamHistory(false);
    }
  }, [isAuthenticated, tLobby]);

  useEffect(() => {
    if (hydrated && isAuthenticated) {
      fetchStreamHistory();
    }
  }, [hydrated, isAuthenticated, fetchStreamHistory]);

  const handleCreateFromHistory = async (item: StreamHistoryItem) => {
    if (!isAuthenticated) return;
    if (!item.stream_url) return;

    setCreatingHistoryId(item.id);
    setHistoryError('');
    setDuplicateInfo(null);

    try {
      const response = await api.post('/rooms', {
        title: item.title,
        stream_url: item.stream_url,
        movie_id: item.movie_id,
        audio: item.audio,
        content_type: item.content_type,
        season: item.season,
        episode: item.episode,
        episode_playlist: item.episode_playlist || [],
        poster: item.poster || '',
      });

      const { room_id } = response.data;
      router.push(`/streaming-room?room=${room_id}`);
    } catch (err: unknown) {
      console.error('Error creating room from saved stream:', err);
      const axiosErr = err as { response?: { data?: { error?: string; code?: string; existing_room_id?: string } } };
      const errData = axiosErr?.response?.data;

      if (errData?.code === 'DUPLICATE_ROOM') {
        setDuplicateInfo({
          existingRoomId: errData.existing_room_id || '',
          audio: item.audio,
        });
        setHistoryError(errData.error || tLobby('duplicateRoomError'));
      } else {
        setHistoryError(errData?.error || tLobby('savedStreamCreateFailed'));
      }
    } finally {
      setCreatingHistoryId(null);
    }
  };

  const handleDeleteHistoryItem = async (historyId: string) => {
    if (!isAuthenticated) return;

    setDeletingHistoryId(historyId);
    setHistoryError('');
    try {
      await api.delete(`/rooms/history/${encodeURIComponent(historyId)}`);
      setStreamHistory((prev) => prev.filter((item) => item.id !== historyId));
    } catch {
      setHistoryError(tLobby('deleteSavedStreamFailed'));
    } finally {
      setDeletingHistoryId(null);
    }
  };

  const formatHistoryDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!hydrated || !isAuthChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <h1 className="text-3xl font-bold text-white mb-4">{tProfile('pleaseLogin')}</h1>
          <p className="text-gray-400 mb-6">{tProfile('loginRequiredHint')}</p>
          <Link
            href="/login"
            className="inline-block px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
          >
            {tProfile('goToLogin')}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Background gradient effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <section className="pt-6 sm:pt-10 lg:pt-14 pb-10 sm:pb-16 px-3 sm:px-4 md:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 mb-6 sm:mb-8"
            >
              <Link
                href="/profile"
                className="p-2 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5 text-gray-300" />
              </Link>
              <div>
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-500 text-transparent bg-clip-text">
                  {tLobby('savedStreams')}
                </h1>
                <p className="text-xs sm:text-sm text-gray-400 mt-0.5">
                  {tLobby('savedStreamsDesc')}
                </p>
              </div>
              <button
                onClick={fetchStreamHistory}
                disabled={loadingStreamHistory}
                className="ml-auto p-2 text-gray-400 hover:text-emerald-400 transition-colors rounded-lg bg-gray-800/60 hover:bg-gray-700/60 border border-gray-700/50"
                title={tLobby('refresh')}
              >
                <RefreshCw className={`h-5 w-5 ${loadingStreamHistory ? 'animate-spin' : ''}`} />
              </button>
            </motion.div>

            {/* Error notifications */}
            {historyError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 rounded-xl bg-red-900/20 border border-red-500/20 text-red-200"
              >
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
                  <p className="text-sm font-medium">{historyError}</p>
                </div>
                {duplicateInfo?.existingRoomId && (
                  <button
                    onClick={() => router.push(`/streaming-room?room=${duplicateInfo.existingRoomId}`)}
                    className="mt-3 px-4 py-2 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-semibold rounded-lg hover:from-yellow-400 hover:to-amber-400 transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-yellow-500/20"
                  >
                    <Radio className="h-4 w-4 animate-pulse" />
                    {tLobby('goToExistingRoom')} ({duplicateInfo.existingRoomId})
                  </button>
                )}
              </motion.div>
            )}

            {/* Content List */}
            {loadingStreamHistory && streamHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-gray-400">{tLobby('loadingSavedStreams')}</p>
              </div>
            ) : streamHistory.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-20 bg-gray-900/35 border border-gray-800 rounded-2xl text-center"
              >
                <div className="w-16 h-16 rounded-full bg-gray-800/50 flex items-center justify-center mb-6 border border-gray-700/50">
                  <Clock className="w-8 h-8 text-gray-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
                  {tLobby('noSavedStreams')}
                </h3>
                <p className="text-sm text-gray-400 max-w-sm px-6">
                  {tLobby('noSavedStreamsDesc')}
                </p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence mode="popLayout">
                  {streamHistory.map((item, index) => {
                    const isTVShow = item.content_type === 'tvshow';
                    const isCreatingThis = creatingHistoryId === item.id;
                    const isDeletingThis = deletingHistoryId === item.id;

                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.3, delay: Math.min(index * 0.03, 0.3) }}
                        className="bg-gray-900/40 backdrop-blur-sm rounded-xl p-4 border border-gray-800/80 hover:border-emerald-500/30 transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-start gap-4 min-w-0">
                          {item.poster ? (
                            <>
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={item.poster.startsWith('http') ? item.poster : `https://image.tmdb.org/t/p/w154${item.poster}`}
                                alt={item.title}
                                className="w-12 h-16 rounded-lg object-cover shrink-0 shadow-lg border border-gray-800"
                              />
                            </>
                          ) : (
                            <div className={`w-12 h-16 rounded-lg flex items-center justify-center shrink-0 shadow-lg ${
                              isTVShow ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
                            }`}>
                              {isTVShow ? <Tv className="h-6 w-6" /> : <Film className="h-6 w-6" />}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border uppercase tracking-wider ${
                                isTVShow 
                                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' 
                                  : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                              }`}>
                                {isTVShow ? tLobby('showBadge') : tLobby('movieBadge')}
                              </span>
                              {item.audio && (
                                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-pink-500/10 text-pink-300 border border-pink-500/20 uppercase tracking-wider">
                                  {item.audio}
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-bold text-white truncate pr-4" title={item.title || tLobby('untitledRoom')}>
                              {item.title || tLobby('untitledRoom')}
                            </h3>
                            {isTVShow && item.season && item.episode && (
                              <p className="text-xs text-gray-400 mt-1">
                                {tLobby('seasonEpisode', { season: item.season, episode: item.episode })}
                              </p>
                            )}

                            <div className="flex items-center gap-3 text-[11px] text-gray-500 mt-2">
                              <span>{tLobby('lastCreated', { date: formatHistoryDate(item.last_created_at) })}</span>
                              <span>•</span>
                              <span>{tLobby('createdCount', { count: item.created_count || 1 })}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <button
                            onClick={() => handleDeleteHistoryItem(item.id)}
                            disabled={isDeletingThis}
                            className="p-2.5 text-gray-400 hover:text-red-400 hover:bg-red-500/15 border border-transparent hover:border-red-500/20 rounded-xl transition-all disabled:opacity-60"
                            title={tLobby('deleteSavedStreamTitle')}
                          >
                            <Trash2 className={`h-5 w-5 ${isDeletingThis ? 'animate-spin' : ''}`} />
                          </button>
                          <button
                            onClick={() => handleCreateFromHistory(item)}
                            disabled={isCreatingThis}
                            className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 text-black text-sm font-bold rounded-xl hover:from-emerald-400 hover:to-teal-400 transition-all shadow-md shadow-emerald-500/10 text-center min-w-[110px]"
                          >
                            {isCreatingThis ? (
                              <div className="flex items-center justify-center gap-2">
                                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                                <span>{tLobby('creating')}</span>
                              </div>
                            ) : (
                              tLobby('createAgain')
                            )}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
