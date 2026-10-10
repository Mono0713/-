import { BRAND } from '@/shared/brand/brand'
import { LogoMark } from '@/shared/brand/LogoMark'
import { getT } from '@/shared/i18n/server'
import { LanguagePick } from './LanguagePick'
import { StartButton, type Start } from './StartButton'
import { WRAP } from './wrap'

/** Logo on the left, the page's sections in the middle (wide screens), language (not on phones) and sign-in on the right. No local name beside the logo. */
export async function LandingNav(start: Start) {
  const t = await getT()
  const links: [string, string][] = [
    ['#how', t('怎麼運作')],
    ['#who', t('適合誰')],
    ['#features', t('功能')],
    ['#faq', t('常見問題')],
  ]
  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-paper/85 backdrop-blur-md">
      <div className={`${WRAP} flex h-16 items-center justify-between gap-3`}>
        <a href="#top" className="m-logo flex items-center gap-2 text-accent" aria-label={BRAND.name}>
          <LogoMark size={30} />
          <span className="font-display text-[20px] font-extrabold lowercase leading-none tracking-[-0.035em] text-ink">{BRAND.name}</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-muted lg:flex">
          {links.map(([href, label]) => (
            <a key={href} href={href} className="hover:text-ink">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {/* phones keep the header to the logo and sign-in; the language is in the footer there */}
          <div className="mr-1 hidden sm:block">
            <LanguagePick className="text-sm text-muted hover:text-ink" />
          </div>
          <StartButton {...start} size="small" />
        </div>
      </div>
    </header>
  )
}
