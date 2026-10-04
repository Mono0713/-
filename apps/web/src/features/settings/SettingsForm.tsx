'use client'

import { useState, useTransition } from 'react'
import type { ProviderOption } from '@/server/context'
import { IconKey, IconRefresh } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Badge, Button, Card, inputClass } from '@/shared/ui'
import { refreshModels, removeApiKey, saveAiGrading, saveApiKey, saveDefaultProvider, saveLocale, saveModel } from './actions'
import { ModelPicker } from './ModelPicker'
import { CustomProviders, type CustomProviderView } from './CustomProviders'
import { StrengthSettings, type StrengthState } from './StrengthSettings'
import { TranslationSettings } from './TranslationSettings'
import type { ProviderInfo } from '@exam/models'
import type { UsageRow } from '@exam/usage/estimates'
import { CalmSwitch } from '@/shared/motion/CalmSwitch'
import { ThemePicker } from '@/shared/theme/ThemePicker'

export interface KeyInfo {
  source: 'settings' | 'env' | null
  hint: string | null
}

// Where each provider hands out API keys.
const KEY_PAGES: Record<string, string> = {
  claude: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
}

/** The settings page: each change is saved as soon as it is made. */
export function SettingsForm({
  locales,
  locale,
  defaultProvider,
  providers,
  keys,
  aiGrading,
  keysInDatabase,
  routing,
  strength,
  translationEngine,
  usage,
  month,
  custom,
  hosted,
}: {
  locales: { id: string; label: string }[]
  locale: string
  defaultProvider: string
  providers: ProviderOption[]
  keys: Record<string, KeyInfo>
  /** The saved choice, and what it resolves to even while switched off (null: no key yet). */
  aiGrading: { enabled: boolean; active: { provider: string; model: string } | null }
  /** Keys are kept encrypted in the hosted database rather than in the local data folder. */
  keysInDatabase: boolean
  /** Every service with its models and prices, without keys, for the strength estimates. */
  routing: ProviderInfo[]
  strength: StrengthState
  translationEngine: 'free' | 'ai'
  /** Recent AI calls, added up per task and model, so estimates follow real use. */
  usage: UsageRow[]
  /** Spend this calendar month; `unpriced` when some calls used a model without a known price. */
  month: { usd: string; unpriced: boolean } | null
  custom: CustomProviderView[]
  /** Hosted with accounts: only public HTTPS services can be added. */
  hosted: boolean
}) {
  const [, start] = useTransition()
  const run = (action: () => Promise<unknown>) => start(async () => void (await action()))
  // every change saves on the spot; no "saved" note (the control itself already shows the new value)
  const flash = () => {}
  const apis = providers.filter((p) => p.id !== 'manual' && p.id !== 'auto' && !p.id.startsWith('c-'))

  return (
    <div className="space-y-6">
      <Section title="一般">
        <Row label="介面語言" hint="AI 寫的校對備註（⚠ 提示）會用這個語言。網頁文字的翻譯會陸續加入。">
          <select defaultValue={locale} onChange={(e) => run(() => saveLocale(e.target.value))} className={inputClass}>
            {locales.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </Row>
        <Row label="外觀" hint="淺色或深色。只記在這個瀏覽器裡。">
          <ThemePicker />
        </Row>
        <Row plain label="做題時減少動畫" hint="換題、對答案時不播動畫，畫面直接切換，專心作答。只記在這個瀏覽器裡。">
          <CalmSwitch />
        </Row>
        <Row label="預設辨識方式" hint="匯入考卷時先選好的方式，每次上傳仍可以改。">
          <select defaultValue={defaultProvider} onChange={(e) => run(() => saveDefaultProvider(e.target.value))} className={inputClass}>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.ready ? '' : '（還沒有 API 金鑰）'}
              </option>
            ))}
          </select>
        </Row>
      </Section>

      <Section
        title="AI 強度"
        note={`拉一次套用到所有工作。費用是依各家公開價格的粗估，用久了會改用你的實際用量計算。${month ? `本月已花約 ${month.usd}${month.unpriced ? '（不含沒填價格的模型）' : ''}。` : ''}`}
      >
        <StrengthSettings providers={routing} initial={strength} usage={usage} onSaved={flash} />
      </Section>

      <Section
        title="AI 批改"
        note="為了省 AI 用量：程式先自己比對答案（格式不同也算對，例如 1/2、0.5、½），比不出來的才交給 AI；交卷時一次批改全部；同一題同樣的答案只問一次。選擇題和是非題不會用到 AI。"
      >
        <TeacherSettings initial={aiGrading} onSaved={flash} />
      </Section>

      <Section title="翻譯" note="題目不是介面語言時，做題畫面會有翻譯按鈕，題目和選項一起翻。覺得免費翻譯不夠好，可以改用 AI 翻譯（用你的 API 金鑰）。">
        <TranslationSettings initial={{ engine: translationEngine, strength: strength.taskStrength.translation ?? null }} strength={strength.strength} providers={routing} override={strength.taskModels.translation ?? null} />
      </Section>

      <Section
        title="模型與 API 金鑰"
        note={`${keysInDatabase ? '金鑰加密後存在你的帳號裡，只有你能用' : '金鑰只存在這台電腦的資料夾裡（data/settings.json）'}，網頁上不會再顯示完整金鑰，也只會送到該家 AI 服務。`}
      >
        {apis.map((p) => (
          <ProviderRow key={p.id} provider={p} info={keys[p.id]!} onSaved={flash} />
        ))}
      </Section>

      <Section title="其他 AI 服務" note="OpenRouter、DeepSeek、Groq、本機的 Ollama 等支援 OpenAI 相容格式的服務都能接；接上後自動模式會把它們一起算進去，最便宜的先用。">
        <CustomProviders providers={custom} hosted={hosted} onSaved={flash} />
      </Section>
    </div>
  )
}

