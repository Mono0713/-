import { cookies } from 'next/headers'
import { brandTagline } from '@/shared/brand/brand'
import { IconCheck } from '@/shared/icons'
import { rich } from '@/shared/i18n/rich'
import { LOCALES } from '@/shared/i18n/locales'
import { getLocale, getT, getTIn } from '@/shared/i18n/server'
import { practiceItems } from './demo/practice'
import { TourButton } from './demo/TourButton'
import { SAMPLES } from './samples'
import { pickUnseen, SEEN_COOKIE } from './samples/seen'
import { SampleDeck } from './sheet/SampleDeck'
import { FoundCard, SampleSheet } from './sheet/Sheet'
import { StartButton, type Start } from './StartButton'
import { WRAP } from './wrap'

export async function Hero(start: Start) {
  const t = await getT()
  const locale = await getLocale()
  const ids = SAMPLES.map((s) => s.id)
  // A sample this browser has not been shown yet, so every visit opens on a different exam.
  const first = pickUnseen(ids, (await cookies()).get(SEEN_COOKIE)?.value.split('.') ?? [])
  return (
    <section id="top" className={`${WRAP} grid grid-cols-1 items-center gap-x-10 gap-y-14 pb-20 pt-10 sm:pt-14 lg:grid-cols-[1fr_minmax(0,460px)] lg:pb-28 lg:pt-20`}>
      <div className="m-enter">
        <p className="text-sm font-medium text-muted">{brandTagline(locale)}</p>
        <h1 className="mt-4 font-display text-[40px] font-extrabold leading-[1.1] tracking-[-0.03em] [text-wrap:balance] sm:text-[54px] lg:text-[60px]">
          {rich(t('把寫過的考卷，<hl>變成練不完的題庫</hl>'), {
            hl: (c) => (
              <span className="hl m-sweep inline-block" style={{ animationDelay: '300ms' }}>
                {c}
              </span>
            ),
          })}
        </h1>
        <p className="mt-6 max-w-[34rem] text-[17px] leading-relaxed text-muted">
          {t('拍照、掃描或上傳 PDF，AI 會把每一題框出來，認出題型和答案，寫過的筆跡也不會留在題目上。校對一下存進題庫，就能隨時練習、限時考試，讓 AI 幫你批改。')}
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
          <StartButton {...start} />
          {/* the tour plays the sample exam the pile is showing; its practice question is printed in another language, like the 試一題 card */}
          <TourButton practice={practiceItems(t, getTIn(locale === 'en' ? 'zh-Hant' : 'en'))} cta={<StartButton {...start} />} />
        </div>
        <ul className="mt-7 flex flex-wrap gap-x-5 gap-y-2 text-[13px] text-muted">
          {[t('免費使用'), t('用你自己的 AI 金鑰'), t('{n} 種介面語言', { n: LOCALES.length })].map((point) => (
            <li key={point} className="flex items-center gap-1.5">
              <IconCheck size={14} className="text-good" aria-hidden />
              {point}
            </li>
          ))}
        </ul>
      </div>
      <SampleDeck
        ids={ids}
        start={first}
        sheets={SAMPLES.map((s) => <SampleSheet key={s.id} sample={s} t={t} />)}
        notes={SAMPLES.map((s) => <FoundCard key={s.id} sample={s} t={t} />)}
        captions={SAMPLES.map((s) => `${t(s.subject)} ${t(s.exam)}`)}
      />
    </section>
  )
}
