import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { Header } from '@/shared/chrome/Header'
import { Sidebar } from '@/shared/chrome/Sidebar'
import { MOTION_SCRIPT } from '@/shared/motion/preference'
import { THEME_SCRIPT } from '@/shared/theme/theme'
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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${body.variable} ${bricolage.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Applies the saved light/dark and motion choices before the first paint. Browser extensions
            sometimes rewrite this tag before React starts, so a mismatch here is not ours to report. */}
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_SCRIPT + MOTION_SCRIPT }} />
      </head>
      <body className="min-h-screen font-sans antialiased">
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
      </body>
    </html>
  )
}
