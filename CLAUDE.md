# Sheetloop 卷環: code map

Read this first. It says where each feature lives, so a fix opens only the files it needs.
Don't scan the repo or read whole folders: find the feature below, open its entry file, follow imports from there.
Keep this map current: when you add, move or split a file, update its line here in the same commit.

## Layout

```
apps/web/            Next.js 16 app (App Router, React 19, Tailwind v4). The product.
  src/app/           Routes only: each page.tsx loads data on the server and renders a feature component.
  src/features/<f>/  One folder per feature: its components, hooks and actions.ts (server actions).
  src/server/        Server-only wiring: services, auth, AI model choice, storage limits.
  src/shared/        UI and helpers used by several features (no feature logic here).
  test/              Web unit tests (vitest).
  DESIGN.md          Visual rules (study-desk look, motion, color). Follow for any UI change.
packages/<p>/        Plain TypeScript libraries with no UI; each has src/index.ts and test/.
apps/cli/            `pnpm extract`: batch recognition from the command line.
supabase/migrations/ Postgres schema (hosted). SQLite creates its own tables in each package's store code.
docs/HOSTING.md      Supabase, Google login, R2, Render setup.
```

Dependency direction: `app → features → shared`, `features → server → packages`. A feature never imports another
feature's internals except its exported components (e.g. review uses `features/questions/QuestionEditor`).
Packages never import from apps.

## Where things are (by what the user sees)

