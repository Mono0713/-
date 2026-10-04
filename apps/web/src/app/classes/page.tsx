import Link from 'next/link'
import { ClassHome } from '@/features/classes/ClassHome'
import { ROLE_LABELS } from '@/server/classes'
import { currentOwner, services } from '@/server/context'
import { getT } from '@/shared/i18n/server'
import { Removable } from '@/shared/removal'
import { Badge, Card, PageHeader } from '@/shared/ui'

export const dynamic = 'force-dynamic'
export async function generateMetadata() {
  const t = await getT()
  return { title: t('班級') }
}

export default async function ClassesPage() {
  const t = await getT()
  const { classes } = services()
  const mine = await classes.of(await currentOwner())
  const counts = await Promise.all(
    mine.map(async ({ classroom }) => [(await classes.members(classroom.id)).filter((m) => m.role === 'student').length, (await classes.assignments(classroom.id)).length] as const),
  )

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader title={t('班級')} subtitle={mine.length ? t('{n} 個班級', { n: mine.length }) : t('老師派作業、學生作答，成績集中在一起')} />
      <ClassHome />
      {mine.length > 0 && (
        <ul className="m-stagger grid gap-3 sm:grid-cols-2">
          {mine.map(({ classroom, role }, i) => (
            <Removable key={classroom.id} id={classroom.id}>
              <li>
                <Link href={`/classes/${classroom.id}`} className="block">
                  <Card interactive className="space-y-2 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 font-semibold">{classroom.name}</span>
                      <Badge tone={role === 'student' ? 'neutral' : 'accent'}>{t(ROLE_LABELS[role])}</Badge>
                    </div>
                    <p className="text-sm text-muted">
                      {t('{students} 位學生 · {assignments} 份作業', { students: counts[i]![0], assignments: counts[i]![1] })}
                    </p>
                  </Card>
                </Link>
              </li>
            </Removable>
          ))}
        </ul>
      )}
    </div>
  )
}
