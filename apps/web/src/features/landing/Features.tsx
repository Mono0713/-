import type { CSSProperties, ReactNode } from 'react'
import { IconClass, IconKey, IconShare, IconTimer } from '@/shared/icons'
import { getT } from '@/shared/i18n/server'
import { TYPE_LABELS } from '@/shared/labels'
import { WRAP } from './wrap'

/** What a recognised exam can do, as a grid of cards each with a small picture of the feature. */
export async function Features() {
  const t = await getT()
  const types = Object.entries(TYPE_LABELS).filter(([type]) => type !== 'other')
  return (
    <section className={`${WRAP} py-20 lg:py-28`}>
      <h2 className="m-reveal max-w-xl font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[36px]">
        {t('存進題庫之後')}
      </h2>
      <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card i={0} wide title={t('認得各種題型')} text={t('連表格裡、圖上的空格，閱讀題組和圖片選項都能辨識，作答方式跟著題型走。')}>
          <div className="flex flex-wrap gap-2">
            {types.map(([type, label]) => (
              <span key={type} className="rounded-lg border border-line bg-paper px-2.5 py-1 text-sm">
                {t(label)}
              </span>
            ))}
          </div>
        </Card>

        <Card i={1} title={t('AI 幫你批改')} text={t('簡答、計算和手寫作答交給 AI 打分，用紅筆寫下哪裡要改。')}>
          <div className="rounded-lg border border-line bg-paper px-3 py-2.5">
            <p className="text-sm">
              <span className="num">2⁶ = 64</span>
            </p>
            <p className="pen mt-1 text-[15px] leading-snug">{t('答對了，記得寫出 120 ÷ 20 = 6 這一步。')}</p>
          </div>
        </Card>

        <Card i={2} icon={<IconTimer size={18} />} title={t('限時考試，也能逐題練')} text={t('考試模式計時計分；練習模式每題看解析，看不懂就問 AI，還能一鍵翻譯。')} />
        <Card i={3} icon={<IconShare size={18} />} title={t('分享與班級')} text={t('一個連結就能分享考卷。老師開班級、派作業，學生交卷後再公布答案。')} />
        <Card i={4} icon={<IconKey size={18} />} title={t('用你自己的 AI 金鑰')} text={t('Claude、OpenAI、Gemini 都能接，用多少付多少，沒有訂閱。')}>
          <div className="flex gap-2 text-xs font-medium text-muted">
            {['Claude', 'OpenAI', 'Gemini'].map((name) => (
              <span key={name} className="rounded-md bg-accent-soft px-2 py-1 text-accent">
                {name}
              </span>
            ))}
          </div>
        </Card>
      </div>
      <p className="m-reveal mt-6 flex items-center gap-2 text-sm text-muted">
        <IconClass size={16} aria-hidden />
        {t('學生、家長和老師都能用，一個帳號管理所有考卷。')}
      </p>
    </section>
  )
}

function Card({ i, wide = false, icon, title, text, children }: { i: number; wide?: boolean; icon?: ReactNode; title: string; text: string; children?: ReactNode }) {
  return (
    <article className={`m-reveal flex flex-col rounded-2xl bg-surface p-6 shadow-sheet ${wide ? 'lg:col-span-2' : ''}`} style={{ '--i': i } as CSSProperties}>
      {icon && <span className="mb-4 grid size-9 place-items-center rounded-lg bg-accent-soft text-accent">{icon}</span>}
      <h3 className="text-lg font-bold">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
      {children && <div className="mt-auto pt-5">{children}</div>}
    </article>
  )
}
