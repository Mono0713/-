import type { CSSProperties, ReactNode } from 'react'
import { getLocale, getT } from '@/shared/i18n/server'
import { TYPE_LABELS } from '@/shared/labels'
import { ClassArt, GradeArt, KeysArt, PracticeModesArt, TranslateArt, TypesArt } from './art/FeatureArt'
import { Heading } from './Heading'
import { WRAP } from './wrap'

const SHOWN = new Set(['single_choice', 'matching', 'writing', 'drawing', 'fill_in_blank', 'calculation', 'other'])

/** What a recognised exam can do, each card with a small picture of it. */
export async function Features() {
  const t = await getT()
  const locale = await getLocale()
  const more = Object.entries(TYPE_LABELS).filter(([type]) => !SHOWN.has(type))
  return (
    <section id="features" className={`${WRAP} scroll-mt-16 pb-20 lg:pb-28`}>
      <Heading n={3} kicker={t('功能')} title={t('存進題庫之後')} lead={t('練習、考試、批改和分享，都在同一個地方。')} />
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card i={0} wide title={t('認得各種題型')} text={t('連表格裡、圖上的空格，閱讀題組和圖片選項都能辨識，作答方式跟著題型走。')}>
          <TypesArt t={t} />
          <p className="mt-3 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {t('還有')}
            {more.map(([type, label]) => (
              <span key={type} className="rounded-md border border-line px-1.5 py-0.5">
                {t(label)}
              </span>
            ))}
          </p>
        </Card>
        <Card i={1} fill title={t('AI 幫你批改')} text={t('簡答、計算和手寫作答交給 AI 打分，用紅筆寫下哪裡要改。')}>
          <GradeArt t={t} />
        </Card>
        <Card i={2} title={t('限時考試，也能逐題練')} text={t('考試模式計時計分；練習模式每題看解析，看不懂就問 AI，還能一鍵翻譯。')}>
          <PracticeModesArt t={t} />
        </Card>
        <Card i={3} title={t('看不懂題目？一鍵翻譯')} text={t('題目和選項一起翻成你的語言。預設用免費翻譯，不需要金鑰。')}>
          <TranslateArt t={t} locale={locale} />
        </Card>
        <Card i={4} title={t('分享與班級')} text={t('一個連結就能分享考卷。老師開班級、派作業，學生交卷後再公布答案。')}>
          <ClassArt t={t} />
        </Card>
        <article className="m-reveal grid gap-5 rounded-2xl bg-surface p-6 shadow-sheet md:col-span-2 lg:col-span-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <h3 className="text-lg font-bold">{t('用你自己的 AI 金鑰')}</h3>
            <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{t('Claude、OpenAI、Gemini 都能接，用多少付多少，沒有訂閱。')}</p>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted">{t('還沒有金鑰？手動模式可以把考卷交給 ChatGPT、Claude 或 Gemini 的聊天 App 辨識。')}</p>
          </div>
          <KeysArt t={t} />
        </article>
      </div>
    </section>
  )
}

/** `fill`: the picture takes the card's spare height instead of sitting at the bottom. */
function Card({ i, wide = false, fill = false, title, text, children }: { i: number; wide?: boolean; fill?: boolean; title: string; text: string; children: ReactNode }) {
  return (
    <article className={`m-reveal flex flex-col rounded-2xl bg-surface p-6 shadow-sheet ${wide ? 'md:col-span-2' : ''}`} style={{ '--i': i % 3 } as CSSProperties}>
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
      <div className={fill ? 'flex flex-1 flex-col pt-5' : 'mt-auto pt-5'}>{children}</div>
    </article>
  )
}
