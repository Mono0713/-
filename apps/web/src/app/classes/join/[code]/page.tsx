import { redirect } from 'next/navigation'
import { JoinButton } from '@/features/classes/JoinButton'
import { joinTooOften } from '@/server/classes'
import { currentOwner, services } from '@/server/context'
import { getT } from '@/shared/i18n/server'
import { Card, EmptyState } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('加入班級') }
}

/** Where a join link or QR code leads: the class's name and one button. */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const t = await getT()
  const { classes } = services()
  if (joinTooOften(await currentOwner())) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <EmptyState title={t('試了太多次加入碼，請過 15 分鐘再試。')} />
      </div>
    )
  }
  const classroom = await classes.byCode(code)
  if (!classroom) {
    return (
      <div className="mx-auto max-w-md pt-10">
        <EmptyState title={t('這個加入連結已經失效')}>{t('老師可能換了加入碼。請老師再給一次新的連結或加入碼。')}</EmptyState>
      </div>
    )
  }
  if (await classes.member(classroom.id, await currentOwner())) redirect(`/classes/${classroom.id}`)
  const teacher = (await classes.members(classroom.id)).find((m) => m.role === 'teacher')
  return (
    <div className="mx-auto max-w-md pt-6 sm:pt-12">
      <Card className="space-y-5 p-6 text-center">
        <div className="space-y-1">
          <p className="text-sm text-muted">{teacher ? t('{name} 邀請你加入', { name: teacher.name }) : t('邀請你加入')}</p>
          <h1 className="font-display text-2xl font-semibold">{classroom.name}</h1>
        </div>
        {classroom.joinOpen ? <JoinButton code={classroom.joinCode} /> : <p className="text-sm text-muted">{t('這個班級現在不開放加入，請問老師。')}</p>}
      </Card>
    </div>
  )
}
