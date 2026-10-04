import type { Strength } from '@exam/models'
import { msg } from '@/shared/i18n/format'

/** The three AI strengths as the slider shows them, cheapest first. Translated where shown: t(label). */
export const STRENGTH_LABELS = [
  ['save', msg('省錢')],
  ['balanced', msg('平衡')],
  ['best', msg('最準')],
] as const satisfies readonly (readonly [Strength, string])[]

/** One line under the slider on what the chosen strength does. Translated where shown: t(hint). */
export const STRENGTH_HINTS: Record<Strength, string> = {
  save: msg('每種工作都用最便宜的模型。'),
  balanced: msg('平常用中階模型，沒把握的頁再交給最強的模型。'),
  best: msg('每種工作都用最準的模型，最貴。'),
}
