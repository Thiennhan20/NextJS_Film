import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    // Disable Next.js Image Optimization to avoid Vercel image transformation usage
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
      },
      {
        protocol: 'https',
        hostname: 'randomuser.me',
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
      },
      {
        protocol: 'https',
        hostname: 'phimimg.com',
      },
      {
        protocol: 'https',
        hostname: 'phimapi.com',
      },
    ],
    localPatterns: [
      {
        pathname: '/api/**',
        search: '*',
      },
    ],
  },
  experimental: {
    // Enable optimizations for better performance
    optimizePackageImports: [
      '@react-three/fiber', 
      '@react-three/drei', 
      'three', 
      'framer-motion',
      '@heroicons/react'
    ],
    // Enable modern bundling
    esmExternals: true,
  },
  // Enable SWC minification for better performance

  // Compiler optimizations
  compiler: {
    // Remove console logs in production
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Add headers for better performance
  async headers() {
    return [
      {
        // Static assets (JS, CSS) - cache lâu dài vì có hash trong tên file
        source: '/_next/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        // Images và assets trong public folder - cache vừa phải
        // Tách thành nhiều routes vì Next.js không cho phép capturing groups
        source: '/:path*\\.jpg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.jpeg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.png',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.gif',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.svg',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.webp',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.woff',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.woff2',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.ttf',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        source: '/:path*\\.eot',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400, s-maxage=86400',
          },
        ],
      },
      {
        // API routes - không cache để luôn có dữ liệu mới
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate',
          },
        ],
      },
      {
        // HTML pages và tất cả routes khác - KHÔNG CACHE để luôn có phiên bản mới
        source: '/(.*)',
        headers: [
          {
            key: 'X-Font-Loading',
            value: 'swap',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate, max-age=0',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
          {
            key: 'Expires',
            value: '0',
          },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'https://server-nextjs-firm.onrender.com/api/:path*',
      },
    ];
  },
};

export default withNextIntl(nextConfig);