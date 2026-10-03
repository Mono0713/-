'use client'

import type { AiPayer } from '@exam/classes'
import { useState, useTransition } from 'react'
import { Segmented } from '@/shared/Segmented'
import { Card, inputBase } from '@/shared/ui'
import { setAiPayer } from './actions'

const PAYERS = [
  ['teacher', '老師付'],
  ['mixed', '混合'],
  ['student', '學生付'],
  ['off', '不用 AI'],
] as const satisfies readonly (readonly [AiPayer, string])[]

const NOTES: Record<AiPayer, string> = {
  teacher: '用老師的 API 金鑰批改學生交的問答題和填空題。',
  mixed: '老師付到每月上限，超過之後改用學生自己的金鑰。',
  student: '學生用自己的 API 金鑰批改；沒有金鑰的學生由老師批改。',
  off: '不用 AI，全部由老師批改。',
}

/** Who pays for marking the class's open answers with AI, and the most the teacher spends a month. */
export function AiPayment({ classId, payer, cap, spent, unpriced, canEdit }: { classId: string; payer: AiPayer; cap: number | null; spent: number; unpriced: boolean; canEdit: boolean }) {
  const [value, setValue] = useState(payer)
  const [limit, setLimit] = useState(cap === null ? '' : String(cap))
  const [, start] = useTransition()
  const save = (next: AiPayer, nextLimit: string) => start(() => setAiPayer(classId, next, nextLimit.trim() ? Number(nextLimit) : null))
  const teacherPays = value === 'teacher' || value === 'mixed'

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold">AI 批改費用</h2>
      {canEdit ? (
        <Segmented
          value={value}
          options={PAYERS}
          onChange={(next) => {
            setValue(next)
            save(next, limit)
          }}
        />
      ) : (
        <p className="text-sm">{PAYERS.find(([v]) => v === value)?.[1]}</p>
      )}
      <p className="text-xs text-muted">{NOTES[value]}</p>
      {teacherPays && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted">每月上限 US$</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={limit}
              disabled={!canEdit}
              placeholder="不限"
              onChange={(e) => setLimit(e.target.value)}
              onBlur={() => save(value, limit)}
              className={`${inputBase} w-24`}
            />
          </label>
          <span className="text-muted">
            這個月已用 <span className="num text-ink">US${spent.toFixed(2)}</span>
            {unpriced && '（有的模型沒有價格，沒算進去）'}
          </span>
        </div>
      )}
    </Card>
  )
}
