'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconChevronDown, IconExternal, IconPlus, IconRefresh } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Button } from '@/shared/ui'
import { refreshModels } from './actions'
import { ApiKeys, type SavedKey } from './ApiKeys'
import { AddService, CustomService, type CustomProviderView } from './CustomProviders'

export interface BuiltinService {
  id: string
  label: string
  /** Where its key comes from: the settings page, the server's .env, or nowhere yet. */
  source: 'settings' | 'env' | null
  /** Its saved keys, in the order they were added. */
  keys: SavedKey[]
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
  const live = (keys: SavedKey[]) => keys.filter((k) => !isRemoved(`key:${k.slot}`))
  const on = (b: BuiltinService) => b.source === 'env' || live(b.keys).length > 0
  const none = !builtin.some(on) && !services.some((c) => live(c.keys).length > 0)
  return (
    <>
      {none && <p className="border-b border-line/70 bg-accent-soft/40 px-5 py-3 text-sm">{t('先接上一家 AI 服務：打開下面任一家，貼上它的 API 金鑰。')}</p>}
      {/* connected services first, the ones still to connect last */}
      {[...builtin.filter(on), ...services, ...builtin.filter((b) => !on(b))].map((service) =>
        'baseUrl' in service ? (
          <ServiceRow
            key={service.id}
            name={service.name}
            on={live(service.keys).length > 0 || service.models.length > 0}
            detail={`${service.baseUrl} · ${t('{n} 個模型', { n: service.models.length })}${live(service.keys).length > 1 ? ` · ${t('{n} 把金鑰', { n: live(service.keys).length })}` : ''}`}
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
            detail={on(service) ? (service.source === 'env' ? t('使用 .env 裡的金鑰') : keyDetail(t, live(service.keys))) : t('還沒接上')}
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

/** 已接上 with the last characters of its key, or how many keys it has. */
function keyDetail(t: ReturnType<typeof useT>, keys: SavedKey[]): string {
  if (keys.length > 1) return t('已接上 · {n} 把金鑰', { n: keys.length })
  const hint = keys[0]?.hint
  return hint ? t('已接上 · 金鑰 …{hint}', { hint }) : t('已接上')
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

/** The keys of Claude, OpenAI or Gemini (one or several), and asking it for its models. */
function BuiltinKey({ service: b, on, onDone }: { service: BuiltinService; on: boolean; onDone: () => void }) {
  const t = useT()
  const [message, setMessage] = useState<{ tone: 'good' | 'bad'; text: string } | null>(null)
  const [pending, start] = useTransition()
  return (
    <>
      <ApiKeys
        provider={b.id}
        name={b.label}
        keys={b.keys}
        fromEnv={b.source === 'env'}
        onAdded={(note) => (setMessage(note ? { tone: 'bad', text: note } : null), !note && !on && onDone())}
      />
      {on && (
        <Button
          variant="ghost"
          loading={pending}
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
