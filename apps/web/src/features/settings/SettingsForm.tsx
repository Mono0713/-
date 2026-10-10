'use client'

import type { ProviderInfo } from '@exam/models'
import type { UsageRow } from '@exam/usage/estimates'
import type { ReactNode } from 'react'
import { useLocaleSwitch, useT } from '@/shared/i18n/client'
import { CalmSwitch } from '@/shared/motion/CalmSwitch'
import { ThemePicker } from '@/shared/theme/ThemePicker'
import { Card, inputClass } from '@/shared/ui'
import { AiServices, type BuiltinService } from './AiServices'
import type { CustomProviderView } from './CustomProviders'
import { TaskModels, type TaskModelsState } from './TaskModels'

/** The settings page: 一般, then AI in two steps (connect a service, pick each task's model). Each change is saved as soon as it is made. */
export function SettingsForm({
  locales,
  locale,
  builtin,
  custom,
  hosted,
  keysInDatabase,
  routing,
  models,
  usage,
  month,
}: {
  locales: { id: string; label: string }[]
  locale: string
  builtin: BuiltinService[]
  custom: CustomProviderView[]
  /** Hosted with accounts: only public HTTPS services can be added. */
  hosted: boolean
  /** Keys are kept encrypted in the hosted database rather than in the local data folder. */
  keysInDatabase: boolean
  /** Every service with its models and prices, without keys, for routes and estimates. */
  routing: ProviderInfo[]
  models: TaskModelsState
  /** Recent AI calls, added up per task and model, so estimates follow real use. */
  usage: UsageRow[]
  /** Spend this calendar month; `unpriced` when some calls used a model without a known price. */
  month: { usd: string; unpriced: boolean } | null
}) {
  const t = useT()
  // the picker shows the chosen language at once; the page follows behind the top loading bar
  const { target, switchTo } = useLocaleSwitch()

  return (
    <div className="space-y-9">
      <section>
        <Heading title={t('一般')} />
        <Card className="overflow-hidden">
          <Row label={t('介面語言')} hint={t('介面和 AI 寫的校對備註（⚠ 提示）都會用這個語言。')}>
            <select value={target} onChange={(e) => switchTo(e.target.value)} className={inputClass}>
              {locales.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </Row>
          <Row label={t('外觀')} hint={t('淺色或深色。只記在這個瀏覽器裡。')}>
            <ThemePicker />
          </Row>
          <Row plain label={t('做題時減少動畫')} hint={t('換題、對答案時不播動畫，畫面直接切換，專心作答。只記在這個瀏覽器裡。')}>
            <CalmSwitch />
          </Row>
        </Card>
      </section>

      <section id="ai" className="scroll-mt-6 space-y-5">
        <Heading
          title="AI"
          aside={month && (month.unpriced ? t('本月約 {usd}（不含沒填價格的模型）', { usd: month.usd }) : t('本月約 {usd}', { usd: month.usd }))}
        />
        <Step
          id="keys"
          n={1}
          title={t('接上 AI 服務')}
          note={
            keysInDatabase
              ? t('金鑰加密後存在你的帳號裡，只有你能用，網頁上不會再顯示完整金鑰，也只會送到該家 AI 服務。')
              : t('金鑰只存在這台電腦的資料夾裡（data/settings.json），網頁上不會再顯示完整金鑰，也只會送到該家 AI 服務。')
          }
        >
          <AiServices builtin={builtin} custom={custom} hosted={hosted} />
        </Step>
        <Step n={2} title={t('每項工作用哪個模型')} note={t('費用是依公開價格的粗估，用久了會改用你的實際用量計算。選的模型呼叫失敗時，會自動換其他接上的服務。')}>
          <TaskModels providers={routing} initial={models} usage={usage} />
        </Step>
      </section>
    </div>
  )
}

function Heading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between gap-3 px-1">
      <h2 className="text-[13px] font-semibold tracking-wide text-muted">{title}</h2>
      {aside && <span className="num text-xs text-muted">{aside}</span>}
    </div>
  )
}

/** One numbered step of the AI settings: a card with its own title. */
function Step({ id, n, title, note, children }: { id?: string; n: number; title: string; note?: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6">
      <Card className="overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-line/70 px-5 py-3">
          <span aria-hidden className="num grid h-5 w-5 shrink-0 place-items-center rounded-full border border-ink/25 text-[11px] font-semibold">
            {n}
          </span>
          <h3 className="font-medium">{title}</h3>
        </div>
        {children}
      </Card>
      {note && <p className="mt-2 px-1 text-xs text-muted">{note}</p>}
    </div>
  )
}

/** A labelled setting; `plain` for rows whose control is not a single form field (a label would forward clicks). */
function Row({ label, hint, children, plain = false }: { label: string; hint?: string; children: ReactNode; plain?: boolean }) {
  const Tag = plain ? 'div' : 'label'
  return (
    <Tag className="grid gap-2 border-t border-line/70 px-5 py-4 first:border-t-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
      <span className="block text-sm font-medium">{label}</span>
      <span className="block space-y-1.5">
        {children}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </Tag>
  )
}
