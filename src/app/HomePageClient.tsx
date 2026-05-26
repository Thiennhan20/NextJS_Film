'use client'



import { useCallback, useEffect, useState, lazy, Suspense } from 'react'
import { 
  SparklesIcon,
  StarIcon,
  HeartIcon,
  EyeIcon
} from '@heroicons/react/24/outline'
import { useTranslations } from 'next-intl'
import LazySection from '@/components/common/LazySection'

// ONLY load HeroMovies immediately (above the fold)
import HeroMovies from '@/components/home/HeroMovies'

// Lazy load all other components with React.lazy (true code splitting)
const RecentlyWatchedMovies = lazy(() => import('@/components/home').then(m => ({ default: m.RecentlyWatched })))
const ActiveStreamingRooms = lazy(() => import('@/components/home').then(m => ({ default: m.ActiveStreamingRooms })))
const EntertainmentFrames = lazy(() => import('@/components/home').then(m => ({ default: m.EntertainmentFrames })))
const KoreanFrame = lazy(() => import('@/components/home/frames/KoreanFrame'))
const USUKFrame = lazy(() => import('@/components/home/frames/USUKFrame'))
const ChinaFrame = lazy(() => import('@/components/home/frames/ChinaFrame'))
const MoviesFrame = lazy(() => import('@/components/home').then(m => ({ default: m.MoviesFrame })))
const ComingSoonMovies = lazy(() => import('@/components/home').then(m => ({ default: m.ComingSoonMovies })))
const TVShowsFrame = lazy(() => import('@/components/home').then(m => ({ default: m.TVShowsFrame })))
const AnimeFrame = lazy(() => import('@/components/home').then(m => ({ default: m.AnimeFrame })))
const TopComments = lazy(() => import('@/components/home').then(m => ({ default: m.TopComments })))
const ActionFrame = lazy(() => import('@/components/home/frames/ActionFrame'))
const HorrorFrame = lazy(() => import('@/components/home/frames/HorrorFrame'))
const RomanceFrame = lazy(() => import('@/components/home/frames/RomanceFrame'))
const ActorsFrame = lazy(() => import('@/components/home/frames/ActorsFrame'))

const ROMANCE_SECTION_RESERVE = 'clamp(490px, 55vw, 650px)'
const ACTORS_SECTION_RESERVE = 'clamp(360px, 39vw, 470px)'

// Minimal placeholder - no skeleton animation, sections appear when ready
const SectionSkeleton = () => <div />
const ReservedSectionSpace = ({ minHeight }: { minHeight: string }) => (
  <div aria-hidden="true" style={{ minHeight }} />
)

interface Particle {
  x: number;
  y: number;
  size: number;
  duration: number;
}

