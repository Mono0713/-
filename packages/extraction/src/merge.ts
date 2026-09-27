import type { DraftExam, DraftQuestion, ExamMeta, ExtractedQuestion } from '@exam/core'
import type { PageResult } from './extract.ts'

/**
 * Combines per-page results into one draft exam: joins questions that run over a
 * page break, namespaces group ids per page, and fills exam metadata from the
 * first page that shows each field.
 */
export function mergePages(fileName: string, results: PageResult[]): DraftExam {
  const ordered = [...results].sort((a, b) => a.pageNumber - b.pageNumber)
  const meta: ExamMeta = { title: null, subject: null, institution: null, term: null, language: null }
  const exam: DraftExam = { fileName, meta, groups: [], questions: [], pages: [] }

  let open: DraftQuestion | null = null
  let section: string | null = null
  for (const result of ordered) {
    exam.pages.push({
      pageNumber: result.pageNumber,
      provider: result.provider,
      model: result.model,
      notes: result.error ? `extraction failed: ${result.error}` : (result.page?.notes ?? null),
    })
    if (!result.page) {
      open = null
      continue
    }
    const page = result.page
    for (const key of Object.keys(meta) as (keyof ExamMeta)[]) {
      meta[key] ??= page.meta[key]
    }

    const groupId = (id: string | null) => (id === null ? null : `p${result.pageNumber}:${id}`)
    for (const group of page.groups) {
      exam.groups.push({ ...group, id: groupId(group.id)!, pageNumber: result.pageNumber })
    }

    for (const [index, q] of page.questions.entries()) {
      const location = { pageNumber: result.pageNumber, bbox: q.bbox }
      if (index === 0 && open && q.continuesFromPreviousPage) {
        appendContinuation(open, q, location)
      } else {
        // A page that starts mid-section does not repeat the heading.
        section = q.section ?? section
        exam.questions.push(tidy(toDraft({ ...q, section }, groupId(q.groupId), location)))
      }
    }
    const last = page.questions.at(-1)
    open = last?.continuesOnNextPage ? exam.questions.at(-1)! : null
  }
  return exam
}

function toDraft(q: ExtractedQuestion, groupId: string | null, location: DraftQuestion['locations'][number]): DraftQuestion {
  const { continuesFromPreviousPage: _from, continuesOnNextPage: _to, bbox: _bbox, ...rest } = q
  return { ...rest, groupId, locations: [location] }
}

/** Brackets and trailing punctuation some models leave on option labels: "(1)", "A.", "（B）". */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/^[(（\[]\s*/, '').replace(/\s*[)）\].:：、]$/, '').trim()
}

/** Evens out what different models return so drafts look the same whichever model made them. */
function tidy(q: DraftQuestion): DraftQuestion {
  for (const option of q.options) option.label = normalizeLabel(option.label)
  if (q.options.length > 0) q.answer.values = q.answer.values.map(normalizeLabel)
  if (q.explanation && q.explanation.trim() === q.answer.values.join('\n').trim()) q.explanation = null
  if (q.points === null && q.section) {
    const perQuestion = /每題\s*(\d+(?:\.\d+)?)\s*分|(\d+(?:\.\d+)?)\s*(?:points?|pts?)\s*(?:for\s+)?each/i.exec(q.section)
    if (perQuestion) q.points = Number(perQuestion[1] ?? perQuestion[2])
  }
  return q
}

const CONFIDENCE_RANK = { high: 2, medium: 1, low: 0 } as const

function appendContinuation(target: DraftQuestion, part: ExtractedQuestion, location: DraftQuestion['locations'][number]) {
  target.stem = [target.stem, part.stem].filter(Boolean).join('\n\n')
  target.options.push(...part.options)
  target.figures.push(...part.figures)
  if (target.answer.values.length === 0 && part.answer.values.length > 0) target.answer = part.answer
  if (part.explanation) target.explanation = [target.explanation, part.explanation].filter(Boolean).join('\n\n')
  target.points ??= part.points
  target.issues.push(...part.issues)
  if (CONFIDENCE_RANK[part.confidence] < CONFIDENCE_RANK[target.confidence]) target.confidence = part.confidence
  target.locations.push(location)
}
