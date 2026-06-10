import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "../styles/scrollbar.css";
import Navigation from "@/components/Navigation";
import CustomToaster from "@/components/CustomToaster";
import Footer from '@/components/Footer';
import AuthChecker from '../components/AuthChecker';
import { SplashWrapper } from '@/components/splash';
import { HeaderProvider } from '@/contexts/HeaderContext';
import ContentWrapper from '@/components/ContentWrapper';
import { SpeedInsights } from '@vercel/speed-insights/next';
import WatchlistSyncer from "@/components/WatchlistSyncer";
import FloatingChatboxWrapper from "@/components/FloatingChatboxWrapper";
import ProgressCleanup from '@/components/ProgressCleanup';
import VersionChecker from '@/components/VersionChecker';
import PageTransition from '@/components/PageTransition';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const inter = Inter({
  subsets: ["latin"],
  display: 'swap', // Prevent FOIT (Flash of Invisible Text)
  preload: true,
  fallback: ['system-ui', 'arial'],
});

export const metadata: Metadata = {
  referrer: "origin",
  title: "ENTN - Explore Movies, Games & Beyon",
  description: "Dive into a universe of entertainment: stream movies, play games, and enjoy AI-powered recommendations in one seamless platform.",
  other: {
    'translate': 'no',
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1.0,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon.ico" />
        <meta name="referrer" content="origin" />
        {/* Preconnect to TMDB for faster image loading */}
        <link rel="preconnect" href="https://image.tmdb.org" />
        <link rel="dns-prefetch" href="https://image.tmdb.org" />
        {/* Blocking script: hide splash on reload before paint */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `try{if(sessionStorage.getItem('splashShown'))document.documentElement.setAttribute('data-splash-done','1')}catch(e){}` }} />
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `html[data-splash-done="1"] [data-splash]{display:none!important}` }} />
      </head>
      <body suppressHydrationWarning className={`${inter.className} bg-black text-white min-h-screen flex flex-col`}>
        <NextIntlClientProvider messages={{
          Navigation: messages.Navigation,
          Notifications: messages.Notifications,
          Search: messages.Search,
          Footer: messages.Footer,
          Watchlist: messages.Watchlist,
          Filter: messages.Filter,
          NotFound: messages.NotFound
        }}>
          <HeaderProvider>
            {/* Splash Screen */}
            <SplashWrapper />

            <AuthChecker />
            <ProgressCleanup />
            <Navigation />
            <PageTransition />
            <WatchlistSyncer />
            <ContentWrapper>
              {children}
            </ContentWrapper>
            <Footer />
            <FloatingChatboxWrapper />
            <CustomToaster />
            <VersionChecker />
            <SpeedInsights />
          </HeaderProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
