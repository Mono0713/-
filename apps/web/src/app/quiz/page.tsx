import { summarize } from '@exam/quiz'
import { QuizList } from '@/features/quiz/QuizList'
import { currentOwner, services } from '@/server/context'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function QuizListPage() {
  const attempts = await services().quizzes.list(await currentOwner())
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="線上測驗"
        subtitle={`${attempts.length} 次紀錄`}
        actions={
          <ButtonLink href="/quiz/new" variant="primary">
            新測驗
          </ButtonLink>
        }
      />
      {attempts.length === 0 ? (
        <EmptyState title="還沒有測驗紀錄">從題庫挑考卷或題目，選擇考試或單題練習。</EmptyState>
      ) : (
        <QuizList
          rows={attempts.map((a) => ({
            id: a.id,
            title: a.title,
            exam: a.settings.mode === 'exam',
            count: a.items.length,
            date: new Date(a.startedAt).toLocaleDateString('zh-TW'),
            score: a.finishedAt === null ? null : (({ score, max }) => ({ score, max }))(summarize(a)),
          }))}
        />
      )}
    </div>
  )
}
