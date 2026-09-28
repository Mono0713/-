# 模組規格：Sheetloop UI Motion

這份文件說明動畫程式怎麼拆、每一塊負責什麼、彼此之間只能透過什麼溝通。改動畫前先看這裡，就知道要動哪個檔案、會不會影響別的段落。

## 1. 設計原則

1. **畫面是時間的純函式。** 任何時刻的畫面只由 `seek(t)` 決定。不准用 CSS transition、CSS animation、`setTimeout`、`requestAnimationFrame` 累積狀態，也不准讓第 t 秒的畫面依賴「上一幀做了什麼」。這條規則讓渲染器能以任意順序、任意精度（subframe）取樣。
2. **元件彼此獨立。** 元件之間不 import 對方，也不讀寫對方的 DOM。需要共用的東西（時間點、座標、圖形）放在 `src/shared/`。
3. **原始碼模組化，產物是單一 HTML。** 開發時是很多小檔案；`build.mjs` 把 JS、CSS、HTML 片段和字型全部內嵌成 `dist/index.html` 一個檔案，渲染器只吃這個檔案。
4. **渲染器與動畫無關。** 渲染器只認得 `window.seek`、`window.DURATION`、`window.ready` 三個介面，換一支動畫也能直接用。

## 2. 目錄

```
motion/
├─ SPEC.md                 本文件
├─ README.md               使用方式
├─ build.mjs               src/ → dist/index.html（單檔）
├─ render.mjs              渲染 CLI：建置 → 截圖 → FFmpeg
├─ render/
│  ├─ plan.mjs             純函式：subframe 時間、工作切段、FFmpeg 模糊濾鏡
│  ├─ capture.mjs          Playwright：開頁面、seek(t)、截圖
│  └─ encode.mjs           FFmpeg：分段寫入（含 motion blur）、最終編碼
├─ src/
│  ├─ shell.html           頁面骨架：#stage、#app 容器、預覽播放列
│  ├─ main.js              組裝：掛載元件、定義 seek(t)
│  ├─ core/                與內容無關的工具
│  │  ├─ math.js           clamp / lerp / prog / bezier / 緩動 E / spring / ease / pulse / mixRgb
│  │  ├─ dom.js            $ / qs / put / show / svg / letters
│  │  ├─ player.js         對外介面 + 瀏覽器預覽播放器
│  │  └─ player.css
│  ├─ theme/               全域樣式
│  │  ├─ tokens.css        色票、字型堆疊、@font-face
│  │  ├─ base.css          reset、#stage、.abs
│  │  ├─ brand.css         Logo 外框、字標、標語
│  │  └─ ui.css            共用小元件：pill、chip、badge、題目選項
│  ├─ shared/              元件之間唯一的共用管道
│  │  ├─ brand.js          產品名稱、在地名稱、標語、Logo SVG（品牌只寫在這裡）
│  │  ├─ timeline.js       總時間軸：DURATION、SCENES、CUE、共用運動曲線
│  │  ├─ layout.js         共用座標：視窗、考卷相機、題目框、填空框、落點
│  │  └─ exam-art.js       考卷手寫字形與細胞示意圖的繪製
│  ├─ components/<名稱>/   一個元件一個資料夾（見第 4 節）
│  └─ fonts/               Inter、JetBrains Mono（OFL 授權）
├─ test/                   node:test 測試
└─ dist/index.html         建置產物（勿手改）
```

## 3. 介面

### 3.1 元件介面

每個元件資料夾有三個檔案：

| 檔案 | 內容 |
| --- | --- |
| `view.html` | 靜態標記。只放結構與排版，不放會動的值。 |
| `style.css` | 這個元件自己的樣式，選擇器以元件的 id 或專屬 class 開頭。 |
| `index.js` | 預設匯出一個元件物件。 |

```js
export default {
  id: 'mobile',          // 唯一名稱
  layer: 'stage',        // 掛在哪一層：'stage'（整個畫面）或 'app'（會隨 App 一起退場的群組）
  view,                  // view.html 的字串；沒有畫面可為 ''
  mount() {},            // 選用。建置一次性的動態 DOM、快取元素參照。不可依時間做任何事。
  seek(t) {},            // 必要。把自己負責的元素全部設成第 t 秒的樣子。
};
```

