'use client'

import { useEffect, useState } from 'react'
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
}

export default function WatchNowMoviesServer2({
  movie,
  onLinkChange
}: WatchNowMoviesServer2Props) {
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
    if (typeof id === 'string' && id && activeDomain) {
      const cleanDomain = activeDomain.replace(/\/$/, '');
      const server2Url = `${cleanDomain}/embed/movie?tmdb=${id}&ds_lang=vi&autoplay=1`;
      onLinkChange(server2Url);
    }
  }, [id, movie?.title, movie?.year, activeDomain, onLinkChange]);

  return null;
}
