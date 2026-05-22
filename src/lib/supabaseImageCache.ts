// Supabase Image Cache - Primary storage for movie poster/backdrop images
// Falls back to Telegram cache if Supabase is unavailable

import { supabaseAdmin, getSupabasePublicUrl } from './supabase'

const BUCKET_NAME = 'movie-images'

/**
 * Build the storage path for an image in Supabase Storage.
 * Example: posters/movie_123.jpg, backdrops/tv_456.jpg
 */
function buildStoragePath(id: string, type: 'poster' | 'backdrop' | 'scene'): string {
  const folder = type === 'poster' ? 'posters' : type === 'backdrop' ? 'backdrops' : 'scenes'
  // Sanitize id to avoid path issues
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '_')
  return `${folder}/${safeId}.jpg`
}

/**
 * Check Supabase DB for a cached image. Returns public CDN URL or null.
 * If the original URL has changed (TMDB updated poster), returns null to trigger re-upload.
 */
export async function getCachedImage(
  id: string,
  url: string,
  type: 'poster' | 'backdrop' | 'scene' = 'poster'
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('image_cache')
      .select('public_url, original_url')
      .eq('tmdb_id', id)
      .eq('type', type)
      .single()

    if (error || !data) {
      return null
    }

    // URL changed → poster updated on TMDB → need to re-upload
    if (data.original_url !== url) {
      console.log(`[SupabaseImageCache] URL changed for ${id}, will re-upload`)
      return null
    }

    return data.public_url
  } catch (err) {
    console.error('[SupabaseImageCache] Error checking cache:', err)
    return null
  }
}

/**
 * Fetch image from source URL, upload to Supabase Storage, save record to DB.
 * Returns the public CDN URL.
 */
export async function cacheImage(
  id: string,
  url: string,
  type: 'poster' | 'backdrop' | 'scene' = 'poster'
): Promise<string> {
  const storagePath = buildStoragePath(id, type)

  // 1. Fetch the image from the original URL (TMDB)
  console.log('[SupabaseImageCache] Fetching image from:', url)
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch image from ${url}: ${response.status}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  const contentType = response.headers.get('content-type') || 'image/jpeg'

  console.log('[SupabaseImageCache] Uploading to Storage:', storagePath, `(${buffer.length} bytes)`)

  // 2. Upload to Supabase Storage
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET_NAME)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true, // Overwrite if exists
      cacheControl: '31536000', // 1 year cache (images don't change)
    })

  if (uploadError) {
    throw new Error(`Failed to upload to Supabase Storage: ${uploadError.message}`)
  }

  // 3. Build the public URL
  const publicUrl = getSupabasePublicUrl(storagePath)
  console.log('[SupabaseImageCache] Public URL:', publicUrl)

  // 4. Save record to image_cache table
  const { error: dbError } = await supabaseAdmin
    .from('image_cache')
    .upsert(
      {
        tmdb_id: id,
        type,
        original_url: url,
        storage_path: storagePath,
        public_url: publicUrl,
        file_size: buffer.length,
      },
      {
        onConflict: 'tmdb_id,type',
      }
    )

  if (dbError) {
    // Non-critical: image is already uploaded, just log the DB error
    console.error('[SupabaseImageCache] Failed to save DB record:', dbError.message)
  }

  return publicUrl
}

/**
 * Get Supabase cache statistics for the stats endpoint.
 */
export async function getSupabaseCacheStats(): Promise<{
  totalImages: number
  totalSizeBytes: number
  configured: boolean
}> {
  try {
    const isConfigured = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)

    if (!isConfigured) {
      return { totalImages: 0, totalSizeBytes: 0, configured: false }
    }

    // Count total images
    const { count, error: countError } = await supabaseAdmin
      .from('image_cache')
      .select('*', { count: 'exact', head: true })

    // Sum total file size
    const { data: sizeData, error: sizeError } = await supabaseAdmin
      .rpc('sum_image_cache_size')

    if (countError) {
      console.error('[SupabaseImageCache] Stats count error:', countError.message)
    }
    if (sizeError) {
      // RPC might not exist yet, fallback to 0
      console.warn('[SupabaseImageCache] Stats size RPC not available:', sizeError.message)
    }

    return {
      totalImages: count || 0,
      totalSizeBytes: sizeData || 0,
      configured: true,
    }
  } catch (err) {
    console.error('[SupabaseImageCache] Error getting stats:', err)
    return { totalImages: 0, totalSizeBytes: 0, configured: false }
  }
}
