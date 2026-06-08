export interface GenreFilter {
  id: number;
  name: string;
}

export const MOVIE_GENRE_FILTERS: GenreFilter[] = [
  { id: 28, name: 'Action' },
  { id: 12, name: 'Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 14, name: 'Fantasy' },
  { id: 36, name: 'History' },
  { id: 27, name: 'Horror' },
  { id: 10402, name: 'Music' },
  { id: 9648, name: 'Mystery' },
  { id: 10749, name: 'Romance' },
  { id: 878, name: 'Science Fiction' },
  { id: 10770, name: 'TV Movie' },
  { id: 53, name: 'Thriller' },
  { id: 10752, name: 'War' },
  { id: 37, name: 'Western' },
  { id: 53, name: 'Psychological' },
  { id: 36, name: 'Period Drama' },
  { id: 28, name: 'Martial Arts' },
  { id: 18, name: 'Sports' },
  { id: 18, name: 'School' },
  { id: 14, name: 'Mythology' },
  { id: 18, name: 'Classic' },
];

export const TV_GENRE_FILTERS: GenreFilter[] = [
  { id: 10759, name: 'Action & Adventure' },
  { id: 16, name: 'Animation' },
  { id: 35, name: 'Comedy' },
  { id: 80, name: 'Crime' },
  { id: 99, name: 'Documentary' },
  { id: 18, name: 'Drama' },
  { id: 10751, name: 'Family' },
  { id: 10762, name: 'Kids' },
  { id: 9648, name: 'Mystery' },
  { id: 10763, name: 'News' },
  { id: 10764, name: 'Reality' },
  { id: 10765, name: 'Sci-Fi & Fantasy' },
  { id: 10766, name: 'Soap' },
  { id: 10767, name: 'Talk' },
  { id: 10768, name: 'War & Politics' },
  { id: 37, name: 'Western' },
  { id: 9648, name: 'Thriller' },
  { id: 9648, name: 'Horror' },
  { id: 18, name: 'Romance' },
  { id: 9648, name: 'Psychological' },
  { id: 18, name: 'Period Drama' },
  { id: 10759, name: 'Martial Arts' },
  { id: 10764, name: 'Sports' },
  { id: 10762, name: 'School' },
  { id: 10765, name: 'Mythology' },
  { id: 18, name: 'Classic' },
];

export const MOVIE_CATEGORY_OPTIONS = ['All', ...MOVIE_GENRE_FILTERS.map((genre) => genre.name)];
export const TV_CATEGORY_OPTIONS = ['All', ...TV_GENRE_FILTERS.map((genre) => genre.name)];

export const CONTENT_COUNTRY_OPTIONS = [
  'All',
  'USA',
  'United Kingdom',
  'China',
  'Hong Kong',
  'Taiwan',
  'Japan',
  'Korea',
  'India',
  'France',
  'Germany',
  'Spain',
  'Italy',
  'Netherlands',
  'Brazil',
  'Russia',
  'Egypt',
  'Thailand',
  'Vietnam',
  'Indonesia',
  'Malaysia',
  'Philippines',
  'Myanmar',
  'Cambodia',
  'Laos',
  'Canada',
  'Australia',
  'Turkey',
  'Mexico',
];

export const COUNTRY_CODE_MAP: Record<string, string> = {
  USA: 'US',
  'United Kingdom': 'GB',
  China: 'CN',
  'Hong Kong': 'HK',
  Taiwan: 'TW',
  Japan: 'JP',
  Korea: 'KR',
  India: 'IN',
  France: 'FR',
  Germany: 'DE',
  Spain: 'ES',
  Italy: 'IT',
  Netherlands: 'NL',
  Brazil: 'BR',
  Russia: 'RU',
  Egypt: 'EG',
  Thailand: 'TH',
  Vietnam: 'VN',
  Indonesia: 'ID',
  Malaysia: 'MY',
  Philippines: 'PH',
  Myanmar: 'MM',
  Cambodia: 'KH',
  Laos: 'LA',
  Canada: 'CA',
  Australia: 'AU',
  Turkey: 'TR',
  Mexico: 'MX',
};

export const COUNTRY_LANGUAGE_MAP: Record<string, string> = {
  USA: 'en',
  'United Kingdom': 'en',
  China: 'zh',
  'Hong Kong': 'zh',
  Taiwan: 'zh',
  Japan: 'ja',
  Korea: 'ko',
  India: 'hi',
  France: 'fr',
  Germany: 'de',
  Spain: 'es',
  Italy: 'it',
  Netherlands: 'nl',
  Brazil: 'pt',
  Russia: 'ru',
  Egypt: 'ar',
  Thailand: 'th',
  Vietnam: 'vi',
  Indonesia: 'id',
  Malaysia: 'ms',
  Philippines: 'tl',
  Myanmar: 'my',
  Cambodia: 'km',
  Laos: 'lo',
  Canada: 'en',
  Australia: 'en',
  Turkey: 'tr',
  Mexico: 'es',
};

const LANGUAGE_COUNTRY_NAME_MAP: Record<string, string> = {
  en: 'USA',
  zh: 'China',
  ja: 'Japan',
  ko: 'Korea',
  hi: 'India',
  fr: 'France',
  de: 'Germany',
  es: 'Spain',
  it: 'Italy',
  nl: 'Netherlands',
  pt: 'Brazil',
  ru: 'Russia',
  ar: 'Egypt',
  th: 'Thailand',
  vi: 'Vietnam',
  id: 'Indonesia',
  ms: 'Malaysia',
  tl: 'Philippines',
  my: 'Myanmar',
  km: 'Cambodia',
  lo: 'Laos',
  tr: 'Turkey',
};

const COUNTRY_CODE_NAME_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRY_CODE_MAP).map(([name, code]) => [code, name])
);

export function getGenreId(filters: GenreFilter[], name: string) {
  return filters.find((genre) => genre.name === name)?.id;
}

export function appendGenreFilter(params: URLSearchParams, filters: GenreFilter[], selectedGenre: string) {
  if (selectedGenre === 'All') return;
  const genreId = getGenreId(filters, selectedGenre);
  if (genreId) {
    params.append('with_genres', genreId.toString());
  }
}

export function appendCountryCodeFilter(params: URLSearchParams, selectedCountry: string) {
  if (selectedCountry === 'All') return;
  const countryCode = COUNTRY_CODE_MAP[selectedCountry];
  if (countryCode) {
    params.append('with_origin_country', countryCode);
  }
}

export function getCountryLanguage(selectedCountry: string) {
  return COUNTRY_LANGUAGE_MAP[selectedCountry];
}

export function getCountryCode(selectedCountry: string) {
  return COUNTRY_CODE_MAP[selectedCountry];
}

export function getCountryDisplayName(languageCode?: string, countryCode?: string) {
  const normalizedCountryCode = countryCode?.toUpperCase();
  if (normalizedCountryCode && COUNTRY_CODE_NAME_MAP[normalizedCountryCode]) {
    return COUNTRY_CODE_NAME_MAP[normalizedCountryCode];
  }

  const normalizedLanguage = languageCode?.toLowerCase() || 'en';
  return LANGUAGE_COUNTRY_NAME_MAP[normalizedLanguage] || 'USA';
}
