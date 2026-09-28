import { IconBank, IconQuiz, IconUpload, type Icon } from '@/shared/icons'

/** The app's main sections, shared by the sidebar and the phone header. */
export const NAV: { href: string; label: string; icon: Icon }[] = [
  { href: '/imports', label: '匯入考卷', icon: IconUpload },
  { href: '/bank', label: '題庫', icon: IconBank },
  { href: '/quiz', label: '線上測驗', icon: IconQuiz },
]

export const activeNav = (pathname: string) => NAV.findIndex((n) => pathname === n.href || pathname.startsWith(n.href + '/'))
