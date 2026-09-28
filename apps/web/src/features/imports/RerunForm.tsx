'use client'

import { useState, useTransition } from 'react'
import { Button, inputBase } from '@/shared/ui'
import { rerunImport } from './actions'

/** Read pages again, optionally with another provider or model. */
export function RerunForm({
  importId,
  providers,
  current,
  pages,
  label = '重新辨識',
}: {
  importId: string
  providers: { id: string; label: string; ready: boolean }[]
  current: { provider: string; model: string | null }
  pages?: number[]
  label?: string
}) {
  const [provider, setProvider] = useState(current.provider)
  const [model, setModel] = useState(current.model ?? '')
  const [pending, startTransition] = useTransition()
  return (
    <div className="flex flex-wrap items-end gap-2">
      <select value={provider} onChange={(e) => setProvider(e.target.value)} className={inputBase} aria-label="辨識方式">
        {providers.map((p) => (
          <option key={p.id} value={p.id} disabled={!p.ready}>
            {p.label}
          </option>
        ))}
      </select>
      <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="模型（選填）" className={`${inputBase} w-48`} aria-label="模型" />
      <Button variant="primary" disabled={pending} onClick={() => startTransition(() => rerunImport(importId, { provider, model: model.trim() || null, pages }))}>
        {pending ? '開始中…' : label}
      </Button>
    </div>
  )
}
