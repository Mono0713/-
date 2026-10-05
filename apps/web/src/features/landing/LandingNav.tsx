import { BRAND } from '@/shared/brand/brand'
import { LogoMark } from '@/shared/brand/LogoMark'
import { WRAP } from './wrap'
import { LanguagePick } from './LanguagePick'
import { StartButton, type Start } from './StartButton'

/** Logo on the left; language and sign-in on the right. No local name beside the logo. */
export function LandingNav(start: Start) {
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className={`${WRAP} flex h-16 items-center justify-between gap-3`}>
        <a href="#top" className="m-logo flex items-center gap-2 text-accent" aria-label={BRAND.name}>
          <LogoMark size={30} />
          <span className="font-display text-[20px] font-extrabold lowercase leading-none tracking-[-0.035em] text-ink">{BRAND.name}</span>
        </a>
        <div className="flex items-center gap-2">
          <LanguagePick />
          <StartButton {...start} size="small" />
        </div>
      </div>
    </header>
  )
}
