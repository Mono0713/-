import type { CSSProperties, ReactNode } from 'react'
import { getT } from '@/shared/i18n/server'
import { TYPE_LABELS } from '@/shared/labels'

const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` })

/**
 * A sample exam sheet that plays the product once on load: a scan line passes, the questions
 * are boxed one by one, then the right answer is highlighted and ticked. Nothing loops.
 */
export async function HeroSheet() {
  const t = await getT()
  const options = [t('具有核膜'), t('具有 70S 核糖體'), t('具有粒線體'), t('染色體為線狀')]
  return (
    <div className="relative mx-auto w-full max-w-[480px] lg:mr-0" aria-hidden>
      <div className="relative -rotate-1 overflow-hidden rounded-2xl bg-surface px-5 pb-6 pt-5 shadow-sheet sm:px-7">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <span className="font-semibold">{t('普生期中考')}</span>
          <span className="flex items-baseline gap-1 text-xs text-muted">
            {t('姓名：')}
            <span className="inline-block w-14 border-b border-line" />
          </span>
        </div>

        <Boxed i={0} label={`1 · ${t(TYPE_LABELS.single_choice)}`}>
          <p className="flex items-baseline justify-between gap-3 text-[15px]">
            {t('下列何者為原核生物的特徵？')}
            <span className="pen m-enter shrink-0 -rotate-3 text-[17px] leading-none" style={delay(2500)}>
              {t('答對！')}
            </span>
          </p>
          <ol className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-sm text-muted sm:grid-cols-2">
            {options.map((o, n) => (
              <li key={n} className="flex items-center gap-1.5">
                <span className="num">({'ABCD'[n]})</span>
                {n === 1 ? (
                  <>
                    <span className="hl m-sweep text-ink" style={delay(2000)}>
                      {o}
                    </span>
                    <Tick />
                  </>
                ) : (
                  o
                )}
              </li>
            ))}
          </ol>
        </Boxed>

        <Boxed i={1} label={`2 · ${t(TYPE_LABELS.true_false)}`}>
          <p className="text-[15px]">{t('依下表，酵母菌是真核生物。')}</p>
          <table className="mt-2 w-full text-left text-xs">
            <thead className="text-muted">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">{t('生物')}</th>
                <th className="py-1 font-medium">{t('細胞壁')}</th>
                <th className="py-1 font-medium">{t('核膜')}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-line/60">
                <td className="py-1">{t('大腸桿菌')}</td>
                <td>○</td>
                <td>✕</td>
              </tr>
              <tr>
                <td className="py-1">{t('酵母菌')}</td>
                <td>○</td>
                <td>○</td>
              </tr>
            </tbody>
          </table>
        </Boxed>

        <Boxed i={2} label={`3 · ${t(TYPE_LABELS.calculation)}`}>
          <p className="text-[15px]">{t('一個細菌每 20 分鐘分裂一次，2 小時後會有幾個？')}</p>
          <div className="mt-3 h-5 border-b border-dashed border-line" />
        </Boxed>

        <div className="m-scan-bar m-scan-once" />
      </div>

      <div className="m-enter absolute -bottom-8 left-3 rotate-2 rounded-xl bg-night px-4 py-3 text-white shadow-[0_18px_40px_-18px_rgb(10_15_31/0.55)] sm:-left-10" style={delay(1700)}>
        <p className="text-sm font-semibold">{t('已辨識 {n} 題', { n: 3 })}</p>
        <div className="mt-2 flex gap-1.5">
          {(['single_choice', 'true_false', 'calculation'] as const).map((type) => (
            <span key={type} className="rounded-md bg-night-soft px-1.5 py-0.5 text-[11px] text-night-accent">
              {t(TYPE_LABELS[type])}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

/** A question with the blue box the editor draws around it, labelled with its number and type. */
function Boxed({ i, label, children }: { i: number; label: string; children: ReactNode }) {
  return (
    <div className="relative mt-6 px-3 pb-3 pt-3.5">
      <span className="m-box-in pointer-events-none absolute inset-0 rounded-lg border-2 border-accent/70" style={{ '--i': i } as CSSProperties}>
        <span className="absolute -top-2.5 left-2 rounded bg-accent px-1.5 text-[11px] font-semibold leading-[18px] text-on-accent">{label}</span>
      </span>
      {children}
    </div>
  )
}

/** The ballpoint tick from the quiz, drawn after the highlighter. */
function Tick() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" className="shrink-0 overflow-visible">
      <path className="m-pen" style={delay(2300)} pathLength={1} d="M4 13 L10 18.5 L20 6" fill="none" stroke="var(--color-good)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
