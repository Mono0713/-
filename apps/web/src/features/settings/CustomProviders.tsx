'use client'

import type { Tier } from '@exam/models'
import { useState, useTransition } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { IconKey, IconPlus, IconRefresh, IconX } from '@/shared/icons'
import { Listbox } from '@/shared/Listbox'
import { useRemoval } from '@/shared/removal'
import { Badge, Button, inputBase, inputClass } from '@/shared/ui'
import { addCustomProvider, refreshModels, removeCustomProvider, saveApiKey, saveCustomModels } from './actions'

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
  /** Last four characters of its saved key, '' when one is saved but short, null without a key. */
  keyHint: string | null
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

const TIERS: [Tier, string][] = [
  ['fast', msg('省錢級')],
  ['balanced', msg('平衡級')],
  ['best', msg('最準級')],
]

/** Services added by the person: any OpenAI-compatible API, with the models picked from it. */
export function CustomProviders({ providers, hosted, onSaved }: { providers: CustomProviderView[]; hosted: boolean; onSaved: () => void }) {
  const t = useT()
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const { isRemoved } = useRemoval()
  return (
    <>
      {providers.filter((p) => !isRemoved(`provider:${p.id}`)).map((p) => (
        <ProviderCard key={p.id} provider={p} onSaved={onSaved} />
      ))}
      <div className="border-t border-line/70 px-5 py-4 first:border-t-0">
        {adding ? (
          <AddForm hosted={hosted} onDone={(n) => (setAdding(false), setNote(n ?? null), onSaved())} onCancel={() => setAdding(false)} />
        ) : (
          <>
            {note && <p className="mb-3 text-sm text-muted">{note}</p>}
            <Button onClick={() => (setAdding(true), setNote(null))} icon={<IconPlus size={15} />}>
              {t('接上其他 AI 服務')}
            </Button>
          </>
        )}
      </div>
    </>
  )
}

function AddForm({ hosted, onDone, onCancel }: { hosted: boolean; onDone: (note?: string) => void; onCancel: () => void }) {
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
          onDone(result.note)
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

function ProviderCard({ provider: p, onSaved }: { provider: CustomProviderView; onSaved: () => void }) {
  const t = useT()
  const [models, setModels] = useState(p.models)
  const [editingKey, setEditingKey] = useState(false)
  const [key, setKey] = useState('')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, start] = useTransition()
  const { remove } = useRemoval()
  const commit = (next: CustomModel[]) => {
    setModels(next)
    start(async () => (await saveCustomModels(p.id, next), onSaved()))
  }
  const change = (i: number, patch: Partial<CustomModel>) => commit(models.map((m, j) => (j === i ? { ...m, ...patch } : m)))
  const addable = p.known.filter((id) => !models.some((m) => m.id === id))

  return (
    <div className="space-y-3 border-t border-line/70 px-5 py-4 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium">{p.name}</span>
        <span className="min-w-0 truncate font-mono text-xs text-muted">{p.baseUrl}</span>
        {p.keyHint !== null ? <Badge tone="good">{p.keyHint ? t('已設定金鑰（…{hint}）', { hint: p.keyHint }) : t('已設定金鑰')}</Badge> : <Badge>{t('沒有金鑰')}</Badge>}
        <span className="ml-auto flex gap-1">
          <Button variant="ghost" onClick={() => setEditingKey(!editingKey)} icon={<IconKey size={15} />}>
            {t('金鑰')}
          </Button>
          <Button
            variant="ghost"
            icon={<IconRefresh size={15} />}
            onClick={() =>
              start(async () => {
                const result = await refreshModels(p.id)
                setMessage(result.ok ? { tone: 'good', text: result.note ?? '' } : { tone: 'bad', text: result.error })
              })
            }
          >
            {t('更新清單')}
          </Button>
          <Button variant="danger" onClick={() => remove({ id: `provider:${p.id}`, note: t('已移除 {name}', { name: p.name }), commit: async () => (await removeCustomProvider(p.id), onSaved()) })}>
            {t('移除')}
          </Button>
        </span>
      </div>

      {editingKey && (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const result = await saveApiKey(p.id, key)
              if (!result.ok) return setMessage({ tone: 'bad', text: result.error })
              setKey('')
              setEditingKey(false)
              onSaved()
            })
          }}
        >
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={t('貼上新的 API 金鑰')} autoComplete="off" spellCheck={false} className={`${inputClass} min-w-0 flex-1 basis-56 font-mono`} aria-label={t('{name} 金鑰', { name: p.name })} />
          <Button type="submit" variant="primary" disabled={!key.trim() || pending} loading={pending}>
            {t('儲存')}
          </Button>
        </form>
      )}

      {models.length > 0 ? (
        <ul className="space-y-2">
          {models.map((m, i) => (
            <li key={m.id} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 basis-40 truncate font-mono text-xs">{m.id}</span>
              <select value={m.tier} onChange={(e) => change(i, { tier: e.target.value as Tier })} className={inputBase} aria-label={t('{model} 等級', { model: m.id })}>
                {TIERS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {t(label)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" className="m-check" checked={m.vision} onChange={(e) => change(i, { vision: e.target.checked })} />
                {t('會看圖')}
              </label>
              <PriceInput value={m.price} onChange={(price) => change(i, { price })} />
              <button type="button" onClick={() => commit(models.filter((_, j) => j !== i))} className="m-press grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-bad-soft hover:text-bad" aria-label={t('移除 {model}', { model: m.id })}>
                <IconX size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t('還沒有加入模型。加入後，自動模式和 AI 強度就會把它算進去。')}</p>
      )}
      <AddModel known={addable} onAdd={(id) => commit([...models, { id, tier: 'balanced', vision: true, price: null }])} />
      <p className="text-xs text-muted">{t('「等級」決定 AI 強度拉到哪一格時用它；只有勾「會看圖」的模型會拿來讀考卷和手寫。價格（每百萬 token 的美元）選填，只用來估費用。')}</p>
      {message && <p className={`text-sm ${message.tone === 'good' ? 'text-good' : 'text-bad'}`}>{message.text}</p>}
    </div>
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
          {t('加入')}
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
