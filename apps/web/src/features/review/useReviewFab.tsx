'use client'

import type { DraftExam } from '@exam/core'
import type { Strength } from '@exam/models'
import { STRENGTH_LABELS } from '@/features/settings/strengths'
import type { FabAction } from '@/shared/chrome/Fab'
import { IconAlert, IconCopy, IconIndent, IconMerge, IconOutdent, IconPlus, IconSparkles, IconSplit, IconStrength, IconUndo } from '@/shared/icons'
import { useT } from '@/shared/i18n/client'
import { attachToPrevious, mergeParts, splitNumber, splitParts } from './parts'
import { isFlagged, type useReviewDraft } from './useReviewDraft'
import { canSolve, type Solver } from './useSolver'

type Draft = ReturnType<typeof useReviewDraft>

/**
 * What the floating button holds: only what the page does not already show. Three groups, nearest
 * the button first: the whole exam (jump to the next question to check or to answer, AI 作答 and
 * AI 詳解 for every question still missing them, AI strength, undo), the selected question
 * (AI for it, split, sub-question moves, copy, insert) and adding a question when none is chosen.
 */
export function useReviewFab({ d, solver, strength, onStrength }: { d: Draft; solver: Solver; strength?: Strength; onStrength: () => void }): FabAction[] {
  const t = useT()
  const { draft, selected, select } = d
  const flagged = draft.questions.filter(isFlagged).length
  const next = (match: (q: DraftExam['questions'][number]) => boolean) => () => {
    const n = draft.questions.length
    const from = selected ?? -1
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n
      if (match(draft.questions[i]!)) return select(i, true)
    }
  }
  const { missing, running, busy, runAll, runOne } = solver
  const exam = t('整份考卷')
  const whole: FabAction[] = [
    ...(flagged > 0 ? [{ id: 'next', group: exam, label: t('下一題待確認'), icon: <IconAlert size={19} />, badge: flagged, onClick: next(isFlagged) }] : []),
    ...(missing.answer.length > 0
      ? [
          { id: 'ai-answer-all', group: exam, label: running?.job === 'answer' ? t('AI 正在作答…（{done} / {total}）', running) : t('AI 作答沒有答案的 {n} 題', { n: missing.answer.length }), icon: <IconSparkles size={19} />, onClick: () => runAll('answer'), disabled: Boolean(running), primary: true },
        ]
      : []),
    ...(missing.explain.length > 0
      ? [{ id: 'ai-explain-all', group: exam, label: running?.job === 'explain' ? t('AI 正在寫詳解…（{done} / {total}）', running) : t('AI 詳解沒有詳解的 {n} 題', { n: missing.explain.length }), icon: <IconSparkles size={19} />, onClick: () => runAll('explain'), disabled: Boolean(running) }]
      : []),
    ...(strength ? [{ id: 'strength', group: exam, label: t('AI 強度：{strength}', { strength: t(STRENGTH_LABELS.find(([v]) => v === strength)![1]) }), icon: <IconStrength size={19} />, onClick: onStrength }] : []),
    { id: 'undo', group: exam, label: t('復原上一步'), icon: <IconUndo size={19} />, onClick: d.undo, disabled: !d.canUndo },
  ]

  const chosen = selected !== null ? draft.questions[selected] : undefined
  if (!chosen || selected === null) return [...whole, { id: 'add', group: exam, label: t('新增題目'), icon: <IconPlus size={20} />, onClick: () => d.addQuestion() }]

  const n = chosen.number
  const one = t('第 {n} 題', { n })
  const key = d.keys.current[selected]!
  const working = busy.get(key)
  const hasKey = chosen.answer.values.some((v) => v.trim())
  const group = chosen.groupId ? draft.groups.find((g) => g.id === chosen.groupId) : undefined
  const canMerge = !!group && !!mergeParts(group, draft.questions.filter((q) => q.groupId === group.id))
  const question: FabAction[] = [
    ...(canSolve(chosen)
      ? [
          { id: 'ai-answer', group: one, label: working === 'answer' ? t('AI 正在作答第 {n} 題…', { n }) : hasKey ? t('AI 重新作答第 {n} 題', { n }) : t('AI 作答第 {n} 題', { n }), icon: <IconSparkles size={19} />, onClick: () => runOne(selected, 'answer'), disabled: Boolean(working) },
          ...(hasKey ? [{ id: 'ai-explain', group: one, label: working === 'explain' ? t('AI 正在寫第 {n} 題的詳解…', { n }) : chosen.explanation ? t('AI 重寫第 {n} 題的詳解', { n }) : t('AI 詳解第 {n} 題', { n }), icon: <IconSparkles size={19} />, onClick: () => runOne(selected, 'explain'), disabled: Boolean(working) }] : []),
        ]
      : []),
    ...(splitParts(chosen, '') ? [{ id: 'split', group: one, label: t('把第 {n} 題拆成小題', { n }), icon: <IconSplit size={19} />, onClick: () => d.splitQuestion(selected) }] : []),
    ...(selected > 0 && attachToPrevious(draft, selected, '')
      ? [{ id: 'attach', group: one, label: t('把第 {n} 題設為第 {main} 題的小題', { n, main: splitNumber(draft.questions[selected - 1]!.number).main }), icon: <IconIndent size={19} />, onClick: () => d.attachPart(selected) }]
      : []),
    ...(group ? [{ id: 'detach', group: one, label: t('把第 {n} 題移出小題', { n }), icon: <IconOutdent size={19} />, onClick: () => d.detachQuestion(selected) }] : []),
    ...(canMerge ? [{ id: 'merge', group: one, label: t('把第 {n} 題的小題合併', { n: splitNumber(n).main }), icon: <IconMerge size={19} />, onClick: () => d.mergeGroup(group!.id) }] : []),
    { id: 'copy', group: one, label: t('複製第 {n} 題', { n }), icon: <IconCopy size={19} />, onClick: () => d.duplicateQuestion(selected) },
    { id: 'insert', group: one, label: t('在第 {n} 題後面新增', { n }), icon: <IconPlus size={20} />, onClick: () => d.addQuestion(selected) },
  ]
  return [...whole, ...question]
}
