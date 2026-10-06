'use client'

import { formatUsd, route, routeCost, type ModelChoice, type ProviderInfo, type Route, type Strength, type Task } from '@exam/models'
import { measuredPerUnit, type UsageRow } from '@exam/usage/estimates'
import { useState, useTransition } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { rich } from '@/shared/i18n/rich'
import { Segmented } from '@/shared/Segmented'
import { inputBase } from '@/shared/ui'
import { saveStrength, saveTaskModel, saveTaskStrength } from './actions'
import { STRENGTH_HINTS, STRENGTH_LABELS } from './strengths'
import { TaskModelPicker } from './TaskModelPicker'

const STRENGTHS = STRENGTH_LABELS
const HINTS = STRENGTH_HINTS

/** The tasks the app runs today, how one unit of each reads, and how many units the estimate covers. Texts are translated where shown. */
const TASKS: { id: Task; label: string; unit: string; units: number }[] = [
  { id: 'recognition', label: msg('辨識考卷'), unit: msg('一份 4 頁考卷'), units: 4 },
  { id: 'handwriting', label: msg('讀手寫作答'), unit: msg('每題'), units: 1 },
  { id: 'grading', label: msg('批改問答題'), unit: msg('每次交卷'), units: 1 },
  { id: 'solving', label: msg('AI 作答'), unit: msg('每題'), units: 1 },
  { id: 'explaining', label: msg('AI 詳解'), unit: msg('每題'), units: 1 },
]

const AUTO = ''

export interface StrengthState {
  strength: Strength
  taskStrength: Partial<Record<Task, Strength>>
  taskModels: Partial<Record<Task, ModelChoice>>
}

/**
 * The AI strength slider: one setting for every task, what each task then uses and about
 * what it costs, and under 進階 a strength or a model of its own for each task.
 */
export function StrengthSettings({ providers, initial, usage, onSaved }: { providers: ProviderInfo[]; initial: StrengthState; usage: UsageRow[]; onSaved: () => void }) {
  const t = useT()
  const [state, setState] = useState(initial)
  const [, start] = useTransition()
  const strengths = STRENGTHS.map(([v, label]) => [v, t(label)] as const)
  const save = (next: StrengthState, action: () => Promise<unknown>) => {
    setState(next)
    start(async () => (await action(), onSaved()))
  }
  const routeOf = (task: Task) => route(task, state.taskStrength[task] ?? state.strength, providers, { override: state.taskModels[task] })
  const anyKey = providers.some((p) => p.ready)

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={state.strength} options={strengths} onChange={(strength) => save({ ...state, strength }, () => saveStrength(strength))} />
        <span className="text-xs text-muted">{t(HINTS[state.strength])}</span>
      </div>

      {anyKey ? (
        <ul className="divide-y divide-line/70 rounded-lg border border-line/70 text-sm">
          {TASKS.map((task) => (
            <TaskLine key={task.id} task={task} r={routeOf(task.id)} providers={providers} usage={usage} custom={Boolean(state.taskStrength[task.id] || state.taskModels[task.id])} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">{t('加上任一家的 API 金鑰後，這裡會顯示每種工作用哪個模型、大約花多少。')}</p>
      )}

      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-accent">{t('進階：每種工作分開設定')}</summary>
        <div className="mt-3 space-y-3">
          {TASKS.map((task) => (
            <div key={task.id} className="grid gap-2 sm:grid-cols-[7rem_auto_minmax(0,1fr)] sm:items-center">
              <span className="text-sm font-medium">{t(task.label)}</span>
              <select
                value={state.taskStrength[task.id] ?? AUTO}
                onChange={(e) => {
                  const value = (e.target.value || null) as Strength | null
                  const taskStrength = { ...state.taskStrength }
                  if (value) taskStrength[task.id] = value
                  else delete taskStrength[task.id]
                  save({ ...state, taskStrength }, () => saveTaskStrength(task.id, value))
                }}
                className={inputBase}
                aria-label={t('{task}的強度', { task: t(task.label) })}
              >
                <option value={AUTO}>{t('跟整體強度')}</option>
                {strengths.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <TaskModelPicker
                task={task.id}
                label={t('{task}的模型', { task: t(task.label) })}
                providers={providers}
                value={state.taskModels[task.id] ?? null}
                onChange={(choice) => {
                  const taskModels = { ...state.taskModels }
                  if (choice) taskModels[task.id] = choice
                  else delete taskModels[task.id]
                  save({ ...state, taskModels }, () => saveTaskModel(task.id, choice))
                }}
              />
            </div>
          ))}
          <p className="text-xs text-muted">{t('指定模型後，強度只在那家沒有金鑰時才派上用場；指定的模型讀不了時，會換其他有金鑰的服務。')}</p>
        </div>
      </details>
    </div>
  )
}

function TaskLine({ task, r, providers, usage, custom }: { task: (typeof TASKS)[number]; r: Route | null; providers: ProviderInfo[]; usage: UsageRow[]; custom: boolean }) {
  const t = useT()
  if (!r) return <li className="px-3 py-2 text-muted">{t('{task}：沒有能用的模型', { task: t(task.label) })}</li>
  const name = (c: ModelChoice) => providers.find((p) => p.id === c.provider)?.models.find((m) => m.id === c.model)?.label ?? c.model
  const cost = routeCost(r, providers, task.units, measuredPerUnit(usage, task.id, r.primary.model))
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
      <span className="text-muted">
        {rich(
          r.escalate
            ? t('<task>{task}</task>：{model}，沒把握的頁升 {escalate}', { task: t(task.label), model: name(r.primary), escalate: name(r.escalate) })
            : t('<task>{task}</task>：{model}', { task: t(task.label), model: name(r.primary) }),
          {
            task: (c) => (
              <span className="text-ink">
                <span className="font-medium">{c}</span>
                {custom && <span className="ml-1.5 text-xs text-muted">{t('（自訂）')}</span>}
              </span>
            ),
          },
        )}
      </span>
      <span className="num text-xs text-muted">{cost === null ? t('價格未知') : t('{unit}約 {cost}', { unit: t(task.unit), cost: formatUsd(cost) })}</span>
    </li>
  )
}
