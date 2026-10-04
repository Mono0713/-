'use client'

import type { AiPayer } from '@exam/classes'
import { useState, useTransition } from 'react'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { rich } from '@/shared/i18n/rich'
import { Segmented } from '@/shared/Segmented'
import { Card, inputBase } from '@/shared/ui'
import { setAiPayer } from './actions'

const PAYERS = [
  ['teacher', msg('老師付')],
  ['mixed', msg('混合')],
  ['student', msg('學生付')],
  ['off', msg('不用 AI')],
] as const satisfies readonly (readonly [AiPayer, string])[]

const NOTES: Record<AiPayer, string> = {
  teacher: msg('用老師的 API 金鑰批改學生交的問答題和填空題。'),
  mixed: msg('老師付到每月上限，超過之後改用學生自己的金鑰。'),
  student: msg('學生用自己的 API 金鑰批改；沒有金鑰的學生由老師批改。'),
  off: msg('不用 AI，全部由老師批改。'),
}

/** Who pays for marking the class's open answers with AI, and the most the teacher spends a month. */
export function AiPayment({ classId, payer, cap, spent, unpriced, canEdit }: { classId: string; payer: AiPayer; cap: number | null; spent: number; unpriced: boolean; canEdit: boolean }) {
  const t = useT()
  const [value, setValue] = useState(payer)
  const [limit, setLimit] = useState(cap === null ? '' : String(cap))
  const [, start] = useTransition()
  const save = (next: AiPayer, nextLimit: string) => start(() => setAiPayer(classId, next, nextLimit.trim() ? Number(nextLimit) : null))
  const teacherPays = value === 'teacher' || value === 'mixed'

  return (
    <Card className="space-y-3 p-4">
      <h2 className="text-sm font-semibold">{t('AI 批改費用')}</h2>
      {canEdit ? (
        <Segmented
          value={value}
          options={PAYERS.map(([v, l]) => [v, t(l)] as const)}
          onChange={(next) => {
            setValue(next)
            save(next, limit)
          }}
        />
      ) : (
        <p className="text-sm">{t(PAYERS.find(([v]) => v === value)?.[1] ?? '')}</p>
      )}
      <p className="text-xs text-muted">{t(NOTES[value])}</p>
      {teacherPays && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <label className="flex items-center gap-2">
            <span className="text-muted">{t('每月上限 US$')}</span>
            <input
              autoComplete="off"
              type="number"
              min={0}
              step={0.5}
              value={limit}
              disabled={!canEdit}
              placeholder={t('不限')}
              onChange={(e) => setLimit(e.target.value)}
              onBlur={() => save(value, limit)}
              className={`${inputBase} w-24`}
            />
          </label>
          <span className="text-muted">
            {rich(t('這個月已用 <n>US${amount}</n>', { amount: spent.toFixed(2) }), { n: (c) => <span className="num text-ink">{c}</span> })}
            {unpriced && t('（有的模型沒有價格，沒算進去）')}
          </span>
        </div>
      )}
    </Card>
  )
}