export default function Home() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const t = useTranslations('HomePage');

  const preloadFeatureFrames = useCallback(() => {
    void import('@/components/home/frames/RomanceFrame')
      .then((module) => module.preloadRomanceFrameData())
      .catch(() => undefined)
      .then(() => import('@/components/home/frames/ActorsFrame'))
      .then((module) => module.preloadActorsFrameData())
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    // Detect mobile device with debounce
    let resizeTimeout: NodeJS.Timeout;
    const checkMobile = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const mobile = window.innerWidth < 768;
        setIsMobile(mobile);
        
        // Only create particles on desktop and if not already created
        if (!mobile && particles.length === 0) {
          const newParticles = Array.from({ length: 8 }).map(() => ({
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 1.5 + 0.5,
            duration: Math.random() * 10 + 6,
          }));
          setParticles(newParticles);
        } else if (mobile && particles.length > 0) {
          setParticles([]);
        }
      }, 100);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => {
      window.removeEventListener('resize', checkMobile);
      clearTimeout(resizeTimeout);
    };
  }, [particles.length]);

  return (
    <main className="min-h-screen overflow-x-hidden bg-black text-white">
      {/* Background Particles - Only on desktop for better performance */}
      {!isMobile && particles.length > 0 && (
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
          {particles.map((p, i) => (
            <div
              key={i}
              className="absolute bg-purple-400/30 rounded-full performance-particle"
              style={{ 
                left: `${p.x}%`, 
                top: `${p.y}%`, 
                width: p.size, 
                height: p.size,
                willChange: 'transform, opacity',
                animation: `particleFloat ${p.duration}s ease-in-out infinite alternate`
              }}
            />
          ))}
        </div>
      )}

      {/* Hero Movies Section - Load immediately (above the fold) */}
      <HeroMovies />

      {/* Recently Watched Movies Section - Near fold, load early */}
      <LazySection rootMargin="200px" minHeight="300px">
        <Suspense fallback={<SectionSkeleton />}>
          <RecentlyWatchedMovies />
        </Suspense>
      </LazySection>

      {/* Active Streaming Rooms Section */}
      <LazySection rootMargin="200px" minHeight="200px">
        <Suspense fallback={<SectionSkeleton />}>
          <ActiveStreamingRooms />
        </Suspense>
      </LazySection>

      {/* Korean Frame - Each frame gets its own LazySection */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto py-4 sm:py-6">
            <KoreanFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* US-UK Frame */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto py-4 sm:py-6">
            <USUKFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* China Frame */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto py-4 sm:py-6">
            <ChinaFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Top Comments Section */}
      <LazySection rootMargin="150px" minHeight="500px">
        <Suspense fallback={<SectionSkeleton />}>
          <TopComments />
        </Suspense>
      </LazySection>

      {/* Top Movies Section */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto">
            <MoviesFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Coming Soon Movies Section */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <ComingSoonMovies />
        </Suspense>
      </LazySection>

      {/* Top TV Shows Section */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto">
            <TVShowsFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Anime Frame Section */}
      <LazySection rootMargin="150px" minHeight="500px" onIntersect={preloadFeatureFrames}>
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto pb-12">
            <AnimeFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Action Frame - Separate LazySection */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto py-4 sm:py-6">
            <ActionFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Horror Frame - Separate LazySection */}
      <LazySection rootMargin="150px" minHeight="350px">
        <Suspense fallback={<SectionSkeleton />}>
          <div className="max-w-7xl mx-auto py-4 sm:py-6">
            <HorrorFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Romance Frame - 3D Image Ring */}
      <LazySection rootMargin="150px" minHeight={ROMANCE_SECTION_RESERVE}>
        <Suspense fallback={<ReservedSectionSpace minHeight={ROMANCE_SECTION_RESERVE} />}>
          <div className="max-w-7xl mx-auto py-4 sm:py-6">
            <RomanceFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Featured Actors Frame */}
      <LazySection rootMargin="150px" minHeight={ACTORS_SECTION_RESERVE}>
        <Suspense fallback={<ReservedSectionSpace minHeight={ACTORS_SECTION_RESERVE} />}>
          <div className="max-w-7xl mx-auto py-4 sm:py-6">
            <ActorsFrame />
          </div>
        </Suspense>
      </LazySection>

      {/* Entertainment Frames Section */}
      <LazySection rootMargin="150px" minHeight="500px">
        <Suspense fallback={<SectionSkeleton />}>
          <EntertainmentFrames />
        </Suspense>
      </LazySection>


      {/* Call to Action Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div
            className="absolute inset-0"
            style={{
              backgroundImage: "radial-gradient(circle at 30% 20%, rgba(139, 92, 246, 0.2) 0%, transparent 50%), radial-gradient(circle at 70% 80%, rgba(239, 68, 68, 0.2) 0%, transparent 50%)",
              animation: 'ctaBgRotate 40s linear infinite alternate',
            }}
        />
        <div className="max-w-5xl mx-auto text-center relative z-10 px-4">
            <div
              className="bg-black/40 backdrop-blur-xl rounded-3xl p-8 sm:p-12 border border-white/10 hover:scale-[1.02] transition-transform duration-300"
            >
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 via-pink-400 to-red-400 text-transparent bg-clip-text leading-tight"
                style={{ backgroundSize: "300% 300%", animation: 'ctaGradientShift 4s ease-in-out infinite' }}
              >
                {t('comingSoon')}
              </h2>
              
              <p
                className="text-lg text-gray-300 mb-8"
                style={{ animation: 'ctaPulseOpacity 3s ease-in-out infinite' }}
              >
                {t('comingSoonSubtitle')}
              </p>

              {/* Simple Feature Icons */}
              <div className="flex justify-center gap-8 mb-8">
                {[
                  { icon: <SparklesIcon className="w-8 h-8" />, color: "text-purple-400" },
                  { icon: <StarIcon className="w-8 h-8" />, color: "text-yellow-400" },
                  { icon: <HeartIcon className="w-8 h-8" />, color: "text-red-400" },
                  { icon: <EyeIcon className="w-8 h-8" />, color: "text-blue-400" }
                ].map((item, index) => (
                  <div
                    key={index}
                    className={item.color}
                    style={{ animation: `ctaIconRotate 6s linear infinite`, animationDelay: `${index * 0.5}s` }}
                  >
                    {item.icon}
                  </div>
                ))}
              </div>

            </div>
        </div>
      </section>
      
    </main>
  )
}
