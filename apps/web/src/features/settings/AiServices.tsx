'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconChevronDown, IconExternal, IconKey, IconPlus, IconRefresh } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Button, inputClass } from '@/shared/ui'
import { refreshModels, removeApiKey, saveApiKey } from './actions'
import { AddService, CustomService, type CustomProviderView } from './CustomProviders'

export interface BuiltinService {
  id: string
  label: string
  /** Where its key comes from: the settings page, the server's .env, or nowhere yet. */
  source: 'settings' | 'env' | null
  /** Last four characters of a saved key. */
  hint: string | null
}

// Where each provider hands out API keys.
const KEY_PAGES: Record<string, string> = {
  claude: 'https://console.anthropic.com/settings/keys',
  openai: 'https://platform.openai.com/api-keys',
  gemini: 'https://aistudio.google.com/apikey',
}

/**
 * 接上 AI 服務: Claude, OpenAI, Gemini and the services the person added, one row each, with whether
 * it is connected. A row opens in place to paste or change its key, and for an added service to pick
 * its models and say which of them see pictures.
 */
export function AiServices({ builtin, custom, hosted }: { builtin: BuiltinService[]; custom: CustomProviderView[]; hosted: boolean }) {
  const t = useT()
  const { isRemoved } = useRemoval()
  const [open, setOpen] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const toggle = (id: string) => setOpen(open === id ? null : id)
  const services = custom.filter((c) => !isRemoved(`provider:${c.id}`))
  const on = (b: BuiltinService) => b.source === 'env' || (b.source === 'settings' && !isRemoved(`key:${b.id}`))
  const none = !builtin.some(on) && !services.some((c) => c.keyHint !== null)
  return (
    <>
      {none && <p className="border-b border-line/70 bg-accent-soft/40 px-5 py-3 text-sm">{t('先接上一家 AI 服務：打開下面任一家，貼上它的 API 金鑰。')}</p>}
      {/* connected services first, the ones still to connect last */}
      {[...builtin.filter(on), ...services, ...builtin.filter((b) => !on(b))].map((service) =>
        'baseUrl' in service ? (
          <ServiceRow
            key={service.id}
            name={service.name}
            on={service.keyHint !== null || service.models.length > 0}
            detail={`${service.baseUrl} · ${t('{n} 個模型', { n: service.models.length })}`}
            open={open === service.id}
            onToggle={() => toggle(service.id)}
          >
            <CustomService provider={service} />
          </ServiceRow>
        ) : (
          <ServiceRow
            key={service.id}
            name={service.label}
            on={on(service)}
            detail={on(service) ? (service.source === 'env' ? t('使用 .env 裡的金鑰') : service.hint ? t('已接上 · 金鑰 …{hint}', { hint: service.hint }) : t('已接上')) : t('還沒接上')}
            open={open === service.id}
            onToggle={() => toggle(service.id)}
          >
            <BuiltinKey service={service} on={on(service)} onDone={() => setOpen(null)} />
          </ServiceRow>
        ),
      )}
      <div className="px-5 py-4">
        {adding ? (
          <AddService hosted={hosted} onDone={(id, n) => (setAdding(false), setNote(n ?? null), id && setOpen(id))} onCancel={() => setAdding(false)} />
        ) : (
          <>
            {note && <p className="mb-3 text-sm text-muted">{note}</p>}
            <Button onClick={() => (setAdding(true), setNote(null))} icon={<IconPlus size={15} />}>
              {t('接上其他 AI 服務')}
            </Button>
            <p className="mt-2 text-xs text-muted">{t('OpenRouter、DeepSeek、通義千問、轉接站或本機的 Ollama，只要支援 OpenAI 相容格式都能接。')}</p>
          </>
        )}
      </div>
    </>
  )
}

/** One service: its name, whether it is connected, and its settings when opened. */
function ServiceRow({ name, on, detail, open, onToggle, children }: { name: string; on: boolean; detail: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div className="border-b border-line/70">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-ink/[0.025]">
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${on ? 'bg-good' : 'bg-ink/15'}`} />
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${on ? '' : 'text-muted'}`}>{name}</span>
          <span className="block truncate text-xs text-muted">{detail}</span>
        </span>
        <IconChevronDown size={16} className={`shrink-0 text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="m-expand space-y-3 px-5 pb-4 sm:pl-10">{children}</div>}
    </div>
  )
}

/** Paste, change or remove the key of Claude, OpenAI or Gemini. */
function BuiltinKey({ service: b, on, onDone }: { service: BuiltinService; on: boolean; onDone: () => void }) {
  const t = useT()
  const { remove } = useRemoval()
  const [editing, setEditing] = useState(!on)
  const [key, setKey] = useState('')
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, start] = useTransition()
  return (
    <>
      {editing ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const result = await saveApiKey(b.id, key)
              if (!result.ok) return setMessage({ tone: 'bad', text: result.error })
              setKey('')
              setEditing(false)
              setMessage(result.note ? { tone: 'bad', text: result.note } : null)
              if (!result.note) onDone()
            })
          }}
        >
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={t('貼上 API 金鑰')}
            autoComplete="off"
            spellCheck={false}
            autoFocus
            className={`${inputClass} min-w-0 flex-1 basis-56 font-mono`}
            aria-label={t('{name} 金鑰', { name: b.label })}
          />
          <Button type="submit" variant="primary" disabled={!key.trim() || pending} loading={pending} icon={<IconKey size={15} />}>
            {pending ? t('確認中…') : t('確認並儲存')}
          </Button>
          {on && (
            <Button variant="ghost" onClick={() => setEditing(false)}>
              {t('取消')}
            </Button>
          )}
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => setEditing(true)} icon={<IconKey size={15} />}>
            {b.source === 'settings' ? t('更換金鑰') : t('改用自己的金鑰')}
          </Button>
          <Button
            variant="ghost"
            icon={<IconRefresh size={15} />}
            title={t('向服務查詢這把金鑰能用的模型，加到清單裡')}
            onClick={() =>
              start(async () => {
                const result = await refreshModels(b.id)
                setMessage(result.ok ? { tone: 'good', text: result.note ?? '' } : { tone: 'bad', text: result.error })
              })
            }
          >
            {t('更新模型清單')}
          </Button>
          {b.source === 'settings' && (
            <Button variant="danger" onClick={() => remove({ id: `key:${b.id}`, note: t('已移除 {name} 的金鑰', { name: b.label }), commit: () => removeApiKey(b.id) })}>
              {t('移除金鑰')}
            </Button>
          )}
        </div>
      )}
      {message && <p className={`text-sm ${message.tone === 'good' ? 'text-good' : 'text-bad'}`}>{message.text}</p>}
      {KEY_PAGES[b.id] && (
        <a href={KEY_PAGES[b.id]} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
          {t('到 {name} 取得金鑰', { name: b.label })}
          <IconExternal size={12} aria-hidden />
        </a>
      )}
    </>
  )
}
