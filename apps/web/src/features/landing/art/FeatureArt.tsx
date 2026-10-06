import type { CSSProperties, ReactNode } from 'react'
import { IconCopy, IconLink, IconSparkles, IconTimer } from '@/shared/icons'
import type { T } from '@/shared/i18n/format'
import { TYPE_LABELS } from '@/shared/labels'
import { Printed } from '../sheet/Printed'
import { Tick } from './Frame'

/** Pictures for the feature cards: small, true-to-life pieces of the app. */

/** Six question types, each as it looks when answered. */
export function TypesArt({ t }: { t: T }) {
  const tiles: { type: keyof typeof TYPE_LABELS; art: ReactNode }[] = [
    { type: 'single_choice', art: <ChoiceMini /> },
    { type: 'matching', art: <MatchMini /> },
    { type: 'writing', art: <WritingMini /> },
    { type: 'drawing', art: <DrawMini /> },
    { type: 'fill_in_blank', art: <TableMini /> },
    {
      type: 'calculation',
      art: (
        <span className="whitespace-nowrap text-[12px] sm:text-[16px]">
          <Printed text="$x=\dfrac{-b\pm\sqrt{b^2-4ac}}{2a}$" />
        </span>
      ),
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {tiles.map(({ type, art }, i) => (
        <div key={type} className="m-play m-tile flex flex-col rounded-xl bg-paper p-2.5 ring-1 ring-line/70" style={{ '--i': i } as CSSProperties}>
          <div className="grid h-[72px] place-items-center overflow-hidden" aria-hidden>
            {art}
          </div>
          <span className="mt-1.5 text-xs font-medium text-muted">{t(TYPE_LABELS[type])}</span>
        </div>
      ))}
    </div>
  )
}

function ChoiceMini() {
  return (
    <div className="grid w-full grid-cols-2 gap-1 px-1">
      {'ABCD'.split('').map((l, k) => (
        <span key={l} className={`flex h-6 items-center gap-1 rounded-md border px-1.5 text-[10px] ${k === 2 ? 'border-good/60 bg-good-soft' : 'border-line bg-surface'}`}>
          <span className="num text-muted">{l}</span>
          {k === 2 && <Tick delay={600} size={12} />}
        </span>
      ))}
    </div>
  )
}

function MatchMini() {
  return (
    <svg viewBox="0 0 120 64" className="h-16 w-[120px]">
      {[12, 32, 52].map((y) => (
        <g key={y}>
          <rect x="4" y={y - 6} width="34" height="12" rx="3" fill="var(--color-surface)" stroke="var(--color-line)" />
          <rect x="82" y={y - 6} width="34" height="12" rx="3" fill="var(--color-surface)" stroke="var(--color-line)" />
        </g>
      ))}
      <g stroke="var(--color-ink)" strokeOpacity="0.55" strokeWidth="1.4" fill="none" strokeLinecap="round">
        <path d="M38 12L82 52" />
        <path d="M38 32L82 12" />
        <path d="M38 52L82 32" />
      </g>
    </svg>
  )
}

function WritingMini() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((k) => (
        <span key={k} className="relative grid size-9 place-items-center border border-ink/30 bg-surface font-hand text-[22px] leading-none">
          <span className="absolute inset-0 bg-[linear-gradient(var(--color-ink)_0_0),linear-gradient(var(--color-ink)_0_0)] bg-[length:100%_1px,1px_100%] bg-center bg-no-repeat opacity-[0.12]" />
          <span className={`relative ${k ? 'text-ink' : 'text-ink/30'}`}>{/* i18n-ignore */ '永'}</span>
        </span>
      ))}
    </div>
  )
}

function DrawMini() {
  return (
    <svg viewBox="0 0 120 40" className="h-12 w-[144px] max-w-full text-ink">
      <path d="M4 22H116M111 18l5 4-5 4" stroke="currentColor" strokeWidth="1.2" fill="none" />
      {[14, 34, 54, 74, 94].map((x, i) => (
        <g key={x}>
          <path d={`M${x} 18V26`} stroke="currentColor" strokeWidth="1.1" />
          <text x={x} y="37" textAnchor="middle" fontSize="8.5" fill="currentColor" opacity="0.6">
            {i - 2 < 0 ? `−${2 - i}` : i - 2}
          </text>
        </g>
      ))}
      <circle cx="64" cy="22" r="3.2" fill="var(--color-accent)" />
    </svg>
  )
}

