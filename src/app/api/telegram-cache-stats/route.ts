import { NextResponse } from 'next/server';
import { telegramImageCacheDB } from '@/lib/telegramImageCache';
import { getSupabaseCacheStats } from '@/lib/supabaseImageCache';

export async function GET() {
  try {
    const [supabaseStats] = await Promise.all([
      getSupabaseCacheStats(),
    ]);

    const stats = {
      supabase: supabaseStats,
      telegram: {
        size: telegramImageCacheDB.getSize(),
        keys: telegramImageCacheDB.getKeys(),
        botConfigured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return NextResponse.json({ error: 'Failed to get cache stats' }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    await telegramImageCacheDB.clear();
    return NextResponse.json({ message: 'Telegram cache cleared successfully' });
  } catch (error) {
    console.error('Error clearing Telegram cache:', error);
    return NextResponse.json({ error: 'Failed to clear cache' }, { status: 500 });
  }
}
