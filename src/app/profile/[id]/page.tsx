import type { Metadata } from 'next';
import { getMessages } from 'next-intl/server';
import { NextIntlClientProvider } from 'next-intl';
import PublicProfileClient from './PublicProfileClient';

type Props = {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  try {
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
    const res = await fetch(`${apiBase}/auth/profile/${id}`, { next: { revalidate: 60 } });
    if (res.ok) {
      const data = await res.json();
      const name = data.user?.name || 'Hồ sơ người dùng';
      const username = data.user?.username ? `@${data.user.username}` : '';
      const title = username ? `${name} (${username})` : name;
      return {
        title: `${title} | NTN Stream`,
        description: `Xem trang cá nhân của ${name} trên NTN Stream.`,
        openGraph: {
          title: `${title} | NTN Stream`,
          description: `Xem trang cá nhân của ${name} trên NTN Stream.`,
          images: data.user?.avatar ? [data.user.avatar] : []
        }
      };
    }
  } catch {
    // fallback
  }

  return {
    title: 'Hồ sơ người dùng | NTN Stream',
  };
}

export default async function PublicProfilePage({ params }: Props) {
  const resolvedParams = await params;
  const messages = await getMessages();
  
  const userMessages = {
    Profile: messages.Profile,
  };

  return (
    <NextIntlClientProvider messages={userMessages}>
      <PublicProfileClient userId={resolvedParams.id} />
    </NextIntlClientProvider>
  );
}