| User says | Route | Files |
|---|---|---|
| 匯入、上傳、拍照、掃描 | `app/imports/page.tsx` | `features/imports/UploadForm.tsx`, `Scan.tsx`, `shrink.ts` (image shrink before upload), `ImportList.tsx` |
| 手動模式（貼聊天 App 回覆） | `app/imports/[id]` | `features/imports/ManualPanel.tsx`, `packages/extraction/src/providers/manual.ts` |
| 重新辨識、辨識失敗訊息 | `app/imports/[id]` | `features/imports/RerunForm.tsx`, `ImportError.tsx`, `errors.ts` |
| 原檔保存 | `app/imports/[id]/original` | `features/imports/OriginalFiles.tsx`, `packages/importer` (expiry) |
| 校對頁 / 編輯頁 (whole workspace) | `app/imports/[id]/page.tsx` | `features/review/ReviewEditor.tsx` (composes the pieces below) |
| ↳ 工具列、題號列、存入題庫鈕 | | `review/ReviewToolbar.tsx`, `review/NumberBar.tsx` |
| ↳ 新增/複製/刪除/復原/拖曳排序/拆小題/合併 | | `review/useReviewDraft.ts` (all draft edits + Ctrl+Z), `review/parts.ts` (sub-question logic), `review/sortable.tsx` (drag) |
| ↳ 自動儲存、存入題庫 | | `review/useDraftSaving.ts`, `review/actions.ts` |
| ↳ 原卷、題目框、放大縮小 | | `review/PageViewer.tsx`, `review/useBoxEditing.ts` (move/resize boxes), `review/boxGeometry.ts`; box placement from AI: `packages/core/src/boxes.ts` |
| ↳ 題目大綱、分隔線、版面記憶 | | `review/Outline.tsx`, `review/useWorkspaceLayout.ts` |
| ↳ 題組/小題共用卡片 | | `review/GroupCard.tsx` |
| ↳ 懸浮球 AI 強度 | | `review/StrengthPanel.tsx` |
| 題目卡（看）/ 題目編輯表單 | | `features/questions/QuestionView.tsx`, `QuestionEditor.tsx` → `OptionsEditor.tsx`, `AnswerEditor.tsx`, `editorParts.tsx` |
| 圖片空格清理 | | `features/questions/FigureBlanksEditor.tsx`, `packages/figures` |
| 圖片選項（選項是圖） | | figure `option` field in `packages/core/src/schema.ts`, `questionFigures`/`optionFigures` in `core/src/figures.ts`; shown by `shared/FigureView.tsx` (`OptionPictures`); assigned in `QuestionEditor.tsx` (這張圖是) |
| 題庫、考卷卡、篩選 | `app/bank/page.tsx`, `bank/exams/[id]`, `bank/[id]` | `features/bank/*` (`ExamCard`, `BankFilters`, `ExamMetaForm`, `BankQuestionEditor`) |
| 開始測驗、選題 | `app/quiz/new` | `features/quiz/QuizSetup.tsx`, `start.ts` |
| 作答頁（考試/單題練習、計時） | `app/quiz/[id]` | `features/quiz/QuizPlayer.tsx` |
| 一題的作答區（選項、填空、手寫、書寫模式） | | `features/quiz/QuizQuestion.tsx`, `PracticeSheet.tsx` (寫字練習 田字格), `MatchingPicker.tsx` (配合題 點選), `Passage.tsx` (閱讀題組 文章) |
| 選項代號填空（點空格選 (A)～(L)、圖上和表格裡） | | `features/quiz/BlankPick.tsx` (空格選單), `packages/core/src/matching.ts` (`isPickAnswer`), `shared/Markdown.tsx` (`renderBlank`/`blankCount`：句子和表格裡的 ___ 原位作答) |
| 字數上限、評分規則（錯字扣分等） | | `maxLength`/`markingRule` in `packages/core/src/schema.ts`；顯示 `QuizQuestion.tsx`、`questions/QuestionView.tsx`，編輯 `questions/QuestionEditor.tsx`，送給 AI `packages/grading/src/teacher.ts` |
| 作圖題（在圖上畫答案） | | `QuizQuestion.tsx` (drawOn), `shared/ink/InkPad.tsx` (`backdrop` 底圖), `packages/grading/src/handwriting.ts` (`drawingToPng`, readDrawing) |
| 讀圖題容許誤差（98 ± 2、96 ~ 100） | | `packages/quiz/src/equivalence.ts` (`withinTolerance`) |
| 看答案 | | `features/quiz/Reveal.tsx`, `visible.ts` (what may show before reveal) |
| 翻譯 | | `features/quiz/useQuestionTranslation.ts`, `packages/grading/src/translate.ts` |
| 問 AI | | `features/quiz/TutorChat.tsx`, `packages/grading/src/tutor.ts` |
| 批改、AI 評分、成績 | | `features/quiz/actions.ts`, `teacher.ts`, `QuizResults.tsx`; rules `packages/quiz/src/logic.ts`, `equivalence.ts`; AI `packages/grading` |
| 測驗紀錄列表 | `app/quiz/page.tsx` | `features/quiz/QuizList.tsx` |
| 分享連結 | `app/s/[token]` | `features/sharing/*`, `packages/sharing`, `server/shared.ts` |
| 班級、作業、交卷、老師批閱 | `app/classes/**` | `features/classes/*`, `server/classes.ts`, `packages/classes` |
| 設定頁 | `app/settings/page.tsx` | `features/settings/SettingsForm.tsx` (API 金鑰 rows), `StrengthSettings`, `ModelPicker`, `CustomProviders`, `TranslationSettings`, `StorageCard`, `ProfileEditor`/`ProfileCard` |
| 側邊欄、帳號選單、頁首、手機導覽 | | `shared/chrome/` (`Sidebar`, `SideNav`, `rail.ts` fold state, `AccountMenu`, `Header`, `NavLinks`, `nav.ts` items) |
| 懸浮球 (FAB) | | `shared/chrome/Fab.tsx` |
| 登入 | `app/login`, `app/auth/callback` | `features/auth/actions.ts`, `server/auth.ts` |
| 刪除＋5 秒復原 | | `shared/removal.tsx`, `shared/Toast.tsx` |
| 公式輸入 | | `shared/math/` (`MathTextInput`, `FormulaToolbar`, `mathlive.ts`) |
| 手寫板、稿紙 | | `shared/ink/InkPad.tsx`, `packages/ink` (`paper.ts`) |
| 動畫 | | `shared/motion/` (`motion.css` holds every keyframe and `m-*` class) |
| 深色/淺色 | | `shared/theme/`, color tokens in `app/globals.css` |
| Logo、產品名 | | `shared/brand/brand.ts` (the only place the name is written) |
| 圖示 | | `shared/icons` (lucide, import only from here) |
| 介面語言 | | `shared/i18n/` (see below) |
| 題型名稱 | | `shared/labels.ts`; types defined in `packages/core/src/schema.ts` |
| PWA | | `shared/pwa/ServiceWorker.tsx`, `apps/web/public` |

