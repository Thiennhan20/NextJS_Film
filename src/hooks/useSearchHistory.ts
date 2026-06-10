'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import api from '@/lib/axios';
import useAuthStore from '@/store/useAuthStore';

// ─── Types ───────────────────────────────────────────────────────
export interface SearchHistoryEntry {
  query: string;
  searched_at: string; // ISO string
}

interface UseSearchHistoryReturn {
  /** 15 most recent entries for display */
  displayHistory: SearchHistoryEntry[];
  /** All entries in memory */
  fullHistory: SearchHistoryEntry[];
  /** Add or update a search query */
  addSearch: (query: string) => void;
  /** Remove a single entry by query (normalized) */
  removeSearch: (query: string) => void;
  /** Clear all history immediately */
  clearAll: () => void;
  /** Flush any pending sync now (call before logout) */
  flushSync: () => void;
  /** Whether initial load is in progress */
  isLoading: boolean;
}

// ─── Constants ───────────────────────────────────────────────────
const LOCALSTORAGE_KEY = 'guest_search_history';
const DEBOUNCE_MS = 10_000; // 10 seconds
const DISPLAY_LIMIT = 15;
const GUEST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ─── Helpers ─────────────────────────────────────────────────────
const normalize = (q: string) => q.toLowerCase().trim();

const sortDesc = (arr: SearchHistoryEntry[]) =>
  [...arr].sort(
    (a, b) => new Date(b.searched_at).getTime() - new Date(a.searched_at).getTime()
  );

// ─── Guest localStorage helpers ──────────────────────────────────
function loadGuestHistory(): SearchHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed: SearchHistoryEntry[] = JSON.parse(raw);
    // Purge entries older than 24h
    const now = Date.now();
    const valid = parsed.filter(
      (e) => now - new Date(e.searched_at).getTime() < GUEST_TTL_MS
    );
    if (valid.length !== parsed.length) {
      localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(valid));
    }
    return sortDesc(valid);
  } catch {
    return [];
  }
}

function saveGuestHistory(history: SearchHistoryEntry[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCALSTORAGE_KEY, JSON.stringify(history));
}

function clearGuestHistory() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(LOCALSTORAGE_KEY);
}

// ═════════════════════════════════════════════════════════════════
// Hook
// ═════════════════════════════════════════════════════════════════
export function useSearchHistory(): UseSearchHistoryReturn {
  const { isAuthenticated } = useAuthStore();
  const [history, setHistory] = useState<SearchHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Refs for debounce & sync
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const historyRef = useRef<SearchHistoryEntry[]>(history);
  const dirtyRef = useRef(false); // tracks if there are unsynced changes
  const isAuthRef = useRef(isAuthenticated);

  // Keep refs in sync
  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    isAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // ─── Sync to server ──────────────────────────────────────────
  const syncToServer = useCallback(async (data: SearchHistoryEntry[]) => {
    if (!isAuthRef.current) return;
    try {
      await api.post('/search-history', { history: data });
      dirtyRef.current = false;
    } catch (err) {
      console.warn('Search history sync failed, will retry on next search:', err);
      // Keep dirty flag so next addSearch will retry
    }
  }, []);

  const scheduleSyncDebounce = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      if (dirtyRef.current) {
        syncToServer(historyRef.current);
      }
    }, DEBOUNCE_MS);
  }, [syncToServer]);

  // ─── Flush pending sync immediately ──────────────────────────
  const flushSync = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    if (dirtyRef.current && isAuthRef.current) {
      syncToServer(historyRef.current);
    }
  }, [syncToServer]);

  // ─── Init: load from server or localStorage ──────────────────
  useEffect(() => {
    if (isAuthenticated) {
      // Logged in → clear guest data, fetch from server
      clearGuestHistory();
      setIsLoading(true);
      api
        .get('/search-history')
        .then((res) => {
          const serverHistory: SearchHistoryEntry[] = res.data.history || [];
          setHistory(sortDesc(serverHistory));
        })
        .catch((err) => {
          console.warn('Failed to load search history from server:', err);
        })
        .finally(() => setIsLoading(false));
    } else {
      // Guest → load from localStorage (with TTL cleanup)
      setHistory(loadGuestHistory());
    }
  }, [isAuthenticated]);

  // ─── beforeunload: flush sync when closing tab ────────────────
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!dirtyRef.current || !isAuthRef.current) return;
      const token = useAuthStore.getState().token;
      const baseURL =
        typeof window !== 'undefined' &&
        (window.location.hostname === 'localhost' ||
          window.location.hostname === '127.0.0.1')
          ? 'http://localhost:3001/api'
          : process.env.NEXT_PUBLIC_API_URL || '';
      const url = `${baseURL}/search-history`;
      try {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', url, false); // sync
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.withCredentials = true;
        if (token) {
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(JSON.stringify({ history: historyRef.current }));
      } catch {
        // Best effort — data might be lost but that's acceptable
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    // Listen for logout flush event
    const handleFlushEvent = () => flushSync();
    window.addEventListener('searchhistory:flush', handleFlushEvent);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('searchhistory:flush', handleFlushEvent);
    };
  }, [flushSync]);

  // ─── addSearch ────────────────────────────────────────────────
  const addSearch = useCallback(
    (rawQuery: string) => {
      const normalized = normalize(rawQuery);
      if (!normalized) return;

      const now = new Date().toISOString();

      setHistory((prev) => {
        // Remove existing entry with same query (if any)
        const filtered = prev.filter((e) => normalize(e.query) !== normalized);
        // Prepend new entry at top
        const updated = [{ query: normalized, searched_at: now }, ...filtered];

        if (isAuthRef.current) {
          // Mark dirty + schedule debounce
          dirtyRef.current = true;
          scheduleSyncDebounce();
        } else {
          // Guest → save to localStorage immediately
          saveGuestHistory(updated);
        }
        return updated;
      });
    },
    [scheduleSyncDebounce]
  );

  // ─── removeSearch ──────────────────────────────────────────────
  const removeSearch = useCallback(
    (rawQuery: string) => {
      const normalized = normalize(rawQuery);

      setHistory((prev) => {
        const updated = prev.filter((e) => normalize(e.query) !== normalized);

        if (isAuthRef.current) {
          dirtyRef.current = true;
          scheduleSyncDebounce();
        } else {
          saveGuestHistory(updated);
        }
        return updated;
      });
    },
    [scheduleSyncDebounce]
  );

  // ─── clearAll ──────────────────────────────────────────────────
  const clearAll = useCallback(() => {
    setHistory([]);

    if (isAuthRef.current) {
      // Immediate API call — no debounce for destructive action
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        debounceTimer.current = null;
      }
      dirtyRef.current = false;
      api.delete('/search-history').catch((err) => {
        console.warn('Failed to clear search history on server:', err);
      });
    } else {
      clearGuestHistory();
    }
  }, []);

  // ─── Cleanup timer on unmount ──────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  // ─── Computed display list (15 most recent) ────────────────────
  const displayHistory = sortDesc(history).slice(0, DISPLAY_LIMIT);

  return {
    displayHistory,
    fullHistory: history,
    addSearch,
    removeSearch,
    clearAll,
    flushSync,
    isLoading,
  };
}
