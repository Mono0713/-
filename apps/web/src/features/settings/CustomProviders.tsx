'use client'

import { guessVision, TIERS, type Tier } from '@exam/models'
import { useRef, useState, useTransition } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { IconPlus, IconRefresh, IconX } from '@/shared/icons'
import { Listbox } from '@/shared/Listbox'
import { useRemoval } from '@/shared/removal'
import { Button, inputBase, inputClass } from '@/shared/ui'
import { addCustomProvider, detectVision, refreshModels, removeCustomProvider, saveCustomModels } from './actions'
import { ApiKeys, type SavedKey } from './ApiKeys'
import { TIER_LABELS } from './strengths'

export interface CustomModel {
  id: string
  tier: Tier
  vision: boolean
  price: { input: number; output: number } | null
}

export interface CustomProviderView {
  id: string
  name: string
  baseUrl: string
  /** Its saved keys, in the order they were added; none for a local service such as Ollama. */
  keys: SavedKey[]
  models: CustomModel[]
  /** Model ids the service listed last time it was asked. */
  known: string[]
}

// Services known to speak the OpenAI format; any other works too with its address. Names are translated where shown: t(p.name).
const PRESETS = [
  { name: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { name: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
  { name: 'Groq', url: 'https://api.groq.com/openai/v1' },
  { name: 'Mistral', url: 'https://api.mistral.ai/v1' },
  { name: 'xAI', url: 'https://api.x.ai/v1' },
  { name: msg('通義千問'), url: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1' },
  { name: 'Ollama', url: 'http://localhost:11434/v1', local: true },
  { name: 'LM Studio', url: 'http://localhost:1234/v1', local: true },
]


/** Adds a service that speaks the OpenAI format: a known one in one tap, or any address. `onDone` gets its id to open it. */
export function AddService({ hosted, onDone, onCancel }: { hosted: boolean; onDone: (id: string | undefined, note?: string) => void; onCancel: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const presets = PRESETS.filter((p) => !hosted || !p.local)
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault()
        start(async () => {
          const result = await addCustomProvider({ name, baseUrl: url, apiKey: key })
          if (!result.ok) return setError(result.error)
          onDone(result.id, result.note)
        })
      }}
    >
      <p className="text-sm text-muted">{t('大部分 AI 服務都支援「OpenAI 相容」格式。選一個常見的，或貼上任何服務的 API 網址。')}</p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <button
            key={p.name}
            type="button"
            onClick={() => (setName(t(p.name)), setUrl(p.url))}
            className={`m-press rounded-full border px-2.5 py-1 text-xs ${url === p.url ? 'border-accent bg-accent-soft text-accent' : 'border-line text-muted hover:text-ink'}`}
          >
            {t(p.name)}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
        <input autoComplete="off" value={name} onChange={(e) => setName(e.target.value)} placeholder={t('名稱')} className={inputClass} aria-label={t('服務名稱')} />
        <input autoComplete="off" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…/v1" className={`${inputClass} font-mono`} aria-label={t('API 網址')} spellCheck={false} />
      </div>
      <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t('API 金鑰（本機模型可以留空）')} autoComplete="off" spellCheck={false} className={`${inputClass} font-mono`} aria-label={t('API 金鑰')} />
      {error && <p className="m-shake text-sm text-bad">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={!name.trim() || !url.trim() || pending} loading={pending}>
          {pending ? t('連線確認中…') : t('新增')}
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          {t('取消')}
        </Button>
      </div>
    </form>
  )
}

/** An added service, opened: its key, the models it is used with (tier, pictures, price), and removing it. */
export function CustomService({ provider: p }: { provider: CustomProviderView }) {
  const t = useT()
  const [models, setModels] = useState(p.models)
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, start] = useTransition()
  const { remove } = useRemoval()
  const [checking, setChecking] = useState<string[]>([])
  // The list as last committed, for answers that arrive after other edits.
  const latest = useRef(models)
  const commit = (next: CustomModel[]) => {
    latest.current = next
    setModels(next)
    start(async () => void (await saveCustomModels(p.id, next)))
  }
  /** Adds a model with 看得懂圖 set from its name, or, when the name doesn't say, from a small test call. */
  const addModel = (id: string) => {
    const guess = guessVision(id)
    commit([...latest.current, { id, tier: 'balanced', vision: guess ?? true, price: null }])
    if (guess !== null) return
    setChecking((ids) => [...ids, id])
    void detectVision(p.id, id).then(({ vision }) => {
      setChecking((ids) => ids.filter((x) => x !== id))
      if (!latest.current.some((m) => m.id === id)) return
      if (vision === null) return setMessage({ tone: 'bad', text: t('{model}：試不出看不看得懂圖，請自己確認「看得懂圖」。', { model: id }) })
      commit(latest.current.map((m) => (m.id === id ? { ...m, vision } : m)))
      setMessage({ tone: 'good', text: vision ? t('{model} 看得懂圖。', { model: id }) : t('{model} 看不懂圖，已關掉「看得懂圖」。', { model: id }) })
    })
  }
  const change = (i: number, patch: Partial<CustomModel>) => commit(models.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const addable = p.known.filter((id) => !models.some((m) => m.id === id))

  return (
    <>
      <ApiKeys provider={p.id} name={p.name} keys={p.keys} />

      <div>
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium">{t('要用的模型')}</p>
          <Button
            variant="ghost"
            icon={<IconRefresh size={15} />}
            title={t('向服務查詢這把金鑰能用的模型，加到清單裡')}
            onClick={() =>
              start(async () => {
                const result = await refreshModels(p.id)
                setMessage(result.ok ? { tone: 'good', text: result.note ?? '' } : { tone: 'bad', text: result.error })
              })
            }
          >
            {t('更新模型清單')}
          </Button>
        </div>
        {models.length > 0 ? (
          <ul className="divide-y divide-line/70 rounded-lg border border-line/70">
            {models.map((m, i) => (
              <li key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate font-mono text-xs sm:basis-40">{m.id}</span>
                {/* on a phone: name and × on one line, the settings below; wider: all on one line, × last */}
                <button type="button" onClick={() => commit(models.filter((_, j) => j !== i))} className="m-press grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-bad-soft hover:text-bad sm:order-last" aria-label={t('移除 {model}', { model: m.id })}>
                  <IconX size={15} />
                </button>
                <span className="flex basis-full flex-wrap items-center gap-x-3 gap-y-2 sm:basis-auto">
                  <label className="flex items-center gap-1.5 text-xs text-muted" title={t('勾了才會拿來讀考卷、手寫和有圖的題目')}>
                    <input type="checkbox" className="m-check" checked={m.vision} disabled={checking.includes(m.id)} onChange={(e) => change(i, { vision: e.target.checked })} />
                    {checking.includes(m.id) ? t('判斷看不看得懂圖…') : t('看得懂圖')}
                  </label>
                  <select value={m.tier} onChange={(e) => change(i, { tier: e.target.value as Tier })} className={`${inputBase} py-1 text-xs`} aria-label={t('{model} 在自動時算哪一級', { model: m.id })} title={t('一鍵套用選這一級時，自動會挑它')}>
                    {TIERS.map((tier) => (
                      <option key={tier} value={tier}>
                        {t(TIER_LABELS[tier])}
                      </option>
                    ))}
                  </select>
                  <PriceInput value={m.price} onChange={(price) => change(i, { price })} />
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg bg-ink/[0.035] px-3 py-2 text-sm text-muted">{t('還沒有加入模型。加入後就能在下面選它。')}</p>
        )}
        <div className="mt-2">
          <AddModel known={addable} onAdd={addModel} />
        </div>
        <p className="mt-2 text-xs text-muted">{t('「看得懂圖」的模型才會拿來讀考卷、手寫和有圖的題目，加入時會自動判斷。等級決定一鍵套用時自動挑哪個。價格（每百萬 token 的美元）選填，只用來估費用。')}</p>
      </div>
      {message && <p className={`text-sm ${message.tone === 'good' ? 'text-good' : 'text-bad'}`}>{message.text}</p>}
      <div>
        <Button variant="danger" onClick={() => remove({ id: `provider:${p.id}`, note: t('已移除 {name}', { name: p.name }), commit: () => removeCustomProvider(p.id) })}>
          {t('移除這個服務')}
        </Button>
      </div>
    </>
  )
}

function AddModel({ known, onAdd }: { known: string[]; onAdd: (id: string) => void }) {
  const t = useT()
  const [typed, setTyped] = useState('')
  return (
    <div className="flex flex-wrap items-center gap-2">
      {known.length > 0 && (
        <Listbox
          value=""
          label={t('從清單加入模型')}
          className={`${inputBase} min-w-56`}
          onChange={(id) => id && onAdd(id)}
          groups={[{ options: [{ value: '', label: t('從清單加入（{n} 個）', { n: known.length }) }] }, { options: known.slice(0, 300).map((id) => ({ value: id, label: id })) }]}
        />
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (typed.trim()) onAdd(typed.trim())
          setTyped('')
        }}
      >
        <input autoComplete="off" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={t('或輸入模型名稱')} className={`${inputBase} w-48 font-mono`} aria-label={t('模型名稱')} spellCheck={false} />
        <Button type="submit" variant="ghost" disabled={!typed.trim()} icon={<IconPlus size={15} />}>
          {t('新增')}
        </Button>
      </form>
    </div>
  )
}

/** Input and output price per million tokens; both empty means unknown. */
function PriceInput({ value, onChange }: { value: CustomModel['price']; onChange: (price: CustomModel['price']) => void }) {
  const t = useT()
  const [input, setInput] = useState(value ? String(value.input) : '')
  const [output, setOutput] = useState(value ? String(value.output) : '')
  const commit = () => {
    const i = Number(input)
    const o = Number(output)
    const next = input.trim() && output.trim() && Number.isFinite(i) && Number.isFinite(o) && i >= 0 && o >= 0 ? { input: i, output: o } : null
    if (JSON.stringify(next) !== JSON.stringify(value)) onChange(next)
  }
  const field = 'w-16 rounded-md border border-line bg-surface px-2 py-1 text-xs outline-none focus:border-accent/45'
  return (
    <span className="flex items-center gap-1 text-xs text-muted">
      $<input autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} onBlur={commit} inputMode="decimal" placeholder={t('輸入')} className={field} aria-label={t('輸入價格')} />/
      <input autoComplete="off" value={output} onChange={(e) => setOutput(e.target.value)} onBlur={commit} inputMode="decimal" placeholder={t('輸出')} className={field} aria-label={t('輸出價格')} />
    </span>
  )
}
