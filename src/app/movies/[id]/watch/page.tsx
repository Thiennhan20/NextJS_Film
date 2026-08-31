import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import MovieWatchClient from './MovieWatchClient'

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