## Server side

- `server/context.ts`: `services()` builds every store once (SQLite locally, Postgres when `DATABASE_URL` is set), plus `localeOf`, `keyPrefixOf`. Re-exports `currentOwner`, `currentUser`, `authEnabled` from `server/auth.ts`.
- `server/ai.ts`: which service and model each task uses (`routeFor`), API keys (`apiKeyOf`, `keySource`), and the AI helpers `teacherFor`, `tutorFor`, `translatorFor`, `availableProviders`.
- `server/storage.ts`: per-account quota (`storageOf`, `noRoomFor`).
- `server/owned.ts`, `shared.ts`, `classes.ts`, `profile.ts`: access checks and lookups for owned items, share links, classes, profiles.
- Server actions live in each feature's `actions.ts`; they get the signed-in person from `currentOwner()`.

## Packages

| Package | What it does |
|---|---|
| `core` | Question/exam schema and types (`schema.ts`), box untangling (`boxes.ts`), figure helpers, 配合題 item count (`matching.ts`) |
| `extraction` | AI recognition of pages: prompt (`prompt.ts`), providers, merging pages (`merge.ts`) |
| `importer` | Upload → pages → recognition → draft pipeline, background runs, original-file expiry |
| `ingest` | PDF and image → page images |
| `figures` | Cropping figures, cleaning handwriting out of blanks, moving AI question boxes onto their text lines (`snap.ts`) |
| `bank` | Question bank storage (`sqlite.ts`, `postgres.ts`), drafts |
| `quiz` | Attempts storage, marking rules (`logic.ts`), answer equivalence (`equivalence.ts`) |
| `grading` | AI teacher, handwriting reader, tutor, translation, their caches |
| `models` | Model catalog, prices, routing by AI strength (see `packages/models/SPEC.md`) |
| `settings` | Per-user settings and their stores, locales list |
| `sharing`, `classes`, `usage` | Share links; classes and assignments; AI usage log |
| `files` | File storage (local folder or R2) with dedup |
| `ink` | Handwriting data and practice papers |
| `db` | Postgres connection and `pnpm db:migrate` |

A new column or table needs both `supabase/migrations/<timestamp>_<name>.sql` and the package's SQLite store (`grep -l "CREATE TABLE" packages/*/src`).

## Rules every change follows

- **UI text**: never hard-code Chinese. Write `t('中文')` (or `msg('中文')` outside components); the Chinese text is the key.
  Then add translations without opening the catalogs:
  `pnpm --silent i18n missing > /tmp/new.json`, fill in each language, `pnpm i18n add /tmp/new.json`.
  `pnpm i18n` reports gaps; `pnpm i18n prune` drops unused keys. 11 catalogs in `shared/i18n/messages/` (zh-Hant is the key itself).
- **Design**: follow `apps/web/DESIGN.md`. No confirm dialogs: act at once with a 復原 toast. Icons from `@/shared/icons`.
  No new keyframes outside `shared/motion/motion.css`. Inputs get `autoComplete="off"`.
- **Small files**: one component or hook per file; move a piece out once a file passes ~400 lines, and add it to this map.
- **Test-only helpers** (e.g. `shared/chrome/LocalSwitcher.tsx`) show only under `pnpm dev`.

## Checks before pushing

```
pnpm typecheck     # all packages + web
pnpm test          # vitest, includes the i18n completeness test
pnpm --filter @exam/web build   # production build, catches server/client boundary errors
```

Run a single test file with `pnpm vitest run apps/web/test/parts.test.ts`.

## Branches

Mainline is `claude/project-thread-nw5bqx-blank` (never `main` without the user's go-ahead). Work on your own branch from the latest mainline.
