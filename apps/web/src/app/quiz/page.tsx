import { summarize } from '@exam/quiz'
import { QuizCount, QuizList } from '@/features/quiz/QuizList'
import { currentOwner, services } from '@/server/context'
import { getLocale, getT } from '@/shared/i18n/server'
import { intlTag } from '@/shared/i18n/locales'
import { ButtonLink, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'

export default async function QuizListPage() {
  const attempts = await services().quizzes.list(await currentOwner())
  const t = await getT()
  const locale = await getLocale()
  const empty = <EmptyState title={t('還沒有測驗紀錄')}>{t('從題庫挑考卷或題目，選擇考試或單題練習。')}</EmptyState>
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={t('線上測驗')}
        subtitle={<QuizCount ids={attempts.map((a) => a.id)} />}
        actions={
          <ButtonLink href="/quiz/new" variant="primary">
            {t('新測驗')}
          </ButtonLink>
        }
      />
      {attempts.length === 0 ? (
        empty
      ) : (
        <QuizList
          empty={empty}
          rows={attempts.map((a) => ({
            id: a.id,
            title: a.title,
            exam: a.settings.mode === 'exam',
            count: a.items.length,
            date: new Date(a.startedAt).toLocaleDateString(intlTag(locale)),
            score: a.finishedAt === null ? null : (({ score, max }) => ({ score, max }))(summarize(a)),
          }))}
        />
      )}
    </div>
  )
}
