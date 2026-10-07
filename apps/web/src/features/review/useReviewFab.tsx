'use client'

import type { Strength } from '@exam/models'
import { STRENGTH_LABELS } from '@/features/settings/strengths'
import type { FabAction } from '@/shared/chrome/Fab'
import { IconCopy, IconPlus, IconPrint, IconSparkles, IconStrength, IconUndo } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { msg } from '@/shared/i18n/format'
import type { useReviewDraft } from './useReviewDraft'
import type { Solver, SolveJob, SolveScope } from './useSolver'

type Draft = ReturnType<typeof useReviewDraft>

/**
 * What the floating button holds, nearest the button first: AI 作答 and AI 詳解 for the questions
 * still missing them or for every question (each card has its own AI buttons), add a question after
 * the selected one, copy it, 匯出 PDF for an exam written from scratch (without and with the answers),
 * the AI strength with the model it uses, and undo. Nothing else.
 */
export function useReviewFab({
  d,
  solver,
  strength,
  model,
  onStrength,
  onExport,
}: {
  d: Draft
  solver: Solver
  strength?: Strength
  model?: string | null
  onStrength: () => void
  /** Given (an exam with no original pages), prints its A4 pages as PDF, with or without the answers. */
  onExport?: (withAnswers: boolean) => void
}): FabAction[] {
  const t = useT()
  const { draft, selected } = d
  const { missing, all, running, runAll } = solver
  const chosen = selected !== null ? draft.questions[selected] : undefined

  const ai = (job: SolveJob, scope: SolveScope, label: string, primary = false): FabAction[] => {
    const n = (scope === 'all' ? all : missing)[job].length
    // 「全部」 shows only when it covers more than the missing ones
    if (!n || (scope === 'all' && n === missing[job].length)) return []
    const now = running?.job === job && running.scope === scope
    const progress = job === 'answer' ? t('AI 正在作答…（{done} / {total}）', running ?? { done: 0, total: 0 }) : t('AI 正在寫詳解…（{done} / {total}）', running ?? { done: 0, total: 0 })
    return [{ id: `ai-${job}-${scope}`, label: now ? progress : t(label, { n }), icon: <IconSparkles size={19} />, onClick: () => runAll(job, scope), disabled: Boolean(running), primary }]
  }
  const strengthLabel = strength && t(STRENGTH_LABELS.find(([v]) => v === strength)![1])

  return [
    ...ai('answer', 'missing', msg('為沒有答案的 {n} 題生成答案'), true),
    ...ai('explain', 'missing', msg('為沒有詳解的 {n} 題生成詳解')),
    ...ai('answer', 'all', msg('生成全部 {n} 題的答案')),
    ...ai('explain', 'all', msg('生成全部 {n} 題的詳解')),
    chosen
      ? { id: 'insert', label: t('在第 {n} 題後面新增一題', { n: chosen.number }), icon: <IconPlus size={20} />, onClick: () => d.addQuestion(selected!) }
      : { id: 'add', label: t('新增題目'), icon: <IconPlus size={20} />, onClick: () => d.addQuestion() },
    ...(chosen ? [{ id: 'copy', label: t('複製第 {n} 題', { n: chosen.number }), icon: <IconCopy size={19} />, onClick: () => d.duplicateQuestion(selected!) }] : []),
    ...(onExport
      ? [
          { id: 'pdf', label: t('匯出 PDF'), icon: <IconPrint size={19} />, onClick: () => onExport(false) },
          { id: 'pdf-key', label: t('匯出 PDF（附答案）'), icon: <IconPrint size={19} />, onClick: () => onExport(true) },
        ]
      : []),
    ...(strength
      ? [{ id: 'strength', label: model ? t('AI 強度：{strength}・{model}', { strength: strengthLabel!, model }) : t('AI 強度：{strength}', { strength: strengthLabel! }), icon: <IconStrength size={19} />, onClick: onStrength }]
      : []),
    { id: 'undo', label: t('復原上一步'), icon: <IconUndo size={19} />, onClick: d.undo, disabled: !d.canUndo },
  ]
}
