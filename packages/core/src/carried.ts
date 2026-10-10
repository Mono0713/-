import type { DraftExam } from './types.ts'

/** "11(b)" → { main: "11", part: "b" }; "10" → { main: "10", part: null }. */
function parts(number: string): { main: string; part: string | null } {
  const hit = /^\s*(\d+)\s*(?:[(（]\s*([^)）]+?)\s*[)）])?\s*$/.exec(number)
  return hit ? { main: hit[1]!, part: hit[2] ?? null } : { main: number.trim(), part: null }
}

/** Whether `next` is numbered right after `prev`: 9 → 10, or 11(a) → 11(b). */
function follows(prev: string, next: string): boolean {
  const a = parts(prev)
  const b = parts(next)
  if (a.part !== null && b.part !== null) return a.main === b.main
  return a.part === null && b.part === null && /^\d+$/.test(a.main) && Number(b.main) === Number(a.main) + 1
}

/**
 * Questions carried onto the next page rejoin the group they started in. Each page is read on its own,
 * so a reader that sees a passage, word box or sub-question continue from the page before marks the
 * question as belonging to a group that is not on its page; such a question, numbered right after one
 * in a group, joins that group, and so do the others pointing at the same missing group. The same draft
 * when nothing changed.
 */
export function joinCarriedGroups<T extends Pick<DraftExam, 'groups' | 'questions'>>(draft: T): T {
  const exists = new Set(draft.groups.map((g) => g.id))
  const moved = new Map<string, string>()
  const questions = [...draft.questions]
  for (let i = 1; i < questions.length; i++) {
    const q = questions[i]!
    if (!q.groupId || exists.has(q.groupId)) continue
    const prev = questions[i - 1]!
    const target = moved.get(q.groupId) ?? (prev.groupId && exists.has(prev.groupId) && follows(prev.number, q.number) ? prev.groupId : undefined)
    if (!target) continue
    moved.set(q.groupId, target)
    questions[i] = { ...q, groupId: target }
  }
  return moved.size ? { ...draft, questions } : draft
}
