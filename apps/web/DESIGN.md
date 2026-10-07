# Sheetloop design base: 自修桌 (study desk)

The look comes from a student's desk: graph paper, a ballpoint pen, a highlighter and the
teacher's red pen. Everything below is set as tokens in `src/app/globals.css`; components use
the tokens only, never literal colors, so light and dark mode come from the tokens alone.

## Color

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `paper` | `#fcfcfa` | `#0f1528` | page background (with the `grid` lines) |
| `grid` | `#e9edf5` | `#172039` | 18 px graph-paper lines behind every page |
| `surface` | `#ffffff` | `#151d34` | cards, inputs, sheets |
| `ink` | `#1b2340` | `#e6eaf7` | text |
| `muted` | `#5f6782` | `#97a0bd` | secondary text |
| `line` | `#dfe4ee` | `#263155` | borders and dividers |
| `accent` | `#2f4bff` | `#7d93ff` | ballpoint blue: the one accent, primary buttons, focus, links |
| `accent-soft` | `#eef1ff` | `#1c2650` | selected and hovered backgrounds |
| `on-accent` | `#ffffff` | `#0f1528` | text and icons on `accent`, `bad` |
| `hl` | `#f4ff5c` | `#d7f04a` | highlighter as a solid color: "needs review" dots and badges |
| `hl-mark` | `#f4ff5c` | `#d7f04a` at 30% | highlighter stroke behind text (see-through in dark, so text never changes color) |
| `accent-deep` | `#1d33c9` | `#4c62d6` | the pressed-down edge of primary buttons |
| `pen` | `#d63a2f` | `#ff8b7e` | the teacher's red pen: AI comments |
| `night` | `#141b33` | `#0a0f1f` | the navy sidebar, toasts, floating controls |
| `night-accent` | `#8fa2ff` | `#8fa2ff` | accent on `night` |
| `good` / `warn` / `bad` (+ `-soft`) | | | right, check this, wrong |

Rules:

- One accent. Blue is for what you can press or what is selected; nothing else is blue.
- Never put `text-white` on `accent`: dark mode's accent is light. Use `text-on-accent`.
- No gradients on controls. The old blue-violet gradient is gone.

## Type

| Role | Face | Where |
| --- | --- | --- |
| Display | Bricolage Grotesque (`font-display`) | page titles, the wordmark, numbers (`.num`) |
| Body | Atkinson Hyperlegible Next, then the system Chinese face (`font-sans`) | everything else |
| Hand | LXGW WenKai TC (`font-hand`, `.pen`) | short AI/teacher comments only; on the product page's sample exams also the student's pencil, in muted grey |
| Code | JetBrains Mono (`font-mono`) | code in questions |

All fonts are served by the app itself (SIL Open Font License).

## Study-desk details

- `.hl` (and `.hl-md` for rendered Markdown) draws a highlighter stroke behind the text.
  Use it for the correct answer and for things the reader should look at, a few words at a time.
- `.pen` sets a short comment in the red-pen handwriting. Only for comments written "by the
  teacher" (AI grading feedback). Never for buttons, labels or running UI text.
- Graph paper only on the page background. Cards stay plain white (navy in dark mode).
  Too much grid or handwriting makes it look like children's material.
- Every text field the app draws sets `autoComplete="off"` (sign-in and API keys aside), so the
  browser does not offer to fill or save it: Chrome took the question number for a licence plate.

## Motion

Rhythms borrowed from other products, drawn with study-desk tools. All of it lives in
`src/shared/motion` (CSS classes in `motion.css`, small components next to it) and collapses
to an instant change under `prefers-reduced-motion`.

| What | Borrowed from | Where | How |
| --- | --- | --- | --- |
| Highlighter sweep | Apple Notes | revealed answers | `.hl.m-sweep` / `.hl-md.m-sweep`, 340 ms ease-out (sped up 2026-10-04: revealing felt slow) |
| Pen tick | Duolingo | right option | `PenTick` (draws in 360 ms). A wrong pick only gets its red tint and a nudge: no red-pen ring, it was too loud while answering |
| Pressable buttons | Duolingo | primary and secondary `Button` | `.m-push` / `.m-push-quiet`: a solid bottom edge that collapses while held |
| Rolling digits | Stripe | quiz results | `Odometer`, 900 ms spring, 80 ms per column |
| Gliding hover | Linear, Vercel | review outline | `Glide` + `data-glide` rows, 260 ms |
| Toast | Linear | after a delete (with 復原) | `Toast` (`.m-toast`): a navy pill at the bottom, rises 8 px and fades. Settings save silently: no "已儲存" note |
| Erase on confirm | Things 3 | "沒問題" on a review note | `ConfirmNote`: highlight erased right to left, then the note folds |
| Bottom sheet | iOS | phone action menu | `Fab` below `sm`, 520 ms spring |
| Next sheet | Apple Books, iOS | next question in a quiz | `.m-leaf-out` slides the old sheet 14 px off in 120 ms, then `.m-leaf-in` slides the new one 18 px in (300 ms) from the side you head to; `data-back` mirrors it. The two never show at once; no 3D. Off with 設定 > 做題時減少動畫 (`data-motion="calm"` stills everything inside `.m-calm-zone`) |
| Full-marks stamp | Duolingo, hanko | 100% on quiz results | `.m-stamp`, lands 520 ms after the score, ink ring spreads |
| Drag | Trello, Linear | dragging a question in review | Picked up on the first pixel of movement. The copy is the whole card, same size and buttons, lifted by its shadow only (`.m-lifted`); its place stays as a dashed slot of the same size. `EdgeScroll` glides the page near the top and bottom edges, once per frame |
| Scan | Apple Notes | import being read; boxes when the editor opens | `Scan` (`.m-scan-bar`, loops while loading); `.m-found` boxes one by one, 140 ms apart |
| Pencil progress | Stripe | import progress | `PencilProgress`: pencil tip on the line's end, blue stroke behind it |
| Pen checkbox | Things 3, Todoist | quiz setup | `input.m-check`: tick drawn in 320 ms, unticked in 120 ms |
| Last-minute timer | Duolingo | timed exams, last 60 s | `.m-last-minute`: red pen, beats once a second, colon blinks |
| Corner curl | iBooks, the logo | exam cards in the bank | `.m-curl` lifts on hover to show `練習`; the corner itself also opens the practice setup (always shown on touch). The rest of the card opens the exam |
| Product page | Linear, Stripe | `/` for signed-out visitors, `/welcome` | A pile of ten sample exams; each visit opens on one this browser has not seen yet and 換一張 brings another (`.m-leaf-out`, then `.m-leaf-in`). A sheet is printed twice in one place: the copy with the student's pencil on top, wiped away by `.m-wipe` in step with the `.m-scan-once` line, then the clean copy's `.m-box-in` boxes 200 ms apart, the highlighter on the answer and the found note. Every sheet is as tall as the longest (a short one spreads its questions a little), so nothing moves when it changes. Pictures play once they scroll in (`.m-play`), sections fade up 14 px once (`.m-reveal` + `RevealObserver`). Nothing loops |
| Punch confetti | Stripe, Linear | 100% on quiz results | `Confetti`: one burst of binder-hole dots in the four ink colors |

