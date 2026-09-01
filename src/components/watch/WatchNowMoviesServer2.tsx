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
  const [activeDomain, setActiveDomain] = useState<string>('https://vidsrcme.su');

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
    if (typeof id === 'string' && id) {
      const cleanDomain = domainToUse.replace(/\/$/, '');
      const rawServer2Url = `${cleanDomain}/embed/movie?tmdb=${id}&ds_lang=vi&autoplay=1`;
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const proxiedUrl = `${apiUrl}/vidsrc/embed-proxy?url=${encodeURIComponent(rawServer2Url)}`;
      onLinkChange(proxiedUrl);
    }
  }, [id, movie?.title, movie?.year, activeDomain, onLinkChange]);

  return null;
}
