'use client'

import { useEffect, useState } from 'react'
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
  selectedSeason,
  selectedEpisode,
  onLinkChange
}: WatchNowTVShowsServer2Props) {
  const { id } = useParams();
  const [activeDomain, setActiveDomain] = useState<string>('');

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

  // Set Server 2 embed URL once active domain is loaded from API
  useEffect(() => {
    if (typeof id === 'string' && id && selectedSeason && selectedEpisode > 0 && activeDomain) {
      const cleanDomain = activeDomain.replace(/\/$/, '');
      const server2Url = `${cleanDomain}/embed/tv?tmdb=${id}&season=${selectedSeason}&episode=${selectedEpisode}&ds_lang=vi&autoplay=1&autonext=1`;
      onLinkChange(server2Url);
    }
  }, [id, selectedSeason, selectedEpisode, activeDomain, onLinkChange]);

  return null;
}
