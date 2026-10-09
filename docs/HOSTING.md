# 上線設定：Supabase、Google 登入、Cloudflare R2

不設定任何東西時，Sheetloop 跟以前一樣是單人本機版：資料在 `data/`（SQLite），不用登入。
下面三塊可以各自打開，互不影響：

| 要打開的 | 設定的變數 | 打開後 |
| --- | --- | --- |
| 雲端資料庫 | `DATABASE_URL`、`SETTINGS_SECRET` | 題庫、測驗、設定、批改快取改存 Supabase 的 Postgres |
| Google 登入 | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`（上線時加 `SITE_URL`） | 每個人用 Google 帳號登入，只看得到自己的資料 |
| 雲端檔案 | `R2_ENDPOINT`、`R2_BUCKET`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` | 上傳檔、頁面圖、裁切圖改存 Cloudflare R2 |
| 儲存上限 | `STORAGE_QUOTA_MB`（預設 1024） | 登入版每個帳號能用的空間 |

全部寫在專案根目錄的 `.env`（範本見 `.env.example`）。

## 1. Supabase 專案

1. 到 https://supabase.com 建立專案（免費方案可以先測，但一週沒人用會暫停）。
2. **資料庫**：Project Settings → Database → Connection string，選 URI，把 `[YOUR-PASSWORD]` 換成建立專案時設的密碼，填進 `DATABASE_URL`。
   - 長時間跑的伺服器用「Session pooler」或直接連線的網址；Vercel 這類無伺服器平台用「Transaction pooler」（port 6543）。程式已關閉 prepared statements，兩種都能用。
3. **建立資料表**：`pnpm db:migrate`。會套用 `supabase/migrations/` 裡還沒套用過的檔案，重跑也安全。也可以用 Supabase CLI 的 `supabase db push`。
4. **`SETTINGS_SECRET`**：隨便一串 32 個字以上的亂碼（例如 `node -p "require('crypto').randomBytes(32).toString('hex')"`）。本機和 Render 共用同一個資料庫時，兩邊要填同一串。用戶存的 API 金鑰會用它加密後才寫進資料庫。**之後不能改**，改了已存的金鑰就讀不出來，要請大家重新貼。

資料表都開了 Row Level Security 且沒有任何規則，所以瀏覽器拿到的公開 anon key 無法直接讀寫資料；只有網站伺服器（用 `DATABASE_URL` 連線）能存取，並由伺服器檢查每筆資料的擁有者。

## 2. Google 登入

1. **Google Cloud Console** → APIs & Services → Credentials → Create credentials → OAuth client ID：
   - Application type：Web application
   - Authorized redirect URIs：`https://<你的專案>.supabase.co/auth/v1/callback`（Supabase 的 Google 設定頁會顯示這個網址）
   - 第一次要先設定 OAuth consent screen（應用程式名稱填 Sheetloop）。
2. **Supabase** → Authentication → Sign In / Providers → Google：打開，貼上 Client ID 和 Client Secret。
3. **Supabase** → Authentication → URL Configuration：
   - Site URL：上線網址（本機測試用 `http://localhost:3000`）
   - Redirect URLs：加上 `http://localhost:3000/auth/callback` 和 `https://<上線網址>/auth/callback`
4. `.env` 填 `NEXT_PUBLIC_SUPABASE_URL`（Project Settings → API → Project URL）和 `NEXT_PUBLIC_SUPABASE_ANON_KEY`（同一頁的 anon / publishable key）。上線時再填 `SITE_URL`（例如 `https://sheetloop.app`），登入完成後才會回到正確的網址。

打開登入後：
- 沒登入的人一律被帶到 `/login`。
- 每個人只看得到自己的匯入、題庫、測驗和設定；圖片網址也會檢查擁有者。
- 伺服器 `.env` 裡的 `ANTHROPIC_API_KEY` 等金鑰**不會**拿來替用戶付費，每個人在設定頁貼自己的金鑰。

## 3. Cloudflare R2