`seek(t)` 的規則：

- 必須是**冪等**的：同一個 t 呼叫幾次、之前呼叫過什麼 t，結果都一樣。
- 只能寫入自己 `view.html` 或 `mount()` 建出的元素。
- 所有變化都從 `t` 算出：`ease(t, t0, t1, 曲線)`、`spring(t - t0, 頻率, 阻尼)`、`prog`、`pulse`。
- 用 `put(el, {x, y, s, sx, sy, r, o})` 設 transform 與透明度；透明度為 0 時自動隱藏，減少渲染成本。

### 3.2 組裝（`main.js`）

- `COMPONENTS` 陣列的順序就是繪製順序（後面的疊在上面）。
- 掛載流程：依序插入每個元件的 `view` → 把 `#app` 移到 intro 與 mobile 之間 → 依序呼叫 `mount()`。
- `seek(t)` = 把 t 限制在 `[0, DURATION]`，然後依序呼叫每個元件的 `seek(t)`。

新增元件：建資料夾與三個檔案 → 在 `main.js` import 並放進 `COMPONENTS` 適當位置。刪除元件：從陣列拿掉即可，其他元件不受影響。

### 3.3 對外介面（`core/player.js`）

| 名稱 | 說明 |
| --- | --- |
| `window.seek(t)` | 設定第 t 秒的畫面 |
| `window.DURATION` | 總長度（秒） |
| `window.ready` | 字型載入完成後 resolve 的 Promise |
| `?render` | 渲染模式：隱藏播放列、不自動播放、不縮放 |
| `?t=12` | 預覽時從第 12 秒開始 |

### 3.4 渲染器介面

| 模組 | 函式 | 說明 |
| --- | --- | --- |
| `plan.mjs` | `subframeTimes(f, {fps, sub, shutter})` | 第 f 幀的 subframe 時間，以幀時間為中心、分布在快門區間 |
| | `chunks(first, last, n)` | 把幀範圍切成 n 段連續工作 |
| | `blurFilter({fps, sub})` | `tmix` 平均每 sub 張 + `select` 每組留一張 |
| `capture.mjs` | `launch()` | 啟動 Chromium（固定色彩設定、關閉 LCD 次像素） |
| | `openPage(browser, html, {scale})` | 回傳 `shot(t)`：seek 後截 PNG |
| `encode.mjs` | `segmentWriter(file, {fps, sub})` | 每個 worker 一段，無損 RGB 中介檔 |
| | `encodeFinal(segments, out, {fps, crf})` | 串接並輸出 H.264 / yuv420p / BT.709 MP4 |

## 4. 元件一覽

| 元件 | 層 | 負責 | 時間 |
| --- | --- | --- | --- |
| `background` | stage | 暖色底、兩團緩慢漂移的光、點陣網格 | 全程 |
| `intro` | stage | 字標逐字升起、標語 | 0 – 2.8 |
| `app-layer` | stage | App 群組整體退場（縮小、左移、淡出） | 13.45 – 14.25 |
| `app-window` | app | 視窗進場、標頭、上傳頁（拖放區、模型選擇、開始辨識按鈕） | 2.3 – 6.4 |
| `exam-paper` | app | 三張考卷飛入；中間那張變成原卷、掃描光束、題目框、鏡頭推近、手寫清除、藍色空格框 | 3.2 – 13.8 |
| `results` | app | 辨識結果標題、四張題目卡從題目框飛出 | 6.5 – 10.5 |
| `figure-panel` | app | 圖片填空面板、開關、答案晶片從筆跡飛進列表 | 10.5 – 13.95 |
| `cursor` | app | 游標路徑、點擊縮放、點擊漣漪 | 3.75 – 5.9 |
| `mobile` | stage | 左側標語、手機、點選、答對提示、解析、成績環 | 13.5 – 18.1 |
| `outro` | stage | 字標、四步驟、結尾淡出（可循環） | 17.9 – 20 |
| `logo` | stage | Sheetloop 標誌：彈入時循環箭頭轉緊 → 飛進視窗標頭時轉一圈（交給 `app-window` 的 slot）→ 收尾再彈回 | 0 – 3.2、17.75 – 20 |

