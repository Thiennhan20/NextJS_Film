'use client'

import { motion, useScroll, useTransform, MotionValue } from 'framer-motion'
import { useState, useRef, ReactNode, useEffect, useCallback } from 'react'
import { 
  FilmIcon,
  TvIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PuzzlePieceIcon
} from '@heroicons/react/24/outline'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import useAuthStore from '@/store/useAuthStore'

// New morphing effect for 2-column layout
const TwoColumnMorphingItem = ({ children, isLeft, scrollProgress }: { children: ReactNode, isLeft: boolean, scrollProgress: MotionValue<number> }) => {
  const x = useTransform(
    scrollProgress,
    [0.1, 0.4, 0.6, 0.9],
    isLeft ? ['-100%', '0%', '0%', '-100%'] : ['100%', '0%', '0%', '100%']
  );
  
  const opacity = useTransform(scrollProgress, [0.1, 0.4, 0.6, 0.9], [0, 1, 1, 0]);
  
  const scale = useTransform(
    scrollProgress,
    [0.1, 0.4, 0.6, 0.9],
    [0.8, 1, 1, 0.8]
  );
  
  return (
    <motion.div style={{ x, opacity, scale }} className="h-full">
      {children}
    </motion.div>
  );
};

export default function EntertainmentFrames() {
  const router = useRouter();
  const [currentNav, setCurrentNav] = useState<'movies' | 'tvshows'>('movies');
  const featuresRef = useRef<HTMLElement>(null);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);
  const t = useTranslations('Entertainment');

  const handleGameClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const isAuthenticated = useAuthStore.getState().isAuthenticated;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    let targetUrl = '/game-realtime';
    if (token) {
      targetUrl += `?token=${encodeURIComponent(token)}`;
    }
    router.push(targetUrl);
  };

  const { scrollYProgress: featuresScrollProgress } = useScroll({ 
    target: featuresRef, 
    offset: ["start end", "end start"]
  });

  // Auto-switch between Movies/TV Shows - Optimized interval
  const startAutoPlay = useCallback(() => {
    if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    autoPlayRef.current = setInterval(() => {
      setCurrentNav(prev => prev === 'movies' ? 'tvshows' : 'movies');
    }, 10000); // Increased interval for better performance
  }, []);

  const stopAutoPlay = useCallback(() => {
    if (autoPlayRef.current) {
      clearInterval(autoPlayRef.current);
    }
  }, []);

  // Start auto-play when component mounts
  useEffect(() => {
    startAutoPlay();
    
    return () => {
      stopAutoPlay();
    };
  }, [startAutoPlay, stopAutoPlay]);

  return (
    <section ref={featuresRef} className="py-8 sm:py-12 md:py-16 lg:py-20 xl:py-24 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-6xl mx-auto">
        {/* New Layout based on sketch */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:gap-8 h-auto min-h-[350px] sm:min-h-[400px] md:min-h-[450px] lg:min-h-[500px] xl:min-h-[550px]">
          {/* Left Column - Two smaller frames */}
          <TwoColumnMorphingItem isLeft={true} scrollProgress={featuresScrollProgress}>
            <div className="col-span-1 flex flex-col gap-4 sm:gap-6 lg:gap-8 h-full">
              {/* Top Left Frame */}
              <Link href={currentNav === 'movies' ? '/movies' : '/tvshows'}>
                <motion.div 
                  className={`flex-1 min-h-[150px] sm:min-h-[170px] md:min-h-[190px] lg:min-h-[200px] xl:min-h-[220px] backdrop-blur-xl rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 flex items-center justify-center relative overflow-hidden group cursor-pointer ${
                    currentNav === 'movies' 
                      ? 'bg-gradient-to-br from-purple-900/10 to-blue-900/10 border border-purple-500/30' 
                      : 'bg-gradient-to-br from-amber-900/10 to-yellow-900/10 border border-amber-500/30'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  onMouseEnter={stopAutoPlay}
                  onMouseLeave={startAutoPlay}
                >
                  {/* Background Image */}
                  <motion.div
                    key={currentNav}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 0.4, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.1 }}
                    transition={{ duration: 0.6 }}
                  >
                    <div 
                      className="w-full h-full bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${currentNav === 'movies' ? '/movies.webp' : '/tvshows.webp'})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    />
                    <div className={`absolute inset-0 ${
                      currentNav === 'movies' 
                        ? 'bg-gradient-to-br from-purple-900/35 to-blue-900/35' 
                        : 'bg-gradient-to-br from-amber-900/35 to-yellow-900/35'
                    }`} />
                  </motion.div>

                  {/* Left Arrow */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentNav(currentNav === 'movies' ? 'tvshows' : 'movies');
                    }}
                    className="absolute left-2 top-1/2 transform -translate-y-1/2 cursor-pointer p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors z-20"
                  >
                    <ChevronLeftIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 hover:text-white transition-colors" />
                  </motion.div>

                  {/* Right Arrow */}
                  <motion.div
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setCurrentNav(currentNav === 'movies' ? 'tvshows' : 'movies');
                    }}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer p-2 rounded-full bg-black/20 hover:bg-black/40 transition-colors z-20"
                  >
                    <ChevronRightIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white/80 hover:text-white transition-colors" />
                  </motion.div>

                  {/* Navigation Content */}
                  <div className="text-center relative z-10">

                    {/* Current Selection Display */}
                    <motion.div
                      key={currentNav}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="flex items-center justify-center gap-2 mb-6"
                    >
                      {currentNav === 'movies' ? (
                        <>
                          <FilmIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
                          <span className="text-sm sm:text-base text-purple-300 font-medium">{t('movies')}</span>
                        </>
                      ) : (
                        <>
                          <TvIcon className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                          <span className="text-sm sm:text-base text-amber-300 font-medium">{t('tvShows')}</span>
                        </>
                      )}
                    </motion.div>

                    {/* Navigation Controls */}
                    <div className="space-y-6">
                      {/* Navigation Dots */}
                      <div className="flex justify-center space-x-2">
                        <motion.div 
                          className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full cursor-pointer transition-all duration-200 ${
                            currentNav === 'movies' ? 'bg-purple-400 scale-110' : 'bg-purple-400/30 hover:bg-purple-400/50'
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCurrentNav('movies');
                          }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                        />
                        <motion.div 
                          className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full cursor-pointer transition-all duration-200 ${
                            currentNav === 'tvshows' ? 'bg-amber-400 scale-110' : 'bg-amber-400/30 hover:bg-amber-400/50'
                          }`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCurrentNav('tvshows');
                          }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                        />
                      </div>

                      {/* More Button */}
                      <div className="flex justify-center">
                        <motion.div
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`cursor-pointer px-4 py-2 rounded-full transition-all duration-200 border ${
                            currentNav === 'movies' 
                              ? 'bg-gradient-to-r from-purple-500/20 to-purple-600/20 hover:from-purple-500/30 hover:to-purple-600/30 border-purple-500/30' 
                              : 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 hover:from-amber-500/30 hover:to-yellow-500/30 border-amber-500/30'
                          }`}
                        >
                          <span className={`text-xs sm:text-sm font-medium transition-colors ${
                            currentNav === 'movies' 
                              ? 'text-purple-300 hover:text-purple-200' 
                              : 'text-amber-300 hover:text-amber-200'
                          }`}>
                            {t('clickSeeMore')}
                          </span>
                        </motion.div>
                      </div>
                    </div>
                  </div>

                  {/* Background Glow Effect */}
                  <motion.div
                    className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${
                      currentNav === 'movies' 
                        ? 'bg-gradient-to-br from-purple-500/5 to-blue-500/5' 
                        : 'bg-gradient-to-br from-amber-500/5 to-yellow-500/5'
                    }`}
                    animate={{
                      backgroundPosition: ['0% 0%', '100% 100%', '0% 0%']
                    }}
                    transition={{ duration: 4, repeat: Infinity }}
                  />
                </motion.div>
              </Link>

              {/* Bottom Left Frame */}
              <motion.div 
                className="flex-1 min-h-[150px] sm:min-h-[170px] md:min-h-[190px] lg:min-h-[200px] xl:min-h-[220px] bg-gradient-to-br from-blue-900/10 to-cyan-900/10 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-blue-500/30 p-3 sm:p-4 md:p-5 lg:p-6 flex items-center justify-center relative overflow-hidden"
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {/* Background Image */}
                <motion.div
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 1.1 }}
                  animate={{ opacity: 0.4, scale: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <div 
                    className="w-full h-full bg-cover bg-center"
                    style={{
                      backgroundImage: `url('/ai.webp')`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center'
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-900/35 to-cyan-900/35" />
                </motion.div>

                <motion.div
                  animate={{ 
                    scale: [1, 1.1, 1],
                    textShadow: [
                      "0 0 20px rgba(59, 130, 246, 0.5)",
                      "0 0 40px rgba(59, 130, 246, 0.8)",
                      "0 0 20px rgba(59, 130, 246, 0.5)"
                    ]
                  }}
                  transition={{ 
                    scale: { duration: 4, repeat: Infinity, repeatType: "mirror" },
                    textShadow: { duration: 3, repeat: Infinity, repeatType: "mirror" }
                  }}
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 text-transparent bg-clip-text relative z-10"
                >
                  AI
                  <span className="text-sm sm:text-base text-white font-medium">{t('comingSoon')}</span>
                </motion.div>
              </motion.div>
            </div>
          </TwoColumnMorphingItem>

          {/* Right Column - One larger frame */}
          <TwoColumnMorphingItem isLeft={false} scrollProgress={featuresScrollProgress}>
            <motion.div 
              onClick={handleGameClick}
              className="col-span-1 h-full bg-gradient-to-br from-red-900/10 to-orange-900/10 backdrop-blur-xl rounded-xl sm:rounded-2xl border border-red-500/30 p-4 sm:p-5 md:p-6 lg:p-8 xl:p-10 flex flex-col items-center justify-center relative overflow-hidden cursor-pointer group"
              whileHover={{ scale: 1.01 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              {/* Background Image */}
              <motion.div
                className="absolute inset-0"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 0.4, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                <div 
                  className="w-full h-full bg-cover bg-center group-hover:scale-105 transition-transform duration-700"
                  style={{
                    backgroundImage: `url('/games.webp')`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-red-900/35 to-orange-900/35 group-hover:from-red-900/20 group-hover:to-orange-900/20 transition-colors duration-500" />
              </motion.div>

              <motion.div
                animate={{ 
                  scale: [1, 1.05, 1],
                  rotateY: [0, 5, 0, -5, 0]
                }}
                transition={{ 
                  scale: { duration: 6, repeat: Infinity, repeatType: "mirror" },
                  rotateY: { duration: 8, repeat: Infinity, ease: "easeInOut" }
                }}
                className="text-center relative z-10 flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ 
                    textShadow: [
                      "0 0 30px rgba(239, 68, 68, 0.6)",
                      "0 0 60px rgba(239, 68, 68, 0.9)",
                      "0 0 30px rgba(239, 68, 68, 0.6)"
                    ]
                  }}
                  transition={{ duration: 4, repeat: Infinity, repeatType: "mirror" }}
                  className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl 2xl:text-8xl font-bold bg-gradient-to-r from-red-400 via-orange-400 to-yellow-400 text-transparent bg-clip-text"
                >
                  Game
                </motion.div>

                {/* Compact & Sleek Game Start Button */}
                <motion.div
                  whileHover={{ scale: 1.06 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-2 px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-semibold transition-all duration-200 bg-gradient-to-r from-red-500/30 to-orange-500/30 hover:from-red-500/50 hover:to-orange-500/50 text-orange-200 hover:text-white shadow-[0_4px_20px_rgba(239,68,68,0.3)] border border-red-500/40 backdrop-blur-md cursor-pointer group-hover:border-orange-400/60"
                >
                  <PuzzlePieceIcon className="w-4 h-4 sm:w-4.5 sm:h-4.5 stroke-[2.5] text-amber-300" />
                  <span>{t('start')}</span>
                </motion.div>
              </motion.div>
            </motion.div>
          </TwoColumnMorphingItem>
        </div>
      </div>
    </section>
  );
}
