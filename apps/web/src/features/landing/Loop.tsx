import type { CSSProperties } from 'react'
import { IconEdit, IconQuiz, IconScan, IconUpload, type Icon } from '@/shared/icons'
import { getT } from '@/shared/i18n/server'
import { WRAP } from './wrap'

/** Upload → recognise → check → practise, and the bank is there for the next round. */
export async function Loop() {
  const t = await getT()
  const steps: { icon: Icon; title: string; text: string }[] = [
    { icon: IconUpload, title: t('上傳'), text: t('手機拍照、掃描檔或 PDF，一次多頁也可以。') },
    { icon: IconScan, title: t('辨識'), text: t('AI 框出每一題，認出題型、選項、表格、圖和答案。') },
    { icon: IconEdit, title: t('校對'), text: t('在原卷旁邊直接改，框歪了拖一下就好。') },
    { icon: IconQuiz, title: t('練習'), text: t('題目和選項隨機排，做完馬上看成績和錯題。') },
  ]
  return (
    <section id="how" className="scroll-mt-20 border-y border-line/70 bg-surface/70 py-20 lg:py-24">
      <div className={WRAP}>
        <h2 className="m-reveal max-w-xl font-display text-[30px] font-extrabold leading-tight tracking-[-0.02em] sm:text-[36px]">
          {t('一張考卷，四個步驟')}
        </h2>
        <ol className="mt-12 grid gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ icon: Icon, title, text }, i) => (
            <li key={i} className="m-reveal relative" style={{ '--i': i } as CSSProperties}>
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Icon size={20} aria-hidden />
                </span>
                <span className="num font-display text-sm font-bold text-muted">0{i + 1}</span>
                {/* the dashed line to the next step; the last one curls back to the first */}
                <span className={`hidden h-px flex-1 border-t-2 border-dashed lg:block ${i === 3 ? 'border-transparent' : 'border-line'}`} />
              </div>
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <p className="m-reveal mt-12 flex items-center gap-2 text-sm text-muted" style={{ '--i': 4 } as CSSProperties}>
          <LoopArrow />
          {t('題目都留在題庫裡，隨時挑幾題再考一次。')}
        </p>
      </div>
    </section>
  )
}

function LoopArrow() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </svg>
  )
}
