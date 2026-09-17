'use client'

import { useEffect, useState, useRef } from 'react'
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
}

export default function WatchNowTVShowsServer2({
  tvShow,
  selectedSeason,
  selectedEpisode,
  onLinkChange
}: WatchNowTVShowsServer2Props) {
  const { id } = useParams();
  const [activeDomain, setActiveDomain] = useState<string>('https://vidsrcme.su');

  // Stable ref for callback to avoid re-render ping-pong loop
  const onLinkChangeRef = useRef(onLinkChange);
  onLinkChangeRef.current = onLinkChange;

  // Track last emitted link to prevent redundant updates
  const lastLinkRef = useRef<string>('');

  useEffect(() => {
    let active = true;
    async function fetchDomain() {
      try {
        const res = await api.get('/vidsrc/active-domain');
        if (active && res.data?.active_domain) {
          setActiveDomain(res.data.active_domain);
        }
      } catch {
        if (active) setActiveDomain('https://vidsrcme.su');
      }
    }
    fetchDomain();
    return () => { active = false; };
  }, []);

  // Set Server 2 embed URL once active domain is loaded or defaulted
  useEffect(() => {
    const domainToUse = activeDomain || 'https://vidsrcme.su';
    const rawId = tvShow?.id ? String(tvShow.id) : (typeof id === 'string' ? id.replace(/-(vietsub|dubbed)$/i, '') : '');
    if (rawId && selectedSeason && selectedEpisode > 0) {
      const cleanDomain = domainToUse.replace(/\/$/, '');
      const rawServer2Url = `${cleanDomain}/embed/tv?tmdb=${rawId}&season=${selectedSeason}&episode=${selectedEpisode}&ds_lang=vi&autoplay=1&autonext=1`;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const proxiedUrl = `${apiUrl}/vidsrc/embed-proxy?url=${encodeURIComponent(rawServer2Url)}`;
      
      // Deduplicate: only notify parent if URL actually changed
      if (lastLinkRef.current !== proxiedUrl) {
        lastLinkRef.current = proxiedUrl;
        onLinkChangeRef.current?.(proxiedUrl);
      }
    }
  }, [id, tvShow?.id, selectedSeason, selectedEpisode, activeDomain]);

  return null;
}
