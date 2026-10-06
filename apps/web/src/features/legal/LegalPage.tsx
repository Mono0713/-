import Link from 'next/link'
import { Fragment, type ReactNode } from 'react'
import { BRAND } from '@/shared/brand/brand'
import { LogoMark } from '@/shared/brand/LogoMark'
import { getLocale, getT } from '@/shared/i18n/server'
import { LEGAL_UPDATED, legalDoc, type LegalKind } from './docs'

/** /privacy and /terms: open to everyone, without the app's navigation. */
export async function LegalPage({ kind }: { kind: LegalKind }) {
  const t = await getT()
  const { doc, lang, translated } = legalDoc(kind, await getLocale())
  const email = process.env.SUPPORT_EMAIL
  const operator = process.env.LEGAL_OPERATOR || doc.operator.replaceAll('{brand}', BRAND.name)
  const fill = (text: string): ReactNode => {
    const plain = text.replaceAll('{brand}', BRAND.name).replaceAll('{operator}', operator)
    return plain.split('{email}').map((part, i) => (
      <Fragment key={i}>
        {i > 0 &&
          (email ? (
            <a className="text-accent hover:underline" href={`mailto:${email}`}>
              {email}
            </a>
          ) : (
            t('網站管理者')
          ))}
        {part}
      </Fragment>
    ))
  }
  const other = kind === 'privacy' ? { href: '/terms', label: t('服務條款') } : { href: '/privacy', label: t('隱私權政策') }
  return (
    // .auth-screen hides the app's navigation (see globals.css).
    <div className="auth-screen mx-auto max-w-2xl py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 text-accent">
        <LogoMark size={28} />
        <span className="font-display text-lg font-extrabold lowercase tracking-[-0.03em]">{BRAND.name}</span>
      </Link>
      <article lang={lang} className="space-y-6 rounded-2xl bg-surface p-6 text-sm leading-relaxed shadow-sheet sm:p-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-bold">{doc.title}</h1>
          <p className="text-xs text-muted">{t('最後更新：{date}', { date: LEGAL_UPDATED })}</p>
          {!translated && <p className="rounded-lg bg-ink/[0.04] px-3 py-2 text-xs text-muted">{t('這份文件只有繁體中文和英文版本，兩者不同時以繁體中文為準。')}</p>}
          <p className="pt-1">{fill(doc.intro)}</p>
        </header>
        {doc.sections.map((s) => (
          <section key={s.title} className="space-y-2">
            <h2 className="font-semibold">{s.title}</h2>
            {s.body.map((b, i) =>
              typeof b === 'string' ? (
                <p key={i}>{fill(b)}</p>
              ) : (
                <ul key={i} className="list-disc space-y-1 pl-5">
                  {b.map((li, j) => (
                    <li key={j}>{fill(li)}</li>
                  ))}
                </ul>
              ),
            )}
          </section>
        ))}
      </article>
      <p className="mt-6 text-center text-xs text-muted">
        <Link href={other.href} className="text-accent hover:underline">
          {other.label}
        </Link>
      </p>
    </div>
  )
}
