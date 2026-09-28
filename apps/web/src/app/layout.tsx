import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'

export const metadata: Metadata = {
  title: '考卷題庫',
  description: '把考卷變成可編輯的題庫',
}

const NAV = [
  { href: '/imports', label: '匯入考卷' },
  { href: '/bank', label: '題庫' },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body className="min-h-screen font-sans antialiased">
        <header className="sticky top-0 z-30 border-b border-line bg-paper/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-8 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-ink text-sm text-paper">題</span>
              考卷題庫
            </Link>
            <nav className="flex gap-1 text-sm">
              {NAV.map((item) => (
                <Link key={item.href} href={item.href} className="rounded-md px-3 py-1.5 text-muted hover:bg-surface hover:text-ink">
                  {item.label}
                </Link>
              ))}
              <span className="cursor-default rounded-md px-3 py-1.5 text-muted/50" title="之後加入">
                線上測驗
              </span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  )
}
