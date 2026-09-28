import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { Header } from '@/shared/chrome/Header'
import { Sidebar } from '@/shared/chrome/Sidebar'
import './globals.css'

// Inter and JetBrains Mono (both SIL Open Font License), served from the app itself.
const inter = localFont({ src: './fonts/inter-latin-wght-normal.woff2', variable: '--font-inter', weight: '100 900', display: 'swap' })
const mono = localFont({ src: './fonts/jetbrains-mono-latin-500-normal.woff2', variable: '--font-jbmono', weight: '500', display: 'swap' })

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: brandTagline(),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" className={`${inter.variable} ${mono.variable}`}>
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
