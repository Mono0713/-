import { SharedActions } from '@/features/sharing/SharedActions'
import { currentOwner, services } from '@/server/context'
import { openShare } from '@/server/shared'
import { getT } from '@/shared/i18n/server'
import { TYPE_LABELS } from '@/shared/labels'
import { Card, EmptyState, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('分享的考卷') }
}

/** The page a share link opens. Signing in is required (the front door sends people to it first). */
export default async function SharedPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const t = await getT()
  const opened = await openShare(token)
  if (!opened) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState title={t('這個連結已經關閉了')}>{t('分享的人關掉了連結，或考卷已經刪除。可以請對方再傳一次新的連結。')}</EmptyState>
      </div>
    )
  }
  const { exam, questions, share } = opened
  const owner = await currentOwner()
  // A copy made earlier and still in the bank.
  let copy: string | null = null
  for (const id of await services().shares.copies(token, owner)) {
    if ((await services().bank.getExam(id))?.ownerId === owner) {
      copy = id
      break
    }
  }
  const points = questions.reduce((sum, q) => sum + (q.points ?? 0), 0)
  const types = [...new Set(questions.map((q) => (TYPE_LABELS[q.type] ? t(TYPE_LABELS[q.type]) : q.type)))]

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title={exam.title ?? t('未命名考卷')} subtitle={[exam.subject, t('{n} 題', { n: questions.length }), points ? t('共 {n} 分', { n: points }) : null].filter(Boolean).join(' · ')} />
      <Card className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap gap-1.5 text-xs text-muted">
          {types.map((type) => (
            <span key={type} className="rounded-full border border-line px-2 py-0.5">
              {type}
            </span>
          ))}
          {share.answers === 'never' && <span className="rounded-full border border-line px-2 py-0.5">{t('答案不公開')}</span>}
        </div>
        <SharedActions token={token} copy={copy} allowCopy={share.allowCopy} />
      </Card>
    </div>
  )
}
