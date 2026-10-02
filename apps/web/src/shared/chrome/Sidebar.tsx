import { connection } from 'next/server'
import { Suspense } from 'react'
import { authEnabled, currentUser, services } from '@/server/context'
import { Logo } from '@/shared/brand/Logo'
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
  const owner = authEnabled() ? (await currentUser())?.id : 'local'
  if (!owner) return null
  const [all, exams] = await Promise.all([bank.listImports(owner), bank.listExams({ ownerId: owner })])
  const imports = all.slice(0, 6)
  const questions = exams.reduce((n, e) => n + e.questionCount, 0)
  return (
    <>
      {imports.length > 0 && (
        <div className="mt-8 min-h-0 flex-1 overflow-y-auto px-3">
          <p className="mb-1.5 px-2 text-[11px] font-semibold tracking-[0.12em] text-white/35">最近匯入</p>
          <ul className="space-y-px">
            {imports.map((imp) => (
              <li key={imp.id}>
                <RecentLink href={`/imports/${imp.id}`} title={imp.title ?? imp.fileName} status={imp.status} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-auto border-t border-white/[0.07] px-5 py-4">
        <div className="flex items-baseline gap-4 text-white/45">
          <p className="text-xs">
            <span className="num mr-1 text-lg text-white">{exams.length}</span>份考卷
          </p>
          <p className="text-xs">
            <span className="num mr-1 text-lg text-white">{questions}</span>題
          </p>
        </div>
      </div>
    </>
  )
}
