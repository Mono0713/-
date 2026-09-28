import type { Metadata } from 'next'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { Header } from '@/shared/chrome/Header'
import './globals.css'

export const metadata: Metadata = {
  title: { default: BRAND.name, template: `%s · ${BRAND.name}` },
  description: brandTagline(),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen font-sans antialiased">
        <Header />
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  )
}
