# 考卷數位化題庫

把紙本掃描檔、PDF 和手機照片的考卷，轉成可編輯的個人題庫，並提供線上測驗。

目前有兩種用法：

- **網頁版**（`pnpm dev`）：上傳考卷、辨識、左右對照校對、存進題庫、編輯題目、線上測驗，全部在瀏覽器完成。
- **命令列**（`pnpm extract`）：批次辨識、比較各家模型的準確度。

## 網頁版

需要 Node.js 22.13 以上和 pnpm。

```bash
pnpm install
cp .env.example .env   # 用 API 時填入金鑰；只用手動模式可以不填
pnpm dev
```

打開 http://localhost:3000 。

1. **匯入考卷**：拖曳 PDF 或照片（多張照片會合成同一份考卷），選辨識方式。沒有 API 金鑰就選「手動」。
2. **手動模式**：頁面上按「複製提示詞」、下載頁面圖片，一起貼到 Claude／Gemini／ChatGPT，再把回覆貼回來。多頁可以一次送。
3. **校對**：左邊是原始頁面，點題目會框出它在頁面上的位置；右邊可以改題號、題型、題幹（可切換預覽公式）、選項、答案、配分。上方工具列有題號導覽和「只看待確認」。修改會自動存成草稿。
4. **存入題庫**：題庫以考卷為單位，首頁列出每份考卷，可用關鍵字和科目篩選；點進考卷看全部題目、改考卷資訊或編輯單題。
5. **線上測驗**：選一份或多份考卷（也可以只挑幾題、隨機抽幾題），可打亂題目與選項順序。
   - **考試**：寫完再交卷計分，可設時間限制，時間到自動交卷。
   - **單題練習**：每寫完一題就顯示對錯、正確答案、詳解和翻譯。
   - 簡答、問答、計算題沒辦法自動批改，目前看完參考答案後按「答對／答錯」自評。評分格式已預留部分給分和評語，之後的 AI 老師評分會接在 `packages/quiz` 的 `AnswerGrader` 介面。
   - 每次測驗都會留下紀錄和成績，題庫之後修改題目不會影響舊紀錄。

資料存在專案根目錄的 `data/`（SQLite 資料庫加上頁面圖片和裁切的圖），不會進 git。要換位置可以設 `EXAM_DATA_DIR`。

模型寫的待檢查備註（⚠）會用介面語言，預設繁體中文；在 `.env` 設 `EXAM_LOCALE=en`（或 `ja`、`zh-Hans` 等）可以改，命令列用 `--lang`。之後有登入功能時改成每位使用者自己的設定。

## 命令列

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
| `figures/<provider>/*.png` | 裁切出來的圖，圖上空格裡的手寫已清除 |

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
  figures/     裁圖、把空格對齊印刷方框、清除空格裡的手寫
  bank/        題庫儲存介面（考卷 → 題目）；目前是本機 SQLite，上線時換成雲端資料庫只需另寫一個實作
  quiz/        線上測驗：出題、打亂順序、批改計分（logic.ts，前後端共用）與測驗紀錄儲存
  importer/    匯入流程：上傳 → 轉圖 → 辨識 → 裁圖 → 草稿，與介面無關
apps/
  cli/         命令列辨識工具
  web/         網頁版（Next.js）
    src/server/     唯一把各模組組裝起來的地方（資料庫、檔案位置、目前使用者）
    src/features/   imports（上傳與手動模式）、review（校對）、questions（題目顯示與編輯）、bank（題庫）、quiz（測驗）
    src/shared/     共用元件：公式渲染、附圖、按鈕等
```
- **換模型**：`packages/extraction/src/providers/` 每家一個檔案，只負責翻譯 API 格式。提示詞和輸出格式三家共用，回覆一律經過同一個 schema 驗證，格式不對會自動重試一次。新增模型用 `registerProvider()`。
- **內容格式**：題幹和選項是 Markdown，數學用 LaTeX（`$...$`），化學式用 mhchem（`$\ce{H2O}$`），表格用 Markdown 表格，圖形會裁成獨立圖片。
- **圖片填空**：模型回報圖上每個空格的編號和大概位置，程式再把它對齊到印刷的方框或底線，清除框內和周圍的紅筆、藍筆字跡，保留印刷的編號文字。答案依空格順序存放，空格位置以裁切後的圖為基準，線上測驗可以直接在圖上對應位置放輸入框。鉛筆和黑筆跟印刷字同色，無法逐筆分辨，所以模型也會回報每格的筆色和格內印刷字（例如 `7. ___ host`）：深色筆的格子會整格清空，再把印刷字打回原位（沒有印刷字時只印編號）。模型判斷錯時，可在網頁審閱畫面的「圖上空格的筆跡清理」逐格切換後重新清理。
- **手寫答案**：答案會標明來源是印刷還是手寫；手寫且被批改為錯的答案不會當成正解，並列入待檢查。

## 開發

```bash
pnpm typecheck
pnpm test
```

預設模型：Claude `claude-opus-5`、OpenAI `gpt-5`、Gemini `gemini-3.1-pro-preview`。各家常會下架舊模型，可以在 `.env` 設 `CLAUDE_MODEL`、`OPENAI_MODEL`、`GEMINI_MODEL` 換掉預設，或單次用 `-m` 指定。
