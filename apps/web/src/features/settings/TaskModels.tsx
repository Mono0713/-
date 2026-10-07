'use client'

import { formatUsd, PICTURE_TASKS, route, routeCost, type ModelChoice, type ProviderInfo, type Strength, type Task } from '@exam/models'
import { measuredPerUnit, type UsageRow } from '@exam/usage/estimates'
import { useEffect, useRef, useState, useTransition } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { IconImage } from '@/shared/icons'
import { UNDO_MS } from '@/shared/removal'
import { Segmented } from '@/shared/Segmented'
import { Toast } from '@/shared/Toast'
import { applyStrength, restoreChoices, saveAiGrading, savePictureModel, saveTaskModel, saveTranslationEngine, type ModelChoices } from './actions'
import { STRENGTH_HINTS, STRENGTH_LABELS } from './strengths'
import { Switch } from './Switch'
import { AUTO, decodeChoice, encodeChoice, TaskModelPicker } from './TaskModelPicker'

interface TaskInfo {
  id: Task
  label: string
  hint: string
  /** How one unit of work reads, and how many the estimate covers. */
  unit: string
  units: number
}

// Texts are translated where shown: t(label).
const GROUPS: { title: string; tasks: TaskInfo[] }[] = [
  {
    title: msg('讀考卷'),
    tasks: [
      { id: 'recognition', label: msg('辨識考卷'), hint: msg('把照片、掃描和 PDF 讀成題目。'), unit: msg('一份 4 頁考卷'), units: 4 },
      { id: 'handwriting', label: msg('讀手寫作答'), hint: msg('把手寫的答案讀成文字再批改。'), unit: msg('每題'), units: 1 },
    ],
  },
  {
    title: msg('批改與解題'),
    tasks: [
      { id: 'grading', label: msg('批改問答題'), hint: msg('程式比不出對錯的答案，交卷後由 AI 評分、寫評語。'), unit: msg('每次交卷'), units: 1 },
      { id: 'solving', label: msg('AI 作答'), hint: msg('替沒印答案的題目做出答案。'), unit: msg('每題'), units: 1 },
      { id: 'explaining', label: msg('AI 詳解'), hint: msg('替題目寫一步步的詳解。'), unit: msg('每題'), units: 1 },
      { id: 'tutoring', label: msg('問 AI'), hint: msg('看過答案後，和 AI 討論這一題。'), unit: msg('每則回覆'), units: 1 },
    ],
  },
  {
    title: msg('翻譯'),
    tasks: [{ id: 'translation', label: msg('翻譯題目'), hint: msg('做題時把題目和選項翻成介面語言。'), unit: msg('每題'), units: 1 }],
  },
]

const FREE = 'free'

export interface TaskModelsState extends ModelChoices {
  translation: 'free' | 'ai'
  /** AI 批改 is on. */
  grading: boolean
}

/**
 * 每項工作用哪個模型: one row per AI task with the model it runs on, picked by hand or 自動. 一鍵套用
 * sets every task back to 自動 at one strength (復原 puts the hand-picked ones back). AI 作答, 詳解 and
 * 問 AI also name the model for questions with pictures, since a cheap text-only model cannot see them.
 */
export function TaskModels({ providers, initial, usage }: { providers: ProviderInfo[]; initial: TaskModelsState; usage: UsageRow[] }) {
  const t = useT()
  const [state, setState] = useState(initial)
  const [undo, setUndo] = useState<{ before: TaskModelsState; note: string } | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const [, start] = useTransition()
  useEffect(() => () => clearTimeout(timer.current), [])

  const name = (c: ModelChoice) => providers.find((p) => p.id === c.provider)?.models.find((m) => m.id === c.model)?.label ?? c.model
  const routeOf = (task: Task, pictures = false) =>
    route(task, state.strength, providers, { override: (pictures && state.pictureModels[task]) || state.taskModels[task], pictures })
  const picked = Object.keys(state.taskModels).length + Object.keys(state.pictureModels).length

  const change = (next: TaskModelsState, action: () => Promise<unknown>) => {
    setState(next)
    start(async () => void (await action()))
  }

  const preset = (strength: Strength) => {
    if (!picked && strength === state.strength) return
    const before = state
    setState({ ...state, strength, taskModels: {}, pictureModels: {} })
    start(async () => void (await applyStrength(strength)))
    if (!picked) return
    clearTimeout(timer.current)
    setUndo({ before, note: t('{n} 項改回自動', { n: picked }) })
    timer.current = setTimeout(() => setUndo(null), UNDO_MS)
  }

  const restore = () => {
    if (!undo) return
    clearTimeout(timer.current)
    const { before } = undo
    setUndo(null)
    setState({ ...state, strength: before.strength, taskModels: before.taskModels, pictureModels: before.pictureModels })
    start(async () => void (await restoreChoices({ strength: before.strength, taskModels: before.taskModels, pictureModels: before.pictureModels })))
  }

  const pick = (task: Task, value: string) => {
    const choice = decodeChoice(value)
    const taskModels = { ...state.taskModels }
    if (choice) taskModels[task] = choice
    else delete taskModels[task]
    if (task !== 'translation') return change({ ...state, taskModels }, () => saveTaskModel(task, choice))
    // 翻譯 picks the free service too
    const translation = value === FREE ? 'free' : 'ai'
    change({ ...state, taskModels: value === FREE ? state.taskModels : taskModels, translation }, async () => {
      if (translation !== state.translation) await saveTranslationEngine(translation)
      if (value !== FREE) await saveTaskModel(task, choice)
    })
  }

  const pickPictures = (task: Task, value: string) => {
    const choice = decodeChoice(value)
    const pictureModels = { ...state.pictureModels }
    if (choice) pictureModels[task] = choice
    else delete pictureModels[task]
    change({ ...state, pictureModels }, () => savePictureModel(task, choice))
  }

  const strengths = STRENGTH_LABELS.map(([v, label]) => [v, t(label)] as const)
  const others = STRENGTH_LABELS.find(([v]) => v === state.strength)![1]
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line/70 px-5 py-4">
        <span className="text-sm font-medium">{t('一鍵套用')}</span>
        {/* with models picked by hand no strength is lit: the rows say what each task uses */}
        <Segmented<Strength | ''> value={picked ? '' : state.strength} options={strengths} onChange={(v) => v && preset(v)} />
        <span className="basis-full text-xs text-muted sm:basis-auto sm:flex-1">
          {picked ? t('{n} 項是你自己選的模型，其他跟著「{strength}」。按一格就全部改回自動。', { n: picked, strength: t(others) }) : t(STRENGTH_HINTS[state.strength])}
        </span>
      </div>
      {GROUPS.map((group) => (
        <div key={group.title} className="border-b border-line/70 last:border-b-0">
          <h3 className="px-5 pt-3.5 pb-1 text-xs font-semibold text-muted">{t(group.title)}</h3>
          {group.tasks.map((task) => (
            <TaskRow key={task.id} task={task} state={state} providers={providers} usage={usage} routeOf={routeOf} name={name} onPick={pick} onPickPictures={pickPictures} onGrading={(grading) => change({ ...state, grading }, () => saveAiGrading({ enabled: grading }))} />
          ))}
        </div>
      ))}
      <Toast show={undo !== null} action={t('復原')} onAction={restore}>
        {undo?.note}
      </Toast>
    </>
  )
}

