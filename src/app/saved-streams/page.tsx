import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import SavedStreamsClient from './SavedStreamsClient';

export default async function SavedStreamsPage() {
  const messages = await getMessages();

  const pageMessages = {
    StreamingLobby: messages.StreamingLobby,
    Profile: messages.Profile,
  };

  return (
    <NextIntlClientProvider messages={pageMessages}>
      <SavedStreamsClient />
    </NextIntlClientProvider>
  );
}
