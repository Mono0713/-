import type { OptionStat } from '@exam/classes'
import type { T } from '@/shared/i18n/format'
import { Markdown } from '@/shared/Markdown'
import { Card } from '@/shared/ui'

/**
 * For each choice question, how many students picked each option. The right options are green;
 * the wrong option most students fell for is red, so a common misunderstanding stands out.
 */
export function OptionAnalysis({ stats, handedIn, t }: { stats: OptionStat[]; handedIn: number; t: T }) {
  if (!stats.length) return null
  return (
    <Card className="p-5">
      <h2 className="mb-1 text-sm font-semibold">{t('選項分析')}</h2>
      <p className="mb-4 text-xs text-muted">{t('綠色是正確選項，紅色是最多人誤選的選項。')}</p>
      {handedIn === 0 ? (
        <p className="text-sm text-muted">{t('有人交卷後會出現。')}</p>
      ) : (
        <ul className="space-y-5">
          {stats.map((q) => {
            const trap = Math.max(0, ...q.options.filter((o) => !o.correct).map((o) => o.picked))
            return (
              <li key={q.questionId}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-start gap-3 text-sm">
                    <span className="w-8 shrink-0 text-right tabular-nums text-muted">{q.number}</span>
                    <span className="flex min-w-0 flex-1 gap-[2px] overflow-hidden rounded-full" aria-hidden>
                      {q.options.map((o) => (
                        <span
                          key={o.label}
                          className={`h-2 ${o.correct ? 'bg-good' : trap > 0 && o.picked === trap ? 'bg-bad' : 'bg-ink/15'}`}
                          style={{ flexGrow: o.picked, display: o.picked ? undefined : 'none' }}
                        />
                      ))}
                      {q.blank > 0 && <span className="h-2 bg-ink/[0.06]" style={{ flexGrow: q.blank }} />}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{q.options.map((o) => `${o.label} ${o.picked}`).join(' · ')}</span>
                  </summary>
                  <div className="ml-11 mt-2 space-y-1.5 text-sm">
                    <div className="line-clamp-3 text-muted">
                      <Markdown>{q.stem}</Markdown>
                    </div>
                    {q.options.map((o) => (
                      <div key={o.label} className="flex items-center gap-2">
                        <span className={`w-6 shrink-0 font-medium ${o.correct ? 'text-good' : trap > 0 && o.picked === trap ? 'text-bad' : ''}`}>{o.label}</span>
                        <span className="min-w-0 flex-1 truncate">{o.content}</span>
                        <span className="num shrink-0 text-muted">{t('{n} 人', { n: o.picked })}</span>
                      </div>
                    ))}
                    {q.blank > 0 && <p className="text-xs text-muted">{t('沒作答 {n} 人', { n: q.blank })}</p>}
                  </div>
                </details>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
