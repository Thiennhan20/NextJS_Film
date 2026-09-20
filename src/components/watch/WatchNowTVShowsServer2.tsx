'use client'

import { useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import api from '@/lib/axios'

interface TVShow {
  id: number;
  name: string;
}

interface WatchNowTVShowsServer2Props {
  tvShow: TVShow;
  selectedSeason: number;
  selectedEpisode: number;
  onLinkChange: (link: string) => void;
  onLoadingChange?: (loading: boolean) => void;
  onErrorChange?: (hasError: boolean) => void;
}

export default function WatchNowTVShowsServer2({
  tvShow,
  selectedSeason,
  selectedEpisode,
  onLinkChange,
  onLoadingChange,
  onErrorChange
}: WatchNowTVShowsServer2Props) {
  const { id } = useParams();
  const rawId = tvShow?.id ? String(tvShow.id) : (typeof id === 'string' ? id.replace(/-(vietsub|dubbed)$/i, '') : '');

  // Stable refs for callbacks to prevent ping-pong re-render loops
  const onLinkChangeRef = useRef(onLinkChange);
  onLinkChangeRef.current = onLinkChange;
  const onLoadingChangeRef = useRef(onLoadingChange);
  onLoadingChangeRef.current = onLoadingChange;
  const onErrorChangeRef = useRef(onErrorChange);
  onErrorChangeRef.current = onErrorChange;

  // Track last emitted link to prevent redundant updates
  const lastLinkRef = useRef<string>('');

  useEffect(() => {
    // If no episode is selected yet, don't show any error
    if (!rawId || !selectedSeason || selectedEpisode <= 0) {
      if (lastLinkRef.current !== '') {
        lastLinkRef.current = '';
        onLinkChangeRef.current?.('');
      }
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
          const rawServer2Url = `${cleanDomain}/embed/tv?tmdb=${rawId}&season=${selectedSeason}&episode=${selectedEpisode}&ds_lang=vi&autoplay=1&autonext=1`;
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
          const proxiedUrl = `${apiUrl}/vidsrc/embed-proxy?url=${encodeURIComponent(rawServer2Url)}`;

          if (lastLinkRef.current !== proxiedUrl) {
            lastLinkRef.current = proxiedUrl;
            onLinkChangeRef.current?.(proxiedUrl);
          }
          onErrorChangeRef.current?.(false);
        } else {
          // All domains were tested and failed
          if (lastLinkRef.current !== '') {
            lastLinkRef.current = '';
            onLinkChangeRef.current?.('');
          }
          onErrorChangeRef.current?.(true);
        }
      } catch (err) {
        console.error('Failed to verify Server 2 domains for TV show:', err);
        if (active) {
          if (lastLinkRef.current !== '') {
            lastLinkRef.current = '';
            onLinkChangeRef.current?.('');
          }
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
  }, [rawId, selectedSeason, selectedEpisode]);

  return null;
}
