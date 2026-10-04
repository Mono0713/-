import { msg } from '@/shared/i18n/format'
import { IconBank, IconClass, IconQuiz, IconSettings, IconUpload, type Icon } from '@/shared/icons'

/** The app's main sections, shared by the sidebar and the phone header. Labels are translated where shown: t(item.label). */
export const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: '/imports', label: msg('匯入考卷'), icon: IconUpload },
  { href: '/bank', label: msg('題庫'), icon: IconBank },
  { href: '/quiz', label: msg('線上測驗'), icon: IconQuiz },
  { href: '/classes', label: msg('班級'), icon: IconClass },
  { href: '/settings', label: msg('設定'), icon: IconSettings },
]

export const activeNav = (pathname: string) => NAV.findIndex((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
