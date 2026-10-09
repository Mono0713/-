'use client'

import type { QuestionType } from '@exam/core'
import type { Difficulty } from '@exam/grading'
import Link from 'next/link'
import { useState, useTransition } from 'react'
import { Switch } from '@/features/settings/Switch'
import { shrinkPhoto } from '@/features/imports/shrink'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import { rich } from '@/shared/i18n/rich'
import { IconSparkles } from '@/shared/icons'
import { Segmented } from '@/shared/Segmented'
import { Button, Card, inputClass } from '@/shared/ui'
import { generateExam } from './actions'
import { MaterialPicker } from './MaterialPicker'
import { OFFERED } from './plan'
import { TypeCounts } from './TypeCounts'

const LEVELS: [Difficulty, string][] = [
  ['easy', msg('簡單')],
  ['medium', msg('中等')],
  ['hard', msg('困難')],
]

/**
 * AI 出題: study material (files or pasted text), which question types and how many, how hard, then
 * the AI writes the exam into a new draft that opens in the editor beside its A4 sheet.
 * `model`: the model it would use, or null when no service has a key yet.
 */
export function GenerateForm({ model }: { model: string | null }) {
  const t = useT()
  const [files, setFiles] = useState<File[]>([])
  const [counts, setCounts] = useState<[QuestionType, number][]>(() => OFFERED.map((o) => [o.type, o.count]))
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [groups, setGroups] = useState(false)
  const [figures, setFigures] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const total = counts.reduce((n, [, c]) => n + c, 0)

  const submit = (form: FormData) => {
    form.delete('files')
    for (const [type, count] of counts) form.set(`count.${type}`, String(count))
    form.set('difficulty', difficulty)
    if (groups) form.set('groups', 'on')
    if (figures) form.set('figures', 'on')
    setError(null)
    startTransition(async () => {
      for (const f of await Promise.all(files.map(shrinkPhoto))) form.append('files', f)
      const result = await generateExam(form)
      if (result?.error) setError(result.error)
    })
  }

  return (
    <form action={submit} className="space-y-5">
      <Card className="space-y-3 p-5">
        <h2 className="text-sm font-semibold">{t('學習資料')}</h2>
        <MaterialPicker files={files} onChange={setFiles} />
        <textarea name="text" rows={4} autoComplete="off" placeholder={t('也可以直接貼上筆記或課文')} className={`${inputClass} resize-y`} />
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-semibold">{t('題型與題數')}</h2>
          <span className="num text-xs text-muted">{t('共 {n} 題', { n: total })}</span>
        </div>
        <TypeCounts counts={counts} onChange={(type, count) => setCounts((all) => all.map(([k, c]) => [k, k === type ? count : c]))} />
        <div className="space-y-3 border-t border-line pt-4">
          <Row label={t('難度')}>
            <Segmented value={difficulty} options={LEVELS.map(([v, label]) => [v, t(label)] as const)} onChange={setDifficulty} />
          </Row>
          <Row label={t('出題組')} hint={t('幾題共用一段文章、表格或圖')}>
            <Switch on={groups} label={t('出題組')} onChange={setGroups} />
          </Row>
          <Row label={t('用講義裡的圖')} hint={t('題目需要時，從講義截圖放進考卷')}>
            <Switch on={figures} label={t('用講義裡的圖')} onChange={setFigures} />
          </Row>
        </div>
      </Card>

      <Card className="space-y-3 p-5">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">{t('考卷名稱')}</span>
          <input name="title" maxLength={80} autoComplete="off" placeholder={t('不填的話由 AI 命名')} className={inputClass} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold">{t('想特別交代的')}</span>
          <textarea name="notes" rows={2} maxLength={500} autoComplete="off" placeholder={t('例如：只考第三章、多出應用題、用英文出題')} className={`${inputClass} resize-y`} />
        </label>
      </Card>

      {error && <p className="m-shake rounded-lg bg-bad-soft px-3 py-2 text-sm text-bad [overflow-wrap:anywhere]">{error}</p>}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button type="submit" variant="primary" disabled={!total || !model || pending} loading={pending} icon={<IconSparkles size={16} />}>
          {pending ? t('上傳講義中…') : t('開始出題')}
        </Button>
        <p className="text-xs text-muted">
          {rich(model ? t('用 {model} 出題，可以在<link>設定</link>換模型。', { model }) : t('還沒有 API 金鑰：先到<link>設定</link>加上任一家的金鑰。'), {
            link: (c) => (
              <Link href="/settings" className="mx-0.5 text-accent hover:underline">
                {c}
              </Link>
            ),
          })}
        </p>
      </div>
    </form>
  )
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
      {children}
    </div>
  )
}
