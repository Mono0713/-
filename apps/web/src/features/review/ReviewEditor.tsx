'use client'

import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { isWordBank, sheetOf, type DraftExam } from '@exam/core'
import type { Strength } from '@exam/models'
import { useCallback, useEffect, useRef, useState } from 'react'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { QuestionView } from '@/features/questions/QuestionView'
import { SheetPreview } from '@/features/sheet/SheetPreview'
import type { SheetCopy } from '@/features/sheet/SheetQuestion'
import { SheetSettings } from '@/features/sheet/SheetSettings'
import type { StrengthModels } from '@/server/ai'
import { Fab } from '@/shared/chrome/Fab'
import { IconCheck, IconChevronDown, IconPlus, IconTrash } from '@/shared/icons'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { Toast } from '@/shared/Toast'
import { sharedRule } from '@/shared/markingRule'
import { markSymbols } from '@/shared/markSymbols'
import { Button, inputClass } from '@/shared/ui'
import { CardActions, GripButton } from './CardActions'
import { DragPreview } from './DragPreview'
import { GroupCard } from './GroupCard'
import { NumberBar } from './NumberBar'
import { Outline } from './Outline'
import { PageViewer } from './PageViewer'
import { canMerge } from './parts'
import { iconButton, ReviewToolbar } from './ReviewToolbar'
import { ActiveOverlay, alongList, EdgeScroll, listMeasuring, Sortable, underPointer, useDragSensors, type DragHandle } from './sortable'
import { StrengthPanel } from './StrengthPanel'
import { useDraftSaving } from './useDraftSaving'
import { useFigureFraming } from './useFigureFraming'
import { SolveStatus } from './SolveStatus'
import { usePageCrops, type SourcePage } from './usePageCrops'
import { useReviewFab } from './useReviewFab'
import { useSolver } from './useSolver'
import { isFlagged, useReviewDraft } from './useReviewDraft'
import { clampSplit, DEFAULT_LAYOUT, OUTLINE_SPACE, SPLITTER, useWorkspaceLayout } from './useWorkspaceLayout'

/**
 * Review workspace, full screen: an optional question outline, every source page one under the other
 * (the divider next to them sets how wide they are) and the extracted questions, which can be dragged
 * into order. One slim toolbar on top and a floating action button for the common moves.
 * Every edit is saved as a draft automatically; "存入題庫" puts the questions in the bank.
 *
 * The pieces live next to this file: edits and undo in useReviewDraft, saving in useDraftSaving,
 * layout in useWorkspaceLayout, the bar in ReviewToolbar/NumberBar, and Outline, GroupCard, PageViewer.
 */
