import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { BottomNav } from '@/shared/chrome/BottomNav'
import { Header } from '@/shared/chrome/Header'
import { Sidebar } from '@/shared/chrome/Sidebar'
import { MOTION_SCRIPT } from '@/shared/motion/preference'
import { ServiceWorker } from '@/shared/pwa/ServiceWorker'
import { CATALOGS } from '@/shared/i18n/catalogs'
import { saveLocale } from '@/features/settings/actions'
import { I18nProvider } from '@/shared/i18n/client'
import { getLocale } from '@/shared/i18n/server'
import { RemovalProvider } from '@/shared/removal'
import { THEME_SCRIPT } from '@/shared/theme/theme'
import { RAIL_SCRIPT } from '@/shared/chrome/rail'
import '@fontsource/lxgw-wenkai-tc/400.css'
import './globals.css'

// Atkinson Hyperlegible Next (body), Bricolage Grotesque (headings, numbers), JetBrains Mono (code) and
// LXGW WenKai TC (handwritten notes), all SIL Open Font License and served from the app itself.
// Chinese body text uses the system's own font.
const body = localFont({ src: './fonts/atkinson-hyperlegible-next-latin-wght-normal.woff2', variable: '--font-body', weight: '200 800', display: 'swap' })
const bricolage = localFont({ src: './fonts/bricolage-grotesque-latin-wght-normal.woff2', variable: '--font-bricolage', weight: '200 800', display: 'swap' })
const mono = localFont({ src: './fonts/jetbrains-mono-latin-500-normal.woff2', variable: '--font-jbmono', weight: '500', display: 'swap' })

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: brandTagline(),
  // Installed on a phone's home screen it opens like an app, without the browser bar.
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: 'default' },
  // Listing icons here turns off app/icon.svg, so the tab icon is named too.
  icons: { icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
}

export const viewport: Viewport = {
  // Lets the page reach under the phone's home indicator; the bottom bar pads itself with the safe area.
  viewportFit: 'cover',
  // Colors the phone's status bar to match the page.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fcfcfa' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1528' },
  ],
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  return (
    <html lang={locale} className={`${body.variable} ${bricolage.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark and motion choices before the first paint. Browser extensions
            sometimes rewrite this tag before React starts, so a mismatch here is not ours to report. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + MOTION_SCRIPT + RAIL_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
        <I18nProvider locale={locale} messages={CATALOGS[locale]} save={saveLocale}>
        <RemovalProvider>
          <div className="xl:flex">
            <Sidebar />
            <div className="min-w-0 flex-1">
              <Header />
              {/* Pages marked .workspace (the review editor) use the full width. */}
              <main className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 xl:px-10 xl:py-10 has-[.workspace]:max-w-none has-[.workspace]:py-0 sm:has-[.workspace]:px-0 xl:has-[.workspace]:px-0">
                {children}
              </main>
            </div>
          </div>
          <BottomNav />
        </RemovalProvider>
        </I18nProvider>
        <ServiceWorker />
      </body>
    </html>
  )
}
