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

function applySecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  return response;
}

export function middleware(request: NextRequest) {
  const { searchParams, pathname } = request.nextUrl;

  // Skip static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Apply security headers to API routes
  if (pathname.startsWith('/api')) {
    const response = NextResponse.next();
    return applySecurityHeaders(response);
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

  const response = NextResponse.next();
  applySecurityHeaders(response);

  // Update cookie if it differs from target
  if (cookieLocale !== targetLocale) {
    response.cookies.set('locale', targetLocale, {
      path: '/',
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: 'lax',
    });
  }

  return response;
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
