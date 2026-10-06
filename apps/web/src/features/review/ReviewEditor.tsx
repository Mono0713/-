'use client'

import { DndContext } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import type { DraftExam, DraftQuestion } from '@exam/core'
import type { Strength } from '@exam/models'
import { useState } from 'react'
import { QuestionEditor } from '@/features/questions/QuestionEditor'
import { QuestionView } from '@/features/questions/QuestionView'
import { STRENGTH_LABELS } from '@/features/settings/strengths'
import { Fab, type FabAction } from '@/shared/chrome/Fab'
import { IconAlert, IconCheck, IconChevronDown, IconCopy, IconEdit, IconGrip, IconIndent, IconMerge, IconOutdent, IconPlus, IconSplit, IconStrength, IconTrash, IconUndo } from '@/shared/icons'
import { msg } from '@/shared/i18n/format'
import { useT } from '@/shared/i18n/client'
import { Toast } from '@/shared/Toast'
import { markSymbols } from '@/shared/markSymbols'
import { Button, inputClass } from '@/shared/ui'
import { DragPreview } from './DragPreview'
import { GroupCard } from './GroupCard'
import { NumberBar } from './NumberBar'
import { Outline } from './Outline'
import { PageViewer } from './PageViewer'
import { attachToPrevious, mergeParts, splitNumber, splitParts } from './parts'
import { iconButton, ReviewToolbar } from './ReviewToolbar'
import { ActiveOverlay, alongList, EdgeScroll, listMeasuring, Sortable, underPointer, useDragSensors, type DragHandle } from './sortable'
import { StrengthPanel } from './StrengthPanel'
import { useDraftSaving } from './useDraftSaving'
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
}: {
  importId: string
  initial: DraftExam
  pages: { pageNumber: number; image: string }[]
  /** The exam this import was already saved as. */
  savedExam: { id: string; questionCount: number } | null
  notice?: React.ReactNode
  /** Title in the toolbar; a short details line and page actions (menu rows) in its menu. */
  heading: { title: string; meta?: string; menu?: React.ReactNode }
  /** The AI strength from settings; given, the floating button can change it. */
  strength?: Strength
}) {
  const t = useT()
  // Phones show one side at a time.
  const [mobileView, setMobileView] = useState<'questions' | 'page'>('questions')
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
    setGroupStem,
  } = useReviewDraft(initial, () => setMobileView('questions'))
  const { saveState, published, inSync, publish, publishing } = useDraftSaving(importId, draft, initial, start, savedExam)
  const { layout, setLayout, row, viewer, bar, barHeight, startResize } = useWorkspaceLayout()
  const [flaggedOnly, setFlaggedOnly] = useState(false)
  const cardSensors = useDragSensors(true, true)
  const outlineSensors = useDragSensors(false)

  const flagged = draft.questions.filter(isFlagged).length
  const meta = draft.meta

  const nextFlagged = () => {
    const n = draft.questions.length
    const from = selected ?? -1
    for (let k = 1; k <= n; k++) {
      const i = (from + k) % n
      if (isFlagged(draft.questions[i]!)) return select(i, true)
    }
  }
  // The floating button holds what the page does not already show: undo (phones and tablets have
  // no Ctrl+Z), jumping to the next question to check, and actions on the selected question.
  const chosen = selected !== null ? draft.questions[selected] : undefined
  const chosenNumber = chosen ? chosen.number : ''
  const chosenGroup = chosen?.groupId ? draft.groups.find((g) => g.id === chosen.groupId) : undefined
  const canMerge = !!chosenGroup && !!mergeParts(chosenGroup, draft.questions.filter((q) => q.groupId === chosenGroup.id))
  const [strengthOpen, setStrengthOpen] = useState(false)
  // what the panel last saved, so the floating button's label follows it without a reload
  const [shownStrength, setShownStrength] = useState(strength ?? 'balanced')
  const fabActions: FabAction[] = [
    ...(flagged > 0 ? [{ id: 'next', label: t('下一題待確認'), icon: <IconAlert size={19} />, badge: flagged, onClick: nextFlagged }] : []),
    ...(chosen && selected !== null
      ? [
          ...(splitParts(chosen, '') ? [{ id: 'split', label: t('把第 {n} 題拆成小題', { n: chosenNumber }), icon: <IconSplit size={19} />, onClick: () => splitQuestion(selected) }] : []),
          ...(selected > 0 && attachToPrevious(draft, selected, '')
            ? [{ id: 'attach', label: t('把第 {n} 題設為第 {main} 題的小題', { n: chosenNumber, main: splitNumber(draft.questions[selected - 1]!.number).main }), icon: <IconIndent size={19} />, onClick: () => attachPart(selected) }]
            : []),
          ...(chosenGroup ? [{ id: 'detach', label: t('把第 {n} 題移出小題', { n: chosenNumber }), icon: <IconOutdent size={19} />, onClick: () => detachQuestion(selected) }] : []),
          ...(canMerge ? [{ id: 'merge', label: t('把第 {n} 題的小題合併', { n: splitNumber(chosenNumber).main }), icon: <IconMerge size={19} />, onClick: () => mergeGroup(chosenGroup!.id) }] : []),
          { id: 'copy', label: t('複製第 {n} 題', { n: chosenNumber }), icon: <IconCopy size={19} />, onClick: () => duplicateQuestion(selected) },
          { id: 'insert', label: t('在第 {n} 題後面新增', { n: chosenNumber }), icon: <IconPlus size={20} />, onClick: () => addQuestion(selected) },
        ]
      : [{ id: 'add', label: t('新增題目'), icon: <IconPlus size={20} />, onClick: () => addQuestion() }]),
    ...(strength
      ? [{ id: 'strength', label: t('AI 強度：{strength}', { strength: t(STRENGTH_LABELS.find(([v]) => v === shownStrength)![1]) }), icon: <IconStrength size={19} />, onClick: () => setStrengthOpen(true) }]
      : []),
    { id: 'undo', label: t('復原上一步'), icon: <IconUndo size={19} />, onClick: undo, disabled: !canUndo },
  ]

  const metaFields = (compact: boolean) =>
    (
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
    ))

  const visibleKeys = keys.current.filter((_, i) => !flaggedOnly || isFlagged(draft.questions[i]!))

  // A card's buttons when it is not being edited; the dragged copy draws the same row (inert) so it lines up.
  const viewActions = (q: DraftQuestion, index: number, handle: DragHandle | null) => (
    <>
      {!q.groupId && splitParts(q, '') && (
        <button type="button" onClick={() => splitQuestion(index)} className={iconButton} aria-label={t('拆成小題')} title={t('拆成小題：(a)(b) 各自一題，可以分別作答和計分')}>
          <IconSplit size={15} />
        </button>
      )}
      <button type="button" onClick={() => setEditing(index)} className={iconButton} aria-label={t('編輯')} title={t('編輯（或點兩下題目）')}>
        <IconEdit size={15} />
      </button>
      <button type="button" onClick={() => removeQuestion(index)} className={`${iconButton} hover:bg-bad-soft hover:text-bad`} aria-label={t('刪除')} title={t('刪除')}>
        <IconTrash size={15} />
      </button>
      {handle ? (
        gripButton(q, handle)
      ) : (
        <span className={iconButton.replace('text-muted', 'text-accent')}>
          <IconGrip size={16} />
        </span>
      )}
    </>
  )
  const gripButton = (q: DraftQuestion, handle: DragHandle) => (
    <button
      type="button"
      {...handle}
      className={`${iconButton} cursor-grab touch-none active:cursor-grabbing`}
      aria-label={t('拖曳第 {n} 題來排序', { n: q.number })}
      title={t('拖曳排序')}
    >
      <IconGrip size={16} />
    </button>
  )


  return (
    <div className="workspace">
      <ReviewToolbar
        barRef={bar}
        heading={heading}
        published={published}
        inSync={inSync}
        outline={layout.outline}
        onToggleOutline={() => setLayout({ outline: !layout.outline })}
        hasPages={pages.length > 0}
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

          {/* An exam written from scratch has no original pages: the questions take the room. */}
          {pages.length > 0 && (
            <>
              <div
                ref={viewer}
                className={`lg:sticky lg:top-[calc(var(--bar)+1rem)] lg:block lg:h-[calc(100dvh-var(--bar)-1.5rem)] lg:w-[calc((100%_-_var(--side))_*_var(--split))] lg:shrink-0 lg:self-start ${mobileView === 'page' ? '' : 'hidden'}`}
              >
                <PageViewer
                  pages={pages}
                  questions={draft.questions}
                  selected={selected}
                  onSelect={(i) => select(i, true)}
                  onBoxChange={moveBox}
                  className="lg:h-full lg:overflow-auto lg:pr-1 [scrollbar-gutter:stable]"
                />
              </div>

              <div
                role="separator"
                aria-orientation="vertical"
                aria-label={t('調整原卷寬度')}
                aria-valuenow={Math.round(layout.split * 100)}
                aria-valuemin={30}
                aria-valuemax={72}
                tabIndex={0}
                title={t('拖曳調整原卷寬度，點兩下還原')}
                onPointerDown={startResize}
                onDoubleClick={() => setLayout({ split: DEFAULT_LAYOUT.split })}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') setLayout({ split: clampSplit(layout.split + (e.key === 'ArrowLeft' ? -0.02 : 0.02)) })
                }}
                className="group sticky top-[calc(var(--bar)+1rem)] hidden h-[calc(100dvh-var(--bar)-1.5rem)] w-5 shrink-0 cursor-col-resize touch-none items-center justify-center self-start outline-none lg:flex"
              >
                <span className="h-14 w-1 rounded-full bg-ink/10 transition-colors group-hover:bg-accent/60 group-focus-visible:bg-accent group-active:bg-accent" />
              </div>
            </>
          )}

          <div className={`min-w-0 flex-1 space-y-4 pb-24 lg:block ${pages.length ? '' : 'mx-auto max-w-3xl'} ${mobileView === 'questions' ? '' : 'hidden'}`}>
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
                  return (
                    <Sortable key={key} id={key}>
                      {(handle, dragging) => (
                        <>
                          {showSection && <h3 className="mb-2 mt-7 text-[13px] font-semibold tracking-wide text-muted">{markSymbols(q.section ?? '')}</h3>}
                          {group && (
                            <GroupCard
                              group={group}
                              parts={draft.questions.filter((x) => x.groupId === group.id)}
                              onChange={(stem) => setGroupStem(group.id, stem)}
                              onSelect={() => select(index, false)}
                              onMerge={() => mergeGroup(group.id)}
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
                                importId={importId}
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
                                    <span className="hidden sm:contents">{gripButton(q, handle)}</span>
                                  </>
                                }
                              />
                            ) : (
                              <QuestionView
                                q={q}
                                onConfirm={() => confirmQuestion(index)}
                                actions={viewActions(q, index, handle)}
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
                      offset={cards.current.get(index)?.offsetTop ?? 0}
                      flagged={isFlagged(q)}
                      actions={viewActions(q, index, null)}
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

      <Toast show={deletedNote !== null} action={t('復原')} onAction={undo}>
        {t('已刪除第 {n} 題', { n: deletedNote ?? '' })}
      </Toast>

      <Fab actions={fabActions} badge={flagged || undefined} />
      {strength && <StrengthPanel open={strengthOpen} initial={shownStrength} onChange={setShownStrength} onClose={() => setStrengthOpen(false)} />}
    </div>
  )
}
