import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import TVShowWatchClient from './TVShowWatchClient'

export default async function TVShowWatchRoute({ params }: { params: Promise<{ id: string }> }) {
  const messages = await getMessages()
  const resolvedParams = await params
  const cleanId = (resolvedParams.id || '').replace(/-(vietsub|dubbed)$/i, '')

  return (
    <NextIntlClientProvider
      messages={{
        TVShows: messages.TVShows,
        CinemaWatch: messages.CinemaWatch,
        RelatedContent: messages.RelatedContent,
        Watch: messages.Watch,
        Comments: messages.Comments,
        Watchlist: messages.Watchlist,
        StreamingLobby: messages.StreamingLobby,
      }}
    >
      <TVShowWatchClient id={cleanId} />
    </NextIntlClientProvider>
  )
}
