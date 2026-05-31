'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MagnifyingGlassIcon, 
  Bars3Icon, 
  XMarkIcon,
  HomeIcon,
  FilmIcon,
  NewspaperIcon,
  UserGroupIcon,
  QuestionMarkCircleIcon,
  EnvelopeIcon,
  BookmarkIcon,
  UserIcon,
  QueueListIcon,
  PlayCircleIcon
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/useAuthStore'
import { Menu, Transition } from '@headlessui/react'
import { Fragment } from 'react'
import { toast } from 'react-hot-toast'
import { LogOut, Settings } from 'lucide-react';
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
  { key: 'news', href: '/news', icon: NewspaperIcon },
  { key: 'about', href: '/about', icon: UserGroupIcon },
  { key: 'faq', href: '/faq', icon: QuestionMarkCircleIcon },
  { key: 'contact', href: '/contact', icon: EnvelopeIcon },
  { key: 'streaming', href: '/streaming-lobby', icon: PlayCircleIcon },
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
  const { user, isAuthenticated, logout, isLoading } = useAuthStore()
  const { setNavDropdownOpen, setAppModalOpen, isAppModalOpen } = useUIStore();
  const { watchlist } = useWatchlistStore();
  const hydrated = useAuthHydrated();
  const t = useTranslations('Navigation');

  const [isMoreDropdownActive, setIsMoreDropdownActive] = useState(false);
  const [isProfileDropdownActive, setIsProfileDropdownActive] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileUserDropdownOpen, setIsMobileUserDropdownOpen] = useState(false);
  const [isMobileMoreDropdownOpen, setIsMobileMoreDropdownOpen] = useState(false);
  
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


  const HEADER_HEIGHT = 64

  return (
    <>
      {/* Header */}
      <nav
        style={{ height: HEADER_HEIGHT }}
        className={`fixed w-full z-50 ${
          isScrolled ? 'bg-black/90 backdrop-blur-md' : 'bg-white shadow-lg'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
          {/* Enhanced Logo */}
          <Logo isScrolled={isScrolled} variant="header" />

          {/* Desktop Navigation */}
          <div className="hidden min-[700px]:flex items-center gap-2.5">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  className={`${getDesktopMainNavVisibilityClass(item.key)} relative flex h-10 shrink-0 items-center whitespace-nowrap px-4 py-2 rounded-lg transition-colors ${
                    isActive 
                      ? 'text-red-500' 
                      : isScrolled 
                        ? 'text-white hover:text-red-500' 
                        : 'text-gray-700 hover:text-red-500'
                  }`}
                >
                  <motion.div
                    className="flex items-center space-x-2 whitespace-nowrap"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{t(`items.${item.key}`)}</span>
                  </motion.div>
                  {isActive && (
                    <motion.div
                      layoutId="activeNav"
                      className="absolute bottom-0 left-0 right-0 h-0.5 bg-red-500"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.2 }}
                    />
                  )}
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
                  className={`flex h-10 shrink-0 items-center space-x-2 whitespace-nowrap px-4 py-2 rounded-lg transition-colors ${
                    isScrolled ? 'text-white hover:text-red-500' : 'text-gray-700 hover:text-red-500'
                  }`}
                >
                  <QueueListIcon className="h-5 w-5" />
                  <span>{t('more')}</span>
                  <span className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white min-[900px]:inline-flex min-[1200px]:hidden">
                    1
                  </span>
                  <span className="ml-1 hidden h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-xs text-white max-[899px]:inline-flex">
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
                beforeEnter={() => setIsMoreDropdownActive(true)}
                afterLeave={() => setIsMoreDropdownActive(false)}
              >
                <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-gray-900 backdrop-blur-md divide-y divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-60">
                  {/* Hidden nav items first */}
                  <div className="hidden px-1 py-1 max-[1199px]:block">
                      {desktopOverflowNavItems.map((item) => (
                        <Menu.Item key={item.key}>
                          {({ active }) => (
                            <Link
                              href={item.href}
                              className={`${getDesktopMoreNavVisibilityClass(item.key)} items-center space-x-2 px-4 py-2 rounded-md ${
                                active ? 'bg-red-500 text-white' : 'text-gray-300'
                              }`}
                            >
                              <item.icon className="h-5 w-5" />
                              <span>{t(`items.${item.key}`)}</span>
                            </Link>
                          )}
                        </Menu.Item>
                      ))}
                    </div>
                  {/* Original more items */}
                  <div className="px-1 py-1">
                    {moreNavItems.map((item) => (
                      <Menu.Item key={item.key}>
                        {({ active }) => (
                          <Link
                            href={item.href}
                            className={`flex items-center space-x-2 px-4 py-2 rounded-md ${
                              active ? 'bg-red-500 text-white' : 'text-gray-300'
                            }`}
                          >
                            <item.icon className="h-5 w-5" />
                            <span>{t(`items.${item.key}`)}</span>
                          </Link>
                        )}
                      </Menu.Item>
                    ))}
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
              className={`p-2 rounded-full transition-colors min-[1050px]:hidden ${
                isScrolled ? 'text-white hover:text-red-500' : 'text-gray-700 hover:text-red-500'
              }`}
              aria-label="Open search"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>
            
            <NotificationBell isScrolled={isScrolled} />

            {/* Download App Button */}
            <button
              onClick={() => setAppModalOpen(true, 'ios')}
              className={`flex h-10 shrink-0 items-center space-x-1.5 whitespace-nowrap px-4 py-2 rounded-lg border transition-all duration-300 font-semibold text-sm cursor-pointer shadow-sm hover:shadow-md ${
                isScrolled
                  ? 'bg-white/10 border-white/15 text-white hover:border-blue-500/50 hover:bg-white/15'
                  : 'bg-blue-50/70 border-blue-200/80 text-blue-600 hover:border-blue-400 hover:bg-blue-100/70'
              }`}
            >
              <svg className={`h-4.5 w-4.5 transition-colors duration-300 ${isScrolled ? 'text-blue-400' : 'text-blue-650'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
              <span className="hidden lg:inline">{t('downloadApp')}</span>
              <span className="inline lg:hidden">{t('downloadAppShort')}</span>
            </button>
            <div className="flex shrink-0 items-center justify-end">
              {!hydrated || isLoading ? (
                <div className="h-9 w-9 rounded-full bg-gray-300 animate-pulse shrink-0" />
              ) : isAuthenticated ? (
                <div className="flex items-center">
                  <Menu as="div" className="relative inline-block text-left">
                  {({ close }) => (
                  <>
                  <HeaderDropdownAutoClose source="user" close={close} />
                  <div>
                    <Menu.Button
                      onClick={() => notifyHeaderDropdownOpen('user')}
                      className={`inline-flex items-center justify-center p-0.5 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer overflow-hidden shadow-sm hover:shadow-md ${
                        isScrolled
                          ? 'bg-white/10 border-white/15 hover:border-emerald-500/50 hover:bg-white/15'
                          : 'bg-emerald-50/70 border-emerald-200/80 hover:border-emerald-400 hover:bg-emerald-100/70'
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
                    <Menu.Items className="absolute right-0 mt-2 w-56 origin-top-right bg-gray-900 backdrop-blur-md divide-y divide-gray-700 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-60 border border-gray-700">
                      <div className="px-1 py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              href="/profile"
                              className={`w-full flex items-center space-x-2 text-left px-3 py-2 rounded-md text-sm text-gray-300 ${
                                active ? 'bg-gray-700 text-white' : 'hover:bg-gray-800 hover:text-white'
                              }`}
                            >
                              <UserIcon className="h-5 w-5" />
                              <span className="whitespace-nowrap">{t('profile')}</span>
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              href="/watchlist"
                              className={`w-full flex items-center space-x-2 text-left px-3 py-2 rounded-md text-sm text-gray-300 ${
                                active ? 'bg-gray-700 text-white' : 'hover:bg-gray-800 hover:text-white'
                              }`}
                            >
                              <BookmarkIcon className="h-5 w-5" />
                              <span className="whitespace-nowrap">{t('watchlist')} ({watchlist.length})</span>
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              href="/settings"
                              className={`w-full flex items-center space-x-2 text-left px-3 py-2 rounded-md text-sm text-gray-300 ${
                                active ? 'bg-gray-700 text-white' : 'hover:bg-gray-800 hover:text-white'
                              }`}
                            >
                              <Settings className="h-5 w-5" />
                              <span className="whitespace-nowrap">{t('settings')}</span>
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={async () => {
                                await logout();
                                toast.success(t('loggedOut'));
                              }}
                              className={`w-full text-left px-3 py-2 rounded-md text-sm text-gray-300 ${
                                active ? 'bg-red-500 text-white' : 'hover:bg-gray-800 hover:text-white'
                              }`}
                            >
                              <div className="flex items-center space-x-2">
                                <LogOut className="h-5 w-5" />
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
                    className={`inline-flex items-center justify-center p-2 rounded-full border transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer shadow-sm hover:shadow-md ${
                      isScrolled
                        ? 'bg-white/10 border-white/15 text-emerald-400 hover:text-emerald-300 hover:bg-white/15'
                        : 'bg-emerald-50/70 border-emerald-200/80 text-emerald-600 hover:border-emerald-400 hover:bg-emerald-100/70'
                    }`}
                    aria-label={t('login')}
                  >
                    <UserIcon className="h-5 w-5" />
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
                    <Menu.Items className="absolute right-0 mt-2 w-44 origin-top-right rounded-md bg-gray-900 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-60 border border-gray-700">
                      <div className="px-1 py-1">
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              href="/login"
                              className={`flex items-center space-x-2 rounded-md px-3 py-2 text-sm ${
                                active ? 'bg-red-500 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                              }`}
                            >
                              <UserIcon className="h-5 w-5" />
                              <span className="whitespace-nowrap">{t('login')}</span>
                            </Link>
                          )}
                        </Menu.Item>
                        <Menu.Item>
                          {({ active }) => (
                            <Link
                              href="/settings"
                              className={`flex items-center space-x-2 rounded-md px-3 py-2 text-sm ${
                                active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                              }`}
                            >
                              <Settings className="h-5 w-5" />
                              <span className="whitespace-nowrap">{t('settings')}</span>
                            </Link>
                          )}
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
              }}
              className="p-1.5 rounded-full bg-white shadow border border-red-200 text-red-600 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-400 transition"
              aria-label="Open search"
              style={{ boxShadow: '0 2px 8px 0 rgba(0,0,0,0.08)' }}
            >
              <MagnifyingGlassIcon className="h-4 w-4" />
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
              className={`inline-flex items-center justify-center p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-inset focus:ring-red-500 transition-colors duration-200 ${
                'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <span className="sr-only">Open main menu</span>
              {isOpen ? (
                <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {showMobileSearch && (
        <div className="fixed inset-0 z-[999] flex flex-col items-start justify-start bg-black/60 backdrop-blur-[4px] transition-all">
          <div className="w-full flex justify-center pt-4 animate-fadeInUp">
            <div className="w-full max-w-md mx-2 relative">
              <AutocompleteSearch
                menu
                onSelectMovie={() => {
                  setShowMobileSearch(false);
                }}
                inputClassName="text-lg px-6 py-4 border-2 border-red-500 bg-gray-900 text-white placeholder-gray-300 focus:bg-gray-900 focus:ring-2 focus:ring-red-500 shadow-lg"
                showClose
                onClose={() => {
                  setShowMobileSearch(false);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Mobile menu, show/hide based on menu state. */}
      <motion.div
        className="overflow-hidden bg-white shadow-lg min-[700px]:hidden"
        initial={false}
        animate={{
          height: isOpen ? 'auto' : 0,
          opacity: isOpen ? 1 : 0
        }}
        transition={{
          duration: 0.3,
          ease: [0.4, 0, 0.2, 1],
          opacity: { duration: 0.2 }
        }}
      >
        <div className="overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
            {mainNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setIsOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium ${
                    isActive
                      ? 'bg-red-500 text-white'
                      : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                  }`}
                >
                  <motion.div className="flex items-center space-x-2" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                    <item.icon className="h-5 w-5" />
                    <span>{t(`items.${item.key}`)}</span>
                  </motion.div>
                </Link>
              );
            })}
            {/* More dropdown for mobile */}
            <button
              className="flex items-center w-full px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900 focus:outline-none"
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
              <svg className={`ml-auto h-4 w-4 transition-transform ${isMobileMoreDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <motion.div
              initial={false}
              animate={{
                height: isMobileMoreDropdownOpen ? 'auto' : 0,
                opacity: isMobileMoreDropdownOpen ? 1 : 0
              }}
              transition={{
                duration: 0.2,
                ease: [0.4, 0, 0.2, 1]
              }}
              className="overflow-hidden"
            >
              <div className="pl-6 space-y-1">
                {moreNavItems.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => { setIsOpen(false); setIsMobileMoreDropdownOpen(false); }}
                      className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium ${
                        isActive
                          ? 'bg-red-500 text-white'
                          : 'text-gray-700 hover:bg-gray-200 hover:text-gray-900'
                      }`}
                    >
                      <item.icon className="h-5 w-5" />
                      <span>{t(`items.${item.key}`)}</span>
                    </Link>
                  );
                })}
              </div>
            </motion.div>
            {/* Mobile Watchlist, User/Login, Logout */}
            {!hydrated || isLoading ? (
              <div className="w-full px-3 mt-4">
                <div className="flex w-full items-center gap-2 rounded-md bg-gray-100 px-3 py-2">
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gray-300 animate-pulse" />
                  <div className="h-4 min-w-0 flex-1 rounded bg-gray-300 animate-pulse" />
                </div>
              </div>
             ) : isAuthenticated ? (
              <div className="px-3 mt-4 space-y-2">
                <button
                  className="flex w-full min-w-0 items-center gap-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80 px-3 py-2.5 text-base font-semibold text-emerald-700 mb-1 focus:outline-none hover:bg-emerald-100/70 transition-colors duration-300"
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
                <motion.div
                  initial={false}
                  animate={{
                    height: isMobileUserDropdownOpen ? 'auto' : 0,
                    opacity: isMobileUserDropdownOpen ? 1 : 0
                  }}
                  transition={{
                    duration: 0.2,
                    ease: [0.4, 0, 0.2, 1]
                  }}
                  className="overflow-hidden"
                >
                  <div className="bg-gray-50 rounded-md divide-y divide-gray-200 shadow-sm">
                    <Link
                      href="/watchlist"
                      onClick={() => { setIsOpen(false); setIsMobileUserDropdownOpen(false); }}
                      className="flex items-center space-x-2 px-3 py-2 rounded-t-md text-base font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                    >
                      <BookmarkIcon className="h-5 w-5" />
                      <span>{t('watchlist')} ({watchlist.length})</span>
                    </Link>
                    <Link
                      href="/profile"
                      onClick={() => { setIsOpen(false); setIsMobileUserDropdownOpen(false); }}
                      className="flex items-center space-x-2 px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                    >
                      <UserIcon className="h-5 w-5" />
                      <span>{t('profile')}</span>
                    </Link>
                    <Link
                      href="/settings"
                      onClick={() => { setIsOpen(false); setIsMobileUserDropdownOpen(false); }}
                      className="flex items-center space-x-2 px-3 py-2 rounded-b-md text-base font-medium text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                    >
                      <Settings className="h-5 w-5" />
                      <span>{t('settings')}</span>
                    </Link>
                    <button
                      onClick={async () => {
                        await logout();
                        toast.success(t('loggedOut'));
                        setIsOpen(false);
                        setIsMobileUserDropdownOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 mt-2 text-red-600 hover:bg-gray-100 hover:text-red-700 border-t border-gray-200"
                    >
                      <div className="flex items-center space-x-2">
                        <LogOut className="h-5 w-5" />
                        <span>{t('logout')}</span>
                      </div>
                    </button>
                  </div>
                </motion.div>
              </div>
            ) : (
              <div className="px-3 mt-4 space-y-2">
                <Link
                  href="/login"
                  onClick={() => setIsOpen(false)} // Close menu on click
                  className="flex items-center justify-center space-x-2 w-full px-4 py-2.5 rounded-xl text-base font-semibold bg-emerald-50 border border-emerald-200/80 text-emerald-600 hover:bg-emerald-100 transition-colors shadow-sm"
                >
                  <UserIcon className="h-5 w-5" />
                  <span>{t('login')}</span>
                </Link>
                <Link
                  href="/settings"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-center space-x-2 w-full px-4 py-2 rounded-md text-base font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
                >
                  <Settings className="h-5 w-5" />
                  <span>{t('settings')}</span>
                </Link>
              </div>
            )}

            {/* Mobile App Downloads */}
            <div className="px-3 py-3 border-t border-gray-200 mt-4 space-y-2.5">
              <p className="text-xs text-gray-400 font-medium tracking-wide uppercase">{t('mobileAppDownload')}</p>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setAppModalOpen(true);
                }}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-blue-50 border border-blue-200/80 text-blue-600 hover:bg-blue-100/70 transition-colors shadow-sm cursor-pointer"
              >
                <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>{t('viewInstructions')}</span>
              </button>
            </div>
          </div>
        </div>
      </motion.div>
      </nav>
      <AnimatePresence>{isAppModalOpen && <AppDownloadModal />}</AnimatePresence>
    </>
  )
}
