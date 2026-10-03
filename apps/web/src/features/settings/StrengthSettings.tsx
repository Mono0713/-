'use client'

import { formatUsd, route, routeCost, type ModelChoice, type ProviderInfo, type Route, type Strength, type Task } from '@exam/models'
import { measuredPerUnit, type UsageRow } from '@exam/usage/estimates'
import { useState, useTransition } from 'react'
import { Listbox } from '@/shared/Listbox'
import { Segmented } from '@/shared/Segmented'
import { inputBase } from '@/shared/ui'
import { saveStrength, saveTaskModel, saveTaskStrength } from './actions'
import { STRENGTH_HINTS, STRENGTH_LABELS } from './strengths'

const STRENGTHS = STRENGTH_LABELS
const HINTS = STRENGTH_HINTS

/** The tasks the app runs today, how one unit of each reads, and how many units the estimate covers. */
const TASKS: { id: Task; label: string; unit: string; units: number }[] = [
  { id: 'recognition', label: '辨識考卷', unit: '一份 4 頁考卷', units: 4 },
  { id: 'handwriting', label: '讀手寫作答', unit: '每題', units: 1 },
  { id: 'grading', label: '批改問答題', unit: '每次交卷', units: 1 },
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
  const [state, setState] = useState(initial)
  const [, start] = useTransition()
  const save = (next: StrengthState, action: () => Promise<unknown>) => {
    setState(next)
    start(async () => (await action(), onSaved()))
  }
  const routeOf = (task: Task) => route(task, state.taskStrength[task] ?? state.strength, providers, { override: state.taskModels[task] })
  const anyKey = providers.some((p) => p.ready)

  return (
    <div className="space-y-4 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented value={state.strength} options={STRENGTHS} onChange={(strength) => save({ ...state, strength }, () => saveStrength(strength))} />
        <span className="text-xs text-muted">{HINTS[state.strength]}</span>
      </div>

      {anyKey ? (
        <ul className="divide-y divide-line/70 rounded-lg border border-line/70 text-sm">
          {TASKS.map((t) => (
            <TaskLine key={t.id} task={t} r={routeOf(t.id)} providers={providers} usage={usage} custom={Boolean(state.taskStrength[t.id] || state.taskModels[t.id])} />
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-warn-soft px-3 py-2 text-sm">加上任一家的 API 金鑰後，這裡會顯示每種工作用哪個模型、大約花多少。</p>
      )}

      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-accent">進階：每種工作分開設定</summary>
        <div className="mt-3 space-y-3">
          {TASKS.map((t) => (
            <div key={t.id} className="grid gap-2 sm:grid-cols-[7rem_auto_minmax(0,1fr)] sm:items-center">
              <span className="text-sm font-medium">{t.label}</span>
              <select
                value={state.taskStrength[t.id] ?? AUTO}
                onChange={(e) => {
                  const value = (e.target.value || null) as Strength | null
                  const taskStrength = { ...state.taskStrength }
                  if (value) taskStrength[t.id] = value
                  else delete taskStrength[t.id]
                  save({ ...state, taskStrength }, () => saveTaskStrength(t.id, value))
                }}
                className={inputBase}
                aria-label={`${t.label}的強度`}
              >
                <option value={AUTO}>跟整體強度</option>
                {STRENGTHS.map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
              <ModelOverride
                task={t}
                providers={providers}
                value={state.taskModels[t.id] ?? null}
                onChange={(choice) => {
                  const taskModels = { ...state.taskModels }
                  if (choice) taskModels[t.id] = choice
                  else delete taskModels[t.id]
                  save({ ...state, taskModels }, () => saveTaskModel(t.id, choice))
                }}
              />
            </div>
          ))}
          <p className="text-xs text-muted">指定模型後，強度只在那家沒有金鑰時才派上用場；指定的模型讀不了時，會換其他有金鑰的服務。</p>
        </div>
      </details>
    </div>
  )
}


function TaskLine({ task, r, providers, usage, custom }: { task: (typeof TASKS)[number]; r: Route | null; providers: ProviderInfo[]; usage: UsageRow[]; custom: boolean }) {
  if (!r) return <li className="px-3 py-2 text-muted">{task.label}：沒有能用的模型</li>
  const name = (c: ModelChoice) => providers.find((p) => p.id === c.provider)?.models.find((m) => m.id === c.model)?.label ?? c.model
  const cost = routeCost(r, providers, task.units, measuredPerUnit(usage, task.id, r.primary.model))
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 px-3 py-2">
      <span>
        <span className="font-medium">{task.label}</span>
        {custom && <span className="ml-1.5 text-xs text-muted">（自訂）</span>}
        <span className="text-muted">：{name(r.primary)}</span>
        {r.escalate && <span className="text-muted">，沒把握的頁升 {name(r.escalate)}</span>}
      </span>
      <span className="num text-xs text-muted">{cost === null ? '價格未知' : `${task.unit}約 ${formatUsd(cost)}`}</span>
    </li>
  )
}

/** "Automatic" or one model of a provider with a key; reading tasks only list models that see images. */
function ModelOverride({ task, providers, value, onChange }: { task: (typeof TASKS)[number]; providers: ProviderInfo[]; value: ModelChoice | null; onChange: (choice: ModelChoice | null) => void }) {
  const sees = task.id !== 'grading'
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
      label={`${task.label}的模型`}
      className={inputBase}
      onChange={(v) => {
        if (!v) return onChange(null)
        const [provider, model] = v.split('\n') as [string, string]
        onChange({ provider, model })
      }}
      groups={[{ options: [{ value: AUTO, label: '自動（依強度）' }, ...(value && !known ? [{ value: current, label: value.model }] : [])] }, ...groups]}
    />
  )
}
