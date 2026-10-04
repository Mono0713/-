import Link from 'next/link'
import { BRAND } from './brand'
import { LogoMark } from './LogoMark'

/** Mark + wordmark, linking home. `tone="light"` is for the navy sidebar. */
export function Logo({ tone = 'dark', size = 28, foldable = false }: { tone?: 'dark' | 'light'; size?: number; /** The wordmark hides when the sidebar folds into a rail. */ foldable?: boolean }) {
  return (
    <Link href="/" className="m-logo flex shrink-0 items-center gap-2" aria-label={BRAND.name}>
      <LogoMark size={size} className={tone === 'light' ? 'text-night-accent' : 'text-accent'} />
      {/* the wordmark is set in lowercase */}
      <span className={`font-display text-[20px] font-extrabold lowercase leading-none tracking-[-0.035em] ${tone === 'light' ? 'text-white' : ''} ${foldable ? 'transition-opacity duration-200 rail:opacity-0' : ''}`}>{BRAND.name}</span>
    </Link>
  )
}
