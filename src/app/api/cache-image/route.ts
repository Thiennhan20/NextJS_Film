import { NextRequest, NextResponse } from 'next/server';
import { getCachedImage, cacheImage } from '@/lib/supabaseImageCache';
import { getCachedImageFromTelegram, cacheImageToTelegram, telegramImageCacheDB } from '@/lib/telegramImageCache';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get('url');
  const id = searchParams.get('id');
  const type = searchParams.get('type') as 'poster' | 'backdrop' | 'scene' || 'poster';
  const bust = searchParams.get('bust'); // Cache busting parameter
  
  if (!url || !id) {
    return new NextResponse('Missing url or id', { status: 400 });
  }

  console.log('Cache image request:', { id, url, type, bust });

  // ===== STRATEGY 1: Supabase (Primary) =====
  try {
    // Check Supabase cache first
    const supabaseUrl = await getCachedImage(id, url, type);
    if (supabaseUrl) {
      console.log('[Supabase] Cache HIT → redirect:', supabaseUrl);
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
    console.log('[Supabase] Cache MISS → uploading...');
    const newPublicUrl = await cacheImage(id, url, type);
    console.log('[Supabase] Uploaded → redirect:', newPublicUrl);
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

  // ===== STRATEGY 2: Telegram (Fallback — giữ nguyên code cũ) =====
  try {
    // Kiểm tra Telegram cache
    const cached = await getCachedImageFromTelegram(id, url);
    if (cached) {
      console.log('[Telegram] Found cached image:', cached);
      const response = await fetch(cached);
      if (!response.ok) {
        console.log('[Telegram] Fetch failed, removing from cache and retrying');
        await telegramImageCacheDB.delete(id, url);
        throw new Error('Telegram fetch failed');
      }
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Cache-Control': 'public, max-age=86400',
          'X-Source': 'telegram-cache',
          'ETag': `"${id}-${Date.now()}"`,
        },
      });
    }

    // Cache miss → upload to Telegram
    console.log('[Telegram] No cache found, uploading...');
    const telegramUrl = await cacheImageToTelegram(id, url, type);
    console.log('[Telegram] Uploaded:', telegramUrl);

    const response = await fetch(telegramUrl);
    if (!response.ok) {
      throw new Error('New Telegram fetch failed');
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=86400',
        'X-Source': 'telegram-new',
        'ETag': `"${id}-${Date.now()}"`,
      },
    });
  } catch (telegramError) {
    console.error('[Telegram] Failed, falling back to original URL:', telegramError);
  }

  // ===== STRATEGY 3: Direct proxy from original URL (Last resort) =====
  try {
    console.log('[Fallback] Proxying from original URL:', url);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Original URL fetch failed');
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=3600',
        'X-Source': 'fallback',
        'ETag': `"${id}-fallback-${Date.now()}"`,
      },
    });
  } catch (fallbackError) {
    console.error('[Fallback] All strategies failed:', fallbackError);
    return new NextResponse('Error fetching image', { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      }
    });
  }
}
