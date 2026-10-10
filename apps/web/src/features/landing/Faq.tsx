import { IconChevronDown } from '@/shared/icons'
import { getT } from '@/shared/i18n/server'
import { Heading } from './Heading'
import { WRAP } from './wrap'

/** Questions people ask before signing up; each opens on its own (no script). */
export async function Faq() {
  const t = await getT()
  const items: [string, string][] = [
    [t('要付費嗎？'), t('網站本身免費，也沒有訂閱。AI 辨識和批改用的是你自己的 API 金鑰，費用由 AI 服務商直接收取，用多少付多少。')],
    [t('沒有 API 金鑰也能用嗎？'), t('可以。手動模式會給你提示詞和頁面圖片，貼到 ChatGPT、Claude 或 Gemini 的聊天 App，再把回覆貼回來就好。翻譯預設也不需要金鑰。')],
    [t('支援哪些檔案？'), t('手機照片、掃描檔和 PDF 都可以，包括 JPG、PNG、WebP 和 TIFF，一次可以上傳很多頁。')],
    [t('已經寫過的考卷也可以嗎？'), t('可以。上面寫的答案會先記下來讓你確認，圖上空格裡的筆跡可以擦乾淨，題目就能重新作答。')],
    [t('辨識錯了怎麼辦？'), t('沒把握的地方會標成「請確認」。你可以在原卷旁邊直接改字、拖動題目框，或只重新辨識某一頁。')],
    [t('我的資料安全嗎？'), t('題庫、測驗和 API 金鑰只屬於你的帳號。只有你建立分享連結時，拿到連結的人才看得到；你也可以隨時下載或刪除所有資料。')],
    [t('老師可以怎麼用？'), t('建立班級後把加入碼給學生，再把考卷派成作業。學生交卷後可以批閱、看成績分布和匯出成績；學生的 AI 批改也可以選擇由你的金鑰支付。')],
    [t('手機和平板能用嗎？'), t('可以。加到主畫面就像 App 一樣開啟，平板還能直接用筆手寫作答。')],
  ]
  return (
    <section id="faq" className="scroll-mt-16 border-t border-line/70 bg-surface/60 py-20 lg:py-28">
      <div className={`${WRAP} grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-16`}>
        <Heading n={4} kicker={t('常見問題')} title={t('開始之前，你可能想知道')} />
        <div className="m-reveal divide-y divide-line border-y border-line">
          {items.map(([q, a]) => (
            <details key={q} className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-[15px] font-semibold hover:text-accent [&::-webkit-details-marker]:hidden">
                {q}
                <IconChevronDown size={18} className="m-chevron shrink-0 text-muted" aria-hidden />
              </summary>
              <p className="m-answer pb-5 pr-8 text-sm leading-relaxed text-muted">{a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
