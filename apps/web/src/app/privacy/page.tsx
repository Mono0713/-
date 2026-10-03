import Link from 'next/link'
import { BRAND } from '@/shared/brand/brand'
import { LogoMark } from '@/shared/brand/LogoMark'

export const metadata = { title: '隱私權政策' }

const UPDATED = '2026-10-03'

/** The privacy policy Google asks for before sign-in can be published; open to everyone. */
export default function PrivacyPage() {
  const contact = process.env.SUPPORT_EMAIL
  return (
    // .auth-screen hides the app's navigation (see globals.css).
    <div className="auth-screen mx-auto max-w-2xl py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 text-accent">
        <LogoMark size={28} />
        <span className="font-display text-lg font-extrabold lowercase tracking-[-0.03em]">{BRAND.name}</span>
      </Link>
      <article className="space-y-5 rounded-2xl bg-surface p-6 text-sm leading-relaxed shadow-sheet sm:p-8">
        <header>
          <h1 className="text-2xl font-bold">隱私權政策</h1>
          <p className="mt-1 text-xs text-muted">最後更新：{UPDATED}</p>
        </header>
        <Section title="我們收集的資料">
          <ul className="list-disc space-y-1 pl-5">
            <li>用 Google 登入時取得的名稱、電子郵件和大頭貼，只用來辨識你的帳號。</li>
            <li>你上傳的考卷、照片和 PDF，以及由此產生的題目、作答紀錄和批改結果。</li>
            <li>你貼上的 AI 服務 API 金鑰，加密後才存進資料庫。</li>
            <li>加入班級時的成員關係，以及每次呼叫 AI 的用量紀錄（模型和字數，不含內容），用來顯示花費。</li>
          </ul>
        </Section>
        <Section title="資料怎麼使用">
          <p>
            資料只用來提供 {BRAND.name} 的功能。辨識、批改和 AI 家教時，相關的頁面圖片、題目和作答會用你自己的金鑰送到你選的 AI 服務（例如 Anthropic、OpenAI、Google），並受該服務的條款約束。我們不販售資料，也不拿來投放廣告。
          </p>
        </Section>
        <Section title="誰看得到">
          <p>
            預設只有你自己。你分享連結時，拿到連結並登入的人可以看到那份考卷；在班級裡，老師看得到學生交的作業和成績。
          </p>
        </Section>
        <Section title="存放與保留">
          <p>
            資料存放在 Supabase（資料庫與登入）和 Cloudflare R2（檔案）。上傳的原始檔在考卷存進題庫 30 天後刪除，除非你選擇保留；壓縮過的頁面圖會跟著考卷保留。
          </p>
        </Section>
        <Section title="刪除資料">
          <p>
            你可以隨時在網站上刪除考卷、題目和測驗。想刪除整個帳號和所有資料，請{contact ? (
              <>
                寫信到 <a className="text-accent hover:underline" href={`mailto:${contact}`}>{contact}</a>
              </>
            ) : (
              '聯絡網站管理者'
            )}
            ，我們會在 30 天內處理。
          </p>
        </Section>
      </article>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h2 className="font-semibold">{title}</h2>
      {children}
    </section>
  )
}
