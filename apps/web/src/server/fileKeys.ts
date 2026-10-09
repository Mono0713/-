import type { DraftExam, DraftFigure } from '@exam/core'

/** The item with pictures outside `prefix` dropped (the figure stays, without its image). */
function keepFigures<T extends { figures: DraftFigure[] }>(prefix: string, item: T): T {
  const foreign = (f: DraftFigure) => f.image !== null && !f.image.file.startsWith(prefix)
  if (!item.figures.some(foreign)) return item
  return { ...item, figures: item.figures.map((f) => (foreign(f) ? { ...f, image: null } : f)) }
}

/** A question keeping only pictures whose file key starts with `prefix` (an owner's `u/<id>/`; '' keeps all). */
export function keepQuestionFiles<T extends { figures: DraftFigure[] }>(prefix: string, question: T): T {
  return prefix ? keepFigures(prefix, question) : question
}

/** A draft keeping only pictures whose file key starts with `prefix`, in its questions and groups. */
export function keepDraftFiles(prefix: string, draft: DraftExam): DraftExam {
  if (!prefix) return draft
  return { ...draft, questions: draft.questions.map((q) => keepFigures(prefix, q)), groups: draft.groups.map((g) => keepFigures(prefix, g)) }
}
