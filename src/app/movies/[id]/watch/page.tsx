import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import MovieWatchClient from './MovieWatchClient'

// ISR: Cache trang tĩnh 1 tiếng trên Vercel CDN
// Link xem phim (m3u8, embed) luôn được fetch real-time ở client, không bị ảnh hưởng bởi cache
export const revalidate = 3600;

export default async function MovieWatchRoute({ params }: { params: Promise<{ id: string }> }) {
  const messages = await getMessages()
  const resolvedParams = await params
  const cleanId = (resolvedParams.id || '').replace(/-(vietsub|dubbed)$/i, '')

  return (
    <NextIntlClientProvider
      messages={{
        Movies: messages.Movies,
        CinemaWatch: messages.CinemaWatch,
        RelatedContent: messages.RelatedContent,
        Watch: messages.Watch,
        Comments: messages.Comments,
        Watchlist: messages.Watchlist,
        StreamingLobby: messages.StreamingLobby,
      }}
    >
      <MovieWatchClient id={cleanId} />
    </NextIntlClientProvider>
  )
}
