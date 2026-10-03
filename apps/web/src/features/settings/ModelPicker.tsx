'use client'

import { useState } from 'react'
import type { ProviderOption } from '@/server/context'
import { Listbox } from '@/shared/Listbox'
import { inputBase, inputClass } from '@/shared/ui'

const CUSTOM = '__custom'
const TIER_LABELS = { best: '最準確', balanced: '均衡', fast: '最快、最省' } as const

/** A model from a list, or any model id typed in (providers add and retire models often). */
export function ModelPicker({
  models,
  value,
  onChange,
  compact = false,
  label = '模型',
  emptyLabel = '預設',
}: {
  models: ProviderOption['models']
  value: string
  onChange: (model: string) => void
  compact?: boolean
  label?: string
  /** Shown when no model is chosen. */
  emptyLabel?: string
}) {
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
            label: groups.length === 1 && !tier ? undefined : tier ? TIER_LABELS[tier] : '其他可用模型',
            options: list.map((m) => ({ value: m.id, label: m.label })),
          })),
          { options: [{ value: CUSTOM, label: '自己輸入模型名稱…' }] },
        ]}
      />
      {custom && (
        <input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="例如 claude-opus-5-5" className={`${base} ${compact ? 'w-48' : ''}`} aria-label={`${label}名稱`} autoFocus />
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
  const current = providers.find((p) => p.id === provider)
  return (
    <>
      <label className={compact ? '' : 'block text-sm'}>
        {!compact && <span className="mb-1 block font-medium">辨識方式</span>}
        <select
          value={provider}
          onChange={(e) => onChange({ provider: e.target.value, model: providers.find((p) => p.id === e.target.value)?.model ?? '' })}
          className={compact ? inputBase : inputClass}
          aria-label="辨識方式"
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id} disabled={!p.ready}>
              {p.label}
              {p.ready ? '' : '（未設定 API 金鑰）'}
            </option>
          ))}
        </select>
      </label>
      <div className={compact ? '' : 'block text-sm'}>
        {!compact && <span className="mb-1 block font-medium">{provider === 'manual' ? '使用的聊天 App（選填）' : '模型'}</span>}
        {/* key: a new method starts a fresh picker, custom entry included. */}
        <ModelPicker key={provider} models={current?.models ?? []} value={model} onChange={(m) => onChange({ provider, model: m })} compact={compact} emptyLabel={provider === 'manual' ? '不指定' : '預設'} />
      </div>
    </>
  )
}
