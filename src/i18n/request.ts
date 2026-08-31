import { cookies } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';

const SUPPORTED_LOCALES = ['en', 'vi'];

/**
 * Extracts the base locale code from a lang param like "vi-VN" → "vi", "en-US" → "en"
 */
function parseLocale(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const base = raw.split('-')[0].toLowerCase();
  return SUPPORTED_LOCALES.includes(base) ? base : null;
}

export default getRequestConfig(async () => {
  const store = await cookies();

  // Priority: cookie (set by middleware from ?lang= or user choice)
  const cookieLocale = parseLocale(store.get('locale')?.value);
  const locale = cookieLocale || 'en';

  const common = (await import(`./messages/${locale}/common.json`)).default;
  const home = (await import(`./messages/${locale}/home.json`)).default;
  const auth = (await import(`./messages/${locale}/auth.json`)).default;
  const streaming = (await import(`./messages/${locale}/streaming.json`)).default;
  const userNs = (await import(`./messages/${locale}/user.json`)).default;
  const searchNs = (await import(`./messages/${locale}/search.json`)).default;
  const moviesNs = (await import(`./messages/${locale}/movies.json`)).default;
  const tvshowsNs = (await import(`./messages/${locale}/tvshows.json`)).default;
  const watchNs = (await import(`./messages/${locale}/watch.json`)).default;
  const commentsNs = (await import(`./messages/${locale}/comments.json`)).default;
  const friendsNs = (await import(`./messages/${locale}/friends.json`)).default;
  const notFoundNs = (await import(`./messages/${locale}/notFound.json`)).default;
  const mediaNs = (await import(`./messages/${locale}/media.json`)).default;

  return {
    locale,
    messages: {
      ...common,
      ...home,
      ...auth,
      ...streaming,
      ...userNs,
      ...searchNs,
      ...moviesNs,
      ...tvshowsNs,
      ...watchNs,
      ...commentsNs,
      ...friendsNs,
      ...notFoundNs,
      ...mediaNs,
    }
  };
});
