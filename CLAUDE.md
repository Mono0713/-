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
docs/LAUNCH.md       What must be done before opening the site to the public.
```

Dependency direction: `app → features → shared`, `features → server → packages`. A feature never imports another
feature's internals except its exported components (e.g. review uses `features/questions/QuestionEditor`).
Packages never import from apps.

## Where things are (by what the user sees)

| User says | Route | Files |
|---|---|---|
| 匯入、上傳、拍照、掃描 | `app/imports/page.tsx` | `features/imports/UploadForm.tsx`, `Scan.tsx`, `shrink.ts` (image shrink before upload), `ImportList.tsx` |
| AI 出題（放講義、筆記，選題型題數難度，AI 出成考卷） | `app/imports/generate`, then `app/imports/[id]` | `features/generate/GenerateForm.tsx` (`MaterialPicker.tsx`, `TypeCounts.tsx`), `plan.ts` (types offered, form → plan), `actions.ts` (`generateExam`, `retryGenerate`), `sections.ts` (一、單選題… order and numbers), `RetryGenerate.tsx`; material kept and run in the background by `packages/importer/src/written.ts` (`WRITTEN` provider, no pages, so the editor shows the A4 sheet; figures cropped from material pages); AI prompt and reply → draft `packages/grading/src/writer.ts`; model task `generating`, `writerFor` in `server/ai.ts`; failures `explainWriteError` in `imports/errors.ts` |
| 手動模式（貼聊天 App 回覆） | `app/imports/[id]` | `features/imports/ManualPanel.tsx`, `packages/extraction/src/providers/manual.ts` |
| 重新辨識、辨識失敗訊息、卡住的匯入自動接手 | `app/imports/[id]` | `features/imports/RerunForm.tsx`, `ImportError.tsx`, `errors.ts`; a run that died or was cut off resumes from saved page readings (`Importer.resume`, called by the page), assembly has a time limit (`ASSEMBLE_TIMEOUT`) |
| 原檔保存 | `app/imports/[id]/original` | `features/imports/OriginalFiles.tsx`, `packages/importer` (expiry) |
| 校對頁 / 編輯頁 (whole workspace) | `app/imports/[id]/page.tsx` | `features/review/ReviewEditor.tsx` (composes the pieces below) |
| ↳ 工具列、題號列、存入題庫鈕 | | `review/ReviewToolbar.tsx`, `review/NumberBar.tsx` |
| ↳ 新增/複製/刪除/復原/重做/拖曳排序/拆小題/合併 | | `review/useReviewDraft.ts` (all draft edits, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y), `review/useHistory.ts` (multi-step undo/redo, typing joins one step), `review/parts.ts` (sub-question logic; `canMerge` = 合併 only where 拆小題 brings it back), `review/sortable.tsx` (drag) |
| ↳ 自動儲存、存入題庫 | | `review/useDraftSaving.ts`, `review/actions.ts` |
| ↳ 原卷、題目框、放大縮小 | | `review/PageViewer.tsx` (also frames pictures: `review/useFigureFraming.ts`, `FramingBar.tsx` 套用/取消), `review/useBoxEditing.ts` (move/resize/draw boxes; a question added by hand draws its first box, or 放一個框), `review/boxGeometry.ts`; box placement from AI: `packages/core/src/boxes.ts` |
| ↳ 題目大綱、分隔線、版面記憶 | | `review/Outline.tsx`, `review/useWorkspaceLayout.ts` |
| ↳ 題組/小題共用卡片（共用文字、主圖：重新框選、換圖、上傳、刪除） | | `review/GroupCard.tsx` (pictures through `questions/useFigureTools.tsx` on a stand-in question; `setGroupFigures` in `review/useReviewDraft.ts`) |
| ↳ 原卷自動裁切、拉正（拍照的考卷找出紙張四角；四角四邊各自拖曳、自動、整張、復原）、匯出裁切後的 PDF | | found when uploaded (no AI): `packages/ingest/src/crop.ts` (`findPage`, `flattenPage`), kept per page by `packages/importer/src/crops.ts` (`PageCrops`: `crops.json` corners on the photo as taken, `raw-N.webp`; re-runs cut the same way; moving page readings' boxes); corner math `packages/core/src/quad.ts` (`remapBox`, `remapDraftPage`); editor: crop button in the page controls of `review/PageViewer.tsx`, `review/PageCropper.tsx` (the outline and grips), `review/usePageCrops.tsx` (state, 復原 note; draft boxes moved by `remapPage` in `useReviewDraft`, all undo steps rewritten), `review/cropActions.ts`; PDF `app/api/imports/[id]/pdf/route.ts` → `Importer.pagesPdf` → `packages/ingest/src/pdfWrite.ts` |
| ↳ 懸浮球（全部生成答案/詳解、新增、複製、匯出 PDF、AI 強度和目前模型、復原） | | `review/useReviewFab.tsx` (what the FAB holds), `review/StrengthPanel.tsx` (AI 強度; models from `modelsByStrength` in `server/ai.ts`) |
| ↳ 題目卡上的按鈕（拆小題、設為小題/移出小題、編輯、刪除、拖曳） | | `review/CardActions.tsx` |
| ↳ AI 作答、AI 詳解（全部在懸浮球，單題在題目卡上） | | `review/useSolver.ts` (runs + undoable single-question redo), `review/SolveStatus.tsx` (progress toast), `solveQuestion` in `review/actions.ts`; `needsAnswer`/`needsExplanation` in `packages/core/src/answers.ts`; models: tasks `solving`/`explaining` in `packages/models/src/routing.ts`; AI `packages/grading/src/solver.ts` |
| ↳ A4 預覽、學生版／教師版、匯出 PDF（從零建立的考卷，原卷的位置） | | `features/sheet/SheetPreview.tsx` (viewer like the original pages: bottom zoom/page bar and page badge from `shared/PageControls.tsx`, answers always red, PDF export started from the FAB in `review/useReviewFab.tsx`; measures blocks on an unseen page, pages them, `usePrint.ts` prints full-size pages = PDF), `blocks.tsx` (header, section, passage, question blocks), `SheetQuestion.tsx` (one printed question by type), `AnswerRoom.tsx` (answer room whose bottom edge is dragged; `space` on the question, lines), `SheetHeader.tsx` (title, 班級／座號／姓名, 得分), `SheetSettings.tsx` (in 考卷資訊), `layout.ts` (`paginate`, `optionColumns`); settings `sheet` on `DraftExam` (`sheetOf` in `packages/core/src/types.ts`); styles `.a4-*`/`.sheet-*` and print rules in `app/globals.css` |
| 題目卡（看）/ 題目編輯表單 | | `features/questions/QuestionView.tsx` (配合題 as a table: `MatchingTable.tsx`), `QuestionEditor.tsx` → `OptionsEditor.tsx`, `AnswerEditor.tsx`, `editorParts.tsx` |
| 題目圖片：重新框選、換圖、上傳、刪除 | | `features/questions/useFigureTools.tsx` (frame on the left page viewer, replace, upload, delete), `FigureTile.tsx` (picture + its tools), `FiguresEditor.tsx` (the question's own pictures; option pictures sit under each option in `OptionsEditor.tsx`); `recropFigure`/`uploadFigureImage` in `questions/actions.ts`; `packages/figures/src/upload.ts` |
| 圖片空格清理 | | `features/questions/FigureBlanksEditor.tsx`, `packages/figures` |
| 圖片選項（選項是圖） | | figure `option` field in `packages/core/src/schema.ts`, `questionFigures`/`optionFigures` in `core/src/figures.ts`; shown by `shared/FigureView.tsx` (`OptionPictures`); assigned in `QuestionEditor.tsx` (這張圖是) |
| 題庫、考卷卡、篩選 | `app/bank/page.tsx`, `bank/exams/[id]`, `bank/[id]` | `features/bank/*` (`ExamCard`, `BankFilters`, `ExamMetaForm`, `BankQuestionEditor`; `SortableExams.tsx` = drag the cards into your own order, saved as `position` on exams via `reorderExams` in `bank/actions.ts`, off while a filter is on) |
| 開始測驗、選題 | `app/quiz/new` | `features/quiz/QuizSetup.tsx`, `start.ts` |
| 作答頁（考試/單題練習、計時） | `app/quiz/[id]` | `features/quiz/QuizPlayer.tsx` (pages: a 選詞填空 group's sentences share one page, `WordBankPage.tsx`, checked together; section heading shown above each question in `QuizQuestion.tsx`) |
| 一題的作答區（選項、填空、手寫、書寫模式） | | `features/quiz/QuizQuestion.tsx`, `PracticeSheet.tsx` (寫字練習 田字格), `MatchingPicker.tsx` (配合題 like the paper: a ( ) before each item opens the labels, `BlankPick.tsx`; the list shown once beside), `MatchingFill.tsx` (配合題 whose definitions hold a blank: words in a box above, each definition's blank picks a word), `Passage.tsx` (閱讀題組 文章) |
| 選項代號填空（點空格選 (A)～(L)、圖上和表格裡） | | `features/quiz/BlankPick.tsx` (空格選單), `packages/core/src/matching.ts` (`isPickAnswer`), `shared/Markdown.tsx` (`renderBlank`/`blankCount`：句子和表格裡的 ___ 原位作答) |
| 選詞填空（字庫印一次，每句選代號填空） | | box on the group (`options` on `QuestionGroup` in `packages/core/src/schema.ts`), each sentence a `fill_in_blank` holding a copy: `packages/core/src/wordBank.ts` (`syncWordBanks`; `withWordBanks` also turns old drafts that repeated the box on each sentence into one, run in `extraction/src/merge.ts` and when the editor opens); box shown by `shared/WordBox.tsx` in `review/GroupCard.tsx` (edited there), `quiz/Passage.tsx`, `sheet/blocks.tsx`; `wordBank` prop on `QuestionView`/`QuestionEditor`/`SheetQuestion`; options never shuffled (`buildItems`); 加入字庫／移出字庫 on the cards (`review/CardActions.tsx`); questions carried onto the next page rejoin their group (passage, box, sub-questions) by `packages/core/src/carried.ts` (`joinCarriedGroups`); 選詞填空 as a type in the editor's type menu (`makeWordBank` in `review/useReviewDraft.ts`) |
| 字數上限、評分規則（錯字扣分等） | | `maxLength`/`markingRule` in `packages/core/src/schema.ts`；`shared/markingRule.ts`（題組共用的規則只在題組卡顯示一次、題目文字裡重複的規則不顯示）；顯示 `QuizQuestion.tsx`、`questions/QuestionView.tsx`，編輯 `questions/QuestionEditor.tsx`，送給 AI `packages/grading/src/teacher.ts` |
| 作圖題（在圖上畫答案） | | `QuizQuestion.tsx` (drawOn), `shared/ink/InkPad.tsx` (`backdrop` 底圖), `packages/grading/src/handwriting.ts` (`drawingToPng`, readDrawing) |
| 讀圖題容許誤差（98 ± 2、96 ~ 100） | | `packages/quiz/src/equivalence.ts` (`withinTolerance`) |
| 看答案 | | `features/quiz/Reveal.tsx`, `visible.ts` (what may show before reveal) |
| 翻譯 | | `features/quiz/useQuestionTranslation.ts`, `packages/grading/src/translate.ts` |
| 問 AI | | `features/quiz/TutorChat.tsx`, `packages/grading/src/tutor.ts` |
| 批改、AI 評分、成績 | | `features/quiz/actions.ts`, `teacher.ts`, `QuizResults.tsx`; rules `packages/quiz/src/logic.ts`, `equivalence.ts`; AI `packages/grading` |
| 測驗紀錄列表 | `app/quiz/page.tsx` | `features/quiz/QuizList.tsx` |
| 分享連結 | `app/s/[token]` | `features/sharing/*`, `packages/sharing`, `server/shared.ts` |
| 班級、作業、交卷、老師批閱 | `app/classes/**` | `features/classes/*`, `server/classes.ts`, `packages/classes` |
| ↳ 成績表、分布圖、選項分析、每題得分率 | `classes/[id]/a/[aid]` | `classes/ResultsTable.tsx`, `ScoreDistribution.tsx`, `OptionAnalysis.tsx`; math `packages/classes/src/analysis.ts`, `stats.ts` |
| ↳ 匯出成績 CSV | `app/api/classes/[id]/export` | `classes/ExportLink.tsx`, `server/gradebook.ts` |
| ↳ 學生個人成績頁（折線圖、弱點題型） | `classes/[id]/s/[userId]` | `classes/ScoreLine.tsx`, `typeRates` in `analysis.ts` |
| ↳ 每題對錯總表（學生 × 題目）、逐題批改、老師打分 | `classes/[id]/a/[aid]/q/[qid]` | `classes/AnswerGrid.tsx`, `QuestionMarking.tsx` (全班同一題), `MarkBox.tsx` (答對/部分/答錯＋評語), `TeacherReview.tsx` (一位學生整份卷 `r/[attemptId]?q=` 跳到該題); math `packages/classes/src/grid.ts` |
| ↳ 學生練習自己的錯題（答案公布後） | `classes/[id]/a/[aid]` | `classes/MistakesButton.tsx`, `mistakes.ts`; `missedQuestions` in `packages/classes/src/grid.ts` |
| ↳ 個人延長／補考、公告 | | `classes/ExceptionEditor.tsx`, `Announcements.tsx`, actions `teaching.ts`; rules `packages/classes/src/exceptions.ts` (`rulesFor`, `isOpenFor`, `lastClose`) |
| ↳ 學生待辦清單 | `app/classes` | `classes/TodoList.tsx` |
| ↳ 考試防作弊（離開畫面、截圖鍵、全螢幕、禁止選取複製列印） | `app/quiz/[id]` | `classes/Proctor.tsx` (records), `integrity.ts` (saves), `integrityCounts.ts`, `IntegrityLog.tsx` (老師看紀錄); `IntegrityEvent` in `packages/quiz/src/types.ts` |
| 派作業（選考卷、派給一或多個班級；題庫考卷頁的「派給班級」） | `app/classes/assign` | `features/classes/AssignForm.tsx`, `ExamPicker.tsx` (搜尋＋科目篩選), `createAssignments` in `features/classes/actions.ts` |
| 多選題部分給分（派作業時勾選；自己練習在開始測驗頁） | `app/classes/assign` | `features/classes/AssignForm.tsx` → `multiplePartial` in `createAssignments`; `QuizSetup.tsx` for practice; share links use `BankExam.multiplePartial` (column `multiple_partial`, no longer edited in the bank) |
| 設定頁 | `app/settings/page.tsx` | `features/settings/SettingsForm.tsx` (一般 + AI 兩步), `StorageCard` + `StorageList.tsx` (one line per import, biggest first, first 5 then 顯示全部; 刪原檔 or the whole import with 復原; data `storageItems` in `server/storage.ts`, sizes from `files.sizes`), `ProfileEditor`/`ProfileCard`; `ModelPicker` is the import page's method/model picker |
| ↳ 接上 AI 服務（金鑰、自訂服務、模型看不看得懂圖） | | `settings/AiServices.tsx` (one row per service), `ApiKeys.tsx` (一個服務多把金鑰: stored as `apiKeys[id]` + `apiKeys['id#slot']` in the order shown, `keysOf` in `packages/settings`; `KeyRows.tsx` = the key lines, dragged into order via `reorderApiKeys`; calls use the top key and move down on quota/limit/refusal, a refused key rests 10 min: `withKeys` in `packages/core/src/keys.ts`), `CustomProviders.tsx` (`CustomService` models, `AddService`; API 網址自動找 /v1: `apiBase.ts`) |
| ↳ 每項工作用哪個模型、一鍵套用、有圖時改用、翻譯、AI 批改開關 | | `settings/TaskModels.tsx`, `TaskModelPicker.tsx`; routing `packages/models/src/routing.ts` (`PICTURE_TASKS`, `pictures`), `server/ai.ts` (`routeFor`); saved as `taskModels`/`pictureModels` in `packages/settings` |
| 側邊欄、帳號選單、頁首、手機導覽 | | `shared/chrome/` (`Sidebar`, `SideNav`, `rail.ts` fold state, `AccountMenu`, `Header`, `NavLinks`, `nav.ts` items) |
| 懸浮球 (FAB)、收到右邊 | | `shared/chrome/Fab.tsx` (swipe right or 收到右邊 tucks it into a tab on the right edge, remembered per device) |
| 宣傳頁、首頁介紹（未登入看到的 `/`，任何人可開 `/welcome`） | `app/page.tsx`, `app/welcome/page.tsx` | `features/landing/Landing.tsx` → `LandingNav`, `Hero`, `Steps` (四步驟), `Audience` (適合誰), `Features` (試一題: `try/TryQuestion.tsx`, questions in `try/questions.ts`), `Faq`, `Closing`, `Footer`; pictures in `art/` (`StepArt`, `FeatureArt`, `Frame`); `StartButton` (Google 登入／前往題庫), `LanguagePick`, `RevealObserver`, `metadata.ts` (頁面標題與連結預覽); public paths in `proxy.ts` |
| ↳ 介紹影片（首頁「看介紹影片」，全螢幕播放、章節、暫停） | | `landing/demo/` (`TourButton` hero button, loads `Tour` = player, clock, chapter bar; one file per chapter: `Bookends` 開場/結尾, `ScanScenes` 拍照裁切＋辨識, `ReviewScene`, `PracticeScene`, `GradeScene`, `ClassScene`; `SceneLayout` caption + picture, `Cursor` (aimed by `useSpots`), `tween.ts` time→style helpers; plays the sample the hero pile shows (`data-sample` on `SampleDeck`), its practice question from `practice.ts`, explanations = `why` on each sample's choice question) |
| ↳ 示範考卷（每次換一張、換一張鈕） | | `landing/samples/` (one file per subject, listed in `index.ts`; `types.ts`; `seen.ts` = the `lp_seen` cookie that picks one not seen yet), `landing/sheet/` (`SampleDeck` pile + 換一張, `Sheet` printed page and found note, `Question` per kind, `figures` drawings, `parts` pencil/blank/box, `Printed` text with formulas) |
| 登入 | `app/login`, `app/auth/callback` | `features/auth/actions.ts`, `server/auth.ts` |
| 隱私權政策、服務條款 | `app/privacy`, `app/terms` | `features/legal/LegalPage.tsx`; texts `privacy.zh-Hant.ts`/`.en.ts`, `terms.*` (not t(): zh-Hant prevails, others read en; bump `LEGAL_UPDATED` in `docs.ts`) |
| 下載我的資料、刪除帳號 | `app/api/account/export` | `features/account/` (`AccountCard`, `DeleteAccount`, `actions.ts`), `server/account.ts`, `packages/db/src/account.ts` (every table holding a person's rows, SQLite and Postgres: a new owner table goes there); settings via `SettingsStore.remove`; entry in `shared/chrome/AccountMenu.tsx` |
| 安全標頭 (CSP、HSTS…) | | `apps/web/next.config.ts` |
| 找不到頁面 (404) | `app/not-found.tsx` | uses `shared/ui` `EmptyState` |
| 刪除＋5 秒復原 | | `shared/removal.tsx`, `shared/Toast.tsx` |
| 公式輸入 | | `shared/math/` (`MathTextInput` 文字框裡的公式, `FormulaToolbar` 電腦版公式工具列, `formulaKeys.ts` 各分類按鍵（常用／代數／幾何／微積分／希臘字母／化學）, `mathKeyboard.ts` 手機平板的螢幕數學鍵盤, `mathlive.ts`, `chips.ts` 公式小塊與存回文字, `delimiters.ts` (`fromPaste` 貼上的 LaTeX 變公式), `CopyFormulas.tsx` 複製題目時剪貼簿拿到 LaTeX, `InlineText.tsx` 一行裡的短答案帶公式（A4 填空答案）; 鍵盤配色在 `app/globals.css`) |
| 手寫板、稿紙 | | `shared/ink/InkPad.tsx`, `packages/ink` (`paper.ts`) |
| 動畫 | | `shared/motion/` (`motion.css` holds every keyframe and `m-*` class) |
| 深色/淺色 | | `shared/theme/`, color tokens in `app/globals.css` |
| Logo、產品名 | | `shared/brand/brand.ts` (the only place the name is written) |
| 圖示 | | `shared/icons` (lucide, import only from here) |
| 介面語言 | | `shared/i18n/` (see below) |
| 題型名稱 | | `shared/labels.ts`; section headings' ○/╳ marks evened out by `shared/markSymbols.ts`; types defined in `packages/core/src/schema.ts` |
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
| `core` | Question/exam schema and types (`schema.ts`), titles that only name the form (考試命題紙) → subject + term (`title.ts`, used in `extraction/src/merge.ts` and when the editor opens), box untangling (`boxes.ts`), figure helpers, 配合題 item count (`matching.ts`), which questions lack a key (`answers.ts`) |
| `extraction` | AI recognition of pages: prompt (`prompt.ts`), providers, merging pages (`merge.ts`) |
| `importer` | Upload → pages → recognition → draft pipeline, background runs, original-file expiry; exams written from study material (`written.ts`); page crops (`crops.ts`) |
| `ingest` | PDF and image → page images; finding and flattening the sheet in a photo (`crop.ts`); images → PDF (`pdfWrite.ts`) |
| `figures` | Cropping figures, cleaning handwriting out of blanks, moving AI question boxes onto their text lines (`snap.ts`), uploaded pictures (`upload.ts`) |
| `bank` | Question bank storage (`sqlite.ts`, `postgres.ts`), drafts |
| `quiz` | Attempts storage, marking rules (`logic.ts`), answer equivalence (`equivalence.ts`) |
| `grading` | AI teacher, handwriting reader, tutor, translation, answer solver (`solver.ts`), exam writer for AI 出題 (`writer.ts`), their caches |
| `models` | Model catalog, prices, routing by AI strength (see `packages/models/SPEC.md`) |
| `settings` | Per-user settings and their stores, locales list |
| `sharing`, `classes`, `usage` | Share links; classes and assignments (`types.ts`, stores `sqlite.ts`/`postgres.ts`, `rows.ts`, `stats.ts`, `analysis.ts`, `grid.ts`, `exceptions.ts`); AI usage log |
| `files` | File storage (local folder or R2) with dedup |
| `ink` | Handwriting data and practice papers |
| `db` | Postgres connection and `pnpm db:migrate` |

A new column or table needs both `supabase/migrations/<timestamp>_<name>.sql` and the package's SQLite store (`grep -l "CREATE TABLE" packages/*/src`). A table holding someone's data also goes in `packages/db/src/account.ts` (its test fails otherwise).

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
