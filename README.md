# 考卷數位化題庫

把紙本掃描檔、PDF 和手機照片的考卷，轉成可編輯的個人題庫，並提供線上測驗。

目前是**第一階段：辨識原型**。可以把考卷交給 Claude、ChatGPT 或 Gemini 辨識，輸出結構化題目（題型、題幹、選項、答案、公式、附圖位置），用來比較各家模型的準確度。題庫網站和線上測驗在後續階段。

## 快速開始

需要 Node.js 22 以上和 pnpm。

```bash
pnpm install
cp .env.example .env   # 填入要用的模型 API 金鑰
pnpm extract 考卷.pdf                      # 預設用 Claude
pnpm extract 考卷.pdf -p claude,openai,gemini  # 三家都跑，方便比較
pnpm extract 照片.jpg -p gemini -m gemini-2.5-flash
pnpm extract 考卷.pdf --pages-only        # 只轉圖，不呼叫模型
```

每份檔案會在 `out/<檔名>/` 產生：

| 檔案 | 內容 |
|---|---|
| `pages/page-N.png` | 送給模型的頁面圖 |
| `<provider>.md` | 給人看的辨識結果，信心不足的題目會標 ⚠️ 或 ❗ |
| `<provider>.json` | 合併跨頁後的題目資料，之後匯入題庫用 |
| `<provider>.raw.json` | 每頁的原始回覆、錯誤與 token 用量 |

有頁面失敗時（例如免費額度用完），用 `--pages 3-5` 只重跑那幾頁，其他頁的結果會保留。遇到 429 或伺服器忙碌會依模型建議的秒數自動等待重試；免費方案建議加 `--concurrency 1`。

## 不用 API 金鑰：手動模式

用 Claude、Gemini 或 ChatGPT 的網頁版／App 訂閱來辨識，不需要 API 額度：

1. `pnpm extract 考卷.pdf -p manual`，程式會在 `out/<檔名>/manual/` 產生每頁的 `page-N.prompt.md`。
2. 在聊天 App 開新對話，附上 `out/<檔名>/pages/page-N.png`，把 `page-N.prompt.md` 的全部內容貼上送出。
3. 把回覆的 JSON 存成 `out/<檔名>/manual/page-N.reply.json`（有沒有 ```json 框線都可以）。
4. 再跑一次同樣的指令，程式會驗證回覆格式並產生 `manual.md` 和 `manual.json`。

**多頁一次送**：等待中的頁面超過一頁時，還會產生 `batch.prompt.md`。把所有 `page-N.png` 依照終端機列出的順序一起附上，貼上 `batch.prompt.md`，回覆存成 `manual/batch.reply.json` 即可。頁數多時聊天 App 可能輸出不完整，建議一次 5 頁以內。

可以用 `-m claude-web` 之類的名稱標記是哪個 App 回覆的，方便之後比較。

## 架構

pnpm monorepo，每個模組是獨立套件，彼此只透過 `@exam/core` 的資料格式溝通。

```
packages/
  core/        題目資料格式（zod schema）與共用型別，沒有其他依賴
  ingest/      PDF 轉圖並抽出文字層；照片轉正、縮放、提高對比
  extraction/  共用提示詞與驗證、跨頁合併；providers/ 下是各家模型轉接器
apps/
  cli/         命令列辨識工具
```

- **換模型**：`packages/extraction/src/providers/` 每家一個檔案，只負責翻譯 API 格式。提示詞和輸出格式三家共用，回覆一律經過同一個 schema 驗證，格式不對會自動重試一次。新增模型用 `registerProvider()`。
- **內容格式**：題幹和選項是 Markdown，數學用 LaTeX（`$...$`），化學式用 mhchem（`$\ce{H2O}$`），表格用 Markdown 表格，圖形記錄邊界框供之後裁圖。
- **手寫答案**：答案會標明來源是印刷還是手寫；手寫且被批改為錯的答案不會當成正解，並列入待檢查。

## 開發

```bash
pnpm typecheck
pnpm test
```

預設模型：Claude `claude-opus-5`、OpenAI `gpt-5`、Gemini `gemini-3.1-pro-preview`。各家常會下架舊模型，可以在 `.env` 設 `CLAUDE_MODEL`、`OPENAI_MODEL`、`GEMINI_MODEL` 換掉預設，或單次用 `-m` 指定。