function TaskRow({
  task,
  state,
  providers,
  usage,
  routeOf,
  name,
  onPick,
  onPickPictures,
  onGrading,
}: {
  task: TaskInfo
  state: TaskModelsState
  providers: ProviderInfo[]
  usage: UsageRow[]
  routeOf: (task: Task, pictures?: boolean) => ReturnType<typeof route>
  name: (c: ModelChoice) => string
  onPick: (task: Task, value: string) => void
  onPickPictures: (task: Task, value: string) => void
  onGrading: (on: boolean) => void
}) {
  const t = useT()
  const label = t(task.label)
  const off = task.id === 'grading' && !state.grading
  const free = task.id === 'translation' && state.translation === 'free'
  const r = routeOf(task.id)
  // 自動 names the model it would pick with nothing chosen by hand
  const auto = route(task.id, state.strength, providers)
  const picked = state.taskModels[task.id]
  const cost = r && !off && !free ? routeCost(r, providers, task.units, measuredPerUnit(usage, task.id, r.primary.model)) : null
  const pictures = PICTURE_TASKS.includes(task.id)
  const autoSeeing = pictures ? route(task.id, state.strength, providers, { override: picked, pictures: true }) : null
  return (
    <div className="grid gap-x-6 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,17rem)] sm:items-start">
      <div className="min-w-0 sm:pt-1.5">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium">{label}</span>
          {task.id === 'grading' && <Switch on={state.grading} label={t('用 AI 批改')} onChange={onGrading} small />}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {t(task.hint)}
          {cost !== null && <span className="num"> {t('{unit}約 {cost}', { unit: t(task.unit), cost: formatUsd(cost) })}</span>}
        </p>
      </div>
      {off ? (
        <p className="rounded-lg bg-ink/[0.035] px-3 py-2 text-sm text-muted">{t('關閉，問答題自己評分')}</p>
      ) : (
        <div className="min-w-0 space-y-1.5">
          <TaskModelPicker
            label={t('{task}的模型', { task: label })}
            providers={providers}
            value={free ? FREE : picked ? encodeChoice(picked) : AUTO}
            auto={auto && name(auto.primary)}
            sees={task.id === 'recognition' || task.id === 'handwriting'}
            lead={task.id === 'translation' ? [{ value: FREE, label: t('免費翻譯（Google）'), hint: t('不用金鑰也不花錢') }] : []}
            onChange={(v) => onPick(task.id, v)}
          />
          {pictures && (
            <div className="flex items-center gap-2">
              <span className="flex shrink-0 items-center gap-1 text-xs text-muted" title={t('題目有圖時改用這個模型；只列看得懂圖的模型。')}>
                <IconImage size={13} aria-hidden />
                {t('有圖時')}
              </span>
              <div className="min-w-0 flex-1">
                <TaskModelPicker
                  label={t('{task}遇到有圖的題目時的模型', { task: label })}
                  providers={providers}
                  value={state.pictureModels[task.id] ? encodeChoice(state.pictureModels[task.id]!) : AUTO}
                  auto={autoSeeing && name(autoSeeing.primary)}
                  autoHint={t('上面的模型看得懂圖就用它')}
                  sees
                  onChange={(v) => onPickPictures(task.id, v)}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