Controls with a moving part must not change the layout around them: the sliding pill of
`Segmented` is clipped, so its spring overshoot never widens the row or flashes a scrollbar, and it
slides only after a click: a value read from storage on opening (外觀) lands in place.
Text fields have no focus animation, only a deeper blue border. Every delete button (trash icon)
turns red on hover, through one rule in `globals.css`; never give one its own hover color.

Scrollbars are thin pencil-grey thumbs with no track (`globals.css`). Every scrolling area keeps
the bar's room even when nothing scrolls (`scrollbar-gutter: stable`), so content never shifts
sideways when a bar appears. Rows that scroll sideways (the editor's number bar) have no bar at
all: their ends fade out, the wheel scrolls them, and the selected number is kept in the middle.
Long lists to pick from use `Listbox` (`src/shared/Listbox.tsx`, opening with `.m-menu`), not the
native `<select>`, whose popup scrolls by itself when the pointer rests near its edges. A list of
more than 8 opens with a search field (typing narrows it, arrows and Enter pick); options may carry
a quieter `hint` line (subject, date) that is searched too.

No loading screens between pages: the current page stays until the next one is ready. Deleting
never asks first; it shows a toast with 復原, and Ctrl+Z brings questions back (quizzes in the
list are removed for good only when the 5 s toast runs out).
A zoomed exam page can be grabbed and moved with the mouse; a press that does not move is still a
click on a question's box. The selected question's box can be moved by its body and resized by
its edges and corners; a moved box is marked `manual` and never trimmed again, and Ctrl+Z puts it back.

The printed exam (A4 preview, 匯出 PDF) is real paper: black ink on white in both themes, no
accent color except the outline of the picked question on screen; 教師版 writes the answers in red
handwriting where the student would. Its styles are the `.a4-*` and `.sheet-*` rules in `globals.css`.

Tables that follow one another in a question sit side by side (`.table-row`), wrapping when the
column is too narrow. The ink pad's pen is the ink color (white in dark mode) and its width is a
wedge slider (`.m-wedge`) with a live dot preview.

Timing tokens: `--m-fast` 140 ms (presses), `--m-base` 240 ms, `--m-slow` 460 ms (entrances),
`--m-spring` for anything that lands. Rules: one moving thing at a time; feedback within
100 ms of the tap; nothing loops except loading and the last-minute clock; never animate text color.
SVG strokes that draw themselves use `pathLength="1"` with `stroke-dasharray: 1 2` and start at
`stroke-dashoffset: 1.02`, so the round cap never shows before the stroke starts.

## Logo: 捲角

A sheet whose bottom-right corner curls into a loop (Sheet + loop). Single color, drawn with
`currentColor` in `src/shared/brand/LogoMark.tsx`: `accent` on paper, `night-accent` on the
sidebar. The wordmark is lowercase `sheetloop` in Bricolage Grotesque ExtraBold. The favicon
(`src/app/icon.svg`) switches to the lighter blue in dark mode.

## Light and dark

`data-theme="light" | "dark"` on `<html>` forces a theme; without it the device setting
decides. The choice is made on the settings page (外觀) and remembered in the browser
(`src/shared/theme`). An inline script applies it before the first paint.

## Phones and touch

- Under 640px the main sections sit in a bottom bar (`shared/chrome/BottomNav.tsx`), within thumb reach. The header keeps only the logo and the account.
- While a quiz is being taken (`.quiz-play`), the bottom bar steps aside. The quiz pins its own 上一題 / 看答案 / 下一題 row to the bottom edge instead.
- Swiping the question sheet left goes to the next question and right goes back (`shared/motion/useSwipe.ts`). Strokes that start on writing, typing, formulas, tables, or within 24px of a screen edge never count as swipes, because those belong to the element or to the phone's own back gesture. The sheet follows the finger at most 28px.
- List rows a person can delete also delete with a left drag (`shared/motion/SwipeToDelete.tsx`). Past a third of the width it slides away and the usual 復原 note appears; short of that it springs back. Desktop keeps the trash button.
- Gestures are touch-only. Mouse and pen never trigger them, so desktop and stylus writing behave as before.
