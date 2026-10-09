'use client'

import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconKey, IconPlus, IconTrash } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Button, inputClass } from '@/shared/ui'
import { removeApiKey, saveApiKey } from './actions'

/** A saved key as the browser sees it: where it is stored and its last four characters. */
export interface SavedKey {
  slot: string
  hint: string | null
}

/**
 * The API keys of one service: one line per key with its last characters and a delete button, and
 * 加一把金鑰 to add another. With several, calls move to the next key when one runs out or is refused.
 */
export function ApiKeys({ provider, name, keys, fromEnv = false, onAdded }: { provider: string; name: string; keys: SavedKey[]; fromEnv?: boolean; onAdded?: (note?: string) => void }) {
  const t = useT()
  const { remove, isRemoved } = useRemoval()
  const shown = keys.filter((k) => !isRemoved(`key:${k.slot}`))
  const [adding, setAdding] = useState(!shown.length && !fromEnv)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const open = adding || (!shown.length && !fromEnv)

  return (
    <div className="space-y-2">
      {shown.length > 0 ? (
        <ul className="space-y-1">
          {shown.map((k) => (
            <li key={k.slot} className="flex items-center gap-2 text-sm text-muted">
              <IconKey size={14} aria-hidden className="shrink-0" />
              <span className="font-mono text-xs">{k.hint ? `…${k.hint}` : t('已設定金鑰')}</span>
              <button
                type="button"
                onClick={() => remove({ id: `key:${k.slot}`, note: t('已移除 {name} 的金鑰', { name }), commit: () => removeApiKey(provider, k.slot) })}
                aria-label={t('移除金鑰 …{hint}', { hint: k.hint ?? '' })}
                className="m-press grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-bad-soft hover:text-bad"
              >
                <IconTrash size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        fromEnv && <p className="text-sm text-muted">{t('使用 .env 裡的金鑰')}</p>
      )}
      {open ? (
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            start(async () => {
              const result = await saveApiKey(provider, key)
              if (!result.ok) return setError(result.error)
              setKey('')
              setError(null)
              setAdding(false)
              onAdded?.(result.note)
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
            autoFocus={adding}
            className={`${inputClass} min-w-0 flex-1 basis-56 font-mono`}
            aria-label={t('{name} 金鑰', { name })}
          />
          <Button type="submit" variant="primary" disabled={!key.trim() || pending} loading={pending} icon={<IconKey size={15} />}>
            {pending ? t('確認中…') : t('確認並儲存')}
          </Button>
          {(shown.length > 0 || fromEnv) && (
            <Button variant="ghost" onClick={() => (setAdding(false), setError(null))}>
              {t('取消')}
            </Button>
          )}
        </form>
      ) : (
        <button type="button" onClick={() => setAdding(true)} className="m-press inline-flex items-center gap-1.5 text-sm text-accent hover:underline">
          <IconPlus size={15} aria-hidden />
          {shown.length ? t('加一把金鑰') : t('改用自己的金鑰')}
        </button>
      )}
      {error && <p className="text-sm text-bad">{error}</p>}
      {shown.length > 0 && <p className="text-xs text-muted">{t('可以加好幾把：一把額度用完、被限流或失效時，會自動改用下一把。')}</p>}
    </div>
  )
}
