'use client'

import { useState } from 'react'
import type { ProviderOption } from '@/server/context'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { Listbox } from '@/shared/Listbox'
import { inputBase, inputClass } from '@/shared/ui'

const CUSTOM = '__custom'
const TIER_LABELS = { best: msg('最準確'), balanced: msg('均衡'), fast: msg('最快、最省') } as const

/** A model from a list, or any model id typed in (providers add and retire models often). */
export function ModelPicker({
  models,
  value,
  onChange,
  compact = false,
  label: givenLabel,
  emptyLabel: givenEmpty,
}: {
  models: ProviderOption['models']
  value: string
  onChange: (model: string) => void
  compact?: boolean
  label?: string
  /** Shown when no model is chosen. */
  emptyLabel?: string
}) {
  const t = useT()
  const label = givenLabel ?? t('模型')
  const emptyLabel = givenEmpty ?? t('預設')
  const [custom, setCustom] = useState(() => value !== '' && !models.some((m) => m.id === value))
  const base = compact ? inputBase : inputClass
  const groups = (['best', 'balanced', 'fast', null] as const)
    .map((tier) => [tier, models.filter((m) => m.tier === tier)] as const)
    .filter(([, list]) => list.length > 0)
  return (
    <div className={`flex gap-2 ${compact ? 'items-center' : 'flex-col'}`}>
      <Listbox
        value={custom ? CUSTOM : value}
        onChange={(next) => {
          setCustom(next === CUSTOM)
          if (next !== CUSTOM) onChange(next)
        }}
        className={`${base} ${compact ? 'min-w-44' : ''}`}
        label={label}
        groups={[
          ...(!models.some((m) => m.id === value) && !custom ? [{ options: [{ value, label: value || emptyLabel }] }] : []),
          // a plain list (e.g. chat apps) needs no group heading
          ...groups.map(([tier, list]) => ({
            label: groups.length === 1 && !tier ? undefined : tier ? t(TIER_LABELS[tier]) : t('其他可用模型'),
            options: list.map((m) => ({ value: m.id, label: m.label })),
          })),
          { options: [{ value: CUSTOM, label: t('自己輸入模型名稱…') }] },
        ]}
      />
      {custom && (
        <input autoComplete="off" value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder={t('例如 claude-opus-5-5')} className={`${base} ${compact ? 'w-48' : ''}`} aria-label={t('{label}名稱', { label })} autoFocus />
      )}
    </div>
  )
}

/** Recognition method and model together; the model follows the method's default when it changes. */
export function ProviderFields({
  providers,
  provider,
  model,
  onChange,
  compact = false,
}: {
  providers: ProviderOption[]
  provider: string
  model: string
  onChange: (next: { provider: string; model: string }) => void
  compact?: boolean
}) {
  const t = useT()
  const current = providers.find((p) => p.id === provider)
  return (
    <>
      <label className={compact ? '' : 'block text-sm'}>
        {!compact && <span className="mb-1 block font-medium">{t('辨識方式')}</span>}
        <select
          value={provider}
          onChange={(e) => onChange({ provider: e.target.value, model: providers.find((p) => p.id === e.target.value)?.model ?? '' })}
          className={compact ? inputBase : inputClass}
          aria-label={t('辨識方式')}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.ready}>
              {p.label}
              {p.ready ? '' : t('（未設定 API 金鑰）')}
            </option>
          ))}
        </select>
      </label>
      {current?.note !== undefined || provider === 'auto' ? (
        // automatic: the models follow the AI strength in settings, so there is nothing to pick here
        <p className={compact ? 'max-w-80 text-xs text-muted' : 'self-end pb-2 text-xs text-muted'}>{current?.note ?? t('在設定加上 API 金鑰後才能用。')}</p>
      ) : (
        <div className={compact ? '' : 'block text-sm'}>
          {!compact && <span className="mb-1 block font-medium">{provider === 'manual' ? t('使用的聊天 App（選填）') : t('模型')}</span>}
          {/* key: a new method starts a fresh picker, custom entry included. */}
          <ModelPicker key={provider} models={current?.models ?? []} value={model} onChange={(m) => onChange({ provider, model: m })} compact={compact} emptyLabel={provider === 'manual' ? t('不指定') : t('預設')} />
        </div>
      )}
    </>
  )
}
