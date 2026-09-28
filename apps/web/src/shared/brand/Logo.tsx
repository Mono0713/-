import Link from 'next/link'
import { BRAND, brandLocalName } from './brand'
import { LogoMark } from './LogoMark'

/** Mark + wordmark, linking home. */
export function Logo({ locale = 'zh-Hant' }: { locale?: string }) {
  const local = brandLocalName(locale)
  return (
    <Link href="/" className="m-logo flex shrink-0 items-center gap-2" aria-label={BRAND.name}>
      <LogoMark size={28} />
      <span className="text-[17px] font-bold tracking-tight">{BRAND.name}</span>
      {local && <span className="hidden text-xs tracking-[0.25em] text-muted sm:inline">{local}</span>}
    </Link>
  )
}
