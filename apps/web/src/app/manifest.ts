import type { MetadataRoute } from 'next'
import { cookies, headers } from 'next/headers'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { DEFAULT_LOCALE, fromAcceptLanguage, isLocale, LOCALE_COOKIE } from '@/shared/i18n/locales'

/**
 * Lets phones install the site as an app ("add to home screen"); the Android app reuses it.
 * The language follows the browser, since installing happens before or without signing in.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const remembered = (await cookies()).get(LOCALE_COOKIE)?.value
  const locale = isLocale(remembered) ? remembered : (fromAcceptLanguage((await headers()).get('accept-language')) ?? DEFAULT_LOCALE)
  return {
    id: '/',
    name: BRAND.name,
    short_name: BRAND.name,
    description: brandTagline(locale),
    lang: locale,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#fcfcfa',
    theme_color: '#fcfcfa',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
