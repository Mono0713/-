'use client'

import { useState, useTransition } from 'react'
import type { ProviderOption } from '@/server/context'
import { IconCheck, IconKey, IconRefresh } from '@/shared/icons'
import { Badge, Button, Card, inputClass } from '@/shared/ui'
import { refreshModels, removeApiKey, saveApiKey, saveDefaultProvider, saveLocale, saveModel } from './actions'
import { ModelPicker } from './ModelPicker'

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
}: {
  locales: { id: string; label: string }[]
  locale: string
  defaultProvider: string
  providers: ProviderOption[]
  keys: Record<string, KeyInfo>
}) {
  const [saved, flash] = useFlash()
  const [, start] = useTransition()
  const run = (action: () => Promise<unknown>) => start(async () => {
    await action()
    flash()
  })
  const apis = providers.filter((p) => p.id !== 'manual')

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

      <Section title="模型與 API 金鑰" note="金鑰只存在這台電腦的資料夾裡（data/settings.json），網頁上不會再顯示完整金鑰，也只會送到該家 AI 服務。">
        {apis.map((p) => (
          <ProviderRow key={p.id} provider={p} info={keys[p.id]!} onSaved={flash} />
        ))}
      </Section>

      <p aria-live="polite" className={`fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-night px-4 py-2 text-sm text-white shadow-lg transition-all duration-300 ${saved ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-3 opacity-0'}`}>
        <IconCheck size={15} /> 已儲存
      </p>
    </div>
  )
}

function ProviderRow({ provider: p, info, onSaved }: { provider: ProviderOption; info: KeyInfo; onSaved: () => void }) {
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
              onClick={() => {
                if (confirm(`移除 ${p.label} 的金鑰？`)) start(async () => (await removeApiKey(p.id), onSaved()))
              }}
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

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-semibold tracking-wide text-muted">{title}</h2>
      <Card className="overflow-hidden">{children}</Card>
      {note && <p className="mt-2 px-1 text-xs text-muted">{note}</p>}
    </section>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 border-t border-line/70 px-5 py-4 first:border-t-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start">
      <span>
        <span className="block text-sm font-medium">{label}</span>
      </span>
      <span className="block space-y-1.5">
        {children}
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
    </label>
  )
}

/** A flag that turns itself off after a moment, for "saved" feedback. */
function useFlash(): [boolean, () => void] {
  const [on, setOn] = useState(0)
  return [
    on > 0,
    () => {
      const id = Date.now()
      setOn(id)
      setTimeout(() => setOn((cur) => (cur === id ? 0 : cur)), 1600)
    },
  ]
}