function ProviderRow({ provider: p, info: saved, onSaved }: { provider: ProviderOption; info: KeyInfo; onSaved: () => void }) {
  const { remove, isRemoved } = useRemoval()
  // while a removed key waits for 復原 the row already shows it gone
  const info: KeyInfo = isRemoved(`key:${p.id}`) ? { ...saved, source: null, hint: null } : saved
  const [editing, setEditing] = useState(info.source === null)
  const [key, setKey] = useState('')
  const [model, setModel] = useState(p.model)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, start] = useTransition()

  const submitKey = () =>
    start(async () => {
      const result = await saveApiKey(p.id, key)
      if (!result.ok) return setMessage({ tone: 'bad', text: result.error })
      setKey('')
      setEditing(false)
      setMessage(result.note ? { tone: 'bad', text: result.note } : null)
      onSaved()
    })

  return (
    <div className="space-y-3 border-t border-line/70 px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{p.label}</span>
        {info.source === 'settings' && <Badge tone="good">已設定金鑰{info.hint ? `（…${info.hint}）` : ''}</Badge>}
        {info.source === 'env' && <Badge tone="accent">使用 .env 裡的金鑰</Badge>}
        {info.source === null && <Badge>還沒有金鑰</Badge>}
        <a href={KEY_PAGES[p.id]} target="_blank" rel="noreferrer" className="ml-auto text-xs text-accent hover:underline">
          取得金鑰 ↗
        </a>
      </div>

      {editing ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            submitKey()
          }}
        >
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="貼上 API 金鑰"
            autoComplete="off"
            spellCheck={false}
            className={`${inputClass} min-w-0 flex-1 basis-56 font-mono`}
            aria-label={`${p.label} 金鑰`}
          />
          <Button type="submit" variant="primary" disabled={!key.trim() || pending} loading={pending} icon={<IconKey size={15} />}>
            {pending ? '確認中…' : '確認並儲存'}
          </Button>
          {info.source !== null && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              取消
            </Button>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)} icon={<IconKey size={15} />}>
            {info.source === 'settings' ? '更換金鑰' : '改用自己的金鑰'}
          </Button>
          {info.source === 'settings' && (
            <Button
              variant="danger"
              onClick={() => remove({ id: `key:${p.id}`, note: `已移除 ${p.label} 的金鑰`, commit: async () => (await removeApiKey(p.id), onSaved()) })}
            >
              移除
            </Button>
          )}
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)] sm:items-start">
        <span className="pt-2 text-sm text-muted">預設模型</span>
        <div className="flex flex-wrap items-start gap-2">
          <div className="min-w-0 flex-1 basis-60">
            <ModelPicker
              models={p.models}
              value={model}
              onChange={(m) => {
                setModel(m)
                start(async () => (await saveModel(p.id, m), onSaved()))
              }}
            />
          </div>
          {p.ready && (
            <Button
              variant="ghost"
              onClick={() =>
                start(async () => {
                  const result = await refreshModels(p.id)
                  setMessage(result.ok ? { tone: 'good', text: result.note ?? '' } : { tone: 'bad', text: result.error })
                })
              }
              icon={<IconRefresh size={15} />}
              title="向服務查詢這把金鑰能用的模型，加到清單裡"
            >
              更新清單
            </Button>
          )}
        </div>
      </div>

      {message && <p className={`text-sm ${message.tone === 'good' ? 'text-good' : 'text-bad'}`}>{message.text}</p>}
    </div>
  )
}

function TeacherSettings({ initial, onSaved }: { initial: { enabled: boolean; active: { provider: string; model: string } | null }; onSaved: () => void }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [, start] = useTransition()
  return (
    <Row plain label="用 AI 批改" hint="問答、計算、填空題，以及沒有標準答案的題目，交卷後由 AI 老師評分並寫評語；你隨時可以自己改分數。用哪個模型跟著上面的 AI 強度。">
      <span className="flex items-center gap-3">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="用 AI 批改"
          onClick={() => {
            setEnabled(!enabled)
            start(async () => (await saveAiGrading({ enabled: !enabled }), onSaved()))
          }}
          className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${enabled ? 'bg-accent' : 'bg-ink/15'}`}
        >
          <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300 [transition-timing-function:var(--m-spring)] ${enabled ? 'translate-x-5.5' : 'translate-x-0.5'}`} />
        </button>
        <span className="text-sm text-muted">
          {!enabled ? '關閉，問答題自己評分' : initial.active ? `目前使用 ${initial.active.model}` : '需要先在下面加上任一家的 API 金鑰'}
        </span>
      </span>
    </Row>
  )
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted">{title}</h2>
      <Card className="overflow-hidden">{children}</Card>
      {note && <p className="mt-2 px-1 text-xs text-muted">{note}</p>}
    </section>
  )
}

/** A labelled setting; `plain` for rows whose control is not a single form field (a label would forward clicks). */
function Row({ label, hint, children, plain = false }: { label: string; hint?: string; children: React.ReactNode; plain?: boolean }) {
  const Tag = plain ? 'div' : 'label'
  return (
    <Tag className="grid gap-2 border-t border-line/70 px-5 py-4 first:border-t-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
      <span>
        <span className="block text-sm font-medium">{label}</span>
      </span>
      <span className="block space-y-1.5">
        {children}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </Tag>
  )
}
