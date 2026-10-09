'use server'

import type { QuestionType } from '@exam/core'
import type { ExamPlan } from '@exam/grading'
import { MAX_MATERIAL_PAGES, TOO_MANY_PAGES, WRITTEN, type Material } from '@exam/importer'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { writerFor } from '@/server/ai'
import { currentOwner, localeOf, services } from '@/server/context'
import { requireImport } from '@/server/owned'
import { noRoomFor } from '@/server/storage'
import { getT } from '@/shared/i18n/server'
import { TYPE_LABELS } from '@/shared/labels'
import { readPlan } from './plan'
import { withSections } from './sections'

/** Most questions one exam may ask for, so the reply fits in one answer of the model. */
const MAX_QUESTIONS = 40

/** Stores the study material and starts writing the exam in the background; the import page shows progress, then the editor. */
export async function generateExam(form: FormData): Promise<{ error: string } | void> {
  const t = await getT()
  const files = form.getAll('files').filter((f): f is File => f instanceof File && f.size > 0)
  const text = String(form.get('text') ?? '').trim() || null
  if (!files.length && !text) return { error: t('先放上講義、筆記，或貼上一段文字。') }
  const plan = readPlan(form)
  const total = plan.types.reduce((n, x) => n + x.count, 0)
  if (!total) return { error: t('至少選一種題型，題數大於 0。') }
  if (total > MAX_QUESTIONS) return { error: t('一次最多出 {n} 題，請減少題數。', { n: MAX_QUESTIONS }) }
  const owner = await currentOwner()
  // the material pages are sent as pictures whenever there are any, so a model that sees them is needed
  const route = await writerFor(owner, files.some((f) => !/\.(txt|md|markdown|csv)$/i.test(f.name)))
  if (!route) return { error: t('還沒有 API 金鑰：先到設定加上任一家的金鑰。') }
  const full = await noRoomFor(owner, files.reduce((n, f) => n + f.size, 0))
  if (full) return { error: full }
  let id: string
  try {
    const record = await services().importer.written.create({
      ownerId: owner,
      fileName: plan.title || files[0]?.name.replace(/\.[^.]+$/, '') || t('AI 出題'),
      files: await Promise.all(files.map(async (f) => ({ name: f.name, data: Buffer.from(await f.arrayBuffer()) }))),
      text,
      request: plan,
      model: route.model,
    })
    id = record.id
  } catch (err) {
    if (err instanceof Error && err.message === TOO_MANY_PAGES) return { error: t('講義最多 {n} 頁，請只放要考的範圍。', { n: MAX_MATERIAL_PAGES }) }
    console.error('[generate] could not store the material', err)
    return { error: t('檔案讀不出來：請放 PDF、圖片或文字檔。') }
  }
  await write(id)
  revalidatePath('/imports')
  redirect(`/imports/${id}`)
}

/** Writes the exam again from the same material and choices, after a failed run. */
export async function retryGenerate(importId: string): Promise<{ error: string } | void> {
  const imp = await requireImport(importId)
  if (imp.provider !== WRITTEN) return
  const result = await write(importId)
  if (result) return result
  revalidatePath(`/imports/${importId}`)
}

async function write(importId: string): Promise<{ error: string } | void> {
  const { importer } = services()
  const imp = await importer.bank.getImport(importId)
  if (!imp) return
  const t = await getT()
  const language = await localeOf(imp.ownerId)
  // Section headings are worded now, in the person's language: the run outlives this request.
  const headings = { type: (type: QuestionType) => t('{type}題', { type: t(TYPE_LABELS[type]) }), group: t('題組') }
  await importer.written.start(imp, async (material: Material, request) => {
    const plan = request as ExamPlan
    const pages = material.pages.map((p) => ({ pageNumber: p.pageNumber, text: p.text, image: plan.figures || !p.text?.trim() ? p.image : null }))
    const route = await writerFor(imp.ownerId, pages.some((p) => p.image))
    if (!route) throw new Error('No API key for writing exams')
    const draft = await route.writer.write({ pages, text: material.text, plan, language })
    return { ...withSections(draft, headings, plan.types.map((x) => x.type), language), fileName: imp.fileName }
  })
}
