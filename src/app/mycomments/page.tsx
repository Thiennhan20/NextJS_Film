import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import MyCommentsClient from './MyCommentsClient';

export default async function MyCommentsPage() {
  const messages = await getMessages();
  
  const userMessages = {
    Profile: messages.Profile,
    UserComments: messages.UserComments
  };

  return (
    <NextIntlClientProvider messages={userMessages}>
      <MyCommentsClient />
    </NextIntlClientProvider>
  );
}
