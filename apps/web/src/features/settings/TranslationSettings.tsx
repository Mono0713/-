'use client'

import { route, type ModelChoice, type ProviderInfo, type Strength } from '@exam/models'
import { useState, useTransition } from 'react'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { Segmented } from '@/shared/Segmented'
import { saveTaskStrength, saveTranslationEngine } from './actions'
import { STRENGTH_LABELS } from './strengths'

type Engine = 'free' | 'ai'

const ENGINES = [
  ['free', msg('免費翻譯')],
  ['ai', msg('AI 翻譯')],
] as const

const FOLLOW = 'follow'
const STRENGTHS = [[FOLLOW, msg('跟著整體')], ...STRENGTH_LABELS] as const

/** How the 翻譯 button translates: free services by default, or the AI with a strength of its own. */
export function TranslationSettings({ initial, strength, providers, override }: { initial: { engine: Engine; strength: Strength | null }; strength: Strength; providers: ProviderInfo[]; override: ModelChoice | null }) {
  const t = useT()
  const [state, setState] = useState(initial)
  const [, start] = useTransition()
  const r = route('translation', state.strength ?? strength, providers, { override })
  return (
    <div className="space-y-3 px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented<Engine>
          value={state.engine}
          options={ENGINES.map(([v, label]) => [v, t(label)] as const)}
          onChange={(engine) => {
            setState({ ...state, engine })
            start(() => saveTranslationEngine(engine))
          }}
        />
        <span className="text-xs text-muted">
          {state.engine === 'free' ? t('用 Google 翻譯，不用金鑰也不花錢。') : r ? t('目前使用 {model}', { model: r.primary.model }) : t('還沒有 API 金鑰，先用免費翻譯。')}
        </span>
      </div>
      {state.engine === 'ai' && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm">{t('AI 強度')}</span>
          <Segmented<Strength | typeof FOLLOW>
            value={state.strength ?? FOLLOW}
            options={STRENGTHS.map(([v, label]) => [v, t(label)] as const)}
            onChange={(v) => {
              const next = v === FOLLOW ? null : v
              setState({ ...state, strength: next })
              start(() => saveTaskStrength('translation', next))
            }}
          />
        </div>
      )}
    </div>
  )
}
