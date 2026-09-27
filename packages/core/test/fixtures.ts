import type { ExtractedPage, ExtractedQuestion } from '../src/index.ts'

export function question(overrides: Partial<ExtractedQuestion> = {}): ExtractedQuestion {
  return {
    number: '1',
    section: '選擇題（每題 5 分）',
    groupId: null,
    type: 'single_choice',
    stem: 'Evaluate $\\lim_{x \\to 0} \\frac{\\sin x}{x}$.',
    options: [
      { label: 'A', content: '$0$' },
      { label: 'B', content: '$1$' },
    ],
    answer: { values: ['B'], source: 'handwritten' },
    explanation: null,
    points: 5,
    figures: [],
    bbox: { x: 0.1, y: 0.2, width: 0.8, height: 0.1 },
    continuesFromPreviousPage: false,
    continuesOnNextPage: false,
    confidence: 'high',
    issues: [],
    ...overrides,
  }
}

export function page(questions: ExtractedQuestion[], overrides: Partial<ExtractedPage> = {}): ExtractedPage {
  return {
    meta: { title: '微積分小考', subject: '微積分', institution: null, term: null, language: 'zh-Hant' },
    groups: [],
    questions,
    notes: null,
    ...overrides,
  }
}
