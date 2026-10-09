'use client'

import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { IconKey, IconPlus } from '@/shared/icons'
import { useRemoval } from '@/shared/removal'
import { Button, inputClass } from '@/shared/ui'
import { saveApiKey } from './actions'
import { KeyRows } from './KeyRows'

/** A saved key as the browser sees it: where it is stored and its last four characters. */
export interface SavedKey {
  slot: string
  hint: string | null
}

/**
 * The API keys of one service (`KeyRows`, top one used first, dragged into order) and 加一把金鑰 to add
 * another. With several, calls move down to the next key when one runs out or is refused.
 */
export function ApiKeys({ provider, name, keys, fromEnv = false, onAdded }: { provider: string; name: string; keys: SavedKey[]; fromEnv?: boolean; onAdded?: (note?: string) => void }) {
  const t = useT()
  const { isRemoved } = useRemoval()
  const shown = keys.filter((k) => !isRemoved(`key:${k.slot}`))
  const [adding, setAdding] = useState(!shown.length && !fromEnv)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const open = adding || (!shown.length && !fromEnv)

  return (
    <div className="space-y-2">
      {shown.length > 0 ? (
        <KeyRows provider={provider} name={name} keys={shown} />
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
      {shown.length > 0 && <p className="text-xs text-muted">{shown.length > 1 ? t('由上往下使用：上面那把額度用完、被限流或失效時，自動改用下一把。按住左邊的點點上下拖曳可調整順序。') : t('可以加好幾把：一把額度用完、被限流或失效時，會自動改用下一把。')}</p>}
    </div>
  )
}