function TableMini() {
  return (
    <table className="border-collapse text-center text-[10px]">
      <tbody>
        {[
          ['H', '1'],
          ['O', '8'],
          ['Na', null],
        ].map(([a, b]) => (
          <tr key={a}>
            <td className="w-9 border border-line bg-surface py-0.5">{a}</td>
            <td className="w-12 border border-line bg-surface py-0.5">
              {b ?? <span className="mx-auto block h-3 w-8 border-b-2 border-ink/50" />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/** The step the red pen asks for, never broken across two lines. */
const STEP = '120\u00a0÷\u00a020\u00a0=\u00a06'

/** A handwritten answer on ruled paper, marked in red pen. Grows to fill its card. */
export function GradeArt({ t }: { t: T }) {
  return (
    <div className="relative flex min-h-[150px] flex-1 flex-col rounded-xl bg-paper px-4 pb-1 pt-3 ring-1 ring-line/70" aria-hidden>
      <p className="pr-14 text-xs leading-relaxed text-muted">{t('一個細菌每 20 分鐘分裂一次，2 小時後會有幾個？')}</p>
      <div className="mt-1 flex-1 bg-[linear-gradient(transparent_calc(100%-1px),var(--color-line)_0)] bg-[length:100%_30px] leading-[30px]">
        <p className="flex items-center gap-2 font-hand text-[19px] text-ink">
          2⁶ = 64
          <svg width="22" height="22" viewBox="0 0 24 24" className="overflow-visible" aria-hidden>
            <path className="m-pen m-play" style={{ animationDelay: '300ms' }} pathLength={1} d="M4 13 L10 18.5 L20 6" fill="none" stroke="var(--color-pen)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </p>
        <p className="pen m-play m-note-in text-[15px] leading-[30px] [text-wrap:pretty]" style={{ '--m-note-at': '500ms' } as CSSProperties}>
          {t('答對了，記得寫出 {step} 這一步。', { step: STEP })}
        </p>
      </div>
      <span className="m-play m-note-in absolute right-3 top-2.5 grid size-11 -rotate-6 place-items-center rounded-full border-2 border-pen font-display text-sm font-bold text-pen" style={{ '--m-note-at': '800ms' } as CSSProperties}>
        90
      </span>
    </div>
  )
}

/** Exam or one-at-a-time, the clock, and asking the AI. */
export function PracticeModesArt({ t }: { t: T }) {
  return (
    <div className="rounded-xl bg-paper p-3 ring-1 ring-line/70" aria-hidden>
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex rounded-lg bg-surface p-0.5 text-[11px] ring-1 ring-line">
          <span className="rounded-md bg-accent px-2 py-0.5 font-medium text-on-accent">{t('考試')}</span>
          <span className="px-2 py-0.5 text-muted">{t('單題練習')}</span>
        </span>
        <span className="num flex items-center gap-1 text-xs text-muted">
          <IconTimer size={12} />
          24:58
        </span>
      </div>
      <div className="mt-3 flex gap-1">
        {Array.from({ length: 10 }, (_, k) => (
          <span key={k} className={`h-1.5 flex-1 rounded-full ${k < 6 ? 'bg-ink/45' : 'bg-line'}`} />
        ))}
      </div>
      <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-medium shadow-sheet">
        <IconSparkles size={12} className="text-muted" />
        {t('問 AI')}
      </span>
    </div>
  )
}

/** A question in another language, and its translation. */
export function TranslateArt({ t, locale }: { t: T; locale: string }) {
  // Shown in English, or in Chinese to readers of English.
  const original = locale === 'en' ? '下列何者是質數？' /* i18n-ignore */ : 'Which of the following is a prime number?'
  return (
    <div className="rounded-xl bg-paper p-3 ring-1 ring-line/70" aria-hidden>
      <span className="inline-flex rounded-lg bg-surface p-0.5 text-[11px] ring-1 ring-line">
        <span className="px-2 py-0.5 text-muted">{t('原文')}</span>
        <span className="rounded-md bg-accent px-2 py-0.5 font-medium text-on-accent">{t('翻譯')}</span>
      </span>
      <p className="mt-2.5 text-xs text-muted">{original}</p>
      <p className="mt-1 text-sm font-medium">{t('下列何者是質數？')}</p>
      <div className="mt-2 flex gap-1.5 text-[11px]">
        {['21', '27', '29', '33'].map((n, k) => (
          <span key={n} className={`rounded-md border px-2 py-0.5 ${k === 2 ? 'border-good/60 bg-good-soft' : 'border-line bg-surface'}`}>
            {n}
          </span>
        ))}
      </div>
    </div>
  )
}

/** A share link, and a class handing in an assignment. */
export function ClassArt({ t }: { t: T }) {
  const bars = [2, 4, 7, 9, 6, 3]
  return (
    <div className="space-y-2" aria-hidden>
      <div className="flex items-center gap-2 rounded-lg bg-paper px-2.5 py-1.5 text-xs ring-1 ring-line/70">
        <IconLink size={13} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted">/s/7fK2qX</span>
        <IconCopy size={13} className="shrink-0 text-muted" />
      </div>
      <div className="rounded-lg bg-paper p-2.5 ring-1 ring-line/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex -space-x-1.5">
            {['A', 'B', 'C', 'D', 'E'].map((l, k) => (
              <span key={l} className={`grid size-6 place-items-center rounded-full text-[10px] font-semibold ring-2 ring-paper ${k % 2 ? 'bg-accent-soft text-ink' : 'bg-line text-ink'}`}>
                {l}
              </span>
            ))}
          </div>
          <span className="text-[11px] text-muted">{t('已交卷 {done} / {total}', { done: 18, total: 24 })}</span>
        </div>
        <div className="mt-2.5 flex h-8 items-end gap-1">
          {bars.map((h, k) => (
            <span key={k} className="m-play m-grow flex-1 rounded-sm bg-ink/25" style={{ height: `${h * 10}%`, '--i': k } as CSSProperties} />
          ))}
        </div>
      </div>
    </div>
  )
}

/** The AI services a key can come from. */
export function KeysArt({ t }: { t: T }) {
  return (
    <div className="flex flex-wrap gap-2" aria-hidden>
      {['Claude', 'OpenAI', 'Gemini'].map((name) => (
        <span key={name} className="rounded-lg bg-paper px-3 py-1.5 text-sm font-medium ring-1 ring-line">
          {name}
        </span>
      ))}
      <span className="rounded-lg border border-dashed border-line px-3 py-1.5 text-sm text-muted">{t('接上其他 AI 服務')}</span>
    </div>
  )
}

