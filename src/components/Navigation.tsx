'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MagnifyingGlassIcon, 
  Bars3Icon, 
  XMarkIcon,
  HomeIcon,
  FilmIcon,
  BookmarkIcon,
  UserIcon,
  QueueListIcon,
  PlayCircleIcon,
  PuzzlePieceIcon
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { toast } from 'react-hot-toast'
import { ArrowRightOnRectangleIcon as LogOut, Cog6ToothIcon as Settings } from '@heroicons/react/24/outline';
import { useUIStore } from '@/store/store';
import { useWatchlistStore } from '@/store/store';
import useAuthHydrated from '@/store/useAuthHydrated';
import Logo from '@/components/common/Logo';
import dynamic from 'next/dynamic';
import UserAvatar from '@/components/UserAvatar';
import { useTranslations } from 'next-intl';
import NotificationBell from '@/components/notifications/NotificationBell';

// Lazy load heavy search component
const AutocompleteSearch = dynamic(() => import('@/components/common/AutocompleteSearch'), {
  loading: () => (
    <div className="h-10 w-48 rounded-full bg-gray-200 animate-pulse" aria-hidden="true"></div>
  )
});
const AppDownloadModal = dynamic(() => import('@/components/AppDownloadModal'), {
  ssr: false,
  loading: () => null
});

const mainNavItems = [
  { key: 'home', href: '/', icon: HomeIcon, priority: 1 },
  { key: 'movies', href: '/movies', icon: FilmIcon, priority: 2 },
  { key: 'tvShows', href: '/tvshows', icon: PlayCircleIcon, priority: 3 },
]

const moreNavItems = [
  { key: 'streaming', href: '/streaming-lobby', icon: PlayCircleIcon },
  { key: 'game', href: '/game-realtime', icon: PuzzlePieceIcon },
]

const desktopOverflowNavItems = mainNavItems.filter((item) => item.key !== 'home')

function getDesktopMainNavVisibilityClass(key: string) {
  if (key === 'movies') return 'max-[899px]:hidden'
  if (key === 'tvShows') return 'max-[1199px]:hidden'
  return ''
}

function getDesktopMoreNavVisibilityClass(key: string) {
  if (key === 'movies') return 'flex min-[900px]:hidden'
  if (key === 'tvShows') return 'flex min-[1200px]:hidden'
  return 'flex'
}

const HEADER_DROPDOWN_OPEN_EVENT = 'header-dropdown-open'

type HeaderDropdownSource = 'more' | 'user' | 'notifications'

function notifyHeaderDropdownOpen(source: HeaderDropdownSource) {
  if (typeof window === 'undefined') return

  window.dispatchEvent(new CustomEvent(HEADER_DROPDOWN_OPEN_EVENT, {
    detail: { source }
  }))
}

function HeaderDropdownAutoClose({
  source,
  close
}: {
  source: HeaderDropdownSource
  close: () => void
}) {
  useEffect(() => {
    const onHeaderDropdownOpen = (event: Event) => {
      const openedSource = (event as CustomEvent<{ source?: HeaderDropdownSource }>).detail?.source
      if (openedSource && openedSource !== source) {
        close()
      }
    }

    window.addEventListener(HEADER_DROPDOWN_OPEN_EVENT, onHeaderDropdownOpen as EventListener)
    return () => window.removeEventListener(HEADER_DROPDOWN_OPEN_EVENT, onHeaderDropdownOpen as EventListener)
  }, [close, source])

  return null
}



