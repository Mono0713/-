'use client'

import type { ModelChoice, ProviderInfo } from '@exam/models'
import { useT } from '@/shared/i18n/client'
import { Listbox, type ListboxGroup } from '@/shared/Listbox'
import { inputBase } from '@/shared/ui'
import { TIER_LABELS } from './strengths'

/** The picker's value for 自動. */
export const AUTO = ''

export const encodeChoice = (c: ModelChoice) => `${c.provider}\n${c.model}`

/** A picked model from the picker's value; null for 自動 and the options a caller added. */
export function decodeChoice(value: string): ModelChoice | null {
  const [provider, model] = value.split('\n')
  return provider && model ? { provider, model } : null
}

/**
 * The model one task uses: 自動 (naming the model it picks now) or a model of a service with a key,
 * each with its tier and whether it sees pictures. `sees` lists only models that read images.
 * `lead` adds options above 自動, e.g. 免費翻譯.
 */
export function TaskModelPicker({
  label,
  providers,
  value,
  auto,
  autoHint,
  sees = false,
  lead = [],
  onChange,
}: {
  label: string
  providers: ProviderInfo[]
  /** `encodeChoice` of the picked model, AUTO, or a `lead` option's value. */
  value: string
  /** The model 自動 picks now, by name; null when no service can do the task. */
  auto: string | null
  /** The second line under 自動 in the list. */
  autoHint?: string
  sees?: boolean
  lead?: ListboxGroup['options']
  onChange: (value: string) => void
}) {
  const t = useT()
  const groups: ListboxGroup[] = providers
    .filter((p) => p.ready)
    .map((p) => ({
      label: p.label,
      options: p.models
        .filter((m) => !sees || m.vision)
        .map((m) => ({ value: encodeChoice({ provider: p.id, model: m.id }), label: m.label, hint: `${t(TIER_LABELS[m.tier])} · ${m.vision ? t('看得懂圖') : t('只看文字')}` })),
    }))
    .filter((g) => g.options.length)
  const known = value === AUTO || lead.some((o) => o.value === value) || groups.some((g) => g.options.some((o) => o.value === value))
  // a model picked earlier whose service lost its key, or that was removed from the list, still shows what was saved
  const missing = known ? [] : [{ value, label: decodeChoice(value)?.model ?? value, hint: t('目前用不到：服務沒有金鑰或模型已移除') }]
  const automatic = { value: AUTO, label: auto ? t('自動 · {model}', { model: auto }) : t('自動'), hint: auto ? (autoHint ?? t('依一鍵套用的強度挑')) : t('還沒有能用的模型') }
  return <Listbox value={value} label={label} className={`${inputBase} w-full`} onChange={onChange} groups={[{ options: [...lead, automatic, ...missing] }, ...groups]} />
}
