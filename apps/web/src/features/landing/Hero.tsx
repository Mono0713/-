import { brandTagline } from '@/shared/brand/brand'
import { rich } from '@/shared/i18n/rich'
import { getLocale, getT } from '@/shared/i18n/server'
import { HeroSheet } from './HeroSheet'
import { StartButton, type Start } from './StartButton'
import { WRAP } from './wrap'

export async function Hero(start: Start) {
  const t = await getT()
  const locale = await getLocale()
  return (
    <section id="top" className={`${WRAP} grid items-center gap-12 pb-20 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28 lg:pt-24`}>
      <div className="m-enter">
        <p className="text-sm font-medium text-muted">{brandTagline(locale)}</p>
        <h1 className="mt-4 font-display text-[40px] font-extrabold leading-[1.1] tracking-[-0.03em] sm:text-[54px] lg:text-[60px] [text-wrap:balance]">
          {rich(t('把寫過的考卷，<hl>變成練不完的題庫</hl>'), {
            hl: (c) => (
              <span className="hl m-sweep inline-block" style={{ animationDelay: '500ms' }}>
                {c}
              </span>
            ),
          })}
        </h1>
        <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-muted">
          {t('拍照、掃描或上傳 PDF，AI 會框出每一題，認出題型、選項和答案。校對一下存進題庫，就能隨時練習、限時考試，讓 AI 幫你批改。')}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <StartButton {...start} />
          <a href="#how" className="text-sm font-medium text-accent hover:underline">
            {t('看看怎麼運作')}
          </a>
        </div>
        <p className="mt-5 text-xs text-muted">{t('用自己的 AI 金鑰，沒有訂閱費。')}</p>
      </div>
      <HeroSheet />
    </section>
  )
}
