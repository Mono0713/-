import { draftOf } from '@exam/bank'
import { QuizSetup, type SetupExam } from '@/features/quiz/QuizSetup'
import { currentOwner, services } from '@/server/context'
import { getT } from '@/shared/i18n/server'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function NewQuizPage({ searchParams }: { searchParams: Promise<{ exam?: string | string[] }> }) {
  const { exam } = await searchParams
  const { bank } = services()
  const owner = await currentOwner()
  const t = await getT()
  const listed = (await bank.listExams({ ownerId: owner })).filter((e) => e.questionCount > 0)
  const exams: SetupExam[] = await Promise.all(
    listed.map(async (e) => ({
      id: e.id,
      title: e.title ?? t('未命名考卷'),
      subject: e.subject,
      questions: (await bank.listQuestions({ ownerId: owner, examId: e.id, limit: 1000 })).items.map((q) => ({
        id: q.id,
        // Previews must not give answers away.
        question: { ...draftOf(q), answer: { values: [], source: 'none' as const }, explanation: null, translation: null, issues: [], confidence: 'high' as const },
        preview: q.stem.replace(/[#*_`>$|\\]/g, '').replace(/\s+/g, ' ').slice(0, 200),
        hasKey: q.answer.values.some((v) => v.trim()),
      })),
    })),
  )
  const preselected = [exam ?? []].flat()

  return (
    <div>
      <PageHeader title={t('新測驗')} />
      {exams.length === 0 ? (
        <EmptyState title={t('題庫裡還沒有考卷')}>
          <p className="mb-4">{t('先匯入考卷並存入題庫，才能開始測驗。')}</p>
          <ButtonLink href="/imports" variant="primary">
            {t('匯入考卷')}
          </ButtonLink>
        </EmptyState>
      ) : (
        <QuizSetup exams={exams} preselected={preselected} />
      )}
    </div>
  )
}