export default function Navigation() {
  const [isOpen, setIsOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout, isLoading } = useAuthStore()
  const { setNavDropdownOpen, setAppModalOpen, isAppModalOpen } = useUIStore();
  const { watchlist } = useWatchlistStore();
  const hydrated = useAuthHydrated();
  const t = useTranslations('Navigation');

  const prefetchGameRooms = async () => {
    try {
      const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const gameApiUrl = isDev ? 'http://localhost:8080/api/rooms' : 'https://ntngame.fly.dev/api/rooms';
      const res = await fetch(gameApiUrl, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data?.rooms && typeof window !== 'undefined') {
          sessionStorage.setItem('game_rooms_prefetch', JSON.stringify(data.rooms));
        }
      }
    } catch {
      // Ignore prefetch errors
    }
  };

  const handleGameClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      toast.error(t('loginRequiredGame'));
      router.push('/login');
      setIsOpen(false);
      return;
    }
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    let targetUrl = '/game-realtime';
    if (token) {
      targetUrl += `?token=${encodeURIComponent(token)}`;
    }
    router.push(targetUrl);
    setIsOpen(false);
  };

  const [isMoreDropdownActive, setIsMoreDropdownActive] = useState(false);
  const [isProfileDropdownActive, setIsProfileDropdownActive] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isSearchActivated, setIsSearchActivated] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileUserDropdownOpen, setIsMobileUserDropdownOpen] = useState(false);
  const [isMobileMoreDropdownOpen, setIsMobileMoreDropdownOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1200);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowMobileSearch(false);
        setIsSearchActivated(false);
        setIsOpen(false);
        setIsMobileMoreDropdownOpen(false);
        setIsMobileUserDropdownOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        if (isOpen) {
          setIsOpen(false);
          setIsMobileMoreDropdownOpen(false);
          setIsMobileUserDropdownOpen(false);
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const isMoreActive = Boolean(
    pathname?.startsWith('/streaming') ||
    pathname?.startsWith('/game') ||
    pathname?.startsWith('/actors') ||
    pathname?.startsWith('/actor') ||
    pathname?.startsWith('/top-rated') ||
    pathname?.startsWith('/genres') ||
    pathname?.startsWith('/country') ||
    moreNavItems.some(item => item.href !== '/' && pathname?.startsWith(item.href)) ||
    (windowWidth < 1200 && pathname?.startsWith('/tvshows')) ||
    (windowWidth < 900 && pathname?.startsWith('/movies'))
  );

  const isUserActive = Boolean(
    pathname?.startsWith('/profile') ||
    pathname?.startsWith('/watchlist') ||
    pathname?.startsWith('/settings') ||
    pathname?.startsWith('/user')
  );

  const isLoginActive = Boolean(pathname?.startsWith('/login'));
  
  useEffect(() => {
    setNavDropdownOpen(isOpen || isMoreDropdownActive || isProfileDropdownActive);
  }, [isOpen, isMoreDropdownActive, isProfileDropdownActive, setNavDropdownOpen]);

  useEffect(() => {
    const onHeaderDropdownOpen = (event: Event) => {
      const openedSource = (event as CustomEvent<{ source?: HeaderDropdownSource }>).detail?.source
      if (openedSource === 'notifications') {
        setIsOpen(false)
        setIsMobileMoreDropdownOpen(false)
        setIsMobileUserDropdownOpen(false)
      }
    }

    window.addEventListener(HEADER_DROPDOWN_OPEN_EVENT, onHeaderDropdownOpen as EventListener)
    return () => window.removeEventListener(HEADER_DROPDOWN_OPEN_EVENT, onHeaderDropdownOpen as EventListener)
  }, [])


  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);


  if (pathname === '/game-realtime') return null;

  return (
    <>
      {/* Mobile Backdrop Overlay when menu isOpen is true */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs min-[700px]:hidden cursor-pointer"
          onClick={() => {
            setIsOpen(false);
            setIsMobileMoreDropdownOpen(false);
            setIsMobileUserDropdownOpen(false);
          }}
        />
      )}

      {/* Header */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b h-14 sm:h-16 ${
          isScrolled 
            ? 'bg-black/80 backdrop-blur-xl border-white/15 shadow-2xl shadow-black/90 ring-1 ring-white/10' 
            : 'bg-transparent border-white/10 shadow-none'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-full">
          <div className="flex items-center justify-between h-full">
          {/* Enhanced Logo */}
          <Logo isScrolled={isScrolled} variant="header" />

          {/* Desktop Navigation */}
          <div className="hidden min-[700px]:flex items-center gap-1.5">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`${getDesktopMainNavVisibilityClass(item.key)} relative flex h-10 shrink-0 items-center whitespace-nowrap px-4 rounded-full transition-colors duration-200 font-bold text-sm ${
                    isActive 
                      ? 'bg-white text-gray-900 border border-white/70 shadow-md shadow-black/40 ring-1 ring-white/60' 
                      : 'text-white bg-white/10 hover:bg-white/20 border border-white/25 hover:border-white/40 ring-1 ring-white/10 shadow-sm'
                  }`}
                >
                  <motion.div
                    className="flex items-center space-x-1.5 whitespace-nowrap"
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                  >
                    <item.icon className="h-4.5 w-4.5 stroke-[2.5]" />
                    <span className="font-bold">{t(`items.${item.key}`)}</span>
                  </motion.div>
                </Link>
              )
            })}
            {/* More dropdown - includes hidden nav items + original more items */}
            <Menu as="div" className="relative inline-block text-left">
              {({ close }) => (
              <>
              <HeaderDropdownAutoClose source="more" close={close} />
              <div>
                <Menu.Button
                  onClick={() => notifyHeaderDropdownOpen('more')}
                  className={`flex h-10 shrink-0 items-center space-x-1.5 whitespace-nowrap px-4 rounded-full transition-colors duration-200 font-bold text-sm ${
                    isMoreActive
                      ? 'bg-white text-gray-900 border border-white/70 shadow-md shadow-black/40 ring-1 ring-white/60'
                      : 'text-white bg-white/10 hover:bg-white/20 border border-white/25 hover:border-white/40 ring-1 ring-white/10 shadow-sm'
                  }`}
                >
                  <QueueListIcon className="h-4.5 w-4.5 stroke-[2.5]" />
                  <span className="font-bold">{t('more')}</span>
                  <span className={`ml-1 hidden h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-xs min-[900px]:inline-flex min-[1200px]:hidden ${isMoreActive ? 'bg-gray-900/80 text-white' : 'bg-red-500/80 text-white'}`}>
                    1
                  </span>
                  <span className={`ml-1 hidden h-4.5 min-w-4.5 items-center justify-center rounded-full px-1.5 text-xs max-[899px]:inline-flex ${isMoreActive ? 'bg-gray-900/80 text-white' : 'bg-red-500/80 text-white'}`}>
                    2
                  </span>
                </Menu.Button>
              </div>
              <Transition
                as={Fragment}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
                beforeEnter={() => {
                  setIsMoreDropdownActive(true);
                  void prefetchGameRooms();
                }}
                afterLeave={() => setIsMoreDropdownActive(false)}
              >
                <Menu.Items className="absolute right-0 mt-3 w-52 origin-top-right bg-gray-950/85 backdrop-blur-2xl border border-white/15 divide-y divide-white/10 rounded-2xl shadow-2xl shadow-black/90 ring-1 ring-white/10 focus:outline-none z-60 p-1.5">
                  {/* Hidden nav items first */}
                  <div className="hidden px-1 py-1 max-[1199px]:block space-y-1">
                      {desktopOverflowNavItems.map((item) => {
                        const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                        return (
                          <Menu.Item key={item.key}>
                            {({ active }) => (
                              <Link
                                href={item.href}
                                className={`${getDesktopMoreNavVisibilityClass(item.key)} items-center space-x-2.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-gray-900 font-bold shadow-sm'
                                    : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <item.icon className="h-5 w-5 stroke-[2.5]" />
                                <span>{t(`items.${item.key}`)}</span>
                              </Link>
                            )}
                          </Menu.Item>
                        );
                      })}
                    </div>
                  {/* Original more items */}
                  <div className="px-1 py-1 space-y-1">
                    {moreNavItems.map((item) => {
                      const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                      return (
                        <Menu.Item key={item.key}>
                          {({ active }) => (
                            item.key === 'game' ? (
                              <button
                                onClick={handleGameClick}
                                className={`w-full flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-sm font-semibold text-left cursor-pointer transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-gray-900 font-bold shadow-sm'
                                    : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <item.icon className="h-5 w-5 stroke-[2.5]" />
                                <span>{t(`items.${item.key}`)}</span>
                              </button>
                            ) : (
                              <Link
                                href={item.href}
                                className={`flex items-center space-x-2.5 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-gray-900 font-bold shadow-sm'
                                    : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <item.icon className="h-5 w-5 stroke-[2.5]" />
                                <span>{t(`items.${item.key}`)}</span>
                              </Link>
                            )
                          )}
                        </Menu.Item>
                      );
                    })}
                  </div>
                </Menu.Items>
              </Transition>
              </>
              )}
            </Menu>
          </div>

          {/* Search and Auth */}
          <div className="hidden min-[700px]:flex items-center gap-2.5">
            {/* Search - Full bar or Icon */}
            <div className="relative hidden min-[1050px]:block">
              <AutocompleteSearch isScrolled={isScrolled} />
            </div>
            <button
              onClick={() => setShowMobileSearch(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/10 border border-white/25 hover:border-white/40 ring-1 ring-white/10 text-white hover:bg-white/20 transition-colors duration-200 shadow-sm min-[1050px]:hidden cursor-pointer"
              aria-label="Open search"
            >
              <MagnifyingGlassIcon className="h-5 w-5 text-white stroke-[2.5]" />
            </button>
            
            <NotificationBell isScrolled={isScrolled} />

            {/* Download App Button */}
            <button
              onClick={() => setAppModalOpen(true, 'ios')}
              className="flex h-10 shrink-0 items-center space-x-1.5 whitespace-nowrap px-4 rounded-full border border-white/25 hover:border-blue-400/60 ring-1 ring-white/10 bg-white/10 text-white hover:bg-white/20 transition-colors duration-300 font-bold text-sm cursor-pointer shadow-sm hover:shadow-md"
            >
              <svg className="h-5 w-5 text-blue-400 drop-shadow-[0_0_8px_rgba(96,165,250,0.6)] transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="hidden lg:inline font-bold text-white drop-shadow-sm">{t('downloadApp')}</span>
              <span className="inline lg:hidden font-bold text-white drop-shadow-sm">{t('downloadAppShort')}</span>
            </button>
            <div className="flex shrink-0 items-center justify-end">
              {!hydrated || isLoading ? (
                <div className="h-10 w-10 rounded-full bg-gray-700 animate-pulse shrink-0" />
              ) : isAuthenticated ? (
                <div className="flex items-center">
                  <Menu as="div" className="relative inline-block text-left">
                  {({ close }) => (
                  <>
                  <HeaderDropdownAutoClose source="user" close={close} />
                  <div>
                    <Menu.Button
                      onClick={() => notifyHeaderDropdownOpen('user')}
                      className={`inline-flex h-10 w-10 items-center justify-center p-0.5 rounded-full transition-colors duration-300 focus:outline-none cursor-pointer overflow-hidden ${
                        isUserActive
                          ? 'border-2 border-white/70 bg-white/25 ring-1 ring-white/40 shadow-sm'
                          : 'border border-white/25 hover:border-emerald-400/60 ring-1 ring-white/10 bg-white/10 hover:bg-white/20 shadow-sm hover:shadow-md'
                      }`}
                      aria-label="User menu"
                    >
                      <UserAvatar
                        name={user?.name || 'User'}
                        avatar={user?.avatar}
                        size="sm"
                        priority={true}
                      />
                    </Menu.Button>
                  </div>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                    beforeEnter={() => setIsProfileDropdownActive(true)}
                    afterLeave={() => setIsProfileDropdownActive(false)}
                  >
                    <Menu.Items className="absolute right-0 mt-3 w-56 origin-top-right bg-gray-950/85 backdrop-blur-2xl border border-white/15 divide-y divide-white/10 rounded-2xl shadow-2xl shadow-black/90 ring-1 ring-white/10 focus:outline-none z-60 p-1.5">
                      <div className="px-1 py-1 space-y-1">
                        <Menu.Item>
                          {({ active }) => {
                            const isActive = pathname === '/profile' || pathname?.startsWith('/profile');
                            return (
                              <Link
                                href="/profile"
                                className={`w-full flex items-center space-x-2.5 text-left px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-gray-900 font-bold shadow-sm'
                                    : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <UserIcon className="h-5 w-5 stroke-[2.5]" />
                                <span className="whitespace-nowrap">{t('profile')}</span>
                              </Link>
                            );
                          }}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => {
                            const isActive = pathname === '/watchlist' || pathname?.startsWith('/watchlist');
                            return (
                              <Link
                                href="/watchlist"
                                className={`w-full flex items-center space-x-2.5 text-left px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-gray-900 font-bold shadow-sm'
                                    : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <BookmarkIcon className="h-5 w-5 stroke-[2.5]" />
                                <span className="whitespace-nowrap">{t('watchlist')} ({watchlist.length})</span>
                              </Link>
                            );
                          }}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => {
                            const isActive = pathname === '/settings' || pathname?.startsWith('/settings');
                            return (
                              <Link
                                href="/settings"
                                className={`w-full flex items-center space-x-2.5 text-left px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                  isActive
                                    ? 'bg-white text-gray-900 font-bold shadow-sm'
                                    : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Settings className="h-5 w-5 stroke-[2.5]" />
                                <span className="whitespace-nowrap">{t('settings')}</span>
                              </Link>
                            );
                          }}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={async () => {
                                await logout();
                                toast.success(t('loggedOut'));
                              }}
                              className={`w-full text-left px-3.5 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                                active ? 'bg-red-600/80 text-white font-bold shadow-sm' : 'text-red-400 hover:bg-red-600/20 hover:text-red-300 font-bold'
                              }`}
                            >
                              <div className="flex items-center space-x-2.5">
                                <LogOut className="h-5 w-5 stroke-[2.5]" />
                                <span className="whitespace-nowrap">{t('logout')}</span>
                              </div>
                            </button>
                          )}
                        </Menu.Item>

                      </div>
                    </Menu.Items>
                  </Transition>
                  </>
                  )}
                  </Menu>
                </div>
              ) : (
                <Menu as="div" className="relative inline-block text-left">
                  {({ close }) => (
                  <>
                  <HeaderDropdownAutoClose source="user" close={close} />
                  <Menu.Button
                    onClick={() => notifyHeaderDropdownOpen('user')}
                    className={`inline-flex h-10 w-10 items-center justify-center p-2 rounded-full transition-all duration-300 focus:outline-none cursor-pointer ${
                      isLoginActive
                        ? 'border border-white/70 bg-white text-gray-900 ring-1 ring-white/60 shadow-md shadow-black/40'
                        : 'border border-white/20 bg-white/10 text-emerald-400 hover:text-emerald-300 hover:bg-white/20 backdrop-blur-md shadow-sm hover:shadow-md'
                    }`}
                    aria-label={t('login')}
                  >
                    <UserIcon className={`h-5.5 w-5.5 stroke-[2.8] ${isLoginActive ? '' : 'text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]'}`} />
                  </Menu.Button>
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-100"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                    beforeEnter={() => setIsProfileDropdownActive(true)}
                    afterLeave={() => setIsProfileDropdownActive(false)}
                  >
                    <Menu.Items className="absolute right-0 mt-3 w-48 origin-top-right bg-gray-950/85 backdrop-blur-2xl border border-white/15 divide-y divide-white/10 rounded-2xl shadow-2xl shadow-black/90 ring-1 ring-white/10 focus:outline-none z-60 p-1.5">
                      <div className="px-1 py-1 space-y-1">
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              href="/login"
                              className={`flex items-center space-x-2.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                                isLoginActive
                                  ? 'bg-white text-gray-900 font-bold shadow-sm'
                                  : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                              }`}
                            >
                              <UserIcon className="h-5 w-5 stroke-[2.5]" />
                              <span className="whitespace-nowrap">{t('login')}</span>
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => {
                            const isSettingsActive = pathname === '/settings' || pathname?.startsWith('/settings');
                            return (
                              <Link
                                href="/settings"
                                className={`flex items-center space-x-2.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all duration-200 ${
                                  isSettingsActive
                                    ? 'bg-white text-gray-900 font-bold shadow-sm'
                                    : active ? 'bg-white/20 text-white font-bold shadow-sm' : 'text-white/90 hover:bg-white/10 hover:text-white'
                                }`}
                              >
                                <Settings className="h-5 w-5 stroke-[2.5]" />
                                <span className="whitespace-nowrap">{t('settings')}</span>
                              </Link>
                            );
                          }}
                        </Menu.Item>
                      </div>
                    </Menu.Items>
                  </Transition>
                  </>
                  )}
                  </Menu>
              )}
            </div>
          </div>

          {/* Mobile search icon and menu button combined (shows when step >= 4) */}
          <div className="flex items-center space-x-2 min-[700px]:hidden">
            <button
              onClick={() => {
                setShowMobileSearch(true);
                setIsSearchActivated(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 border border-white/15 text-white hover:bg-white/20 focus:outline-none transition backdrop-blur-md shadow-sm"
              aria-label="Open search"
            >
              <MagnifyingGlassIcon className="h-4.5 w-4.5" />
            </button>

            <NotificationBell isScrolled={isScrolled} compact />
            
            <button
              onClick={() => {
                const nextOpen = !isOpen
                setIsOpen(nextOpen)
                if (nextOpen) {
                  notifyHeaderDropdownOpen('more')
                }
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full text-white hover:text-white hover:bg-white/20 focus:outline-none transition-colors duration-200 border border-white/15 bg-white/10 backdrop-blur-md shadow-sm"
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <XMarkIcon className="block h-5 w-5" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-5 w-5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div 
          className={`fixed inset-0 z-[999] bg-black/85 backdrop-blur-md transition-all flex flex-col items-center pt-3 sm:pt-4 px-3 sm:px-6 ${
            isSearchActivated ? 'cursor-default' : 'cursor-pointer'
          }`}
          onClick={() => {
            if (!isSearchActivated) {
              setShowMobileSearch(false);
            }
          }}
        >
          <div 
            className="w-full max-w-xl relative animate-fadeInUp cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            <AutocompleteSearch
              menu
              onSelectMovie={() => {
                setShowMobileSearch(false);
                setIsSearchActivated(false);
              }}
              showClose
              onClose={() => {
                setShowMobileSearch(false);
                setIsSearchActivated(false);
              }}
              onFocusChange={(focused) => {
                if (focused) {
                  setIsSearchActivated(true);
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Mobile menu, show/hide based on menu state. */}
      <div
        className={`pointer-events-auto overflow-hidden bg-[#0a0c10]/95 backdrop-blur-lg text-white shadow-2xl shadow-black/90 rounded-2xl min-[700px]:hidden mx-3 border border-white/15 ring-1 ring-white/10 transition-all duration-300 ease-out origin-top ${
          isOpen
            ? 'mt-3 max-h-[85vh] opacity-100 scale-100'
            : 'mt-0 max-h-0 opacity-0 scale-95 border-transparent ring-0 pointer-events-none'
        }`}
      >
        <div className="overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="px-2.5 pt-2.5 pb-3 space-y-1.5 sm:px-3">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3.5 py-2.5 rounded-xl text-base font-bold transition-all duration-200 active:scale-[0.98] ${
                    isActive
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-white/90 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <item.icon className="h-5 w-5 stroke-[2.5]" />
                    <span>{t(`items.${item.key}`)}</span>
                  </div>
                </Link>
              );
            })}
            {/* More dropdown for mobile */}
            <button
              className={`flex items-center w-full px-3.5 py-2.5 rounded-xl text-base font-bold transition-all duration-200 active:scale-[0.98] ${
                isMoreActive
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-white/90 hover:bg-white/10 hover:text-white'
              }`}
              onClick={() => {
                const nextOpen = !isMobileMoreDropdownOpen
                setIsMobileMoreDropdownOpen(nextOpen)
                if (nextOpen) {
                  notifyHeaderDropdownOpen('more')
                  setIsMobileUserDropdownOpen(false)
                }
              }}
              aria-expanded={isMobileMoreDropdownOpen}
            >
              <QueueListIcon className="h-5 w-5" />
              <span>{t('more')}</span>
              <svg className={`ml-auto h-4 w-4 transition-transform duration-200 ${isMobileMoreDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <div
              className={`overflow-hidden transition-all duration-200 ease-out ${
                isMobileMoreDropdownOpen ? 'max-h-96 opacity-100 mt-1.5' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="bg-gray-950/80 backdrop-blur-md border border-white/15 divide-y divide-white/10 rounded-2xl shadow-xl p-1.5 space-y-1 ml-3">
                {moreNavItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
                  return item.key === 'game' ? (
                    <button
                      key={item.key}
                      onClick={handleGameClick}
                      className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-base font-bold text-left cursor-pointer transition-all duration-200 active:scale-[0.98] ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-white/90 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      <item.icon className="h-5 w-5 stroke-[2.5]" />
                      <span>{t(`items.${item.key}`)}</span>
                    </button>
                  ) : (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => { setIsOpen(false); setIsMobileMoreDropdownOpen(false); }}
                      className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-base font-bold transition-all duration-200 active:scale-[0.98] ${
                        isActive
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-white/90 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      <item.icon className="h-5 w-5 stroke-[2.5]" />
                      <span>{t(`items.${item.key}`)}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            {/* Mobile Watchlist, User/Login, Logout */}
            {!hydrated || isLoading ? (
              <div className="w-full px-3 mt-4">
                <div className="flex w-full items-center gap-2 rounded-md bg-gray-800 px-3 py-2">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gray-700 animate-pulse" />
                  <div className="h-4 min-w-0 flex-1 rounded bg-gray-700 animate-pulse" />
                </div>
              </div>
             ) : isAuthenticated ? (
              <div className="px-3 mt-4 space-y-2">
                <button
                  className={`flex w-full min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-base font-semibold transition-colors duration-300 mb-1 focus:outline-none ${
                    isUserActive
                      ? 'bg-white text-gray-900 border border-white/70 shadow-sm'
                      : 'bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/60'
                  }`}
                  onClick={() => {
                    const nextOpen = !isMobileUserDropdownOpen
                    setIsMobileUserDropdownOpen(nextOpen)
                    if (nextOpen) {
                      notifyHeaderDropdownOpen('user')
                      setIsMobileMoreDropdownOpen(false)
                    }
                  }}
                  aria-expanded={isMobileUserDropdownOpen}
                >
                  <div className="shrink-0">
                    <UserAvatar 
                      name={user?.name || 'User'} 
                      avatar={user?.avatar}
                      size="sm"
                      priority={true}
                    />
                  </div>
                  <span className="min-w-0 flex-1 truncate text-left">{user?.name || 'User'}</span>
                  <svg className={`ml-auto h-4 w-4 transition-transform ${isMobileUserDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </button>
                <div
                  className={`overflow-hidden transition-all duration-200 ease-out ${
                    isMobileUserDropdownOpen ? 'max-h-96 opacity-100 mt-1.5' : 'max-h-0 opacity-0'
                  }`}
                >
                  <div className="bg-gray-950/80 backdrop-blur-md border border-white/15 divide-y divide-white/10 rounded-2xl shadow-xl p-1.5 space-y-1">
                    <Link
                      href="/watchlist"
                      onClick={() => { setIsOpen(false); setIsMobileUserDropdownOpen(false); }}
                      className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-base font-bold transition-all duration-200 active:scale-[0.98] ${
                        pathname?.startsWith('/watchlist')
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-white/90 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      <BookmarkIcon className="h-5 w-5 stroke-[2.5]" />
                      <span>{t('watchlist')} ({watchlist.length})</span>
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => { setIsOpen(false); setIsMobileUserDropdownOpen(false); }}
                      className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-base font-bold transition-all duration-200 active:scale-[0.98] ${
                        pathname?.startsWith('/profile')
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-white/90 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      <UserIcon className="h-5 w-5 stroke-[2.5]" />
                      <span>{t('profile')}</span>
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => { setIsOpen(false); setIsMobileUserDropdownOpen(false); }}
                      className={`flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-base font-bold transition-all duration-200 active:scale-[0.98] ${
                        pathname?.startsWith('/settings')
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-white/90 hover:bg-white/15 hover:text-white'
                      }`}
                    >
                      <Settings className="h-5 w-5 stroke-[2.5]" />
                      <span>{t('settings')}</span>
                    </Link>
                    <button
                      onClick={async () => {
                        await logout();
                        toast.success(t('loggedOut'));
                        setIsOpen(false);
                        setIsMobileUserDropdownOpen(false);
                      }}
                      className="block w-full text-left px-3.5 py-2.5 rounded-xl text-base font-bold transition-all duration-200 text-red-400 hover:bg-red-600/20 hover:text-red-300 active:scale-[0.98]"
                    >
                      <div className="flex items-center space-x-2.5">
                        <LogOut className="h-5 w-5 stroke-[2.5]" />
                        <span>{t('logout')}</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-3 mt-4 space-y-2">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)} // Close menu on click
                  className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 rounded-xl text-base font-semibold bg-emerald-950/60 border border-emerald-700/50 text-emerald-400 hover:bg-emerald-900/60 transition-colors shadow-sm"
                >
                  <UserIcon className="h-5 w-5" />
                  <span>{t('login')}</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center space-x-2 w-full px-4 py-2 rounded-md text-base font-medium bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
                >
                  <Settings className="h-5 w-5" />
                  <span>{t('settings')}</span>
                </Link>
              </div>
            )}

            {/* Mobile App Downloads */}
            <div className="px-3 py-3 border-t border-gray-800 mt-4 space-y-2.5">
              <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{t('mobileAppDownload')}</p>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setAppModalOpen(true);
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-950/60 border border-blue-700/50 text-blue-400 hover:bg-blue-900/60 transition-colors shadow-sm cursor-pointer"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>{t('viewInstructions')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      </nav>
      <AnimatePresence>{isAppModalOpen && <AppDownloadModal />}</AnimatePresence>
    </>
  )
}