1. Cloudflare 後台 → R2 → Create bucket（例如 `sheetloop-files`），不用開公開存取。
2. R2 → Manage R2 API Tokens → Create API token，權限選 Object Read & Write，限定這個 bucket。
3. `.env` 填：
   - `R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com`
   - `R2_BUCKET=sheetloop-files`
   - `R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY`：建立 token 時顯示的那組

瀏覽器看圖時，網站先確認是本人，再轉到 R2 的 5 分鐘有效簽名網址，所以圖片流量不經過網站伺服器。

## 部署

辨識和 AI 批改在網站伺服器的背景執行，所以要用**一直開著的 Node 伺服器**（Render、Railway、Fly.io、自己的主機等），`pnpm build` 後 `pnpm --filter @exam/web start`。Vercel 這類無伺服器平台會在回應後停掉背景工作，之後要改成工作佇列才適合。

### 用 Render 上線（建議）

專案根目錄的 `render.yaml` 已經寫好：Node 22、新加坡機房（離台灣近）、每次部署時自動跑 `pnpm db:migrate`，先用免費方案。

1. 先完成上面 1 到 3（Supabase、Google、R2），手邊備好那些值。
2. https://render.com 用 GitHub 登入 → New → Blueprint → 選這個 repo 和要上線的分支。
3. Render 會列出要填的變數，照 `.env` 的值貼上。`SITE_URL` 先填 Render 給的網址（`https://sheetloop-xxxx.onrender.com`），之後換自己的網域再改。
4. `DATABASE_URL` 要用 Supabase 的 **Session pooler** 連線字串（Connect → Session pooler，網址含 `pooler.supabase.com`）。Render 連不到只有 IPv6 的直連網址。
5. 免費方案閒置 15 分鐘會休眠，下一個人打開要等約一分鐘；記憶體 512 MB，已用 `--max-old-space-size`、`VIPS_CONCURRENCY`、`MALLOC_ARENA_MAX` 壓低用量。休眠或重啟時正在跑的匯入會標成「伺服器重新啟動而中斷」，重新匯入即可。正式上線把 `render.yaml` 的 `plan: free` 改成 `plan: starter`（每月約 7 美元），資料不受影響。
6. 部署好後，回 Supabase → Authentication → URL Configuration，把 `https://<Render 網址>/auth/callback` 加進 Redirect URLs，Site URL 也改成這個網址。

### 發布 Google 登入

Google Cloud 的登入畫面在「測試」狀態時，只有「測試使用者」名單裡的人能登入（最多 100 人）。網站上線後：Google Auth Platform → 品牌，首頁填網站網址、隱私權政策填 `https://<網址>/privacy`、服務條款填 `https://<網址>/terms`（網站內建，不用登入就能看；`SUPPORT_EMAIL` 會顯示成聯絡信箱），再到「目標對象」按發布應用程式。只要求名稱和信箱，不需要 Google 審核。

### 上線後檢查

- 用 Google 登入，再用另一個 Google 帳號登入，確認彼此看不到對方的考卷。
- 設定頁貼 API 金鑰，匯入一份考卷，確認頁面圖顯示得出來（圖來自 R2）。
- 設定頁的「儲存空間」顯示用量；上限由 `STORAGE_QUOTA_MB` 決定（預設 1024，也就是 1 GB）。
- 分享連結用沒登入的瀏覽器打開，會先被帶去登入，登入後才能作答或存進題庫。

## 本機資料

本機版的 `data/` 不會自動搬到雲端。打開登入前在本機匯入的考卷，登入後看不到（它們屬於本機使用者 `local`）。

## 帳號刪除與上線前檢查

使用者可以在設定頁「帳號與資料」下載自己的全部資料、刪除帳號。要連 Google 登入帳號本身一起刪掉，Render 要多設 `SUPABASE_SERVICE_ROLE_KEY`（Supabase → Project Settings → API keys → service_role，只放在伺服器，絕不放進 `NEXT_PUBLIC_` 開頭的變數）；沒設時資料照樣刪除，只是登入帳號留著，再登入會是空帳號。

正式開放前要做的事列在 [LAUNCH.md](LAUNCH.md)。
