import { NextRequest, NextResponse } from 'next/server';
import { getCachedImage, cacheImage } from '@/lib/supabaseImageCache';
import { getCachedImageFromTelegram, cacheImageToTelegram, telegramImageCacheDB } from '@/lib/telegramImageCache';

// Run on Edge for faster cold starts and lower CPU usage
export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const id = searchParams.get('id');
  const type = searchParams.get('type') as 'poster' | 'backdrop' | 'scene' || 'poster';

  if (!url || !id) {
    return new NextResponse('Missing url or id', { status: 400 });
  }

  // ===== STRATEGY 1: Supabase (Primary) =====
  try {
    // Check Supabase cache first
    const supabaseUrl = await getCachedImage(id, url, type);
    if (supabaseUrl) {
      // Redirect to Supabase CDN URL (no proxy needed, saves bandwidth)
      return NextResponse.redirect(supabaseUrl, {
        status: 302,
        headers: {
          'Cache-Control': 'public, max-age=86400',
          'X-Source': 'supabase-cache',
        },
      });
    }

    // Cache miss → fetch from TMDB, upload to Supabase
    const newPublicUrl = await cacheImage(id, url, type);
    return NextResponse.redirect(newPublicUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'X-Source': 'supabase-new',
      },
    });
  } catch (supabaseError) {
    console.error('[Supabase] Failed, falling back to Telegram:', supabaseError);
  }

  // ===== STRATEGY 2: Telegram (Fallback — redirect only, no body proxy) =====
  try {
    // Check Telegram cache
    const cached = await getCachedImageFromTelegram(id, url);
    if (cached) {
      // Redirect to Telegram file URL instead of proxying body
      return NextResponse.redirect(cached, {
        status: 302,
        headers: {
          'Cache-Control': 'public, max-age=86400',
          'X-Source': 'telegram-cache',
        },
      });
    }

    // Cache miss → upload to Telegram, then redirect
    const telegramUrl = await cacheImageToTelegram(id, url, type);
    return NextResponse.redirect(telegramUrl, {
      status: 302,
      headers: {
        'Cache-Control': 'public, max-age=86400',
        'X-Source': 'telegram-new',
      },
    });
  } catch (telegramError) {
    console.error('[Telegram] Failed, falling back to original URL:', telegramError);
    // Remove broken Telegram cache entry
    try {
      await telegramImageCacheDB.delete(id, url);
    } catch {
      // ignore cleanup errors
    }
  }

  // ===== STRATEGY 3: Redirect to original URL (Last resort — zero CPU) =====
  return NextResponse.redirect(url, {
    status: 302,
    headers: {
      'Cache-Control': 'public, max-age=3600',
      'X-Source': 'fallback-redirect',
    },
  });
}
