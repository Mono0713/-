'use client'

import type { ModelChoice, ProviderInfo, Task } from '@exam/models'
import { useT } from '@/shared/i18n/client'
import { Listbox } from '@/shared/Listbox'
import { inputBase } from '@/shared/ui'

const AUTO = ''

/** "Automatic" or one model of a provider with a key; reading tasks only list models that see images. */
export function TaskModelPicker({ task, label, providers, value, onChange }: { task: Task; label: string; providers: ProviderInfo[]; value: ModelChoice | null; onChange: (choice: ModelChoice | null) => void }) {
  const t = useT()
  const sees = task === 'recognition' || task === 'handwriting'
  const encode = (c: ModelChoice) => `${c.provider}\n${c.model}`
  const groups = providers
    .filter((p) => p.ready)
    .map((p) => ({ label: p.label, options: p.models.filter((m) => !sees || m.vision).map((m) => ({ value: encode({ provider: p.id, model: m.id }), label: m.label })) }))
    .filter((g) => g.options.length)
  const current = value ? encode(value) : AUTO
  const known = groups.some((g) => g.options.some((o) => o.value === current))
  return (
    <Listbox
      value={current}
      label={label}
      className={inputBase}
      onChange={(v) => {
        if (!v) return onChange(null)
        const [provider, model] = v.split('\n') as [string, string]
        onChange({ provider, model })
      }}
      groups={[{ options: [{ value: AUTO, label: t('自動（依強度）') }, ...(value && !known ? [{ value: current, label: value.model }] : [])] }, ...groups]}
    />
  )
}
