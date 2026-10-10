import Link from 'next/link'
import { BRAND, brandTagline } from '@/shared/brand/brand'
import { LogoMark } from '@/shared/brand/LogoMark'
import { getLocale, getT } from '@/shared/i18n/server'
import { LanguagePick } from './LanguagePick'
import { WRAP } from './wrap'

export async function Footer() {
  const t = await getT()
  return (
    <footer className="border-t border-line/70">
      <div className={`${WRAP} flex flex-wrap items-end justify-between gap-6 py-10`}>
        <div>
          <span className="flex items-center gap-2 text-accent">
            <LogoMark size={24} />
            <span className="font-display text-[17px] font-extrabold lowercase leading-none tracking-[-0.035em] text-ink">{BRAND.name}</span>
          </span>
          <p className="mt-2 text-sm text-muted">{brandTagline(await getLocale())}</p>
        </div>
        <div className="flex flex-col items-start gap-2 text-xs text-muted sm:items-end">
          <LanguagePick className="hover:text-ink" />
          <nav className="flex gap-4">
            <Link href="/terms" className="hover:text-ink">
              {t('服務條款')}
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              {t('隱私權政策')}
            </Link>
          </nav>
          <span>
            © {new Date().getFullYear()} {BRAND.name}
          </span>
        </div>
      </div>
    </footer>
  )
}
