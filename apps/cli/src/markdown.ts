import type { DraftExam, DraftFigure } from '@exam/core'

const TYPE_LABELS: Record<string, string> = {
  single_choice: '單選',
  multiple_choice: '多選',
  true_false: '是非',
  fill_in_blank: '填充',
  short_answer: '簡答',
  essay: '問答',
  composition: '作文',
  writing: '寫字練習',
  calculation: '計算',
  matching: '配合',
  other: '其他',
}

/** Human-readable view of a draft exam for eyeballing extraction quality. */
export function renderMarkdown(exam: DraftExam): string {
  const out: string[] = []
  const { meta } = exam
  out.push(`# ${meta.title ?? exam.fileName}`, '')
  const facts = [
    meta.subject && `科目：${meta.subject}`,
    meta.institution && `學校：${meta.institution}`,
    meta.term && `學期：${meta.term}`,
    `模型：${[...new Set(exam.pages.map((p) => `${p.provider}/${p.model}`))].join('、')}`,
  ].filter(Boolean)
  out.push(facts.join(' · '), '')

  for (const page of exam.pages) {
    if (page.notes?.startsWith('extraction failed: waiting for a reply')) {
      out.push(`> 第 ${page.pageNumber} 頁：等待貼上聊天回覆（manual/page-${page.pageNumber}.reply.json）`, '')
    } else if (page.notes) {
      out.push(`> 第 ${page.pageNumber} 頁：${page.notes}`, '')
    }
  }

  const groups = new Map(exam.groups.map((g) => [g.id, g]))
  const shownGroups = new Set<string>()
  let section: string | null = null

  for (const q of exam.questions) {
    if (q.section && q.section !== section) {
      section = q.section
      out.push(`## ${section}`, '')
    }
    if (q.groupId && !shownGroups.has(q.groupId)) {
      const group = groups.get(q.groupId)
      if (group) {
        shownGroups.add(q.groupId)
        out.push('> **題組**', '>', ...group.stem.split('\n').map((line) => `> ${line}`), '')
        for (const f of group.figures) out.push(...renderFigure(f).map((line) => `> ${line}`))
        out.push('')
      }
    }

    const tags = [TYPE_LABELS[q.type] ?? q.type, q.points !== null ? `${q.points} 分` : null, `第 ${q.locations.map((l) => l.pageNumber).join('、')} 頁`]
    const flag = q.confidence === 'high' ? '' : q.confidence === 'medium' ? ' ⚠️' : ' ❗'
    out.push(`### ${q.number}.（${tags.filter(Boolean).join('，')}）${flag}`, '', q.stem, '')
    if (q.translation) out.push(`> 翻譯：${q.translation.replace(/\n/g, '\n> ')}`, '')
    for (const o of q.options) out.push(`- **(${o.label})** ${o.content}`)
    if (q.options.length) out.push('')
    for (const f of q.figures) out.push(...renderFigure(f), '')
    if (q.answer.values.length) {
      const source = q.answer.source === 'handwritten' ? '（手寫）' : q.answer.source === 'printed' ? '（印刷）' : ''
      const blanks = q.figures.flatMap((f) => f.blanks)
      const values = blanks.length === q.answer.values.length ? q.answer.values.map((v, i) => `(${blanks[i]!.label}) ${v}`) : q.answer.values
      out.push(`**答案${source}：** ${values.join('、')}`, '')
    }
    if (q.explanation) out.push(`**詳解：** ${q.explanation}`, '')
    for (const issue of q.issues) out.push(`- ⚠️ ${issue}`)
    if (q.issues.length) out.push('')
  }
  return out.join('\n')
}

function renderFigure(f: DraftFigure): string[] {
  const lines = [`🖼 圖：${f.description}`]
  if (f.image) lines.push('', `![${f.description.replace(/[[\]]/g, '')}](${encodeURI(f.image.file)})`)
  if (f.blanks.length) lines.push('', `圖上空格：${f.blanks.map((b) => b.label).join('、')}`)
  return lines
}
