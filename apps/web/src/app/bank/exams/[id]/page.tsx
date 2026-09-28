import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExamMetaForm } from '@/features/bank/ExamMetaForm'
import { QuestionView } from '@/features/questions/QuestionView'
import { currentOwner, services } from '@/server/context'
import { Markdown } from '@/shared/Markdown'
import { FigureView } from '@/shared/FigureView'
import { ButtonLink, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { bank } = services()
  const exam = bank.getExam(id)
  if (!exam || exam.ownerId !== currentOwner()) notFound()
  const { items: questions } = bank.listQuestions({ ownerId: exam.ownerId, examId: id, limit: 1000 })
  const groups = new Map(exam.groups.map((g) => [g.id, g]))
  const points = questions.reduce((sum, q) => sum + (q.points ?? 0), 0)

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={exam.title ?? '未命名考卷'}
        subtitle={[exam.subject, `${questions.length} 題`, points ? `共 ${points} 分` : null].filter(Boolean).join(' · ')}
        actions={
          <>
            {exam.importId && <ButtonLink href={`/imports/${exam.importId}`}>看原始考卷</ButtonLink>}
            <ButtonLink href={`/quiz/new?exam=${exam.id}`} variant="primary">
              用這份考卷測驗
            </ButtonLink>
          </>
        }
      />
      <ExamMetaForm exam={exam} />

      <div className="mt-6 space-y-4">
        {questions.map((q, i) => {
          const showSection = q.section && q.section !== questions[i - 1]?.section
          const group = q.groupId && q.groupId !== questions[i - 1]?.groupId ? groups.get(q.groupId) : undefined
          return (
            <div key={q.id}>
              {showSection && <h3 className="mb-2 mt-6 text-sm font-semibold text-muted">{q.section}</h3>}
              {group && (
                <div className="mb-3 rounded-xl border border-line bg-paper p-4">
                  <Markdown>{group.stem}</Markdown>
                  {group.figures.map((f, k) => (
                    <FigureView key={k} figure={f} />
                  ))}
                </div>
              )}
              <section className="rounded-xl border border-line bg-surface p-4">
                <QuestionView q={q} />
                <div className="mt-3 flex justify-end border-t border-line pt-3">
                  <Link href={`/bank/${q.id}`} className="text-sm text-accent hover:underline">
                    編輯這題
                  </Link>
                </div>
              </section>
            </div>
          )
        })}
      </div>
    </div>
  )
}
