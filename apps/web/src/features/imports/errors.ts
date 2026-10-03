/** What went wrong, in plain words, and what to do next. */
export interface Explained {
  title: string
  detail: string
  /** Where the fix is: the API key in settings, or a different model in the form below. */
  fix: 'settings' | 'model' | 'retry'
}

/**
 * Turns a provider's raw error (often a JSON body with HTTP status, quota names and links) into
 * something a person can act on. The raw text stays available behind a toggle.
 */
export function explainError(raw: string): Explained {
  const text = raw.toLowerCase()
  const status = Number(/"code"\s*:\s*(\d{3})/.exec(raw)?.[1] ?? /\b(4\d\d|5\d\d)\b/.exec(raw)?.[1] ?? 0)

  if (status === 429 || /resource_exhausted|quota|rate.?limit|too many requests/.test(text)) {
    if (/limit:\s*0\b/.test(text) || /"limit"\s*:\s*0\b/.test(text))
      return {
        title: '這個模型不在免費額度裡',
        detail: '供應商給這個模型的免費上限是 0，所以免費的金鑰不能用它。可以到供應商的後台開啟付費，或在下面換一個免費額度能用的模型（例如 Flash）再試。',
        fix: 'model',
      }
    const wait = retryAfter(raw)
    return {
      title: '已經用完這段時間的額度',
      detail: `${wait ? `大約 ${wait}後額度會恢復。` : '等一下額度會恢復。'}也可以在下面換一個模型，或到供應商的後台提高額度。`,
      fix: 'model',
    }
  }
  if (status === 401 || status === 403 || /api[_ ]?key|unauthori[sz]ed|permission|invalid.*key|forbidden/.test(text))
    return { title: 'API 金鑰沒有通過', detail: '金鑰可能打錯、過期，或沒有這個模型的使用權限。到設定換一把金鑰再試。', fix: 'settings' }
  if (status === 404 || /not.?found|does not exist|unknown model|no longer available/.test(text)) {
    // Google names the replacement: "Please update your code to use models/gemini-3.8-flash"
    const instead = /(?:use|switch to|migrate to)\s+(?:models\/)?([a-z][\w.-]*\d[\w.-]*)/i.exec(raw)?.[1]?.replace(/[.,]$/, '')
    return {
      title: /no longer available|deprecated|retired/.test(text) ? '這個模型已經停止提供' : '找不到這個模型',
      detail: instead ? `供應商建議改用 ${instead}。在下面選它，再按重新辨識。` : '模型可能已經下架或改名了。在下面換一個模型再試。',
      fix: 'model',
    }
  }
  if (status === 413 || /too large|too long|context length|maximum.*tokens|payload/.test(text))
    return { title: '這份檔案對這個模型來說太大了', detail: '換一個能讀更長內容的模型，或把檔案拆成幾份再匯入。', fix: 'model' }
  if (status >= 500 || /overloaded|unavailable|internal error|timeout|timed out/.test(text))
    return { title: 'AI 服務暫時忙不過來', detail: '這是供應商那邊的問題，過一下再按重新辨識通常就好了。', fix: 'retry' }
  if (/fetch failed|econnrefused|enotfound|network|socket/.test(text))
    return { title: '連不到 AI 服務', detail: '檢查網路，或確認自訂服務的網址填對了。', fix: 'retry' }
  return { title: 'AI 沒有讀完這份考卷', detail: '可以換一個模型或改用手動模式再試一次。', fix: 'model' }
}

/** "7h22m53s" or "26573s" in the error, as 約 7 小時 23 分 / 30 秒. */
function retryAfter(raw: string): string | null {
  const hms = /retry in\s+(?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/i.exec(raw)
  const delay = /"retryDelay"\s*:\s*"(\d+)s"/.exec(raw)
  let seconds = 0
  if (hms && (hms[1] || hms[2] || hms[3])) seconds = Number(hms[1] ?? 0) * 3600 + Number(hms[2] ?? 0) * 60 + Number(hms[3] ?? 0)
  else if (delay) seconds = Number(delay[1])
  if (!seconds) return null
  if (seconds < 60) return `${Math.ceil(seconds)} 秒`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分鐘`
  const hours = Math.floor(minutes / 60)
  return minutes % 60 ? `${hours} 小時 ${minutes % 60} 分` : `${hours} 小時`
}
