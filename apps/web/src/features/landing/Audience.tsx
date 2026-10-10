import type { CSSProperties } from 'react'
import { IconBackpack, IconGraduation, IconHome, IconLanguages, IconSchool, IconTeach, type Icon } from '@/shared/icons'
import { getT } from '@/shared/i18n/server'
import { Frame } from './art/Frame'
import { Heading } from './Heading'
import { WRAP } from './wrap'

/** Who it is for: from primary school to university, teachers and parents, each with the papers they bring. */
export async function Audience() {
  const t = await getT()
  const groups: { Icon: Icon; title: string; text: string; papers: string[] }[] = [
    { Icon: IconBackpack, title: t('國小'), text: t('生字練習會變成田字格，數學習作也能一題一題反覆練。'), papers: [t('國語習作'), t('數學習作'), t('生字練習')] },
    { Icon: IconSchool, title: t('國中・高中'), text: t('段考、模擬考和講義都存起來，考前隨機抽題，限時再考一次。'), papers: [t('講義'), t('模擬考'), t('段考')] },
    { Icon: IconGraduation, title: t('大學'), text: t('考古題、原文書習題都行，公式、化學式和圖表也認得。'), papers: [t('小考'), t('原文書習題'), t('考古題')] },
    { Icon: IconLanguages, title: t('語言檢定・證照'), text: t('單字、文法和閱讀題組，選項每次重新排，練到真的會為止。'), papers: [t('證照題庫'), t('日檢模擬題'), t('英文單字')] },
    { Icon: IconTeach, title: t('老師・補習班'), text: t('開班級、派作業，學生交卷後批閱、匯出成績，再決定什麼時候公布答案。'), papers: [t('作業'), t('隨堂測驗'), t('學習單')] },
    { Icon: IconHome, title: t('家長'), text: t('把孩子寫過的考卷整理成題庫，在家也能出一張新的考卷。'), papers: [t('講義'), t('評量'), t('孩子的考卷')] },
  ]
  return (
    <section id="who" className={`${WRAP} scroll-mt-16 py-20 lg:py-28`}>
      <Heading n={2} kicker={t('適合誰')} title={t('從國小生字到大學原文書')} lead={t('只要是印在紙上的題目，都能變成自己的題庫。')} />
      <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map(({ Icon, title, text, papers }, i) => (
          <li key={i} className="m-reveal m-fan-host flex flex-col rounded-2xl bg-surface p-4 shadow-sheet" style={{ '--i': i % 3 } as CSSProperties}>
            <PaperStack papers={papers} />
            <h3 className="mt-5 flex items-center gap-2 px-1 text-lg font-bold">
              <Icon size={18} className="shrink-0 text-muted" aria-hidden />
              {title}
            </h3>
            <p className="mt-1 px-1 pb-1 text-sm leading-relaxed text-muted">{text}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Each paper turns a little the other way from the one under it, so every title stays readable. */
const TILT = [2, 0.5, -1.5]

/**
 * Three of the group's papers dropped on the desk in a cascade, each title showing; the front one already
 * has a question boxed. They slide out of one pile as the card comes into view and fan out a little
 * more while it is pointed at (.m-fan, motion.css).
 */
function PaperStack({ papers }: { papers: string[] }) {
  return (
    <Frame className="h-[128px]">
      <div className="m-fan absolute left-1/2 top-1/2 h-[112px] w-[224px] -translate-x-1/2 -translate-y-1/2">
        {papers.map((name, k) => (
          <div
            key={k}
            className="m-play absolute h-[76px] w-[168px] rounded-[5px] bg-surface px-2.5 pt-1 shadow-sheet ring-1 ring-line/60"
            style={{ left: k * 28, top: k * 18, '--k': k, '--tilt': `${TILT[k]}deg` } as CSSProperties}
          >
            <p className="truncate text-[10.5px] font-semibold leading-4">{name}</p>
            <span className="mt-1.5 block h-1 w-4/5 rounded-full bg-ink/10" />
            <span className={`-mx-1 mt-1.5 block space-y-1 rounded-[3px] p-1 ${k === papers.length - 1 ? 'ring-[1.5px] ring-accent/70' : ''}`}>
              <span className="block h-1 w-[90%] rounded-full bg-ink/10" />
              <span className="block h-1 w-3/5 rounded-full bg-ink/10" />
            </span>
          </div>
        ))}
      </div>
    </Frame>
  )
}
