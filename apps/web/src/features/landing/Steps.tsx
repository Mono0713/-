import type { CSSProperties, ReactNode } from 'react'
import { getT } from '@/shared/i18n/server'
import { CheckArt, PracticeArt, ScanArt, UploadArt } from './art/StepArt'
import { Heading } from './Heading'
import { WRAP } from './wrap'

/** Upload → recognise → check → practise, each with a picture of that screen. */
export async function Steps() {
  const t = await getT()
  const steps: { art: ReactNode; title: string; text: string }[] = [
    { art: <UploadArt t={t} />, title: t('上傳'), text: t('手機拍照、掃描檔或 PDF，一次多頁也可以。') },
    { art: <ScanArt />, title: t('辨識'), text: t('AI 框出每一題，認出題型、選項、表格、圖和答案。') },
    { art: <CheckArt t={t} />, title: t('校對'), text: t('在原卷旁邊直接改，框歪了拖一下就好。') },
    { art: <PracticeArt />, title: t('練習'), text: t('題目和選項隨機排，做完馬上看成績和錯題。') },
  ]
  return (
    <section id="how" className="scroll-mt-16 border-y border-line/70 bg-surface/60 py-20 lg:py-28">
      <div className={WRAP}>
        <Heading n={1} kicker={t('怎麼運作')} title={t('一張考卷，四個步驟')} lead={t('不用重新打字，也不用一題一題剪下來。')} />
        <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ art, title, text }, i) => (
            <li key={i} className="m-reveal rounded-2xl bg-surface p-4 shadow-sheet" style={{ '--i': i } as CSSProperties}>
              {art}
              <h3 className="mt-5 flex items-baseline gap-2 px-1 text-lg font-bold">
                <span className="num text-sm text-muted">{i + 1}</span>
                {title}
              </h3>
              <p className="mt-1 px-1 pb-1 text-sm leading-relaxed text-muted">{text}</p>
            </li>
          ))}
        </ol>
        <p className="m-reveal mt-10 flex items-center gap-2 text-sm text-muted">
          <LoopArrow />
          {t('題目都留在題庫裡，隨時挑幾題再考一次。')}
        </p>
      </div>
    </section>
  )
}

function LoopArrow() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden>
      <path d="M20 12a8 8 0 1 1-2.6-5.9" />
      <path d="M20 4v4h-4" />
    </svg>
  )
}
