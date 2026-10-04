import { untangleBoxes, type DraftExam, type DraftFigure, type DraftQuestion, type ExamMeta, type ExtractedQuestion, type Figure } from '@exam/core'
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
    const draftFigures = (figures: Figure[]): DraftFigure[] => figures.map((f) => ({ ...f, pageNumber: result.pageNumber, image: null }))
    for (const group of page.groups) {
      exam.groups.push({ ...group, id: groupId(group.id)!, pageNumber: result.pageNumber, figures: draftFigures(group.figures) })
    }

    for (const [index, q] of page.questions.entries()) {
      const location = { pageNumber: result.pageNumber, bbox: q.bbox }
      if (index === 0 && open && q.continuesFromPreviousPage) {
        appendContinuation(open, q, location, draftFigures(q.figures))
      } else {
        // A page that starts mid-section does not repeat the heading.
        section = q.section ?? section
        exam.questions.push(tidy(toDraft({ ...q, section }, groupId(q.groupId), location, draftFigures(q.figures))))
      }
    }
    const last = page.questions.at(-1)
    open = last?.continuesOnNextPage ? exam.questions.at(-1)! : null
  }
  exam.questions = untangleBoxes(exam.questions)
  return exam
}

function toDraft(q: ExtractedQuestion, groupId: string | null, location: DraftQuestion['locations'][number], figures: DraftFigure[]): DraftQuestion {
  const { continuesFromPreviousPage: _from, continuesOnNextPage: _to, bbox: _bbox, ...rest } = q
  return { ...rest, options: rest.options.map((o) => ({ ...o })), figures, groupId, locations: [location] }
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

function appendContinuation(target: DraftQuestion, part: ExtractedQuestion, location: DraftQuestion['locations'][number], figures: DraftFigure[]) {
  const options = part.options.map((o) => ({ ...o, label: normalizeLabel(o.label) }))
  const lastOption = target.options.at(-1)
  if (lastOption && options[0]?.label === lastOption.label) {
    // The page break cut an option in two: the new page carries the rest of it.
    lastOption.content += options.shift()!.content
  } else if (lastOption && options.length === 0 && part.stem) {
    // Some models return the tail of a cut option as a stem fragment.
    lastOption.content += part.stem
    part = { ...part, stem: '' }
  }
  target.stem = [target.stem, part.stem].filter(Boolean).join('\n\n')
  if (part.translation) target.translation = [target.translation, part.translation].filter(Boolean).join('\n\n')
  target.options.push(...options)
  target.figures.push(...figures)
  if (target.answer.values.length === 0 && part.answer.values.length > 0) target.answer = part.answer
  if (part.explanation) target.explanation = [target.explanation, part.explanation].filter(Boolean).join('\n\n')
  target.points ??= part.points
  target.issues.push(...part.issues)
  if (CONFIDENCE_RANK[part.confidence] < CONFIDENCE_RANK[target.confidence]) target.confidence = part.confidence
  target.locations.push(location)
}

/**
 * Lays a new reading of some pages over the draft the person has been editing, so only those
 * pages change: questions elsewhere stay as they were left (text, answers, order, moved boxes),
 * and on a page read again a box the person placed by hand stays where they put it.
 */
export function keepEdits(previous: DraftExam, next: DraftExam, reread: ReadonlySet<number>): DraftExam {
  const onReread = (l: { pageNumber: number }) => reread.has(l.pageNumber)
  const firstPage = (q: DraftQuestion) => (q.locations.length ? Math.min(...q.locations.map((l) => l.pageNumber)) : null)
  const key = (q: DraftQuestion) => `${q.section ?? ''}\u0000${q.number}`
  const unique = (list: DraftQuestion[]) => {
    const counts = new Map<string, number>()
    for (const q of list) counts.set(key(q), (counts.get(key(q)) ?? 0) + 1)
    return (q: DraftQuestion) => counts.get(key(q)) === 1
  }

  // Old questions on pages not read again stay; one that also ran onto a page read again keeps its other part.
  // The new reading of a page takes the place of the first old question that was on it.
  const questions: (DraftQuestion | number)[] = []
  for (const q of previous.questions) {
    if (!q.locations.some(onReread)) questions.push(q)
    else if (q.locations.some((l) => !onReread(l)))
      questions.push({ ...q, locations: q.locations.filter((l) => !onReread(l)), figures: q.figures.filter((f) => !reread.has(f.pageNumber)) })
    else if (!questions.includes(firstPage(q)!)) questions.push(firstPage(q)!)
  }

  const fresh = next.questions.filter((q) => q.locations.some(onReread))
  const oldUnique = unique(previous.questions)
  const freshUnique = unique(fresh)
  const placedBefore = new Map(previous.questions.filter(oldUnique).map((q) => [key(q), q]))
  const slots = new Map<number, DraftQuestion[]>()
  for (const f of fresh) {
    const before = freshUnique(f) ? placedBefore.get(key(f)) : undefined
    const locations = f.locations.map((l) => (onReread(l) && before?.locations.find((b) => b.manual && b.pageNumber === l.pageNumber)) || l)
    // A question carried over from a page not read again: its part there is the one already edited.
    const carried = f.locations.find((l) => !onReread(l))
    const on = (q: DraftQuestion | number): q is DraftQuestion => typeof q !== 'number' && q.locations.some((l) => l.pageNumber === carried?.pageNumber)
    if (carried) {
      const at = questions.findIndex((q) => on(q) && key(q) === key(f))
      const same = at >= 0 ? at : questions.findLastIndex(on)
      if (same >= 0) {
        const old = questions[same] as DraftQuestion
        questions[same] = { ...f, locations: [...old.locations, ...locations.filter(onReread)].sort((a, b) => a.pageNumber - b.pageNumber) }
        continue
      }
    }
    const page = firstPage(f)!
    if (!questions.includes(page)) {
      const after = questions.findLastIndex((q) => (typeof q === 'number' ? q : (firstPage(q) ?? Infinity)) <= page)
      questions.splice(after + 1, 0, page)
    }
    slots.set(page, [...(slots.get(page) ?? []), { ...f, locations }])
  }

  const meta = { ...previous.meta }
  for (const k of Object.keys(meta) as (keyof ExamMeta)[]) meta[k] ??= next.meta[k]
  return {
    fileName: previous.fileName,
    meta,
    groups: [...previous.groups.filter((g) => !reread.has(g.pageNumber)), ...next.groups.filter((g) => reread.has(g.pageNumber))].sort((a, b) => a.pageNumber - b.pageNumber),
    questions: questions.flatMap((q) => (typeof q === 'number' ? (slots.get(q) ?? []) : [q])),
    pages: next.pages,
  }
}
