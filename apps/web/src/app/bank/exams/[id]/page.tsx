import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ExamMetaForm } from '@/features/bank/ExamMetaForm'
import { QuestionView } from '@/features/questions/QuestionView'
import { ShareMenu } from '@/features/sharing/ShareMenu'
import { services } from '@/server/context'
import { ownedExam } from '@/server/owned'
import { Markdown } from '@/shared/Markdown'
import { FigureView } from '@/shared/FigureView'
import { Removable } from '@/shared/removal'
import { ButtonLink, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function ExamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const exam = await ownedExam(id)
  if (!exam) notFound()
  const [{ items: questions }, share] = await Promise.all([services().bank.listQuestions({ ownerId: exam.ownerId, examId: id, limit: 1000 }), services().shares.forExam(id)])
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
            <ShareMenu examId={exam.id} initial={share && { token: share.token, answers: share.answers, allowCopy: share.allowCopy }} />
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
            <Removable key={q.id} id={q.id}>
              <div>
                {showSection && <h3 className="mb-2 mt-6 text-sm font-semibold text-muted">{q.section}</h3>}
                {group && (group.stem.trim() || group.figures.length > 0) && (
                  <div className="mb-3 rounded-xl border border-line bg-paper p-4">
                    {group.stem.trim() && <Markdown>{group.stem}</Markdown>}
                    {group.figures.map((f, k) => (
                      <FigureView key={k} figure={f} />
                    ))}
                  </div>
                )}
                {/* Questions of a group, like the sub-questions 11(a) and 11(b), sit under its shared text. */}
                <section className={`rounded-2xl bg-surface shadow-sheet p-4 ${q.groupId && groups.has(q.groupId) ? 'ml-4 sm:ml-7' : ''}`}>
                  <QuestionView q={q} />
                  <div className="mt-3 flex justify-end border-t border-line pt-3">
                    <Link href={`/bank/${q.id}`} className="text-sm text-accent hover:underline">
                      編輯這題
                    </Link>
                  </div>
                </section>
              </div>
            </Removable>
          )
        })}
      </div>
    </div>
  )
}
