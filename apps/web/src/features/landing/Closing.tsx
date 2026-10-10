import { IconLaptop, IconPhone, IconTablet } from '@/shared/icons'
import { getT } from '@/shared/i18n/server'
import { StartButton, type Start } from './StartButton'
import { WRAP } from './wrap'

/** The last call to action, on a navy sheet of graph paper. */
export async function Closing(start: Start) {
  const t = await getT()
  return (
    <section className={`${WRAP} py-20 lg:py-28`}>
      <div className="m-reveal relative overflow-hidden rounded-3xl bg-night px-6 py-16 text-center text-white ring-1 ring-white/5 sm:px-12">
        <div aria-hidden className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.045)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.045)_1px,transparent_1px)] bg-[size:18px_18px]" />
        <div className="relative">
          <div className="flex justify-center gap-4 text-night-accent" aria-hidden>
            <IconPhone size={22} />
            <IconTablet size={22} />
            <IconLaptop size={22} />
          </div>
          <h2 className="mx-auto mt-5 max-w-lg font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] [text-wrap:balance] sm:text-[40px]">
            {t('下一張考卷，就從這裡開始')}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-white/70">{t('免費開始，先拍一張考卷試試看。')}</p>
          <div className="mt-8 flex justify-center">
            <StartButton {...start} />
          </div>
        </div>
      </div>
    </section>
  )
}
