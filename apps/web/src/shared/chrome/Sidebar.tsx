import { connection } from 'next/server'
import { Suspense, type ReactNode } from 'react'
import { localPerson } from '@/server/auth'
import { authEnabled, currentUser, services } from '@/server/context'
import { Logo } from '@/shared/brand/Logo'
import { getT } from '@/shared/i18n/server'
import { rich } from '@/shared/i18n/rich'
import { Removable } from '@/shared/removal'
import { Account } from './Account'
import { RecentLink, SideNav } from './SideNav'

/** Left rail on wide screens: logo, main navigation, recent imports and bank totals. */
export function Sidebar() {
  return (
    <aside className="app-sidebar sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-night text-white/70 xl:flex">
      <div className="px-5 pb-7 pt-6">
        <Logo tone="light" />
      </div>
      <SideNav />
      <Suspense>
        <Recent />
        <Account tone="sidebar" />
      </Suspense>
    </aside>
  )
}

async function Recent() {
  await connection()
  const { bank } = services()
  // Signed out (the sign-in page): nothing to list.
  const owner = authEnabled() ? (await currentUser())?.id : (await localPerson()).id
  if (!owner) return null
  const [all, exams] = await Promise.all([bank.listImports(owner), bank.listExams({ ownerId: owner })])
  const imports = all.slice(0, 6)
  const questions = exams.reduce((n, e) => n + e.questionCount, 0)
  const t = await getT()
  const count = (c: ReactNode) => <span className="num mr-1 text-lg text-white">{c}</span>
  return (
    <>
      {imports.length > 0 && (
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto px-3 [scrollbar-gutter:stable]">
          <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-[0.12em] text-white/35">{t('最近匯入')}</p>
          <ul className="space-y-px">
            {imports.map((imp) => (
              <Removable key={imp.id} id={imp.id}>
                <li>
                  <RecentLink href={`/imports/${imp.id}`} title={imp.title ?? imp.fileName} status={imp.status} />
                </li>
              </Removable>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto border-t border-white/[0.07] px-5 py-4">
        <div className="flex items-baseline gap-4 text-white/45">
          <p className="text-xs">
            {rich(t('<n>{count}</n>份考卷', { count: exams.length }), { n: count })}
          </p>
          <p className="text-xs">
            {rich(t('<n>{count}</n>題', { count: questions }), { n: count })}
          </p>
        </div>
      </div>
    </>
  )
}