## 5. 共用資料（`src/shared/`）

### 5.1 `timeline.js`

- `DURATION`：總長 20 秒。
- `SCENES`：六個段落的時間窗（轉場時會重疊），給人看與測試用。
- `CUE`：**兩個以上元件都要對齊的時間點**。例如 `logoFly`（logo 飛行，`logo` 與 `app-window` 的 slot 交接都看它）、`beam`（掃描光束，`exam-paper` 與 `results` 都看它）、`sweep`（清除手寫，`exam-paper` 與 `figure-panel` 都看它）、`outroFade`（收尾淡出，`logo` 與 `outro`）。
- 共用曲線：`winMotion(t)`、`beamY(t)`、`sweepX(t)`、`outroFade(t)`、`outroLogo(t)`。

規則：只有一個元件用到的時間點寫在該元件裡；一旦第二個元件需要對齊它，就搬到 `CUE`。

### 5.2 `layout.js`

- 舞台 1920×1080；App 視窗 `WIN`；考卷原生尺寸 566×800。
- 考卷相機 `PAGE`（校對位置）、`ZOOM`（圖片特寫），用 `pageToStage(cam, x, y)` 把考卷座標換成舞台座標。
- 題目框 `QB`、結果卡 `CARD`、填空框 `BOXES`、筆色 `INK`、手寫位置 `HW_ORIGIN / HW_CENTER`、面板落點 `PANEL_ROW(i)`。
- 推導時間：`boxT[i]`（光束掃過第 i 題）、`sweepHit(i)`（橡皮擦掃過第 i 格）。改 `CUE.beam` 或 `CUE.sweep`，題目框、卡片、晶片會自動跟著移動。

### 5.3 `brand.js`

`BRAND`（`name`、`local`、`tagline`）、`markSvg()` 產生 Logo SVG（每次呼叫的 gradient / mask id 都不同，可在同一頁放多個）、`spinLoop(g, 角度)` 轉動 Logo 裡的循環箭頭。內容與網站 `apps/web/src/shared/brand/` 一致；改名或換 Logo 時兩邊一起改。

### 5.4 `exam-art.js`

手寫字形 `HW`、`glyph()`、細胞示意圖 `drawFigure(parent, clean)`。原卷與結果卡縮圖共用同一份繪圖。

## 6. 常見修改

| 想做的事 | 改哪裡 |
| --- | --- |
| 換配色、字型 | `theme/tokens.css` |
| 改產品名稱、標語、Logo | `shared/brand.js` |
| 整體節奏變快或變慢 | `shared/timeline.js` 的 `CUE`，以及各元件內的局部時間 |
| 換考卷內容 | `exam-paper/view.html`（文字）、`shared/exam-art.js`（圖與筆跡）、`shared/layout.js`（框的位置） |
| 換手機題目 | `mobile/view.html` |
| 加一個新段落 | 新元件資料夾 + `main.js` 登記 + 必要時在 `timeline.js` 加 `CUE`、把 `DURATION` 拉長 |
| 輸出 4K、不同快門 | `node render.mjs --scale 2 --shutter 0.75`，不用改動畫 |

## 7. 測試

`npm test` 執行：

- `math.test.mjs`：緩動端點與單調性、彈簧起點 / 過衝 / 收斂。
- `plan.test.mjs`：subframe 以幀為中心、切段完整不重疊、FFmpeg 濾鏡字串。
- `timeline.test.mjs`：所有段落與 CUE 在總長內、光束與橡皮擦的推導時間順序正確。
- `render.test.mjs`（需要 Chromium）：產物是單一檔案（沒有外部 script / stylesheet / url），以及**決定性**：同一個 t 先後造訪、中間跳去別的時間，截圖逐位元相同。
