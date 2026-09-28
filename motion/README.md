# Sheetloop · UI Motion

20 秒產品展示動畫：開場 → 匯入考卷與選模型 → AI 掃描辨識 → 圖片填空清除手寫 → 手機練習與成績 → 收尾。

## 原理

- **只有一個 HTML**（`dist/index.html`，字型、樣式、程式全部內嵌）。畫面上每個屬性都由 `seek(t)` 用數學算出來：
  easing 是 cubic-bezier，彈性是解析解的阻尼彈簧，沒有 CSS transition / animation，也沒有計時器。
  同一個 `t` 永遠得到同一張畫面。
- **原始碼模組化**（`src/`）：每個畫面元件一個資料夾（`view.html` + `style.css` + `index.js`），
  各自實作 `seek(t)`，彼此不互相引用，只透過 `src/shared/` 的時間軸與座標對齊。
  `build.mjs` 把它們打包成上面那一個 HTML。模組規格見 [SPEC.md](SPEC.md)。
- **Playwright 逐幀渲染**（`render.mjs`）：每一幀取 4 個 subframe，時間平均分布在快門開啟的區間
  （預設 0.5 幀，也就是 180° 快門），每個 subframe 都是 `seek(t)` 後截圖。
- **FFmpeg 合成 motion blur**：subframe 以 240fps 串流進 FFmpeg，`tmix` 平均每 4 張，
  `select` 每組留一張，輸出 60fps。多個 worker 各自渲染一段，最後接起來編碼成 H.264。

## 使用

```bash
cd motion
npm install
npx playwright install chromium   # 第一次才需要
# 需要系統有 ffmpeg；中文字型用系統的 Noto Sans CJK TC / 微軟正黑體 / 蘋方

npm run build                      # src/ → dist/index.html
open dist/index.html               # 瀏覽器預覽，下方可拖時間軸、空白鍵暫停
npm test                           # 單元測試 + 決定性測試
node render.mjs --draft            # （每次渲染都會先自動 build）快速草稿：30fps、半尺寸、不做模糊
node render.mjs                    # 正式：1920×1080、60fps、4 subframes → out/motion.mp4
node render.mjs --scale 2          # 4K
node render.mjs --stills 3.5,9.5   # 輸出指定秒數的靜態 PNG
```

其他參數：`--sub` subframe 數、`--shutter` 快門比例、`--workers` 平行數、`--from/--to` 只渲染一段、`--crf` 畫質。
瀏覽器預覽可加 `?t=12` 從指定秒數開始。

## 時間軸

| 秒 | 段落 |
| --- | --- |
| 0 – 2.4 | Logo 彈入、字標逐字升起 |
| 2.3 – 6 | Logo 飛進視窗標頭；三份考卷拋物線落入上傳區；游標把模型從 Gemini 切到 Claude，按下開始辨識 |
| 6 – 10 | 考卷放大成原卷，掃描光束逐題框出題型，題目卡片從框中飛出排成辨識結果 |
| 10 – 13.6 | 鏡頭推進圖片填空；四種筆色的手寫答案被掃除，變成答案卷 |
| 13.6 – 17.6 | 手機從下方彈入：作答、答對提示、解析與翻譯展開、成績環 |
| 17.6 – 20 | 收尾：上傳 · 辨識 · 校對 · 測驗；最後淡回背景，可以無縫循環 |
