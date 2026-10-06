import Link from 'next/link'
import { BRAND } from '@/shared/brand/brand'
import { LogoMark } from '@/shared/brand/LogoMark'
import { IconLaptop, IconPhone, IconTablet } from '@/shared/icons'
import { getT } from '@/shared/i18n/server'
import { StartButton, type Start } from './StartButton'
import { WRAP } from './wrap'

/** The last call to action, the devices it runs on, and the footer. */
export async function Closing(start: Start) {
  const t = await getT()
  return (
    <>
      <section className={`${WRAP} pb-24`}>
        <div className="m-reveal rounded-3xl bg-night px-6 ring-1 ring-white/5 py-14 text-center text-white sm:px-12">
          <div className="flex justify-center gap-4 text-night-accent" aria-hidden>
            <IconPhone size={22} />
            <IconTablet size={22} />
            <IconLaptop size={22} />
          </div>
          <h2 className="mx-auto mt-5 max-w-lg font-display text-[28px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[34px]">
            {t('下一張考卷，就從這裡開始')}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/70">{t('手機、平板、電腦都能用。加到主畫面就像 App，平板還能直接手寫作答。')}</p>
          <div className="mt-8 flex justify-center">
            <StartButton {...start} />
          </div>
        </div>
      </section>
      <footer className="border-t border-line/70">
        <div className={`${WRAP} flex flex-wrap items-center justify-between gap-3 py-6 text-xs text-muted`}>
          <span className="flex items-center gap-2">
            <LogoMark size={18} />
            <span>
              © {new Date().getFullYear()} {BRAND.name}
            </span>
          </span>
          <nav className="flex gap-4">
            <Link href="/terms" className="hover:text-ink">
              {t('服務條款')}
            </Link>
            <Link href="/privacy" className="hover:text-ink">
              {t('隱私權政策')}
            </Link>
          </nav>
        </div>
      </footer>
    </>
  )
}
