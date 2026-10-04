'use client'

import { useState, useTransition } from 'react'
import type { ProviderOption } from '@/server/context'
import { ProviderFields } from '@/features/settings/ModelPicker'
import { useT } from '@/shared/i18n/client'
import { Button } from '@/shared/ui'
import { rerunImport } from './actions'

/** Read pages again, optionally with another provider or model. */
export function RerunForm({
  importId,
  providers,
  current,
  pages,
  label,
}: {
  importId: string
  providers: ProviderOption[]
  current: { provider: string; model: string | null }
  pages?: number[]
  label?: string
}) {
  const t = useT()
  const [choice, setChoice] = useState({ provider: current.provider, model: current.model ?? providers.find((p) => p.id === current.provider)?.model ?? '' })
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex flex-wrap items-end gap-2">
      <ProviderFields providers={providers} provider={choice.provider} model={choice.model} onChange={setChoice} compact />
      <Button variant="primary" disabled={pending} onClick={() => startTransition(() => rerunImport(importId, { provider: choice.provider, model: choice.model.trim() || null, pages }))}>
        {pending ? t('開始中…') : (label ?? t('重新辨識'))}
      </Button>
    </div>
  )
}