export function ReviewEditor({
  importId,
  initial,
  pages,
  savedExam,
  notice,
  heading,
  strength,
  models,
}: {
  importId: string
  initial: DraftExam
  pages: SourcePage[]
  /** The exam this import was already saved as. */
  savedExam: { id: string; questionCount: number } | null
  notice?: React.ReactNode
  /** Title in the toolbar; a short details line and page actions (menu rows) in its menu. */
  heading: { title: string; meta?: string; menu?: React.ReactNode }
  /** The AI strength from settings; given, the floating button can change it. */
  strength?: Strength
  /** The models each strength would use, shown beside it. */
  models?: StrengthModels
}) {
  const t = useT()
  // Phones show one side at a time.
  const [mobileView, setMobileView] = useState<'questions' | 'page'>('questions')
  const reviewDraft = useReviewDraft(initial, () => setMobileView('questions'))
  // A picture is framed on the page viewer; phones show the page meanwhile.
  const { frame, framing, cancel: cancelFraming } = useFigureFraming(
    () => setMobileView('page'),
    () => setMobileView('questions'),
  )
  const {
    start,
    draft,
    keys,
    cards,
    selected,
    select,
    selectGroup,
    editing,
    setEditing,
    updateQuestion,
    confirmQuestion,
    splitQuestion,
    mergeGroup,
    attachPart,
    detachQuestion,
    removeQuestion,
    moveBox,
    undo,
    canUndo,
    deletedNote,
    onDragEnd,
    addQuestion,
    duplicateQuestion,
    setMeta,
    setSheet,
    setGroupStem,
    setGroupOptions,
    makeWordBank,
    patchQuestion,
  } = reviewDraft
  // The original's pages, cut again from the page viewer (裁切); the draft's boxes move with the paper.
  const crops = usePageCrops(importId, pages, reviewDraft.remapPage)
  // An exam written from scratch has no original pages: the A4 paper it prints as takes their place.
  const paper = pages.length === 0
  // a question's answer room dragged on the paper; stable, so the paper is not laid out again on every render
  const patchRef = useRef(patchQuestion)
  useEffect(() => {
    patchRef.current = patchQuestion
  })
  const setSpace = useCallback((index: number, lines: number) => {
    const key = keys.current[index]
    if (key) patchRef.current(key, (q) => ({ ...q, space: lines }))
  }, [keys])
  const { saveState, published, inSync, publish, publishing } = useDraftSaving(importId, draft, initial, start, savedExam)
  // A picture framed for a form that closes (or another opens) is dropped.
  useEffect(() => {
    cancelFraming()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])
  const { layout, setLayout, row, viewer, bar, barHeight, startResize } = useWorkspaceLayout()
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const cardSensors = useDragSensors(true, true)
  const outlineSensors = useDragSensors(false)

  const flagged = draft.questions.filter(isFlagged).length
  const meta = draft.meta

  const [strengthOpen, setStrengthOpen] = useState(false)
  // what the panel last saved, so the floating button's label follows it without a reload
  const [shownStrength, setShownStrength] = useState(strength ?? 'balanced')
  const solver = useSolver(importId, draft, keys.current, patchQuestion)
  const [printing, setPrinting] = useState<SheetCopy | null>(null)
  const fabActions = useReviewFab({
    d: reviewDraft,
    solver,
    strength: strength && shownStrength,
    model: models?.[shownStrength].solving,
    onStrength: () => setStrengthOpen(true),
    onExport: paper ? (withAnswers) => setPrinting(withAnswers ? 'teacher' : 'student') : undefined,
    onExportPages: paper ? undefined : () => void (location.href = `/api/imports/${encodeURIComponent(importId)}/pdf`),
  })

  const metaFields = (compact: boolean) => [
    ...(
      [
        ['title', msg('考卷名稱')],
        ['subject', msg('科目')],
        ['institution', msg('學校')],
        ['term', msg('學期')],
      ] as const
    ).map(([key, label]) => (
      <label key={key} className="block text-sm">
        <span className={`block font-medium text-muted ${compact ? 'mb-0.5 text-[11px]' : 'mb-1 text-xs'}`}>{t(label)}</span>
        <input autoComplete="off" value={meta[key] ?? ''} onChange={(e) => setMeta(key, e.target.value)} className={`${inputClass} ${compact ? 'py-1.5 text-[13px]' : ''}`} />
      </label>
    )),
    ...(paper ? [<SheetSettings key="sheet" sheet={sheetOf(draft)} onChange={setSheet} compact={compact} />] : []),
  ]

  const visibleKeys = keys.current.filter((_, i) => !flaggedOnly || isFlagged(draft.questions[i]!))

  return (
    <div className="workspace">
      <ReviewToolbar
        barRef={bar}
        heading={heading}
        published={published}
        inSync={inSync}
        outline={layout.outline}
        onToggleOutline={() => setLayout({ outline: !layout.outline })}
        hasPages
        pageLabel={paper ? t('A4 預覽') : t('原卷')}
        mobileView={mobileView}
        onMobileView={setMobileView}
        numbers={
          <NumberBar
            questions={draft.questions}
            keys={keys.current}
            selected={selected}
            flaggedOnly={flaggedOnly}
            isFlagged={isFlagged}
            onSelect={(i) => select(i, true)}
            onSelectGroup={selectGroup}
          />
        }
        flagged={flagged}
        flaggedOnly={flaggedOnly}
        onToggleFlagged={() => setFlaggedOnly(!flaggedOnly)}
        saveState={saveState}
        onPublish={publish}
        publishing={publishing}
        canPublish={draft.questions.length > 0}
      />

      <div className="px-3 py-4 sm:px-5">
        <div
          ref={row}
          className="lg:flex"
          style={{ '--bar': `${barHeight}px`, '--side': `${(layout.outline ? OUTLINE_SPACE : 0) + SPLITTER}px`, '--split': layout.split } as React.CSSProperties}
        >
          {layout.outline && (
            <Outline
              questions={draft.questions}
              keys={keys.current}
              visibleKeys={visibleKeys}
              sensors={outlineSensors}
              onDragEnd={onDragEnd}
              selected={selected}
              flaggedOnly={flaggedOnly}
              isFlagged={isFlagged}
              onSelect={(i) => select(i, true)}
              onAdd={() => addQuestion()}
              onClose={() => setLayout({ outline: false })}
              meta={metaFields(true)}
            />
          )}

          <div
            ref={viewer}
            className={`lg:sticky lg:top-[calc(var(--bar)+1rem)] lg:block lg:h-[calc(100dvh-var(--bar)-1.5rem)] lg:w-[calc((100%_-_var(--side))_*_var(--split))] lg:shrink-0 lg:self-start ${mobileView === 'page' ? '' : 'hidden'}`}
          >
            {paper ? (
              <SheetPreview draft={draft} selected={selected} onSelect={(i) => select(i, true)} onSpace={setSpace} printing={printing} onPrinted={() => setPrinting(null)} className="lg:h-full lg:overflow-auto lg:pr-1 [scrollbar-gutter:stable]" />
            ) : (
              <PageViewer
                pages={crops.pages}
                questions={draft.questions}
                selected={selected}
                onSelect={(i) => select(i, true)}
                onBoxChange={moveBox}
                framing={framing}
                cropping={framing ? null : crops.cropping}
                onCrop={crops.start}
                className="lg:h-full lg:overflow-auto lg:pr-1 [scrollbar-gutter:stable]"
              />
            )}
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={paper ? t('調整預覽寬度') : t('調整原卷寬度')}
            aria-valuenow={Math.round(layout.split * 100)}
            aria-valuemin={30}
            aria-valuemax={72}
            tabIndex={0}
            title={paper ? t('拖曳調整預覽寬度，點兩下還原') : t('拖曳調整原卷寬度，點兩下還原')}
            onPointerDown={startResize}
            onDoubleClick={() => setLayout({ split: DEFAULT_LAYOUT.split })}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setLayout({ split: clampSplit(layout.split + (e.key === 'ArrowLeft' ? -0.02 : 0.02)) })
            }}
            className="group sticky top-[calc(var(--bar)+1rem)] hidden h-[calc(100dvh-var(--bar)-1.5rem)] w-5 shrink-0 cursor-col-resize touch-none items-center justify-center self-start outline-none lg:flex"
          >
            <span className="h-14 w-1 rounded-full bg-ink/10 transition-colors group-hover:bg-accent/60 group-focus-visible:bg-accent group-active:bg-accent" />
          </div>

          <div className={`min-w-0 flex-1 space-y-4 pb-24 lg:block ${mobileView === 'questions' ? '' : 'hidden'}`}>
            {notice}
            {/* a new exam written from scratch starts with its details open: the title comes first */}
            <details open={(!pages.length && !initial.meta.title) || undefined} className={`group rounded-2xl bg-surface shadow-sheet ${layout.outline ? 'lg:hidden' : ''}`}>
              <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
                <span className="font-medium">{t('考卷資訊')}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{[meta.subject, meta.institution, meta.term].filter(Boolean).join(' · ')}</span>
                <IconChevronDown size={16} className="text-muted transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <div className="m-expand grid gap-3 px-4 pb-4 sm:grid-cols-2">{metaFields(false)}</div>
            </details>

            <DndContext
              id="review-cards"
              sensors={cardSensors}
              collisionDetection={underPointer}
              modifiers={[alongList]}
              measuring={listMeasuring}
              autoScroll={false}
              onDragEnd={onDragEnd}
            >
              <EdgeScroll top={barHeight} />
              <SortableContext items={visibleKeys} strategy={verticalListSortingStrategy}>
                {draft.questions.map((q, index) => {
                  if (flaggedOnly && !isFlagged(q)) return null
                  const showSection = q.section && q.section !== draft.questions[index - 1]?.section
                  const group = q.groupId && q.groupId !== draft.questions[index - 1]?.groupId ? draft.groups.find((g) => g.id === q.groupId) : undefined
                  // Questions in a group hang under its shared text.
                  const inGroup = q.groupId !== null && draft.groups.some((g) => g.id === q.groupId)
                  const isEditing = editing === index
                  const key = keys.current[index]!
                  const parts = group ? draft.questions.filter((x) => x.groupId === group.id) : []
                  // a sentence of a word box (選詞填空): the box shows once on the group card above
                  const wordBank = isWordBank(draft.groups.find((g) => g.id === q.groupId))
                  return (
                    <Sortable key={key} id={key}>
                      {(handle, dragging) => (
                        <>
                          {showSection && <h3 className="mb-2 mt-7 text-[13px] font-semibold tracking-wide text-muted">{markSymbols(q.section ?? '')}</h3>}
                          {group && (
                            <GroupCard
                              group={group}
                              parts={parts}
                              onChange={(stem) => setGroupStem(group.id, stem)}
                              onOptions={(options) => setGroupOptions(group.id, options)}
                              onSelect={() => select(index, false)}
                              onMerge={canMerge(parts) ? () => mergeGroup(group.id) : undefined}
                            />
                          )}
                          <section
                            ref={(el) => {
                              if (el) cards.current.set(index, el)
                              else cards.current.delete(index)
                            }}
                            onClick={() => !isEditing && select(index, false)}
                            onDoubleClick={() => !isEditing && setEditing(index)}
                            className={`relative scroll-mt-40 rounded-2xl bg-surface p-4 transition-shadow sm:p-5 ${
                              inGroup ? 'ml-4 before:absolute before:-left-3 before:-top-4 before:bottom-4 before:w-0.5 before:rounded-full before:bg-ink/10 sm:ml-7 sm:before:-left-4' : ''
                            } ${
                              // While dragged, the card stays as an empty slot of its own size while its full-size copy
                              // follows the pointer. It stays mounted: touch drags end on it.
                              dragging ? '!bg-accent-soft/60 outline-2 -outline-offset-2 outline-dashed outline-accent/35 [&>*]:invisible' : 'shadow-sheet'
                            } ${selected === index && !dragging ? 'ring-2 ring-accent/70' : ''}`}
                          >
                            {isFlagged(q) && <span aria-hidden className="absolute bottom-5 left-0 top-5 w-[3px] rounded-r-full bg-hl" />}
                            {isEditing ? (
                              <QuestionEditor
                                value={q}
                                onChange={(v) => updateQuestion(index, v)}
                                wordBank={wordBank}
                                onWordBank={() => makeWordBank(index)}
                                importId={importId}
                                frame={pages.length ? frame : undefined}
                                ai={{ answer: () => solver.runOne(index, 'answer'), explain: () => solver.runOne(index, 'explain'), busy: solver.busy.get(key) }}
                                actions={
                                  // the same places as the card's own buttons: done where edit was, then delete and the grip
                                  <>
                                    <button type="button" onClick={() => setEditing(null)} className={`${iconButton} !text-accent hover:bg-accent-soft`} aria-label={t('完成')} title={t('完成')}>
                                      <IconCheck size={17} strokeWidth={2.6} />
                                    </button>
                                    <button type="button" onClick={() => removeQuestion(index)} className={`${iconButton} hover:bg-bad-soft hover:text-bad`} aria-label={t('刪除')} title={t('刪除')}>
                                      <IconTrash size={15} />
                                    </button>
                                    {/* Phones keep the header on one line; cards are reordered outside editing there. */}
                                    <span className="hidden sm:contents"><GripButton q={q} handle={handle} /></span>
                                  </>
                                }
                              />
                            ) : (
                              <QuestionView
                                q={q}
                                wordBank={wordBank}
                                ruleAbove={inGroup ? sharedRule(draft.questions.filter((x) => x.groupId === q.groupId)) : null}
                                onConfirm={() => confirmQuestion(index)}
                                actions={<CardActions d={reviewDraft} q={q} index={index} busy={solver.busy.get(key)} handle={handle} />}
                              />
                            )}
                          </section>
                        </>
                      )}
                    </Sortable>
                  )
                })}
              </SortableContext>
              <ActiveOverlay
                render={(key) => {
                  const index = keys.current.indexOf(key)
                  const q = draft.questions[index]
                  return q ? (
                    <DragPreview
                      q={q}
                      inGroup={q.groupId !== null && draft.groups.some((g) => g.id === q.groupId)}
                      wordBank={isWordBank(draft.groups.find((g) => g.id === q.groupId))}
                      offset={cards.current.get(index)?.offsetTop ?? 0}
                      flagged={isFlagged(q)}
                      actions={<CardActions d={reviewDraft} q={q} index={index} busy={solver.busy.get(key)} handle={null} />}
                    />
                  ) : null
                }}
              />
            </DndContext>

            {!draft.questions.length && (
              <p className="px-1 pt-2 text-sm text-muted">{t('還沒有題目。新增一題後選題型、寫題目和答案，寫好的題目可以拖曳排序。')}</p>
            )}
            <Button onClick={() => addQuestion()} className="w-full border border-dashed border-ink/15 bg-transparent py-3 shadow-none" icon={<IconPlus size={16} />}>
              {draft.questions.length ? t('新增題目') : t('新增第一題')}
            </Button>
          </div>
        </div>
      </div>

      {crops.toast}
      <Toast show={deletedNote !== null} action={t('復原')} onAction={undo}>
        {t('已刪除第 {n} 題', { n: deletedNote ?? '' })}
      </Toast>

      <SolveStatus solver={solver} />
      <Fab actions={fabActions} />
      {strength && <StrengthPanel open={strengthOpen} initial={shownStrength} models={models} onChange={setShownStrength} onClose={() => setStrengthOpen(false)} />}
    </div>
  )
}
