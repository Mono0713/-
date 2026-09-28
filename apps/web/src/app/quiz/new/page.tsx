import { QuizSetup, type SetupExam } from '@/features/quiz/QuizSetup'
import { currentOwner, services } from '@/server/context'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function NewQuizPage({ searchParams }: { searchParams: Promise<{ exam?: string | string[] }> }) {
  const { exam } = await searchParams
  const { bank } = services()
  const owner = currentOwner()
  const exams: SetupExam[] = bank
    .listExams({ ownerId: owner })
    .filter((e) => e.questionCount > 0)
    .map((e) => ({
      id: e.id,
      title: e.title ?? '未命名考卷',
      subject: e.subject,
      questions: bank.listQuestions({ ownerId: owner, examId: e.id, limit: 1000 }).items.map((q) => ({
        id: q.id,
        section: q.section,
        number: q.number,
        type: q.type,
        preview: q.stem.replace(/[#*_`>$|\\]/g, '').replace(/\s+/g, ' ').slice(0, 80),
        hasKey: q.answer.values.some((v) => v.trim()),
      })),
    }))
  const preselected = [exam ?? []].flat()

  return (
    <div>
      <PageHeader title="新測驗" />
      {exams.length === 0 ? (
        <EmptyState title="題庫裡還沒有考卷">
          <p className="mb-4">先匯入考卷並存入題庫，才能開始測驗。</p>
          <ButtonLink href="/imports" variant="primary">
            匯入考卷
          </ButtonLink>
        </EmptyState>
      ) : (
        <QuizSetup exams={exams} preselected={preselected} />
      )}
    </div>
  )
}
