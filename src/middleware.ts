import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'vi'];
const LOCALE_TO_FULL: Record<string, string> = {
  en: 'en-US',
  vi: 'vi-VN',
};

/**
 * Extracts base locale from "vi-VN" → "vi", "en-US" → "en"
 */
function parseLocale(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const base = raw.split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(base) ? base : null;
}

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;

  // Skip static files, API routes, and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  const langParam = searchParams.get('lang');
  const cookieLocaleRaw = request.cookies.get('locale')?.value;

  const paramLocale = parseLocale(langParam);
  const cookieLocale = parseLocale(cookieLocaleRaw);

  // Check if navigation is internal or external
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  let isInternalNavigation = false;
  if (referer && host) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host === host) {
        isInternalNavigation = true;
      }
    } catch {
      // Ignore invalid URL
    }
  }

  // Determine target locale:
  // - If URL has a param AND (either cookie is empty OR it is an external direct entry), URL param wins
  // - Otherwise, cookie wins (keeps active preference persistent across history and routes)
  let targetLocale: string;
  if (paramLocale && (!cookieLocale || !isInternalNavigation)) {
    targetLocale = paramLocale;
  } else if (cookieLocale) {
    targetLocale = cookieLocale;
  } else {
    targetLocale = 'en';
  }

  // Check if URL or Cookie needs updating to match targetLocale
  const cookieNeedsUpdate = cookieLocale !== targetLocale;
  
  // URL matches if:
  // - targetLocale is 'en' and no langParam is present
  // - targetLocale is 'vi' and langParam matches 'vi'
  const urlMatches =
    targetLocale === 'en'
      ? !langParam
      : paramLocale === targetLocale;

  if (!urlMatches) {
    const url = request.nextUrl.clone();
    if (targetLocale === 'en') {
      url.searchParams.delete('lang');
    } else {
      url.searchParams.set('lang', LOCALE_TO_FULL[targetLocale] || `${targetLocale}-${targetLocale.toUpperCase()}`);
    }
    
    const response = NextResponse.redirect(url);
    if (cookieNeedsUpdate) {
      response.cookies.set('locale', targetLocale, {
        path: '/',
        maxAge: 365 * 24 * 60 * 60, // 1 year
        sameSite: 'lax',
      });
    }
    return response;
  }

  // If URL matches, but cookie still needs update
  if (cookieNeedsUpdate) {
    const response = NextResponse.next();
    response.cookies.set('locale', targetLocale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: 'lax',
    });
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
