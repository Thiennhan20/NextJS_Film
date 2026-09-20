'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import api from '@/lib/axios'

interface Movie {
  id: number;
  title: string;
  year: number | '';
}

interface WatchNowMoviesServer2Props {
  movie: Movie;
  onLinkChange: (link: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onErrorChange?: (hasError: boolean) => void;
}

export default function WatchNowMoviesServer2({
  movie,
  onLinkChange,
  onLoadingChange,
  onErrorChange
}: WatchNowMoviesServer2Props) {
  const { id } = useParams();
  const rawId = movie?.id ? String(movie.id) : (typeof id === 'string' ? id.replace(/-(vietsub|dubbed)$/i, '') : '');

  // Stable refs for callbacks to prevent unnecessary re-render loops
  const onLinkChangeRef = useRef(onLinkChange);
  onLinkChangeRef.current = onLinkChange;
  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;
  const onErrorChangeRef = useRef(onErrorChange);
  onErrorChangeRef.current = onErrorChange;

  useEffect(() => {
    // If movie doesn't have a link/ID yet, don't prematurely report an error
    if (!rawId) {
      onLinkChangeRef.current?.('');
      onLoadingChangeRef.current?.(false);
      onErrorChangeRef.current?.(false);
      return;
    }

    let active = true;
    onLoadingChangeRef.current?.(true);
    onErrorChangeRef.current?.(false);

    async function checkAndSetStream() {
      try {
        const res = await api.get('/vidsrc/active-domain');
        if (!active) return;

        if (res.data?.ok && res.data?.active_domain) {
          const cleanDomain = res.data.active_domain.replace(/\/$/, '');
          const rawServer2Url = `${cleanDomain}/embed/movie?tmdb=${rawId}&ds_lang=vi&autoplay=1`;
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
          const proxiedUrl = `${apiUrl}/vidsrc/embed-proxy?url=${encodeURIComponent(rawServer2Url)}`;
          
          onLinkChangeRef.current?.(proxiedUrl);
          onErrorChangeRef.current?.(false);
        } else {
          // All domains were tested and failed
          onLinkChangeRef.current?.('');
          onErrorChangeRef.current?.(true);
        }
      } catch (err) {
        console.error('Failed to verify Server 2 domains:', err);
        if (active) {
          onLinkChangeRef.current?.('');
          onErrorChangeRef.current?.(true);
        }
      } finally {
        if (active) {
          onLoadingChangeRef.current?.(false);
        }
      }
    }

    checkAndSetStream();

    return () => {
      active = false;
    };
  }, [rawId]);

  return null;
}
