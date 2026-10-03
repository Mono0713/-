import type { Strength } from '@exam/models'

/** The three AI strengths as the slider shows them, cheapest first. */
export const STRENGTH_LABELS = [
  ['save', '省錢'],
  ['balanced', '平衡'],
  ['best', '最準'],
] as const satisfies readonly (readonly [Strength, string])[]

/** One line under the slider on what the chosen strength does. */
export const STRENGTH_HINTS: Record<Strength, string> = {
  save: '每種工作都用最便宜的模型。',
  balanced: '平常用中階模型，沒把握的頁再交給最強的模型。',
  best: '每種工作都用最準的模型，最貴。',
}
