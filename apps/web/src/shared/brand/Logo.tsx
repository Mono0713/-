import Link from 'next/link'
import { BRAND } from './brand'
import { LogoMark } from './LogoMark'

/** Mark + wordmark, linking home. `tone="light"` is for dark backgrounds. */
export function Logo({ tone = 'dark', size = 28 }: { tone?: 'dark' | 'light'; size?: number }) {
  return (
    <Link href="/" className="m-logo flex shrink-0 items-center gap-2.5" aria-label={BRAND.name}>
      <LogoMark size={size} />
      <span className={`text-[17px] font-bold tracking-[-0.02em] ${tone === 'light' ? 'text-white' : ''}`}>{BRAND.name}</span>
    </Link>
  )
}
