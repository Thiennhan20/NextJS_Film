import { NextRequest, NextResponse } from 'next/server';

const SUPPORTED_LOCALES = ['en', 'vi'];

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

  const langParam = searchParams.get('lang') || searchParams.get('locale');
  const cookieLocaleRaw = request.cookies.get('locale')?.value;

  const paramLocale = parseLocale(langParam);
  const cookieLocale = parseLocale(cookieLocaleRaw);

  // Determine target locale: URL param > cookie > default 'en'
  let targetLocale: string;
  if (paramLocale) {
    targetLocale = paramLocale;
  } else if (cookieLocale) {
    targetLocale = cookieLocale;
  } else {
    targetLocale = 'en';
  }

  // Update cookie if it differs from target
  if (cookieLocale !== targetLocale) {
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
