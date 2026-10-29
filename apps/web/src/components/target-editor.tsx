'use client'

import {
  ActionIcon,
  Button,
  Checkbox,
  ColorSwatch,
  Flex,
  Group,
  Indicator,
  NativeSelect,
  Popover,
  Radio,
  SegmentedControl,
  Slider,
  Stack,
  Table,
  Tabs,
  TextInput,
  Tooltip,
} from '@mantine/core'
import { useElementSize, useMediaQuery, useMergedRef } from '@mantine/hooks'
import { overlay } from '@open-reloading/core'
import {
  type CalibrationReference,
  type GroupFace,
  photoTypes,
  recordIdRegex,
  type SheetNote,
  type ShotGroup,
  type TargetSheet,
  type TargetSheetRecord,
  targetSheet,
  type UserRecord,
} from '@open-reloading/schema'
import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowsIn,
  ArrowsOut,
  Camera,
  CaretDown,
  CaretUp,
  Check,
  Cursor,
  Eye,
  FilePlus,
  ImageBroken,
  Image as ImageIcon,
  PencilSimple,
  Plus,
  Ruler,
  Target,
  Trash,
} from '@phosphor-icons/react'
import {
  type CSSProperties,
  type Dispatch,
  type KeyboardEvent,
  type ReactElement,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useCallback,
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { flushSync } from 'react-dom'
import { z } from 'zod'
import { useTranslation } from '../i18n/language.ts'
import { decimalMark, fixedNumber, formatNumber, plainNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { storageName } from '../lib/edition.ts'
import { isFaceId } from '../lib/face-records.ts'
import { calibrateSheetOnFace } from '../lib/face-sheet.ts'
import { typedFieldValue } from '../lib/field-spec.ts'
import { clickOptions, freeId } from '../lib/firearm.ts'
import { type Interval, keyReadouts, readouts, statLines } from '../lib/group-readouts.ts'
import { editHistory, type History, historyOf, pushHistory, redo, undo } from '../lib/history.ts'
import { newId } from '../lib/new-id.ts'
import { nth } from '../lib/nth.ts'
import { shortcutAriaKeys, shortcutLabel, shortcutMatches } from '../lib/shortcuts.ts'
import {
  clicksToAim,
  compassNames,
  frameOf,
  groupColours,
  ladderExtremeSpreads,
  newGroup,
  offsetAngles,
  rebase,
  turnSheet,
  viewToTarget,
  withGroup,
  withoutRegions,
} from '../lib/target-editor.ts'
import { type Point, turnedBox } from '../lib/target-geometry.ts'
import { groupStatisticsOf } from '../lib/target-groups.ts'
import { controlSize, tipEvents } from '../lib/theme.ts'
import { formatQuantity, unitsOf, withUnit } from '../lib/units.ts'
import { canonicalJson, validRecords } from '../lib/user-data.ts'
import {
  deletePhoto,
  deleteRecord,
  putPhoto,
  putRecordIf,
  putRecords,
  requestPersistentStorage,
  storedPhoto,
  storedPhotoIds,
  storedRecord,
  storedRecords,
} from '../lib/user-store.ts'
import {
  keptCopy,
  keptNote,
  mergeWaitingCopies,
  withoutWaitingCopy,
} from '../lib/waiting-copies.ts'
import { confirmDialog, offered, offerUndo } from './confirm.tsx'
import { FileMenu, FileMenuPlaceholder } from './file-menu.tsx'
import { useHoleDetection } from './hole-detection.tsx'
import { LazyLineChart } from './lazy-chart.tsx'
import { PageBar } from './page-bar.tsx'
import { usePopoverReturn } from './popover-return.ts'
import { usePrintEvents } from './print.ts'
import { helpOf } from './property-grid.tsx'
import { PrintButton } from './record-actions.tsx'
import { useSheetReport } from './report-host.ts'
import { scoredOnly, scoreLine, shotText, useRingScoring } from './ring-scoring.tsx'
import { useScrollFocus } from './scroll-region.tsx'
import { useShortcuts } from './shortcuts.tsx'
import { SiField } from './si-field.tsx'
import {
  type Overlay,
  overlayHelp,
  overlayNames,
  refPoints,
  type Selection,
  TargetCanvas,
  type Tool,
  toolPoints,
} from './target-canvas.tsx'
import { ExportMenu, StatsBlock, type StillCanvas, type ViewRef } from './target-export.tsx'
import { NotesLayer, NotesPanel } from './target-notes.tsx'
import { type LoadSummary, printTargetSheet, TargetPrint } from './target-print.tsx'
import { useUnits } from './units-settings.tsx'

type Photo = { url: string; width: number; height: number }
type RefKind = CalibrationReference['kind']

const lastSheet = storageName('target-sheet-last')
/** Copies of the sheets whose save had not landed when the page went. */
const waitingCopy = storageName('target-sheet-waiting')
/** A sheet to save, with the `saved` of the stored version it was edited from (none: a new sheet). */
type WaitingRecord = TargetSheetRecord & { base?: string | undefined }

/** The copies kept now, of every tab of this browser. */
function storedCopies(): WaitingRecord[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(waitingCopy) ?? '[]')
    // validated when restored; here only what the merge reads
    return Array.isArray(list)
      ? list.filter((r) => typeof r?.id === 'string' && typeof r?.saved === 'string')
      : []
  } catch {
    return []
  }
}

/** Keeps `records` with the copies of other tabs, the newer of each sheet. */
function keepCopies(records: WaitingRecord[]) {
  try {
    localStorage.setItem(waitingCopy, JSON.stringify(mergeWaitingCopies(storedCopies(), records)))
  } catch {}
}

/** Deletes a stored file; a refusal leaves it. */
const discardFile = (id: string) => {
  void deletePhoto(id).catch(() => {})
}

/** The copies without sheet `id` up to its save `saved` that landed; without `saved` (a delete), all. */
function dropCopy(id: string, saved?: string) {
  try {
    const left = withoutWaitingCopy(storedCopies(), id, saved)
    if (left.length) localStorage.setItem(waitingCopy, JSON.stringify(left))
    else localStorage.removeItem(waitingCopy)
  } catch {}
}
const overlayKey = storageName('target-overlays')
const defaultOverlays: Record<Overlay, boolean> = {
  spread: true,
  box: false,
  aim: true,
  ellipses: false,
  dispersion: false,
  axis: false,
  excluded: false,
  numbers: true,
  stats: false,
  rings: true,
}

const refNames: Record<RefKind, Message> = {
  line: msg('Line'),
  ringCentre: msg('Ring, center and edge'),
  ringEdge: msg('Ring, three points'),
  rectangle: msg('Rectangle, four corners'),
}
const refHints: Record<RefKind, Message> = {
  line: msg('Click both ends of a known length.'),
  ringCentre: msg('Click the ring center, then a point on the ring.'),
  ringEdge: msg('Click three points on the ring.'),
  rectangle: msg('Click the corners: top left, top right, bottom right, bottom left.'),
}

/** A new sheet: one group at `distance` m, of ladder step `step` when the load has a ladder. */
const blank = (
  load: string | undefined,
  marker: number | undefined,
  distance: number,
  step?: number | undefined,
): TargetSheet => {
  const g = newGroup({ references: [], targetRotation: 0, groups: [] }, 'g1', distance)
  return {
    references: [],
    targetRotation: 0,
    groups: [step === undefined ? g : { ...g, ladderStep: step }],
    ...(load !== undefined && { load }),
    ...(marker !== undefined && { markerDiameter: marker }),
  }
}

/**
 * The face and event of `/groups?face=<id>&event=<event id>` (Open in shot groups of a face or a
 * discipline page), which opens a new sheet on them; none in the workbench tab (no `heading`) or
 * for a malformed id. An event name longer than any record's or with control characters is left out.
 */
function linkedFace(heading: string | undefined) {
  const url = new URL(window.location.href)
  const id = heading ? url.searchParams.get('face') : null
  if (!id) return
  const event = url.searchParams.get('event')
  // used once: a reload opens the sheet saved since, not another new one
  url.searchParams.delete('face')
  url.searchParams.delete('event')
  window.history.replaceState(window.history.state, '', url)
  if (!recordIdRegex.test(id)) return
  // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what it rejects
  return event && event.length <= 200 && !/[\u0000-\u001f]/.test(event) ? { id, event } : { id }
}

/** The stored switches; a stored value that is not a known switch's true or false is left out. */
function readOverlays(): Record<Overlay, boolean> {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(overlayKey) ?? '{}')
    const flags = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
    return Object.fromEntries(
      Object.entries(defaultOverlays).map(([k, v]) => [
        k,
        typeof flags[k] === 'boolean' ? flags[k] : v,
      ]),
    ) as Record<Overlay, boolean>
  } catch {
    return defaultOverlays
  }
}

async function photoOf(blob: Blob): Promise<Photo> {
  const url = URL.createObjectURL(blob)
  const img = new Image()
  img.src = url
  try {
    await img.decode()
  } catch (e) {
    URL.revokeObjectURL(url)
    throw e
  }
  return { url, width: img.naturalWidth, height: img.naturalHeight }
}

let restoring: Promise<string[]> | undefined
/** Once per page load, also when an effect runs twice: the copy is the last page's. */
const restoreWaiting = (t: Translator['t']) => (restoring ??= restoreCopy(t))

/**
 * The sheets the last page left unsaved, each stored over the version it was edited from; a sheet
 * another tab saved since stays and the copy is kept as a sheet of its own (the names returned). A
 * copy is dropped once stored, so a failed write keeps it for the next page.
 */
async function restoreCopy(t: Translator['t']) {
  const kept: string[] = []
  let raw: string | null = null
  try {
    raw = localStorage.getItem(waitingCopy)
  } catch {}
  if (!raw) return kept
  let copies: { copy: TargetSheetRecord; base?: string | undefined }[] = []
  try {
    const list: unknown = JSON.parse(raw)
    copies = (Array.isArray(list) ? list : []).flatMap((item) => {
      // the schema drops `base`: read next to the record
      const [copy] = validRecords([item]).records
      const base = (item as { base?: unknown | undefined } | null)?.base
      return copy?.kind === 'targetSheet'
        ? [{ copy, ...(typeof base === 'string' && { base }) }]
        : []
    })
  } catch {}
  for (const { copy, base } of copies) {
    const stored = await storedRecord(copy.id).catch(() => undefined)
    // its save landed while the page went
    const landed =
      stored?.name === copy.name && canonicalJson(stored.data) === canonicalJson(copy.data)
    if (!landed && !(await putRecordIf(copy, base))) {
      const own = keptCopy(copy, newId(), t)
      await putRecords([own])
      kept.push(own.name)
    }
    dropCopy(copy.id, copy.saved)
  }
  return kept
}

/** Names of the group colours (`groupColours`), for the swatches' accessible names. */
const colourNames = [
  msg('Orange'),
  msg('Blue'),
  msg('Green'),
  msg('Ochre'),
  msg('Pink'),
  msg('Dark green'),
]

/** The compass words of an aim offset as shown in the offset row. */
const compassLabels: Record<keyof typeof compassNames, Message> = {
  N: msg('N'),
  NE: msg('NE'),
  E: msg('E'),
  SE: msg('SE'),
  S: msg('S'),
  SW: msg('SW'),
  W: msg('W'),
  NW: msg('NW'),
  centre: msg('center'),
}

/** Above this many shots the shot table renders only the rows in view. */
const windowFrom = 100

/** A toolbar icon button; its label is its name and its hover text. */
function IconButton({
  label,
  disabled,
  onClick,
  children,
  ...rest
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  children: ReactNode
  'data-expand'?: boolean
  'data-rename'?: boolean
  'aria-keyshortcuts'?: string
}) {
  return (
    <Tooltip label={label} multiline maw={260} events={tipEvents}>
      <ActionIcon
        variant="default"
        aria-label={label}
        {...(disabled !== undefined && { disabled })}
        onClick={onClick}
        {...rest}
      >
        <span className="icon-slot" aria-hidden="true">
          {children}
        </span>
      </ActionIcon>
    </Tooltip>
  )
}

/** A coordinate cell of the shot table: the typed text while focused, the value's text otherwise. */
function CoordInput({
  label,
  si,
  onCommit,
  disabled,
}: {
  label: string
  si: number | undefined
  onCommit: (si: number) => void
  disabled?: boolean
}) {
  const { system } = useUnits()
  const [draft, setDraft] = useState<string>()
  const len = system.length
  return (
    <input
      // a native number input reads and writes the point only
      {...(decimalMark() === '.' ? { type: 'number', step: 'any' } : { type: 'text' })}
      aria-label={label}
      disabled={disabled}
      value={draft ?? (si === undefined ? '' : formatNumber(len.fromSi(si), len.decimals))}
      onChange={(e) => {
        const text = e.currentTarget.value
        setDraft(text)
        const v = typedFieldValue('length', system, text).si
        if (v !== undefined) onCommit(v)
      }}
      onBlur={() => setDraft(undefined)}
    />
  )
}

/** A labelled row of the property grid that is not a field. */
function Row({
  label,
  help,
  children,
}: {
  label: string
  help?: string | undefined
  children: ReactNode
}) {
  return (
    <div className="prop-row">
      <span className="prop-label" title={help}>
        {label}
      </span>
      <span className="prop-value">{children}</span>
    </div>
  )
}

/** The rows of a long shot table in view, at a fixed row height. */
function shotWindowOf(
  shotCount: number,
  coarse: boolean | undefined,
  shotScroll: { top: number; height: number },
) {
  const rowHeight = coarse ? 44 : 24
  const windowed = shotCount > windowFrom
  const inView = Math.ceil(shotScroll.height / rowHeight)
  const firstRow = windowed
    ? Math.max(0, Math.min(Math.floor(shotScroll.top / rowHeight), shotCount - inView) - 10)
    : 0
  const lastRow = windowed ? Math.min(shotCount, firstRow + inView + 20) : shotCount
  return { rowHeight, windowed, firstRow, lastRow, shotCount }
}

type Meta = { id: string; name: string }
type Pop = 'photo' | 'calibrate' | 'overlays'
type Kept = 'failed' | 'saving' | 'saved' | 'blank'
type System = ReturnType<typeof useUnits>['system']
type Apply = (f: (s: TargetSheet) => TargetSheet, key?: string) => void
type Frame = ReturnType<typeof frameOf>
type Stats = NonNullable<ReturnType<typeof groupStatisticsOf>>
type GroupScore = ReturnType<typeof scoredOnly>
type Score = ReturnType<typeof useRingScoring>
type ShotAt = (
  sel: Selection,
  f: (s: ShotGroup['shots'][number]) => ShotGroup['shots'][number] | undefined,
  key?: string | undefined,
) => void

/** What the editor's panels read and call; one object per render. */
type Ed = {
  sheet: TargetSheet
  group: ShotGroup | undefined
  frame: Frame
  system: System
  compact: boolean
  tool: Tool
  startTool: (t: Tool) => void
  apply: Apply
  applyCal: Apply
  onGroup: (f: (g: ShotGroup) => ShotGroup, key?: string) => void
  root: RefObject<HTMLDivElement | null>
  score: Score
  groupScore: GroupScore | undefined
  stats: Stats | undefined
  keyValues: ReturnType<typeof readouts>
  charges: number[] | undefined
  stepLabels: string[] | undefined
  step: number | undefined
  uid: string
  filter: { contrast: number; darken: number }
  setFilter: (f: { contrast: number; darken: number }) => void
  refKind: RefKind
  setRefKind: (k: RefKind) => void
  known: { length?: number | undefined; width?: number | undefined; height?: number | undefined }
  setKnown: (k: {
    length?: number | undefined
    width?: number | undefined
    height?: number | undefined
  }) => void
  calTool: (which: string, t: Tool) => void
  newDistance: { current: number }
  setActive: (id: string | undefined) => void
  setSelected: (s: Selection | undefined) => void
  deleteGroup: () => void
  scrollFocus: ReturnType<typeof useScrollFocus<HTMLDivElement>>
  shotWindow: ReturnType<typeof shotWindowOf>
  setShotScroll: (s: { top: number; height: number }) => void
  selected: Selection | undefined
  shotAt: ShotAt
  toggle: (sel: Selection) => void
  remove: (sel: Selection) => void
  optic: { label: string; click: number } | undefined
  options: ReturnType<typeof clickOptions>
  opticChoice: string
  setOpticChoice: (v: string) => void
  click: { label: string; click: number } | undefined
  ladderRows: ReturnType<typeof ladderExtremeSpreads>
  meta: Meta
  setMeta: Dispatch<SetStateAction<Meta>>
  stored: boolean
  sheets: TargetSheetRecord[]
  setSheets: Dispatch<SetStateAction<TargetSheetRecord[]>>
  open: (r: TargetSheetRecord) => void
  create: () => void
  deleteSheet: () => Promise<void>
  renaming: boolean
  setRenaming: (on: boolean) => void
  fileInput: RefObject<HTMLInputElement | null>
  cameraInput: RefObject<HTMLInputElement | null>
  takePhoto: (file: File | undefined) => Promise<void>
  removePhoto: () => Promise<void>
  coarse: boolean
  pop: Pop | undefined
  setPop: Dispatch<SetStateAction<Pop | undefined>>
  storeError: { reason: string } | undefined
  h: History<TargetSheet>
  setH: Dispatch<SetStateAction<History<TargetSheet>>>
  overlays: Record<Overlay, boolean>
  toggleOverlay: (o: Overlay, on: boolean) => void
  heading: string | undefined
  exportMenu: ReactNode
  expand: { expanded: boolean; onChange: (expanded: boolean) => void } | undefined
  toolbarKeys: (e: KeyboardEvent<HTMLDivElement>) => void
  unscaled: boolean
  photo: Photo | 'missing' | undefined
  pending: Point[]
  describe: (sel: Selection) => string
  addShot: (q: Point) => void
  dragKey: { current: number }
  onPoint: (p: Point) => void
  view: ViewRef
  detect: ReturnType<typeof useHoleDetection>
  layer: (k: number) => ReactNode
  hint: string
  help: string | undefined
  blankSheet: boolean
  startActions: (size: 'xs' | 'sm') => ReactNode
  shotsOpen: boolean
  setShotsOpen: Dispatch<SetStateAction<boolean>>
  notesPanel: ReactNode
  side: string | null
  setSide: (side: string | null) => void
  panel: string
  wide: boolean
  phone: boolean
  sheetOpen: boolean
  setSheetOpen: Dispatch<SetStateAction<boolean>>
  fileData: TargetSheet
  kept: Kept
  storeFromMenu: (record: TargetSheetRecord) => Promise<boolean>
  reloadStored: () => void
  printSheet: () => Promise<void>
}

/** The photo's display filters: contrast and darken. */
function FilterPanel({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { sheet, filter, setFilter } = ed
  return (
    <div className="prop-grid">
      <Row label={t('Contrast')} help={t('Display only; the photo file stays as it is.')}>
        <Slider
          size="sm"
          min={0.5}
          max={3}
          step={0.1}
          disabled={!sheet.photo}
          value={filter.contrast}
          onChange={(v) => setFilter({ ...filter, contrast: v })}
          thumbLabel={t('Contrast')}
          label={(v) => fixedNumber(v, 1)}
        />
      </Row>
      <Row label={t('Darken')} help={t('Display only; the photo file stays as it is.')}>
        <Slider
          size="sm"
          min={0}
          max={0.8}
          step={0.05}
          disabled={!sheet.photo}
          value={filter.darken}
          onChange={(v) => setFilter({ ...filter, darken: v })}
          thumbLabel={t('Darken')}
          label={(v) => `${plainNumber(Math.round(v * 100))} %`}
        />
      </Row>
    </div>
  )
}

/** The shot marker's diameter. */
function MarkerField({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { sheet, apply } = ed
  return (
    <div className="prop-grid">
      <SiField
        spec={{
          key: 'markerDiameter',
          label: msg('Marker'),
          help: msg(
            'Diameter of the shot marks; the bullet diameter centers a mark on a torn hole. Empty: a fixed size on screen.',
          ),
          quantity: 'length',
          min: 0,
          positive: true,
        }}
        si={sheet.markerDiameter}
        onCommit={(si) =>
          apply(
            ({ markerDiameter: _, ...s }) => (si === undefined ? s : { ...s, markerDiameter: si }),
            'markerDiameter',
          )
        }
        placeholder={t('screen size')}
      />
    </div>
  )
}

/** One scale reference of a photo: its known size and Remove. */
function ReferenceRow({ ed, r, i }: { ed: Ed; r: TargetSheet['references'][number]; i: number }) {
  const { t } = useTranslation()
  const { sheet, frame, applyCal } = ed
  const cal = frame?.calibration
  const factor = cal?.factors[i]
  const dev = cal && factor !== undefined ? factor / cal.scale - 1 : undefined
  const label = t('{kind} {n}', { kind: t(refNames[r.kind]).split(',')[0] ?? '', n: i + 1 })
  const help =
    dev === undefined || sheet.references.length < 2
      ? t(refNames[r.kind])
      : t('{kind}; scale {deviation} % from the mean', {
          kind: t(refNames[r.kind]),
          deviation: `${dev >= 0 ? '+' : ''}${fixedNumber(dev * 100, 2)}`,
        })
  const key = r.kind === 'line' ? 'length' : r.kind === 'rectangle' ? 'width' : 'diameter'
  const value = (r as Record<string, unknown>)[key] as number
  return (
    <div className="ref-row">
      <SiField
        spec={{
          key: `ref${i}`,
          label,
          help,
          quantity: 'length',
          min: 0,
          positive: true,
          required: true,
        }}
        si={value}
        onCommit={(si) =>
          si &&
          applyCal(
            (s) => ({
              ...s,
              references: s.references.map((x, j) => (j === i ? { ...x, [key]: si } : x)),
            }),
            `ref${i}`,
          )
        }
      />
      <ActionIcon
        variant="subtle"
        size={controlSize.row.icon}
        aria-label={t('Remove {label}', { label })}
        disabled={sheet.references.length === 1 && sheet.groups.some((g) => g.shots.length)}
        title={
          sheet.references.length === 1 && sheet.groups.some((g) => g.shots.length)
            ? t('The last reference stays while there are shots.')
            : undefined
        }
        onClick={() =>
          applyCal((s) => ({ ...s, references: s.references.filter((_, j) => j !== i) }))
        }
      >
        <Trash size={14} aria-hidden="true" />
      </ActionIcon>
    </div>
  )
}

/** The Calibrate panel: scale references, rotation and origin; none on a drawn target. */
function ScalePanel({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { sheet, refKind, setRefKind, known, setKnown, tool, calTool, applyCal, frame } = ed
  const cal = frame?.calibration
  if (!sheet.photo)
    return (
      <p className="note">{t('A drawn target: shots in target coordinates, no scale needed.')}</p>
    )
  return (
    <div className="prop-grid">
      <NativeSelect
        label={t('Reference')}
        size={controlSize.row.input}
        data={Object.entries(refNames).map(([value, label]) => ({ value, label: t(label) }))}
        value={refKind}
        onChange={(e) => setRefKind(e.currentTarget.value as RefKind)}
        title={t(refHints[refKind])}
      />
      {refKind === 'rectangle' ? (
        <>
          <SiField
            spec={{ key: 'w', label: msg('Width'), quantity: 'length', min: 0, positive: true }}
            si={known.width}
            onCommit={(si) => setKnown({ ...known, width: si })}
          />
          <SiField
            spec={{ key: 'h', label: msg('Height'), quantity: 'length', min: 0, positive: true }}
            si={known.height}
            onCommit={(si) => setKnown({ ...known, height: si })}
          />
        </>
      ) : (
        <SiField
          spec={{
            key: 'len',
            label: refKind === 'line' ? msg('Known length') : msg('Ring diameter'),
            quantity: 'length',
            min: 0,
            positive: true,
          }}
          si={known.length}
          onCommit={(si) => setKnown({ ...known, length: si })}
        />
      )}
      <Button
        size={controlSize.row.button}
        variant={toolPoints[tool] ? 'filled' : 'default'}
        className="wide"
        data-cal="mark"
        disabled={refKind === 'rectangle' ? !(known.width && known.height) : !known.length}
        onClick={() => calTool('mark', refKind)}
        title={t(refHints[refKind])}
      >
        {t('Mark on photo')}
      </Button>
      {sheet.references.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: references keep their order
        <ReferenceRow key={i} ed={ed} r={r} i={i} />
      ))}
      {sheet.references.length > 1 && cal && (
        <Row
          label={t('Spread')}
          help={t(
            'Largest minus smallest scale of the references over their mean: how far they disagree. A photo at an angle shows here; a rectangle corrects it.',
          )}
        >
          {fixedNumber(cal.spread * 100, 2)} %
        </Row>
      )}
      <SiField
        spec={{
          key: 'targetRotation',
          label: msg('Rotation'),
          help: msg(
            "Angle of the target's x axis on the photo, counter-clockwise. Shots stay on their holes.",
          ),
          quantity: 'angle',
        }}
        si={sheet.targetRotation}
        onCommit={(si) => applyCal((s) => ({ ...s, targetRotation: si ?? 0 }), 'targetRotation')}
      />
      <Row
        label={t('Origin point')}
        help={t('The photo point of target (0, 0). Shots stay on their holes.')}
      >
        <Button
          size={controlSize.row.button}
          variant={tool === 'origin' ? 'filled' : 'default'}
          data-cal="origin"
          onClick={() => calTool('origin', 'origin')}
        >
          {t('Set on photo')}
        </Button>
      </Row>
    </div>
  )
}

/** The colours offered: the series colours and a stored colour that is not one of them. */
function coloursOf(group: ShotGroup | undefined, t: Translator['t']) {
  if (!group) return []
  return [
    ...groupColours.map((c, i) => {
      const name = colourNames[i]
      return { value: c, label: name ? t(name) : c }
    }),
    ...(groupColours.includes(group.colour)
      ? []
      : [{ value: group.colour, label: t('Color {color}', { color: group.colour }) }]),
  ]
}

/** The active group's settings: name, color, distance, ladder step, point of aim and score. */
function GroupPanel({ ed }: { ed: Ed }) {
  const {
    sheet,
    group,
    system,
    frame,
    tool,
    startTool,
    apply,
    onGroup,
    score,
    charges,
    stepLabels,
    step,
    uid,
    newDistance,
    setActive,
    setSelected,
    deleteGroup,
  } = ed
  const { t } = useTranslation()
  const len = system.length
  const colours = coloursOf(group, t)
  return (
    <div className="prop-grid">
      {/* above the list: a delete that shortens the list moves neither button (a double click
          deletes two groups) */}
      <span className="row-buttons wide group-actions">
        <Button
          size={controlSize.row.button}
          variant="default"
          leftSection={<Plus size={12} aria-hidden="true" />}
          disabled={sheet.groups.length >= 50}
          onClick={() => {
            const g = newGroup(
              sheet,
              freeId(
                'g',
                sheet.groups.map((x) => x.id),
              ),
              group?.distance ?? newDistance.current,
            )
            const linked = charges && step !== undefined ? { ...g, ladderStep: step } : g
            apply((s) => ({ ...s, groups: [...s.groups, linked] }))
            setActive(g.id)
          }}
        >
          {t('Add group')}
        </Button>
        <Button
          size={controlSize.row.button}
          variant="default"
          color="red"
          title={t('Delete the active group; Undo brings it back')}
          disabled={!group || sheet.groups.length < 2}
          onClick={deleteGroup}
        >
          {t('Delete')}
        </Button>
      </span>
      <div className="wide">
        <Radio.Group
          label={t('Groups')}
          labelProps={{ className: 'visually-hidden' }}
          name={`${uid}-group`}
          value={group?.id ?? ''}
          onChange={(id) => {
            setActive(id)
            setSelected(undefined)
          }}
        >
          <div className="group-list">
            {sheet.groups.map((g) => (
              <Radio.Card key={g.id} value={g.id} className="group-item" withBorder={false}>
                <span className="swatch" style={{ background: g.colour }} aria-hidden="true" />
                <span className="group-name">{g.name}</span>
                <span className="group-count">
                  {plainNumber(g.shots.filter((s) => !s.excluded).length)}
                  {g.shots.some((s) => s.excluded)
                    ? `+${plainNumber(g.shots.filter((s) => s.excluded).length)}`
                    : ''}
                </span>
              </Radio.Card>
            ))}
          </div>
        </Radio.Group>
      </div>
      {group && (
        <>
          <TextInput
            label={t('Group name')}
            size={controlSize.row.input}
            value={group.name}
            maxLength={200}
            error={group.name ? undefined : t('Enter a name.')}
            onChange={(e) => {
              const name = e.currentTarget.value
              onGroup((g) => ({ ...g, name }), `name ${group.id}`)
            }}
          />
          <Radio.Group
            label={t('Color')}
            className="colour-row"
            size={controlSize.row.input}
            name={`${uid}-colour`}
            value={group.colour}
            onChange={(colour) => onGroup((g) => ({ ...g, colour }), `colour ${group.id}`)}
          >
            <Flex wrap="wrap" justify="flex-end">
              {colours.map((c) => (
                <Radio.Card
                  key={c.value}
                  value={c.value}
                  aria-label={c.label}
                  title={c.label}
                  className="swatch-card"
                  withBorder={false}
                >
                  <ColorSwatch component="span" color={c.value} size={16}>
                    {c.value === group.colour && (
                      <Check size={10} color="#fff" aria-hidden="true" />
                    )}
                  </ColorSwatch>
                </Radio.Card>
              ))}
            </Flex>
          </Radio.Group>
          <SiField
            spec={{
              key: 'distance',
              label: msg('Distance'),
              help: msg('Muzzle to target; the angles use it.'),
              quantity: 'range',
              min: 0,
              positive: true,
              required: true,
            }}
            si={group.distance}
            onCommit={(si) =>
              si && onGroup((g) => ({ ...g, distance: si }), `distance ${group.id}`)
            }
          />
          {charges && (
            <NativeSelect
              label={t('Ladder step')}
              size={controlSize.row.input}
              data={[
                { value: '', label: t('None') },
                ...charges.map((c, i) => ({
                  value: String(i),
                  label: t('{step}: {charge}', {
                    step: stepLabels?.[i] ?? i + 1,
                    charge: withUnit('charge', system, c),
                  }),
                })),
              ]}
              value={group.ladderStep === undefined ? '' : String(group.ladderStep)}
              onChange={(e) => {
                const v = e.currentTarget.value
                onGroup(({ ladderStep: _, ...g }) =>
                  v === '' ? g : { ...g, ladderStep: Number(v) },
                )
              }}
            />
          )}
          <div className="prop-row aim-row">
            <span
              className="prop-label"
              title={t(
                'Point of aim, each group its own: Set, then click it on the target, or type x and y in target coordinates; drag it with Select.',
              )}
            >
              {t('Aim ({unit})', { unit: len.symbol })}
            </span>
            <span className="prop-value row-buttons aim-fields">
              <Button
                size={controlSize.row.button}
                variant={tool === 'aim' ? 'filled' : 'default'}
                disabled={!frame}
                onClick={() => startTool('aim')}
              >
                {t('Set')}
              </Button>
              <Button
                size={controlSize.row.button}
                variant="default"
                disabled={!group.aim}
                onClick={() => onGroup(({ aim: _, ...g }) => g)}
              >
                {t('Clear')}
              </Button>
              {(['x', 'y'] as const).map((axis) => (
                <span key={axis} className="aim-axis">
                  <span aria-hidden="true">{axis}</span>
                  <CoordInput
                    label={t('Point of aim {axis}', { axis })}
                    si={group.aim?.[axis]}
                    disabled={!frame}
                    onCommit={(v) =>
                      onGroup(
                        (g) => ({ ...g, aim: { x: 0, y: 0, ...g.aim, [axis]: v } }),
                        `aim ${group.id}:${axis}`,
                      )
                    }
                  />
                </span>
              ))}
            </span>
          </div>
          {score.panel}
        </>
      )}
    </div>
  )
}

/** The add shot button of the shots panel's head. */
function AddShotButton({ ed, addShot }: { ed: Ed; addShot: (q: Point) => void }) {
  const { t } = useTranslation()
  const { group, frame, root } = ed
  if (!group) return null
  return (
    <Button
      size={controlSize.row.button}
      variant="default"
      leftSection={<Plus size={12} aria-hidden="true" />}
      disabled={!frame || group.shots.length >= 1000}
      onClick={() => {
        addShot(group.aim ?? { x: 0, y: 0 })
        // the new shot takes the focus, so Alt and the arrow keys move it at once
        const at = `${group.id} ${group.shots.length}`
        requestAnimationFrame(() =>
          root.current?.querySelector<SVGElement>(`[data-shot="${CSS.escape(at)}"]`)?.focus(),
        )
      }}
      title={t(
        'A shot at the point of aim (or the origin); move it with Alt and the arrow keys or the fields.',
      )}
    >
      {t('Add shot')}
    </Button>
  )
}

/** The shot table of the active group; a long group renders the rows in view only. */
function ShotsPanel({ ed }: { ed: Ed }) {
  const {
    group,
    system,
    compact,
    groupScore,
    score,
    scrollFocus,
    shotWindow,
    setShotScroll,
    selected,
    shotAt,
    toggle,
    remove,
  } = ed
  const { t } = useTranslation()
  if (!group) return null
  const len = system.length
  const { windowed, firstRow, lastRow, rowHeight, shotCount } = shotWindow
  return (
    <div className="shots-panel">
      <div
        className="scroll shots-scroll"
        {...scrollFocus}
        onScroll={(e) =>
          windowed &&
          setShotScroll({ top: e.currentTarget.scrollTop, height: e.currentTarget.clientHeight })
        }
      >
        {/* the rows out of view of a long group are room only */}
        <div
          style={
            windowed
              ? {
                  paddingTop: firstRow * rowHeight,
                  paddingBottom: (shotCount - lastRow) * rowHeight,
                }
              : undefined
          }
        >
          <Table
            className="shot-table"
            withRowBorders
            horizontalSpacing={4}
            verticalSpacing={0}
            stickyHeader
          >
            <Table.Thead>
              <Table.Tr>
                <Table.Th scope="col">#</Table.Th>
                <Table.Th scope="col">x ({len.symbol})</Table.Th>
                <Table.Th scope="col">y ({len.symbol})</Table.Th>
                {group.face && (
                  <Table.Th
                    scope="col"
                    title={`${t('Ring value, with tenths where the target has them; X: inner ten. Excluded shots show their value and do not count in the total.')}${groupScore?.usesOwnTenthRule ? ` ${score.ownRuleNote}` : ''}`}
                  >
                    {t('Score')}
                  </Table.Th>
                )}
                <Table.Th
                  scope="col"
                  title={t('Excluded: left out of the statistics, still shown and counted')}
                >
                  {t('Excl.')}
                </Table.Th>
                {!compact && (
                  <Table.Th scope="col">
                    <span className="visually-hidden">{t('Delete')}</span>
                  </Table.Th>
                )}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {group.shots.slice(firstRow, lastRow).map((s, j) => {
                const i = firstRow + j
                const sel = { group: group.id, index: i }
                const coord = (axis: 'x' | 'y') => (
                  <CoordInput
                    label={t('Shot {n} {axis}', { n: i + 1, axis })}
                    si={s[axis]}
                    onCommit={(v) =>
                      shotAt(sel, (x) => ({ ...x, [axis]: v }), `${group.id}:${axis}:${i}`)
                    }
                  />
                )
                return (
                  <Table.Tr
                    key={i}
                    data-selected={
                      (selected?.group === group.id && selected.index === i) || undefined
                    }
                  >
                    <Table.Th scope="row">{plainNumber(i + 1)}</Table.Th>
                    <Table.Td>{coord('x')}</Table.Td>
                    <Table.Td>{coord('y')}</Table.Td>
                    {group.face && (
                      <Table.Td>
                        {groupScore ? shotText(nth(groupScore.score.shots, i)) : '…'}
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Checkbox
                        size="xs"
                        aria-label={t('Exclude shot {n}', { n: i + 1 })}
                        checked={!!s.excluded}
                        onChange={() => toggle(sel)}
                      />
                    </Table.Td>
                    {!compact && (
                      <Table.Td>
                        <ActionIcon
                          variant="subtle"
                          size={controlSize.row.icon}
                          aria-label={t('Delete shot {n}', { n: i + 1 })}
                          onClick={() => remove(sel)}
                        >
                          <Trash size={14} aria-hidden="true" />
                        </ActionIcon>
                      </Table.Td>
                    )}
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </div>
      </div>
    </div>
  )
}

/** The statistics of the active group: score, key values, offset and the clicks to the point of aim. */
function StatsPanel({ ed }: { ed: Ed }) {
  const {
    group,
    stats,
    system,
    compact,
    groupScore,
    score,
    keyValues,
    optic,
    options,
    opticChoice,
    setOpticChoice,
    click,
  } = ed
  const { t } = useTranslation()
  if (!group || !stats) return null
  const len = system.length
  const offset = stats.aimOffset
  const moa = unitsOf.correction.MOA
  const mrad = unitsOf.correction.mrad
  const angles = (a: number) => [
    formatNumber(moa.fromSi(a), moa.decimals),
    formatNumber(mrad.fromSi(a), mrad.decimals),
  ]
  return (
    <div className="stats-panel">
      <Table className="readout-table" withRowBorders horizontalSpacing={4} verticalSpacing={0}>
        <caption className="visually-hidden">
          {t('Statistics of {name}', { name: group.name })}
        </caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">
              <span className="visually-hidden">{t('Value')}</span>
            </Table.Th>
            <Table.Th scope="col">{len.symbol}</Table.Th>
            <Table.Th scope="col">MOA</Table.Th>
            <Table.Th scope="col">mrad</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          <Table.Tr>
            <Table.Th
              scope="row"
              title={t(
                'Shots in the statistics; excluded shots are shown and counted, not measured.',
              )}
            >
              {t('Shots')}
            </Table.Th>
            <Table.Td colSpan={3}>
              {stats.excludedCount
                ? t('{count} ({excluded} excluded)', {
                    count: stats.shotCount,
                    excluded: stats.excludedCount,
                  })
                : plainNumber(stats.shotCount)}
            </Table.Td>
          </Table.Tr>
          {group.face && (
            <>
              <Table.Tr>
                <Table.Th
                  scope="row"
                  title={`${t('Sum of the ring values of the included shots, the decimal sum in brackets; excluded shots do not count.')}${groupScore?.usesOwnTenthRule ? ` ${score.ownRuleNote}` : ''}`}
                >
                  {t('Score')}
                </Table.Th>
                <Table.Td colSpan={3}>
                  {groupScore
                    ? `${plainNumber(groupScore.score.total)}${groupScore.score.decimalTotal !== undefined ? ` (${fixedNumber(groupScore.score.decimalTotal, 1)})` : ''}`
                    : t('n/a')}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Th scope="row" title={t('Inner tens (X) among the included shots.')}>
                  {t('Inner tens')}
                </Table.Th>
                <Table.Td colSpan={3}>
                  {groupScore ? plainNumber(groupScore.score.innerTenCount) : t('n/a')}
                </Table.Td>
              </Table.Tr>
            </>
          )}
          {keyValues
            .filter((r) => !compact || keyReadouts.includes(r.key))
            .map((r) => {
              const [a, b] = angles(r.angle)
              const range = (iv: Interval) =>
                t('{level} % interval {lower} to {upper} {unit} ({df} degrees of freedom)', {
                  level: Math.round(iv.level * 100),
                  lower: formatQuantity('length', system, iv.lower),
                  upper: formatQuantity('length', system, iv.upper),
                  unit: len.symbol,
                  df: iv.degreesOfFreedom,
                })
              const c = r.circular
              const estimate = c && formatQuantity('length', system, c.value)
              const title = [
                t(r.help),
                r.interval &&
                  ` ${
                    r.interval.circular
                      ? t('{interval}; assumes circular spread.', { interval: range(r.interval) })
                      : t('{interval}.', { interval: range(r.interval) })
                  }`,
                c &&
                  ` ${
                    c.interval
                      ? t(
                          'Circular estimate {value} {unit}, {interval}; assumes circular spread.',
                          {
                            value: estimate ?? '',
                            unit: len.symbol,
                            interval: range(c.interval),
                          },
                        )
                      : t('Circular estimate {value} {unit}; assumes circular spread.', {
                          value: estimate ?? '',
                          unit: len.symbol,
                        })
                  }`,
              ].join('')
              return (
                <Table.Tr key={r.key}>
                  <Table.Th scope="row" title={title}>
                    {t(r.label)}
                  </Table.Th>
                  <Table.Td>{formatQuantity('length', system, r.value)}</Table.Td>
                  <Table.Td>{a}</Table.Td>
                  <Table.Td>{b}</Table.Td>
                </Table.Tr>
              )
            })}
          {offset && !compact && (
            <>
              <Table.Tr>
                <Table.Th scope="row" title={t('Group center from the point of aim.')}>
                  {t('Offset')}
                </Table.Th>
                <Table.Td>{formatQuantity('length', system, offset.distance)}</Table.Td>
                <Table.Td colSpan={2} title={t(compassNames[offset.compass])}>
                  {t(compassLabels[offset.compass])}
                </Table.Td>
              </Table.Tr>
              {(['x', 'y'] as const).map((axis) => {
                const d = axis === 'x' ? offset.dx : offset.dy
                const [a, b] = angles(offsetAngles(offset, group.distance)[axis])
                return (
                  <Table.Tr key={axis}>
                    <Table.Th
                      scope="row"
                      title={
                        axis === 'x'
                          ? t('Right of the point of aim: positive.')
                          : t('Above the point of aim: positive.')
                      }
                    >
                      {axis === 'x' ? t('Offset horiz.') : t('Offset vert.')}
                    </Table.Th>
                    <Table.Td>{formatQuantity('length', system, d)}</Table.Td>
                    <Table.Td>{a}</Table.Td>
                    <Table.Td>{b}</Table.Td>
                  </Table.Tr>
                )
              })}
              {click && (
                <Table.Tr>
                  <Table.Th
                    scope="row"
                    title={t(
                      'Clicks of {optic} ({mrad} mrad, {moa} MOA) that move the group center onto the point of aim.',
                      {
                        optic: click.label,
                        mrad: formatNumber(mrad.fromSi(click.click), 3),
                        moa: formatNumber(moa.fromSi(click.click), 3),
                      },
                    )}
                  >
                    {t('Clicks')}
                  </Table.Th>
                  <Table.Td colSpan={3}>
                    {(() => {
                      const c = clicksToAim(offset, group.distance, click.click)
                      const direction = {
                        left: t('left'),
                        right: t('right'),
                        up: t('up'),
                        down: t('down'),
                      }
                      return t(
                        '{horizontal} {horizontalDirection}, {vertical} {verticalDirection}',
                        {
                          horizontal: c.horizontal.clicks,
                          horizontalDirection: direction[c.horizontal.direction],
                          vertical: c.vertical.clicks,
                          verticalDirection: direction[c.vertical.direction],
                        },
                      )
                    })()}
                  </Table.Td>
                </Table.Tr>
              )}
            </>
          )}
        </Table.Tbody>
      </Table>
      {!optic && offset && !compact && options.length > 0 && (
        <NativeSelect
          size={controlSize.row.input}
          label={t('Optic for clicks')}
          data={[
            { value: '', label: t('None') },
            ...options.map((o) => ({ value: o.value, label: o.label })),
          ]}
          value={opticChoice}
          onChange={(e) => setOpticChoice(e.currentTarget.value)}
        />
      )}
    </div>
  )
}

/** A key value of the group as text with its unit; n/a without it. */
function keyValueText(keyValues: Ed['keyValues'], system: System, key: string, t: Translator['t']) {
  const r = keyValues.find((x) => x.key === key)
  return r ? `${formatQuantity('length', system, r.value)} ${system.length.symbol}` : t('n/a')
}

/** The group's count and key values in one row. */
function Headline({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { group, stats, keyValues, system } = ed
  if (!group || !stats) return null
  const keyValue = (key: string) => keyValueText(keyValues, system, key, t)
  return (
    <dl className="stat-head">
      <div>
        <dt>n</dt>
        <dd>{plainNumber(stats.shotCount)}</dd>
      </div>
      <div>
        <dt>{t('ES')}</dt>
        <dd>{keyValue('extremeSpread')}</dd>
      </div>
      <div>
        <dt>{t('Mean radius')}</dt>
        <dd>{keyValue('meanRadius')}</dd>
      </div>
      <div>
        <dt>{t('CEP')}</dt>
        <dd>{keyValue('cepElliptical')}</dd>
      </div>
    </dl>
  )
}

/** Groups per ladder step of the load: the extreme spread chart and its table. */
function LadderPanel({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { charges, ladderRows, system, stepLabels } = ed
  if (!charges) return null
  const turn = system.correction
  const oneDistance = ladderRows.every((r) => r.length !== undefined)
  const len = system.length
  return (
    <div className="ladder-groups">
      {ladderRows.length >= 2 ? (
        <LazyLineChart
          x={ladderRows.map((r) => system.charge.fromSi(r.charge))}
          y={ladderRows.map((r) => turn.fromSi(r.angle))}
          xLabel={t('Charge ({unit})', { unit: system.charge.symbol })}
          yLabel={t('Extreme spread ({unit})', { unit: turn.symbol })}
          title={t('Group extreme spread against charge')}
          description={t(
            'Mean extreme spread of the groups at each ladder step, as an angle so groups at different distances compare, against its charge; the table lists the values.',
          )}
          height={200}
        />
      ) : (
        <p className="note">
          {t('Groups at two or more ladder steps give a chart of size against charge.')}
        </p>
      )}
      <Table className="readout-table" withRowBorders horizontalSpacing={4} verticalSpacing={0}>
        <caption className="visually-hidden">{t('Groups per ladder step')}</caption>
        <Table.Thead>
          <Table.Tr>
            <Table.Th scope="col">{t('Step')}</Table.Th>
            <Table.Th scope="col">{system.charge.symbol}</Table.Th>
            <Table.Th scope="col">{t('Groups')}</Table.Th>
            <Table.Th scope="col">{t('ES ({unit})', { unit: turn.symbol })}</Table.Th>
            {oneDistance && (
              <Table.Th scope="col">{t('ES ({unit})', { unit: len.symbol })}</Table.Th>
            )}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {ladderRows.map((r) => (
            <Table.Tr key={r.step}>
              <Table.Th scope="row">{stepLabels?.[r.step] ?? plainNumber(r.step + 1)}</Table.Th>
              <Table.Td>{formatQuantity('charge', system, r.charge)}</Table.Td>
              <Table.Td>{plainNumber(r.groups)}</Table.Td>
              <Table.Td>{formatQuantity('correction', system, r.angle)}</Table.Td>
              {r.length !== undefined && (
                <Table.Td>{formatQuantity('length', system, r.length)}</Table.Td>
              )}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </div>
  )
}

/** The statistics box of the canvas and the exports: the group's name, lines and score. */
function StatsBoxContent({ ed }: { ed: Ed }) {
  const translator = useTranslation()
  const { group, stats, keyValues, system, groupScore } = ed
  if (!group || !stats) return null
  return (
    <>
      <strong>{group.name}</strong>
      {statLines(stats, keyValues, system, translator).map((line) => (
        <span key={line}>{line}</span>
      ))}
      {groupScore && (
        <span>{translator.t('Score {score}', { score: scoreLine(groupScore) ?? '' })}</span>
      )}
    </>
  )
}

/** A toolbar button with its popover `p`, its hover text off while open; `frame` wraps the popover. */
function ToolPopover({
  ed,
  p,
  tip,
  wideTip,
  name,
  description,
  icon,
  position,
  frame,
  children,
}: {
  ed: Ed
  p: Pop
  tip: ReactNode
  wideTip?: boolean
  name: string
  description?: string | undefined
  icon: ReactNode
  position?: 'bottom-start' | 'bottom-end'
  frame?: (popover: ReactNode) => ReactElement
  children: ReactNode
}) {
  const { pop, setPop, root } = ed
  const popover = (
    <Popover
      position={position ?? 'bottom-start'}
      shadow="sm"
      withinPortal={false}
      returnFocus
      transitionProps={{ duration: 0 }}
      opened={pop === p}
      onChange={(on) => setPop((x) => (on ? p : x === p ? undefined : x))}
      // closed with the focus inside, it goes back to the button, also when the popover opened
      // after a Calibrate tool (the focus was on the canvas marker then)
      onClose={() =>
        requestAnimationFrame(() => {
          if (document.activeElement === document.body)
            root.current?.querySelector<HTMLElement>(`[data-pop="${p}"]`)?.focus()
        })
      }
    >
      <Popover.Target>
        {/* a controlled popover's target toggles it itself */}
        <ActionIcon
          variant="default"
          aria-label={name}
          data-pop={p}
          onClick={() => setPop((x) => (x === p ? undefined : p))}
          aria-description={description}
        >
          {icon}
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown className="toolbar-pop">{children}</Popover.Dropdown>
    </Popover>
  )
  return (
    <Tooltip
      label={tip}
      events={tipEvents}
      {...(wideTip && { multiline: true, maw: 260 })}
      disabled={pop === p}
    >
      {frame ? frame(popover) : <span className="tool-indicator">{popover}</span>}
    </Tooltip>
  )
}

/** The sheet's name while it is renamed. */
function SheetName({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { meta, setMeta, setRenaming, root } = ed
  return (
    <TextInput
      aria-label={t('Sheet name')}
      className="sheet-select"
      value={meta.name}
      maxLength={200}
      autoFocus
      error={meta.name ? undefined : true}
      onChange={(e) => setMeta({ ...meta, name: e.currentTarget.value })}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          e.currentTarget.blur()
        }
      }}
      onBlur={() => {
        if (!meta.name) setMeta((m) => ({ ...m, name: t('Target sheet') }))
        setRenaming(false)
        requestAnimationFrame(() =>
          root.current?.querySelector<HTMLElement>('[data-rename]')?.focus(),
        )
      }}
    />
  )
}

/** The list of the sheets of this browser. */
function SheetSelect({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { meta, sheets, stored, open } = ed
  return (
    <NativeSelect
      aria-label={t('Target sheet')}
      // the narrow list cuts a long name
      title={meta.name}
      className="sheet-select"
      data={[
        ...(stored ? [] : [{ value: meta.id, label: meta.name }]),
        ...sheets.map((r) => ({ value: r.id, label: r.id === meta.id ? meta.name : r.name })),
      ]}
      value={meta.id}
      onChange={(e) => {
        const r = sheets.find((x) => x.id === e.currentTarget.value)
        if (r) open(r)
      }}
    />
  )
}

/** Rename, new and delete; the compact tab keeps one row, so they are in Expand. */
function SheetButtons({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { compact, setRenaming, create, stored, deleteSheet } = ed
  if (compact) return null
  return (
    <>
      <IconButton label={t('Rename sheet')} data-rename onClick={() => setRenaming(true)}>
        <PencilSimple />
      </IconButton>
      <IconButton label={t('New sheet')} onClick={create}>
        <FilePlus />
      </IconButton>
      <IconButton label={t('Delete sheet')} disabled={!stored} onClick={deleteSheet}>
        <Trash />
      </IconButton>
    </>
  )
}

/** The Photo popover's content: the photo's buttons and its display filters. */
function PhotoPanel({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { sheet, coarse, setPop, fileInput, cameraInput, removePhoto } = ed
  return (
    <>
      <h2 className="prop-head">{t('Photo')}</h2>
      <p className="note">
        {t('Choose, drop or paste a photo; it stays in this browser and is never uploaded.')}
      </p>
      <Flex component="span" className="row-buttons" wrap="wrap" gap={4} mb="xs">
        <Button
          size={controlSize.row.button}
          variant="default"
          leftSection={<ImageIcon size={14} aria-hidden="true" />}
          onClick={() => {
            setPop(undefined)
            fileInput.current?.click()
          }}
        >
          {sheet.photo ? t('Replace photo') : t('Add photo')}
        </Button>
        {coarse && (
          <Button
            size={controlSize.row.button}
            variant="default"
            leftSection={<Camera size={14} aria-hidden="true" />}
            onClick={() => {
              setPop(undefined)
              cameraInput.current?.click()
            }}
          >
            {t('Camera')}
          </Button>
        )}
        <Button
          size={controlSize.row.button}
          variant="default"
          leftSection={<ImageBroken size={14} aria-hidden="true" />}
          disabled={!sheet.photo}
          onClick={() => {
            setPop(undefined)
            void removePhoto()
          }}
        >
          {t('Remove photo')}
        </Button>
      </Flex>
      <FilterPanel ed={ed} />
    </>
  )
}

/** The photo tool: a button in the compact tab, a popover otherwise. */
function PhotoTool({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { compact, fileInput } = ed
  if (compact)
    return (
      <IconButton
        label={t(
          'Photo: choose, drop or paste one; it stays in this browser and is never uploaded',
        )}
        onClick={() => fileInput.current?.click()}
      >
        <ImageIcon />
      </IconButton>
    )
  return (
    <ToolPopover
      ed={ed}
      p="photo"
      tip={t('Photo: add, replace or remove; contrast and darken')}
      name={t('Photo')}
      icon={
        <span className="icon-slot" aria-hidden="true">
          <ImageIcon />
        </span>
      }
    >
      <PhotoPanel ed={ed} />
    </ToolPopover>
  )
}

/** The camera button of the compact tab on a touch screen. */
function CameraButton({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { compact, coarse, cameraInput } = ed
  if (!compact || !coarse) return null
  return (
    <IconButton label={t('Photo from the camera')} onClick={() => cameraInput.current?.click()}>
      <Camera />
    </IconButton>
  )
}

/** The hidden file inputs of the Photo tool: a file and the camera. */
function PhotoInputs({ ed }: { ed: Ed }) {
  const { fileInput, cameraInput, takePhoto } = ed
  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void takePhoto(e.currentTarget.files?.[0])
          e.currentTarget.value = ''
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={(e) => {
          void takePhoto(e.currentTarget.files?.[0])
          e.currentTarget.value = ''
        }}
      />
    </>
  )
}

/** The Calibrate popover: the scale references, rotation and origin. */
function CalibrateTool({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { compact, unscaled } = ed
  if (compact) return null
  return (
    <ToolPopover
      ed={ed}
      p="calibrate"
      tip={
        unscaled
          ? t('Calibrate: the photo has no scale yet; mark a reference of known size')
          : t('Calibrate: scale references, rotation and origin')
      }
      wideTip
      name={t('Calibrate')}
      description={unscaled ? t('The photo has no scale yet.') : undefined}
      icon={
        <span className="icon-slot" aria-hidden="true">
          <Ruler />
        </span>
      }
      frame={(popover) => (
        <Indicator
          disabled={!unscaled}
          size={9}
          offset={3}
          color="orange"
          withBorder
          className="tool-indicator"
          data-unscaled={unscaled || undefined}
        >
          {popover}
        </Indicator>
      )}
    >
      <h2 className="prop-head">{t('Calibrate')}</h2>
      <ScalePanel ed={ed} />
    </ToolPopover>
  )
}

/** The Select and Shot tools. */
function ToolSwitch({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { meta, storeError, tool, startTool } = ed
  return (
    <SegmentedControl
      aria-label={t('Tool')}
      // an edit before the store is read is lost when the sheet opens
      disabled={!meta.id && !storeError}
      value={tool === 'select' || tool === 'shot' ? tool : ''}
      onChange={(v) => startTool(v as Tool)}
      data={[
        {
          value: 'select',
          label: (
            <Group
              component="span"
              display="inline-flex"
              gap={4}
              wrap="nowrap"
              title={t(
                'Select: drag shots, points of aim and reference points; drag the background to pan',
              )}
            >
              <Cursor size={14} aria-hidden="true" />
              <span className="seg-text">{t('Select')}</span>
            </Group>
          ),
        },
        {
          value: 'shot',
          label: (
            <Group
              component="span"
              display="inline-flex"
              gap={4}
              wrap="nowrap"
              title={t('Shot: add shots to the active group by click or tap')}
            >
              <Target size={14} aria-hidden="true" />
              <span className="seg-text">{t('Shot')}</span>
            </Group>
          ),
        },
      ]}
    />
  )
}

/** Undo, and Redo outside the compact tab. */
function UndoRedo({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { compact, h, setH } = ed
  return (
    <>
      <IconButton
        label={t('Undo ({shortcut})', { shortcut: shortcutLabel('undo') })}
        aria-keyshortcuts={shortcutAriaKeys('undo')}
        disabled={!h.past.length}
        onClick={() => setH(undo)}
      >
        <ArrowCounterClockwise />
      </IconButton>
      {!compact && (
        <IconButton
          label={t('Redo ({shortcut})', { shortcut: shortcutLabel('redo') })}
          aria-keyshortcuts={shortcutAriaKeys('redo')}
          disabled={!h.future.length}
          onClick={() => setH(redo)}
        >
          <ArrowClockwise />
        </IconButton>
      )}
    </>
  )
}

/** The Overlays popover: the switches of what the canvas draws. */
function OverlaysTool({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { compact, overlays, toggleOverlay } = ed
  const overlayCount = (Object.keys(overlayNames) as Overlay[]).filter((o) => overlays[o]).length
  return (
    <ToolPopover
      ed={ed}
      p="overlays"
      tip={t('Overlays: {count} on', { count: overlayCount })}
      name={t('Overlays')}
      position="bottom-end"
      icon={<Eye size={16} aria-hidden="true" />}
      frame={(popover) => (
        <Indicator
          label={<span aria-hidden="true">{plainNumber(overlayCount)}</span>}
          size={14}
          offset={3}
          disabled={!overlayCount}
          color="gray"
          className="tool-indicator"
        >
          {popover}
        </Indicator>
      )}
    >
      <fieldset className="overlay-list">
        <legend className="overlay-legend">{t('Overlays')}</legend>
        {(Object.keys(overlayNames) as Overlay[]).map((o) => {
          const help = overlayHelp[o]
          const title = help && t(help)
          return (
            <Checkbox
              key={o}
              label={t(overlayNames[o])}
              title={title}
              wrapperProps={{ title }}
              checked={overlays[o]}
              onChange={(e) => toggleOverlay(o, e.currentTarget.checked)}
            />
          )
        })}
      </fieldset>
      {!compact && <MarkerField ed={ed} />}
    </ToolPopover>
  )
}

/** The workbench tab's Expand and Close button. */
function ExpandButton({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { expand } = ed
  if (!expand) return null
  return (
    <IconButton
      label={expand.expanded ? t('Close') : t('Expand')}
      data-expand
      onClick={() => expand.onChange(!expand.expanded)}
    >
      {expand.expanded ? <ArrowsIn /> : <ArrowsOut />}
    </IconButton>
  )
}

/** The editor's toolbar: sheet, photo, calibration, tools, undo and the overlays. */
function Toolbar({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { renaming, heading, exportMenu, toolbarKeys } = ed
  return (
    <div
      className="target-toolbar"
      role="toolbar"
      aria-label={t('Target sheet tools')}
      onKeyDown={toolbarKeys}
    >
      {renaming ? <SheetName ed={ed} /> : <SheetSelect ed={ed} />}
      <SheetButtons ed={ed} />
      <span className="toolbar-gap" />
      <PhotoTool ed={ed} />
      <CameraButton ed={ed} />
      <PhotoInputs ed={ed} />
      <CalibrateTool ed={ed} />
      <span className="toolbar-gap" />
      <ToolSwitch ed={ed} />
      <UndoRedo ed={ed} />
      <OverlaysTool ed={ed} />
      {/* on /groups in the page bar */}
      {heading === undefined && exportMenu}
      <ExpandButton ed={ed} />
    </div>
  )
}

/** The reference with its points replaced; none when the points are fewer than its kind needs. */
function withPoints(
  r: CalibrationReference,
  [p0, p1, p2, p3]: Point[],
): CalibrationReference | undefined {
  if (r.kind === 'line') return p0 && p1 && { ...r, a: p0, b: p1 }
  if (r.kind === 'ringCentre') return p0 && p1 && { ...r, centre: p0, edge: p1 }
  if (r.kind === 'ringEdge') return p0 && p1 && p2 && { ...r, points: [p0, p1, p2] }
  return p0 && p1 && p2 && p3 && { ...r, corners: [p0, p1, p2, p3] }
}

/** The reference point `pi` of reference `ri` moved to `p`; the sheet as it was when that gives no scale. */
function movedReference(s: TargetSheet, ri: number, pi: number, p: Point): TargetSheet {
  const r = s.references[ri]
  if (!r) return s
  const pts = refPoints(r)
  pts[pi] = p
  const moved = withPoints(r, pts)
  if (!moved) return s
  const next = { ...s, references: s.references.map((x, j) => (j === ri ? moved : x)) }
  return frameOf(next) ? next : s
}

/** The canvas stage: the target with its hint, notes and start actions; a photo can be dropped on it. */
function Canvas({ ed }: { ed: Ed }) {
  const {
    sheet,
    frame,
    group,
    selected,
    tool,
    pending,
    overlays,
    filter,
    photo,
    describe,
    stats,
    setSelected,
    setActive,
    addShot,
    dragKey,
    shotAt,
    apply,
    applyCal,
    toggle,
    remove,
    onPoint,
    view,
    layer,
    detect,
    hint,
    help,
    blankSheet,
    startActions,
    takePhoto,
    unscaled,
  } = ed
  const { t } = useTranslation()
  const statsBox = group && stats && <StatsBoxContent ed={ed} />
  const photoBox =
    photo && photo !== 'missing'
      ? turnedBox(photo.width, photo.height, sheet.photoRotation ?? 0)
      : undefined
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target for a photo; Photo is the keyboard path
    <div
      className="target-stage"
      // a phone with its panels open gives the stage the photo's shape
      style={photoBox && ({ '--photo-ratio': `${photoBox.w} / ${photoBox.h}` } as CSSProperties)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        void takePhoto([...e.dataTransfer.files].find((f) => f.type.startsWith('image/')))
      }}
    >
      <TargetCanvas
        sheet={sheet}
        frame={frame}
        photo={photo === 'missing' ? undefined : photo}
        active={group?.id}
        selected={selected}
        tool={tool}
        pending={pending}
        overlays={overlays}
        filter={filter}
        marker={sheet.markerDiameter}
        describe={describe}
        statsBox={statsBox}
        onSelect={(sel) => {
          setSelected(sel)
          if (sel) setActive(sel.group)
        }}
        onAdd={addShot}
        onMove={(sel, q, first) => {
          if (first) dragKey.current++
          shotAt(sel, (s) => ({ ...s, x: q.x, y: q.y }), `drag${dragKey.current}`)
        }}
        onAimMove={(gid, q, first) => {
          if (first) dragKey.current++
          apply((s) => withGroup(s, gid, (g) => ({ ...g, aim: q })), `drag${dragKey.current}`)
        }}
        onRefMove={(ri, pi, p, first) => {
          if (first) dragKey.current++
          applyCal((s) => movedReference(s, ri, pi, p), `drag${dragKey.current}`)
        }}
        onToggle={toggle}
        onDelete={remove}
        onNudge={(sel, dx, dy) =>
          shotAt(
            sel,
            (s) => ({ ...s, x: s.x + dx, y: s.y + dy }),
            `nudge:${sel.group}:${sel.index}`,
          )
        }
        onPoint={onPoint}
        view={view}
        layer={layer}
      />
      {detect.progressBar}
      {/* the tool hint and the last message, on the canvas: nothing moves when it changes */}
      <p className="target-status" role="status" title={hint}>
        {hint}
      </p>
      {!hint && help && (
        <p className="target-help" aria-hidden="true">
          {help}
        </p>
      )}
      {blankSheet && (
        <div className="canvas-start">
          <p>
            {t(
              'A drawn target. Place shots, then click where each shot hit. Or add a photo of the target: choose, drop or paste one.',
            )}
          </p>
          {startActions(controlSize.bar.button)}
        </div>
      )}
      {photo === 'missing' && (
        <p className="canvas-note">
          {t('The photo of this sheet is not in this browser; its shots are kept.')}
        </p>
      )}
      {unscaled && (
        <p className="canvas-note">
          {t('Mark a reference of known size (Calibrate) to place shots.')}
        </p>
      )}
    </div>
  )
}

/** The shots section's head: the fold toggle and the add button. */
function ShotsHead({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { group, uid, shotsOpen, setShotsOpen, addShot } = ed
  if (!group) return null
  return (
    <div className="section-head">
      <h2 className="prop-head">
        <button
          type="button"
          className="head-toggle"
          aria-expanded={shotsOpen}
          aria-controls={`${uid}-shots`}
          onClick={() => setShotsOpen((o) => !o)}
        >
          {shotsOpen ? (
            <CaretDown size={12} aria-hidden="true" />
          ) : (
            <CaretUp size={12} aria-hidden="true" />
          )}
          {t('Shots ({count})', { count: group.shots.length })}
        </button>
      </h2>
      <AddShotButton ed={ed} addShot={addShot} />
    </div>
  )
}

/** A heading of a side column: the page template's panel head on /groups. */
function SideHead({ ed, title }: { ed: Ed; title: string }) {
  if (!ed.panel) return <h2 className="prop-head">{title}</h2>
  return (
    <div className="page-panel-head">
      <h2 className="page-panel-title record-heading">{title}</h2>
    </div>
  )
}

/** The content of the side tab `v`. */
function SidePanel({ ed, v }: { ed: Ed; v: string }) {
  const { group, stats, detect, addShot, notesPanel, charges } = ed
  if (v === 'groups')
    return (
      <>
        <GroupPanel ed={ed} />
        {detect.panel}
      </>
    )
  if (v === 'shots')
    return (
      <>
        <div className="section-head">{group && <AddShotButton ed={ed} addShot={addShot} />}</div>
        {group && <ShotsPanel ed={ed} />}
      </>
    )
  if (v === 'stats')
    return (
      <>
        <Headline ed={ed} />
        {group && stats && <StatsPanel ed={ed} />}
      </>
    )
  if (v === 'notes') return notesPanel
  return charges ? <LadderPanel ed={ed} /> : null
}

/** The panels as tabs: beside the target, or in the phone's bottom sheet. */
function SideTabs({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { group, stats, side, setSide, panel, charges } = ed
  const tabs: [string, Message][] = [
    ['groups', msg('Group')],
    ['shots', msg('Shots')],
    ['stats', msg('Stats')],
    ['notes', msg('Notes')],
    ...(charges ? [['ladder', msg('Ladder')] as [string, Message]] : []),
  ]
  return (
    <Tabs value={side} onChange={setSide} className={`target-tabs${panel}`}>
      {panel && <SideHead ed={ed} title={group?.name ?? t('Groups')} />}
      <Tabs.List>
        {tabs.map(([v, label]) => (
          <Tabs.Tab key={v} value={v}>
            {t(label)}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {tabs.map(([v]) => (
        <Tabs.Panel key={v} value={v} className="target-side">
          <SidePanel ed={ed} v={v} />
        </Tabs.Panel>
      ))}
      {/* the group's key values under every other tab, at the panel's foot */}
      {panel && side !== 'stats' && group && stats && (
        <div className="target-summary">
          <h3 className="prop-head">{t('Summary')}</h3>
          <Headline ed={ed} />
        </div>
      )}
    </Tabs>
  )
}

/** The phone's bottom sheet: a summary strip that opens the panels. */
function BottomSheet({ ed }: { ed: Ed }) {
  const { t, tn } = useTranslation()
  const { group, stats, keyValues, system, uid, sheetOpen, setSheetOpen } = ed
  const summaryLine = group
    ? [
        group.name,
        tn(stats?.shotCount ?? 0, '{count} shot', '{count} shots'),
        ...(stats && stats.shotCount > 1
          ? [t('ES {value}', { value: keyValueText(keyValues, system, 'extremeSpread', t) })]
          : []),
      ].join(' · ')
    : t('No group')
  return (
    <section
      className="target-sheet"
      data-open={sheetOpen || undefined}
      aria-label={t('Group panels')}
    >
      <button
        type="button"
        className="sheet-strip"
        aria-expanded={sheetOpen}
        aria-controls={`${uid}-sheet`}
        onClick={() => setSheetOpen((o) => !o)}
      >
        {group && (
          <span className="swatch" style={{ background: group.colour }} aria-hidden="true" />
        )}
        <span className="strip-text">{summaryLine}</span>
        {sheetOpen ? (
          <CaretDown size={16} aria-hidden="true" />
        ) : (
          <CaretUp size={16} aria-hidden="true" />
        )}
        <span className="visually-hidden">{sheetOpen ? t('Hide panels') : t('Show panels')}</span>
      </button>
      <div id={`${uid}-sheet`} className="sheet-body" hidden={!sheetOpen}>
        {sheetOpen && <SideTabs ed={ed} />}
      </div>
    </section>
  )
}

/** The side column of the compact tab: the key statistics, or how to start. */
function KeySide({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { group, stats, sheet, frame, startActions } = ed
  return (
    <aside className="target-side key-side" aria-label={t('Key statistics')}>
      <h3 className="prop-head">{group?.name ?? t('Statistics')}</h3>
      {group?.shots.length ? (
        <>
          {stats && <StatsPanel ed={ed} />}
          <ShotsPanel ed={ed} />
        </>
      ) : (
        <Stack gap={4}>
          <p className="note">{startNote(!!sheet.photo, !!frame, t)}</p>
          {startActions(controlSize.row.button)}
        </Stack>
      )}
    </aside>
  )
}

/** What to do first on a compact tab without shots. */
function startNote(photo: boolean, scaled: boolean, t: Translator['t']) {
  if (!photo)
    return t(
      'A drawn target. Place shots, then click where each shot hit. Or add a photo of the target.',
    )
  return scaled
    ? t('Place shots, then click each hole.')
    : t('Mark a reference of known size (Expand, Calibrate) to place shots.')
}

/** The statistics column of the wide layout, with the shots, the notes and the ladder. */
function StatsSide({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { group, stats, uid, shotsOpen, panel, charges, notesPanel } = ed
  return (
    <aside className={`target-side stats-side${panel}`} aria-label={t('Statistics and shots')}>
      <SideHead ed={ed} title={t('Statistics')} />
      <Headline ed={ed} />
      {group && stats && <StatsPanel ed={ed} />}
      <ShotsHead ed={ed} />
      <div id={`${uid}-shots`} className="shots-body" hidden={!shotsOpen}>
        {shotsOpen && group && <ShotsPanel ed={ed} />}
      </div>
      <h2 className="prop-head">{t('Notes')}</h2>
      {notesPanel}
      {charges && (
        <>
          <h2 className="prop-head">{t('Ladder')}</h2>
          <LadderPanel ed={ed} />
        </>
      )}
    </aside>
  )
}

/** The target body: the canvas with the panels beside it, in the layout the width allows. */
function Body({ ed }: { ed: Ed }) {
  const { t } = useTranslation()
  const { compact, wide, phone, panel, detect } = ed
  if (compact)
    return (
      <>
        <Canvas key="canvas" ed={ed} />
        {/* target first: the side column keeps its width, empty or not, so nothing moves */}
        <KeySide key="key" ed={ed} />
      </>
    )
  if (wide)
    return (
      <>
        <aside key="left" className={`target-side${panel}`} aria-label={t('Groups')}>
          <SideHead ed={ed} title={t('Groups')} />
          <GroupPanel ed={ed} />
          {detect.panel}
        </aside>
        <Canvas key="canvas" ed={ed} />
        <StatsSide key="right" ed={ed} />
      </>
    )
  return (
    <>
      <Canvas key="canvas" ed={ed} />
      {phone ? <BottomSheet key="sheet" ed={ed} /> : <SideTabs key="tabs" ed={ed} />}
    </>
  )
}

/** The page bar of /groups: the File menu of the open sheet, Export and Print. */
function SheetPageBar({ ed }: { ed: Ed }) {
  const {
    heading,
    meta,
    fileData,
    kept,
    setSheets,
    open,
    reloadStored,
    storeFromMenu,
    exportMenu,
    printSheet,
  } = ed
  const { t } = useTranslation()
  if (heading === undefined) return null
  return (
    <PageBar
      title={heading}
      actions={
        <>
          {/* from the sheet's id on: the menu never runs without autosave; a placeholder keeps
              its place until then */}
          {meta.id ? (
            <FileMenu
              kind="targetSheet"
              name={meta.name || t('Target sheet')}
              data={fileData}
              autosaved={meta.id}
              // the save effect brings the two together again
              kept={kept}
              onOpen={(_, __, r) => {
                setSheets((list) => [r, ...list.filter((x) => x.id !== r.id)])
                open(r)
              }}
              onStored={reloadStored}
              store={storeFromMenu}
            />
          ) : (
            <FileMenuPlaceholder />
          )}
          {exportMenu}
          <PrintButton
            onClick={printSheet}
            hint={t(
              'Print: what Fit shows at a stated scale with a ruler, and the statistics (also {shortcut})',
              { shortcut: shortcutLabel('print') },
            )}
          />
        </>
      }
    />
  )
}

/** The keys the editor handles itself: undo and redo, and Print on /groups. */
function ownShortcuts(onPage: boolean) {
  return { undo: null, redo: null, ...(onPage && { print: null }) }
}

/** The photo to draw: none while the sheet's photo is missing from the store. */
function shownPhoto(photo: Photo | 'missing' | undefined) {
  return photo === 'missing' ? undefined : photo
}

/** The statistics of the group and its readouts, for its table, its key values and the statistics box. */
function statsOf(group: ShotGroup | undefined) {
  const stats = group && groupStatisticsOf(group)
  const keyValues = group && stats ? readouts(stats, group.distance) : []
  return { stats, keyValues }
}

/**
 * A failure or a limit shows over the hint; a routine message does not; the help of the focused
 * field shows over a routine message.
 */
function hintOf(
  status: { text: string; alert: boolean },
  toolHint: string | undefined,
  help: string | undefined,
) {
  const alertText = status.alert ? status.text : ''
  return alertText || toolHint || (help ? '' : status.text)
}

/** Whether the sheet is a drawn target without a shot yet, with the select tool. */
function isBlank(compact: boolean, tool: Tool, sheet: TargetSheet) {
  return !compact && tool === 'select' && !sheet.photo && sheet.groups.every((g) => !g.shots.length)
}

/** Whether the photo is there and no reference gives it a scale yet. */
function isUnscaled(sheet: TargetSheet, photo: Photo | 'missing' | undefined, frame: Frame) {
  return !!sheet.photo && photo !== 'missing' && !frame
}

/** The layout switches of the editor's root element. */
function rootAttrs(wide: boolean, phone: boolean, sheet: boolean) {
  return {
    'data-wide': wide || undefined,
    'data-phone': phone || undefined,
    'data-sheet': sheet || undefined,
  }
}

/** Replaced or removed photos of a sheet, deleted once the saved sheet points at another. */
type Orphan = { sheet: string; photo: string }

/** The sheet the editor opens next time. */
function rememberSheet(id: string) {
  try {
    localStorage.setItem(lastSheet, id)
  } catch {}
}

/** Deletes the photo file `old` unless a stored sheet still points at it (`now` is the new photo). */
async function dropUnusedPhoto(old: string | undefined, now: string | undefined) {
  if (!old || old === now) return
  const used = await storedPhotoIds()
  if (!used.has(old)) discardFile(old)
}

/** Deletes the replaced photos of sheet `sheetId` that its saved sheet no longer shows. */
async function dropOrphans(
  orphans: { current: Orphan[] },
  sheetId: string,
  shown: string | undefined,
) {
  const gone = orphans.current.filter((o) => o.sheet === sheetId && o.photo !== shown)
  orphans.current = orphans.current.filter((o) => !gone.includes(o))
  // a copy made with Save as may point at the photo too
  const used = gone.length ? await storedPhotoIds() : new Set<string>()
  for (const o of gone) if (!used.has(o.photo)) discardFile(o.photo)
}

/**
 * Writes the photos and the sheet of a deleted sheet back. Another tab may have saved the sheet
 * since the delete: it stays, and this one comes back as a copy (`put` false).
 */
async function putBack(
  r: TargetSheetRecord,
  files: { id: string; blob: Blob | undefined }[],
  t: Translator['t'],
) {
  for (const f of files) if (f.blob) await putPhoto(f.id, f.blob)
  const back = { ...r, saved: new Date().toISOString() }
  const put = await putRecordIf(back, undefined)
  const own = put ? back : keptCopy(back, newId(), t)
  if (!put) await putRecords([own])
  return { own, put }
}

/** The group edited: the chosen one, else the first. */
function activeGroupOf(sheet: TargetSheet, active: string | undefined) {
  return sheet.groups.find((g) => g.id === active) ?? sheet.groups[0]
}

/** The overlay switches of the sheet, else the browser's last choice. */
function overlaysOf(sheet: TargetSheet, browser: Record<Overlay, boolean>) {
  return sheet.overlays
    ? overlay<Record<Overlay, boolean>>(defaultOverlays, sheet.overlays)
    : browser
}

/** The class of the side panels: the page template's panels on /groups only. */
function panelOf(heading: string | undefined) {
  return heading === undefined ? '' : ' page-panel'
}

/** The editor's height on a phone: from its top edge, not a flex share of the page. */
function editorStyle(phoneTop: number | undefined, sheetOpen: boolean): CSSProperties | undefined {
  if (phoneTop === undefined) return undefined
  // with the panels open the photo and the panels below it set the height and the page scrolls
  return sheetOpen ? { flex: 'none' } : { height: `calc(100dvh - ${phoneTop}px)`, flex: 'none' }
}

/** The hint of the active tool, or what the tool needs next. */
function toolHintOf(
  tool: Tool,
  frame: Frame,
  pointsDone: number,
  detectHint: string | undefined,
  scoreHint: string | undefined,
  t: Translator['t'],
) {
  const first = detectHint ?? scoreHint
  if (first !== undefined) return first
  const keys = t('Or arrow keys and Enter. Esc cancels.')
  if (toolPoints[tool])
    return t('{hint} Point {n} of {total}. {keys}', {
      hint: t(refHints[tool as RefKind]),
      n: pointsDone + 1,
      total: toolPoints[tool],
      keys,
    })
  if (tool === 'origin') return t('Click the photo point of target (0, 0). {keys}', { keys })
  if (tool === 'aim') return t('Click the point of aim of the active group. {keys}', { keys })
  if (tool !== 'shot') return
  return frame ? t('Click a hole to add a shot to the active group.') : t('Mark a reference first.')
}

/** The state the File menu shows for the sheet. */
function keptOf(failed: boolean, saving: boolean, stored: boolean): Kept {
  if (failed) return 'failed'
  if (saving) return 'saving'
  return stored ? 'saved' : 'blank'
}

/**
 * The target photo editor: a sheet of the browser store (a photo
 * kept on the device, or a drawn target) with its calibration and shot groups, saved on every
 * change. On `/groups` it lists every sheet; in the workbench tab Groups the sheets of the saved
 * load `load`, each group linked to a ladder step and a chart of size against charge.
 */
export function TargetEditor({
  load,
  charges,
  stepLabels,
  step,
  bulletDiameter,
  optic,
  expand,
  summary,
  heading,
  stored: storedTick,
}: {
  /** Id of the saved load (workbench); the sheets of that load only. */
  load?: string | undefined
  /** Charge of each ladder step of the load, kg. */
  charges?: number[] | undefined
  /** Each ladder step as the workbench names it, relative to the main charge. */
  stepLabels?: string[] | undefined
  /** Index of the ladder step shown in the workbench; new groups take it. */
  step?: number | undefined
  /** Bullet diameter of the load, m: the marker of a new sheet. */
  bulletDiameter?: number | undefined
  /** The optic of the workbench's firearm, for the clicks to the point of aim. */
  optic?: { label: string; click: number } | undefined
  /**
   * The workbench tab: compact (the target and the key readouts) until expanded over the
   * workbench; `onChange` switches.
   */
  expand?: { expanded: boolean; onChange: (expanded: boolean) => void }
  /** The workbench's load and its simulated velocities, for the print sheet. */
  summary?: LoadSummary | undefined
  /** The page heading (`/groups`): shown with the File menu of the open sheet beside it. */
  heading?: string | undefined
  /** Counts the page's File menu writes to the browser store (workbench Import, Replace). */
  stored?: number
}) {
  const { t } = useTranslation()
  const { system } = useUnits()
  /** The distance of a new sheet: 100 of the display unit (100 yd or 100 m), held in m. */
  const newDistance = useRef(0)
  newDistance.current = system.range.toSi(100)
  const [sheets, setSheets] = useState<TargetSheetRecord[]>([])
  // the id is set on mount (`create` or `open`): no clock or random value during the prerender
  const [meta, setMeta] = useState({ id: '', name: t('Target sheet {n}', { n: 1 }) })
  const [h, setH] = useState(() => historyOf(blank(load, bulletDiameter, newDistance.current)))
  const sheet = h.present
  // the Report issue boxes of /groups, not of the workbench tab
  useSheetReport(heading === undefined ? undefined : sheet)
  /** The File menu compares the sheet as JSON: after the edits of a drag, not during them. */
  const fileData = useDeferredValue(sheet)
  /** The sheet and name as opened, created or last saved: saved again only once they differ. */
  const opened = useRef<{ data: TargetSheet; name: string }>({ data: sheet, name: '' })
  /** The sheet and name shown now, for a store read that finishes later. */
  const showing = useRef({ data: sheet, name: meta.name })
  showing.current = { data: sheet, name: meta.name }
  const [stored, setStored] = useState(false)
  /** The browser store refused the last save; the next save that lands clears it. */
  const [saveFailed, setSaveFailed] = useState(false)
  const [photo, setPhoto] = useState<Photo | 'missing'>()
  const [active, setActive] = useState<string | undefined>(sheet.groups[0]?.id)
  const [selected, setSelected] = useState<Selection>()
  const [tool, setTool] = useState<Tool>('select')
  const [pending, setPending] = useState<Point[]>([])
  const [refKind, setRefKind] = useState<RefKind>('line')
  const [known, setKnown] = useState<{
    length?: number | undefined
    width?: number | undefined
    height?: number | undefined
  }>({})
  /** The browser's last overlay choice: the switches of a sheet without its own. */
  const [browserOverlays, setBrowserOverlays] = useState(defaultOverlays)
  const [noteSel, setNoteSel] = useState<string>()
  const noteFields = useRef(new Map<string, HTMLTextAreaElement>())
  /** The view the canvas shows, for the exports and the print. */
  const view: ViewRef = useRef(undefined)
  const [printBox, setPrintBox] = useState<{ x: number; y: number; w: number; h: number }>()
  const printPhoto = useRef<HTMLImageElement>(null)
  // undo and redo are this editor's own keys (`onKeyDown`)
  useShortcuts(ownShortcuts(heading !== undefined))
  // on /groups the browser's print command (Ctrl+P) prints the sheet, as Export > Print sheet does;
  // the workbench tab leaves it to the workbench report
  const ours = useRef(false)
  usePrintEvents(
    () => {
      const html = document.documentElement
      // Print sheet has set it already
      if (html.dataset.print || !view.current) return
      const box = view.current.extent
      ours.current = true
      html.dataset.print = 'target-sheet'
      flushSync(() => setPrintBox(box))
    },
    () => {
      if (!ours.current) return
      ours.current = false
      delete document.documentElement.dataset.print
      setPrintBox(undefined)
    },
    heading !== undefined,
  )
  const [filter, setFilter] = useState({ contrast: 1, darken: 0 })
  /** The last message; an alert (a failure or a limit) shows over a tool's hint. */
  const [status, setStatus] = useState({ text: '', alert: false })
  const say = useCallback((text: string, alert = false) => setStatus({ text, alert }), [])
  // a routine message goes after a while: it sits over the target; an alert stays until the next
  useEffect(() => {
    if (!status.text || status.alert) return
    const t = setTimeout(
      () => setStatus((x) => (x === status ? { text: '', alert: false } : x)),
      8000,
    )
    return () => clearTimeout(t)
  }, [status])
  /** Why the browser store could not be read: nothing is saved then. */
  const [storeError, setStoreError] = useState<{ reason: string }>()
  const [options, setOptions] = useState<ReturnType<typeof clickOptions>>([])
  const [opticChoice, setOpticChoice] = useState('')
  const [side, setSide] = useState<string | null>('groups')
  const coarse = useMediaQuery('(pointer: coarse)')
  const { ref: sized, width } = useElementSize<HTMLDivElement>()
  const root = useRef<HTMLDivElement>(null)
  const rootRef = useMergedRef(sized, root)
  const wide = width >= 928
  const uid = useId()
  /** The toolbar popovers: Photo, Calibrate, Overlays; one open at a time. */
  const [pop, setPop] = useState<'photo' | 'calibrate' | 'overlays'>()
  const [renaming, setRenaming] = useState(false)
  const [shotsOpen, setShotsOpen] = useState(true)
  /** The phone's bottom sheet: open or only its summary strip. */
  const [sheetOpen, setSheetOpen] = useState(false)
  /** The scroll of the shot table, for the rows in view of a long group. */
  const [shotScroll, setShotScroll] = useState({ top: 0, height: 400 })
  const shotScroller = useRef<HTMLDivElement>(null)
  /** The help of the focused field (label and description), shown on the canvas. */
  const [help, setHelp] = useState<string>()
  const fileInput = useRef<HTMLInputElement>(null)
  const cameraInput = useRef<HTMLInputElement>(null)
  const dragKey = useRef(0)
  /** The translator of this render, for the save callbacks that outlive it. */
  const tNow = useRef(t)
  tNow.current = t
  /** The save of the last edit while it waits for the debounce. */
  const pendingSave = useRef<(() => void) & { record?: () => WaitingRecord }>(undefined)
  /** Saves started and not yet landed, by sheet id: copied too when the page goes. */
  const inFlight = useRef(new Map<string, WaitingRecord>())
  /** The `saved` of each sheet as this editor last read or wrote it: a save writes only over that. */
  const bases = useRef(new Map<string, string | undefined>())
  const flush = () => pendingSave.current?.()
  /** The sheet shown now, for a photo read that finishes after a switch. */
  const shown = useRef(meta.id)
  shown.current = meta.id
  /** The photo of the sheet shown now, for a photo read that finishes after an edit. */
  const photoNow = useRef(sheet.photo)
  photoNow.current = sheet.photo
  /** Replaced or removed photos, deleted once their sheet is saved without them or deleted. */
  const orphans = useRef<Orphan[]>([])
  /** The undo notice of the last group delete, joined by a delete while it shows. */
  const groupUndo = useRef<{ n: number; undo: () => void; names: string[] }>(undefined)

  const frame = useMemo(() => frameOf(sheet), [sheet])
  const group = activeGroupOf(sheet, active)
  const scrollFocus = useScrollFocus(
    t('Shots of {name}', { name: group?.name ?? '' }),
    shotScroller,
  )

  useEffect(() => setBrowserOverlays(readOverlays()), [])
  const overlays = overlaysOf(sheet, browserOverlays)

  /** An edit as one undo step; `key` joins a run of edits of one field into one step. */
  const apply = (f: (s: TargetSheet) => TargetSheet, key?: string) =>
    setH((x) => {
      const next = f(x.present)
      if (next === x.present) return x
      return key ? editHistory(x, next, key) : pushHistory(x, next)
    })
  /** A calibration edit: shots and points of aim stay on their photo points. */
  const applyCal = (f: (s: TargetSheet) => TargetSheet, key?: string) =>
    apply((s) => rebase(s, f(s)), key)
  const onGroup = (f: (g: ShotGroup) => ShotGroup, key?: string) =>
    group && apply((s) => withGroup(s, group.id, f), key)
  /** A switch kept with the sheet and as the browser's choice for sheets without their own. */
  const toggleOverlay = (o: Overlay, on: boolean) => {
    const next = { ...overlays, [o]: on }
    apply((s) => ({ ...s, overlays: next }), 'overlays')
    setBrowserOverlays(next)
    try {
      localStorage.setItem(overlayKey, JSON.stringify(next))
    } catch {}
  }
  const notes = sheet.notes ?? []
  const onNote = (id: string, f: (n: SheetNote) => SheetNote | undefined, key?: string) =>
    apply((s) => {
      const next = (s.notes ?? []).flatMap((n) => {
        if (n.id !== id) return [n]
        const m = f(n)
        return m ? [m] : []
      })
      const { notes: _, ...rest } = s
      return next.length ? { ...rest, notes: next } : rest
    }, key)
  const addNote = () => {
    if (!frame) return
    // right of the group's shots, level with its top, so it covers none
    const pts = group?.shots.filter((x) => !x.excluded) ?? []
    const at = pts.length
      ? { x: Math.max(...pts.map((p) => p.x)), y: Math.max(...pts.map((p) => p.y)) }
      : (group?.aim ?? { x: 0, y: 0 })
    const id = freeId(
      'n',
      notes.map((n) => n.id),
    )
    const note: SheetNote = {
      id,
      x: at.x + 0.005,
      y: at.y + 0.005,
      text: '{name}: ES {extremeSpread.length}, {extremeSpread.moa}',
      ...(group && { group: group.id }),
    }
    apply((s) => ({ ...s, notes: [...(s.notes ?? []), note] }))
    setNoteSel(id)
    requestAnimationFrame(() => noteFields.current.get(id)?.focus())
  }
  const editNote = (id: string) => {
    setNoteSel(id)
    setSide('notes')
    // on a phone the panels are in the bottom sheet
    setSheetOpen(true)
    requestAnimationFrame(() => noteFields.current.get(id)?.focus())
  }
  const detect = useHoleDetection({
    sheet,
    sheetId: meta.id,
    frame,
    group,
    photo: shownPhoto(photo),
    bullet: bulletDiameter,
    onGroup,
    onTurn: (angle, key) => {
      const size = shownPhoto(photo)
      if (size) apply((s) => turnSheet(s, size, angle), key)
    },
    openCalibrate: () => setPop('calibrate'),
    onFace: (found) => applyCal((s) => calibrateSheetOnFace(s, group?.id, found, score.scope)),
    say,
    tool,
    startTool,
  })
  const score = useRingScoring({
    sheet,
    frame,
    group,
    bullet: bulletDiameter ?? sheet.markerDiameter,
    rings: overlays.rings,
    onGroup,
    onReference: pushReference,
    say,
    tool,
    startTool,
  })
  /** The score of group `id` when it has one; undefined while the face loads or without it. */
  const scored = (id: string) => scoredOnly(score.of(id))

  function open(r: TargetSheetRecord) {
    flush()
    setMeta({ id: r.id, name: r.name })
    opened.current = { data: r.data, name: r.name }
    bases.current.set(r.id, r.saved)
    setH(historyOf(r.data))
    setStored(true)
    setSaveFailed(false)
    setActive(r.data.groups[0]?.id)
    setSelected(undefined)
    setNoteSel(undefined)
    setTool('select')
    setPending([])
    // the same photo (a copy, a replaced sheet) stays: its effect does not run again
    if (r.data.photo !== photoNow.current) setPhoto(undefined)
    rememberSheet(r.id)
  }

  /** A new sheet; `face`: the id of the target face its first group is scored on. */
  function create(list = sheets, face?: GroupFace) {
    flush()
    // the units may be read after the mount that calls this: the ref has the current ones
    const empty = blank(load, bulletDiameter, newDistance.current, charges ? step : undefined)
    const data = face
      ? {
          ...empty,
          groups: empty.groups.map((g, i) => (i === 0 ? { ...g, face } : g)),
        }
      : empty
    const name = t('Target sheet {n}', { n: list.length + 1 })
    setMeta({ id: newId(), name })
    opened.current = { data, name }
    setH(historyOf(data))
    setStored(false)
    setSaveFailed(false)
    setActive(data.groups[0]?.id)
    setSelected(undefined)
    setNoteSel(undefined)
    setTool('select')
    setPending([])
    setPhoto(undefined)
  }

  /** The sheets of this browser (of the load in the workbench), the newest first. */
  const sheetsOf = (records: UserRecord[]) =>
    records
      .filter(
        (r): r is TargetSheetRecord =>
          r.kind === 'targetSheet' && (load === undefined || r.data.load === load),
      )
      .sort((a, b) => (a.saved < b.saved ? 1 : -1))

  /** The sheet list again after the File menu wrote records (Open, Import). */
  const reloadSheets = () =>
    storedRecords()
      .then(({ records }) => setSheets(sheetsOf(records)))
      .catch(() => {})
  /** `reloadSheets` of this render, for the save effect. */
  const reloadLatest = useRef(reloadSheets)
  reloadLatest.current = reloadSheets

  /**
   * After the File menu wrote records: the list again, and the sheet shown when another writer
   * (Import, Replace) changed it, so the next save does not write the old sheet over it.
   */
  const reloadStored = () => {
    void reloadSheets()
    const id = shown.current
    storedRecord(id)
      .then(async (r) => {
        if (r?.kind !== 'targetSheet' || shown.current !== id) return
        const now = showing.current
        const same = (x: { data: TargetSheet; name: string }) =>
          r.name === x.name && canonicalJson(r.data) === canonicalJson(x.data)
        // the store holds what this editor opened or last saved (an edit may wait), or what it
        // shows (File, Save): nothing to open
        if (same(opened.current) || same(now)) return void bases.current.set(id, r.saved)
        // the stored sheet wins: an edit still waiting would write the old one over it
        pendingSave.current = undefined
        open(r)
        // the photo the replaced sheet showed, unless a sheet still points at it
        await dropUnusedPhoto(now.data.photo, r.data.photo)
      })
      .catch(() => {})
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: on the page's File menu writes only
  useEffect(() => {
    if (storedTick) reloadStored()
  }, [storedTick])

  // the sheets of this browser (of the load in the workbench); the last one used opens
  // biome-ignore lint/correctness/useExhaustiveDependencies: again only for another load
  useEffect(() => {
    let live = true
    let kept: string[] = []
    restoreWaiting(t)
      .then(
        (k) => {
          kept = k
        },
        () => {},
      )
      .then(storedRecords)
      .then(({ records }) => {
        if (!live) return
        const list = sheetsOf(records)
        setSheets(list)
        setOptions(clickOptions(records, tNow.current))
        let last: string | null = null
        try {
          last = localStorage.getItem(lastSheet)
        } catch {}
        const r = list.find((x) => x.id === last) ?? list[0]
        const linked = linkedFace(heading)
        // a well-formed id no face record has opens no face
        return (linked ? isFaceId(linked.id) : Promise.resolve(false)).then((known) => {
          if (!live) return
          const face = known ? linked : undefined
          if (r && !face) open(r)
          else create(list, face)
        })
      })
      .then(() => {
        // once: the copies are the last page's
        if (live) for (const name of kept.splice(0)) say(keptNote(name, t), true)
      })
      .catch((e) => setStoreError({ reason: e instanceof Error ? e.message : '' }))
    return () => {
      live = false
    }
  }, [load])

  // the photo of the sheet from the browser store
  useEffect(() => {
    const id = sheet.photo
    if (!id) return setPhoto(undefined)
    let live = true
    let url: string | undefined
    storedPhoto(id)
      .then(async (blob) => {
        if (!blob) return live && setPhoto('missing')
        const p = await photoOf(blob)
        url = p.url
        if (live) setPhoto(p)
        else URL.revokeObjectURL(p.url)
      })
      .catch(() => live && setPhoto('missing'))
    return () => {
      live = false
      if (url) URL.revokeObjectURL(url)
    }
  }, [sheet.photo])

  /**
   * Keeps `record` (an edit of `data`) as a sheet of its own after another tab saved the sheet
   * since: that save stays.
   */
  const keepOwn = useRef(async (record: TargetSheetRecord, data: TargetSheet) => {
    // a later save of the sheet keeps this edit with its own
    if (bases.current.get(record.id) !== record.saved) return
    const t = tNow.current
    const own = keptCopy(record, newId(), t)
    await putRecords([own])
    bases.current.set(own.id, own.saved)
    dropCopy(record.id, record.saved)
    reloadLatest.current()
    say(keptNote(own.name, t), true)
    if (shown.current !== record.id) return
    pendingSave.current = undefined
    opened.current = { data, name: own.name }
    setMeta({ id: own.id, name: own.name })
    setStored(true)
    setSaveFailed(false)
    rememberSheet(own.id)
  })
  /** File, Save: the browser copy written as autosave writes it; false when kept as a copy. */
  const storeFromMenu = async (record: TargetSheetRecord) => {
    const base = bases.current.get(record.id)
    // an autosave since the menu took the sheet holds a newer edit
    if (base !== undefined && base > record.saved) return true
    bases.current.set(record.id, record.saved)
    const put = await putRecordIf(record, base).catch((e: unknown) => {
      if (bases.current.get(record.id) === record.saved) bases.current.set(record.id, base)
      throw e
    })
    if (!put) await keepOwn.current(record, record.data)
    return put
  }

  // saved on every change, once it differs from what was opened
  useEffect(() => {
    if (!meta.id || (sheet === opened.current.data && meta.name === opened.current.name)) {
      // an edit undone before its save is not saved later
      pendingSave.current = undefined
      setSaveFailed(false)
      if (!meta.id && storeError)
        say(
          t('Not saved: the browser store could not be read. {reason}', {
            reason: storeError.reason,
          }).trim(),
          true,
        )
      return
    }
    const parsed = targetSheet.safeParse(sheet)
    if (!parsed.success) {
      pendingSave.current = undefined
      setSaveFailed(true)
      say(
        t('Not saved: {reason}', { reason: z.prettifyError(parsed.error).split('\n')[0] ?? '' }),
        true,
      )
      return
    }
    const recordNow = (): TargetSheetRecord => ({
      kind: 'targetSheet',
      id: meta.id,
      name: meta.name || t('Target sheet'),
      saved: new Date().toISOString(),
      data: parsed.data,
    })
    const save = () => {
      // only the latest edit saves; a delete drops it
      if (pendingSave.current !== save) return
      pendingSave.current = undefined
      const record = recordNow()
      const base = bases.current.get(record.id)
      // the store runs this editor's writes in order: the next save writes over this one
      bases.current.set(record.id, record.saved)
      const waiting = { ...record, base }
      inFlight.current.set(record.id, waiting)
      const landed = () => {
        if (inFlight.current.get(record.id) === waiting) inFlight.current.delete(record.id)
      }
      putRecordIf(record, base)
        .then(async (put) => {
          landed()
          if (!put) return keepOwn.current(record, sheet)
          dropCopy(record.id, record.saved)
          // replaced photos go once their saved sheet points at another
          await dropOrphans(orphans, record.id, sheet.photo)
          setSheets((list) => [record, ...list.filter((r) => r.id !== record.id)])
          void requestPersistentStorage()
          // a save that ends after another sheet opened leaves that sheet's state alone
          if (shown.current !== record.id) return
          opened.current = { data: sheet, name: meta.name }
          setStored(true)
          setSaveFailed(false)
          // on /groups the page bar's File state says it
          if (heading === undefined) say(t('Saved in this browser.'))
          rememberSheet(record.id)
        })
        .catch(() => {
          landed()
          if (bases.current.get(record.id) === record.saved) bases.current.set(record.id, base)
          if (shown.current === record.id) setSaveFailed(true)
          say(t('Not saved: the browser store refused the sheet.'), true)
        })
    }
    pendingSave.current = Object.assign(save, {
      record: () => ({ ...recordNow(), base: bases.current.get(meta.id) }),
    })
    const timer = setTimeout(save, 300)
    return () => clearTimeout(timer)
  }, [sheet, meta, storeError, say, heading, t])
  // an edit still waiting is saved when the editor goes (a link, a load change) or the page does
  useEffect(() => {
    const flushNow = () => pendingSave.current?.()
    // a write started when the page goes lands only if the page lives until it commits (lost when
    // the next page answers at once, measured in the e2e Chromium): a synchronous copy of the waiting
    // edit and of the saves not landed first, each saved on the next open when newer than the stored
    // sheet
    const leave = () => {
      const waiting = new Map(inFlight.current)
      // shortcut: a waiting edit's base is the save in flight; when that save is lost too, the next
      // page keeps the edit as a copy (a duplicate, nothing lost), carry both bases if that shows up
      const record = pendingSave.current?.record?.()
      if (record) waiting.set(record.id, record)
      if (waiting.size) keepCopies([...waiting.values()])
      flushNow()
    }
    const hidden = () => document.visibilityState === 'hidden' && leave()
    const events = ['beforeunload', 'pagehide']
    for (const e of events) window.addEventListener(e, leave)
    document.addEventListener('visibilitychange', hidden)
    return () => {
      for (const e of events) window.removeEventListener(e, leave)
      document.removeEventListener('visibilitychange', hidden)
      flushNow()
    }
  }, [])

  async function takePhoto(file: File | undefined) {
    if (!file) return
    if (!(photoTypes as readonly string[]).includes(file.type))
      return say(t('The file is not a photo: JPEG, PNG, WebP, GIF, AVIF, HEIC or BMP.'), true)
    const target = meta.id
    if (
      sheet.photo &&
      !(await confirmDialog({
        title: t('Replace the photo?'),
        message: t('Its references go; the shots keep their target values.'),
        confirmLabel: t('Replace'),
        danger: true,
      }))
    )
      return
    try {
      const id = newId()
      const p = await photoOf(file)
      // the size only: the effect below shows the stored file
      URL.revokeObjectURL(p.url)
      await putPhoto(id, file)
      // another sheet opened while the photo was read: it is not this photo's sheet
      if (shown.current !== target) return void deletePhoto(id).catch(() => {})
      const old = photoNow.current
      // a new photo starts a new history: undo cannot bring back a deleted photo
      setH((x) =>
        historyOf({
          ...withoutRegions(x.present),
          photo: id,
          references: [],
          targetOrigin: { x: p.width / 2, y: p.height / 2 },
        }),
      )
      if (old) orphans.current.push({ sheet: target, photo: old })
      // the old photo's size goes, so detection starts on the new one once it has loaded
      setPhoto(undefined)
      detect.photoAdded(id)
      setRefKind('line')
      say(t('Photo kept in this browser. Looking for the target and the holes.'))
    } catch {
      say(t('The photo could not be read.'), true)
    }
  }

  async function removePhoto() {
    const old = sheet.photo
    const target = meta.id
    if (
      !old ||
      !(await confirmDialog({
        title: t('Remove the photo?'),
        message: t('The shots stay on a drawn target.'),
        confirmLabel: t('Remove'),
        danger: true,
      })) ||
      shown.current !== target
    )
      return
    setH((x) => {
      const { photo: _, targetOrigin: __, ...rest } = x.present
      return historyOf({ ...withoutRegions(rest), references: [] })
    })
    orphans.current.push({ sheet: target, photo: old })
  }

  /** No question first: Undo puts the sheet and its photos back. */
  async function deleteSheet() {
    if (!stored) return
    const { id, name } = meta
    // the photo shown and every replaced one not yet deleted
    const photos = [
      ...(sheet.photo ? [sheet.photo] : []),
      ...orphans.current.filter((o) => o.sheet === id).map((o) => o.photo),
    ]
    // what Undo writes back: the sheet as shown, else as last stored
    const parsed = targetSheet.safeParse(sheet)
    const record: TargetSheetRecord | undefined = parsed.success
      ? {
          kind: 'targetSheet',
          id,
          name: name || t('Target sheet'),
          saved: '',
          data: parsed.data,
        }
      : sheets.find((r) => r.id === id)
    // a save still waiting would write the sheet back while the photos are read
    pendingSave.current = undefined
    const files = await Promise.all(
      photos.map(async (p) => ({ id: p, blob: await storedPhoto(p).catch(() => undefined) })),
    )
    const restore = async (r: TargetSheetRecord) => {
      try {
        const { own, put } = await putBack(r, files, t)
        if (put) setSheets((list) => [own, ...list.filter((x) => x.id !== id)])
        else void reloadSheets()
        open(own)
        if (!put) say(keptNote(own.name, t), true)
      } catch {
        say(t('Not restored: the browser store refused.'), true)
      }
    }
    deleteRecord(id)
      .then(async () => {
        // a copy left by a page that went would bring the sheet back on the next open
        dropCopy(id)
        orphans.current = orphans.current.filter((o) => o.sheet !== id)
        // a copy saved with Save as or opened from a file may share the photo
        const used = await storedPhotoIds()
        for (const p of photos) if (!used.has(p)) discardFile(p)
        const rest = sheets.filter((r) => r.id !== id)
        setSheets(rest)
        if (rest[0]) open(rest[0])
        else create(rest)
        if (record) offerUndo(t('Deleted {name}.', { name }), () => restore(record))
      })
      .catch(() => say(t('Not deleted: the browser store refused.'), true))
  }

  // a pasted image becomes the photo while the editor is shown and no field has the focus
  const takeLatest = useRef(takePhoto)
  takeLatest.current = takePhoto
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      if (!root.current?.offsetParent) return
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea')) return
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'))
      if (file) {
        e.preventDefault()
        takeLatest.current(file)
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [])

  function startTool(t: Tool) {
    setTool(t)
    setPending([])
    // a message from before does not hide the new tool's hint
    setStatus((x) => ({ ...x, alert: false }))
  }

  function addReference(points: Point[]) {
    const len = known.length
    const [p0, p1, p2, p3] = points
    let r: CalibrationReference | undefined
    if (refKind === 'line' && len && p0 && p1) r = { kind: 'line', a: p0, b: p1, length: len }
    if (refKind === 'ringCentre' && len && p0 && p1)
      r = { kind: 'ringCentre', centre: p0, edge: p1, diameter: len }
    if (refKind === 'ringEdge' && len && p0 && p1 && p2)
      r = { kind: 'ringEdge', points: [p0, p1, p2], diameter: len }
    if (refKind === 'rectangle' && known.width && known.height && p0 && p1 && p2 && p3)
      r = {
        kind: 'rectangle',
        corners: [p0, p1, p2, p3],
        width: known.width,
        height: known.height,
      }
    if (!r) return say(t('Enter the known size first.'), true)
    pushReference(r)
  }

  /** Adds a scale reference (a rectangle replaces the one before); shots stay on the photo. */
  function pushReference(ref: CalibrationReference) {
    const next = {
      ...sheet,
      references: [
        ...sheet.references.filter((x) => ref.kind !== 'rectangle' || x.kind !== 'rectangle'),
        ref,
      ],
    }
    if (next.references.length > 20) return say(t('A sheet holds at most 20 references.'), true)
    if (!frameOf(next)) return say(t('These points give no scale: three lie on one line.'), true)
    applyCal(() => next)
    say(
      t('{kind} {n} added.', {
        kind: t(refNames[ref.kind]).split(',')[0] ?? '',
        n: next.references.length,
      }),
    )
  }

  function onPoint(p: Point) {
    if (detect.onPoint(p) || score.onPoint(p)) return
    if (tool === 'origin') {
      applyCal((s) => ({ ...s, targetOrigin: p }))
      return startTool('select')
    }
    if (tool === 'aim') {
      if (frame) onGroup((g) => ({ ...g, aim: viewToTarget(frame, p) }))
      return startTool('select')
    }
    const need = toolPoints[tool]
    if (!need) return
    const pts = [...pending, p]
    if (pts.length < need) return setPending(pts)
    setPending([])
    setTool('select')
    addReference(pts)
  }

  const describe = (sel: Selection) => {
    const g = sheet.groups.find((x) => x.id === sel.group)
    const s = g?.shots[sel.index]
    if (!g || !s) return ''
    const value = scored(g.id)?.score.shots[sel.index]
    return [
      t('{group}, shot {n}, x {x}, y {y}', {
        group: g.name,
        n: sel.index + 1,
        x: formatQuantity('length', system, s.x),
        y: withUnit('length', system, s.y),
      }),
      ...(s.excluded ? [t('excluded')] : []),
      ...(value ? [t('score {score}', { score: shotText(value) })] : []),
    ].join(', ')
  }

  const shotAt = (
    sel: Selection,
    f: (s: ShotGroup['shots'][number]) => ShotGroup['shots'][number] | undefined,
    key?: string | undefined,
  ) =>
    apply(
      (s) =>
        withGroup(s, sel.group, (g) => ({
          ...g,
          shots: g.shots.flatMap((x, i) => {
            if (i !== sel.index) return [x]
            const y = f(x)
            return y ? [y] : []
          }),
        })),
      key,
    )

  const addShot = (q: Point) => {
    if (!group) return
    if (group.shots.length >= 1000) return say(t('A group holds at most 1000 shots.'), true)
    setSelected({ group: group.id, index: group.shots.length })
    onGroup((g) => ({ ...g, shots: [...g.shots, { x: q.x, y: q.y, placement: 'placed' }] }))
  }
  const toggle = (sel: Selection) => shotAt(sel, (s) => ({ ...s, excluded: !s.excluded }))
  const remove = (sel: Selection) => {
    shotAt(sel, () => undefined)
    setSelected(undefined)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const t = e.target as HTMLElement
    // Escape closes a toolbar popover, not the expanded editor around it
    if (e.key === 'Escape' && pop) {
      e.preventDefault()
      setPop(undefined)
      return
    }
    if (t.closest('input, textarea, select')) return
    if (shortcutMatches('undo', e.nativeEvent)) {
      e.preventDefault()
      setH(undo)
    } else if (shortcutMatches('redo', e.nativeEvent)) {
      e.preventDefault()
      setH(redo)
    } else if (e.key === 'Escape' && tool !== 'select') {
      // used here: the expanded editor stays open
      e.preventDefault()
      startTool('select')
    }
  }

  /** The workbench tab before Expand: the target and the key readouts only. */
  const compact = expand !== undefined && !expand.expanded
  const click = optic ?? options.find((o) => o.value === opticChoice)
  const { stats, keyValues } = statsOf(group)

  // ----- panels -----

  // a Calibrate tool ended (set, cancelled): Calibrate opens again with the focus where it was
  const calReturnFrom = usePopoverReturn(
    tool,
    () => setPop('calibrate'),
    (which) => root.current?.querySelector<HTMLElement>(`[data-cal="${which}"]`),
  )
  /** A Calibrate tool: the popover closes for the clicks on the photo and opens again after. */
  const calTool = (which: string, t: Tool) => {
    calReturnFrom(which)
    setPop(undefined)
    startTool(t)
  }

  const deleteGroup = () => {
    if (!group) return
    // no question first: Undo puts the group back at its place; deletes in a row (a double click)
    // share one notice, whose Undo brings every one back
    const gone = group
    const at = sheet.groups.findIndex((g) => g.id === gone.id)
    const target = meta.id
    apply((s) => ({ ...s, groups: s.groups.filter((g) => g.id !== gone.id) }))
    setActive(undefined)
    const before = groupUndo.current
    const earlier = before && offered(before.n) ? before : undefined
    const names = [...(earlier?.names ?? []), gone.name]
    const undo = () => {
      if (shown.current !== target) return
      apply((s) =>
        s.groups.some((g) => g.id === gone.id)
          ? s
          : { ...s, groups: [...s.groups.slice(0, at), gone, ...s.groups.slice(at)] },
      )
      setActive(gone.id)
      earlier?.undo()
    }
    groupUndo.current = {
      n: offerUndo(t('Deleted {name}.', { name: names.join(', ') }), undo),
      undo,
      names,
    }
  }

  const groupScore = group && scored(group.id)
  // a long group renders the rows in view only, at a fixed row height
  const shotWindow = shotWindowOf(group?.shots.length ?? 0, coarse, shotScroll)
  const { windowed } = shotWindow
  // scroll events come only while windowed: read the scroll once it starts and on another group
  // biome-ignore lint/correctness/useExhaustiveDependencies: on these changes only
  useLayoutEffect(() => {
    const e = shotScroller.current
    if (windowed && e) setShotScroll({ top: e.scrollTop, height: e.clientHeight })
  }, [windowed, group?.id])
  // groups per ladder step of this load, every sheet, the open one as edited
  const ladderRows = useMemo(() => {
    if (!charges) return []
    const all = [sheet, ...sheets.filter((r) => r.id !== meta.id).map((r) => r.data)]
    return ladderExtremeSpreads(
      all.flatMap((s) => s.groups),
      charges,
    )
  }, [charges, sheet, sheets, meta.id])

  const toolHint = toolHintOf(tool, frame, pending.length, detect.hint, score.hint, t)
  const hint = hintOf(status, toolHint, help)

  /** The sheet without the photo at a fixed view, for the exports (with the statistics box) and the print. */
  const stillOf =
    (withStats: boolean): StillCanvas =>
    (box, k) => (
      <TargetCanvas
        sheet={sheet}
        frame={frame}
        tool="select"
        overlays={overlays}
        filter={filter}
        marker={sheet.markerDiameter}
        describe={describe}
        still={{ box, k }}
        layer={(kk) => (
          <>
            {score.layer(kk, true)}
            {frame && notesOn(frame, kk, true)}
            {withStats && overlays.stats && (
              <StatsBlock
                groups={sheet.groups}
                system={system}
                box={box}
                k={kk}
                score={(g) => scoreLine(score.of(g.id))}
              />
            )}
          </>
        )}
      />
    )
  async function printSheet() {
    const v = view.current
    if (!v) return
    flushSync(() => setPrintBox(v.extent))
    await printPhoto.current?.decode().catch(() => {})
    printTargetSheet(() => setPrintBox(undefined))
  }

  // the page template's panels on /groups only: the workbench's Groups tab keeps its layout
  const panel = panelOf(heading)
  const exportMenu = (
    <ExportMenu
      name={meta.name}
      photoId={sheet.photo}
      photo={shownPhoto(photo)}
      turn={sheet.photoRotation}
      view={view}
      still={stillOf(true)}
      // on /groups the page bar's Print button prints the sheet
      onPrint={heading === undefined ? printSheet : undefined}
      onMessage={say}
      text={heading !== undefined}
    />
  )

  /** Arrow keys, Home and End move the focus along the toolbar; fields and the tool switch keep their keys. */
  const toolbarKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return
    const t = e.target as HTMLElement
    if (t.closest('input, select, textarea, [role="radiogroup"], .mantine-Popover-dropdown')) return
    const items = [
      ...e.currentTarget.querySelectorAll<HTMLElement>('button, select, input[type="radio"]'),
    ].filter(
      (el) =>
        !el.closest('.mantine-Popover-dropdown') &&
        !(el as HTMLButtonElement).disabled &&
        el.getClientRects().length > 0 &&
        (el.getAttribute('type') !== 'radio' || (el as HTMLInputElement).checked),
    )
    const at = items.findIndex((el) => el === t || el.contains(t))
    if (at < 0) return
    e.preventDefault()
    const next =
      e.key === 'Home'
        ? 0
        : e.key === 'End'
          ? items.length - 1
          : (at + (e.key === 'ArrowRight' ? 1 : -1) + items.length) % items.length
    items[next]?.focus()
  }

  const notesOn = (f: NonNullable<typeof frame>, k: number, still?: boolean) => (
    <NotesLayer
      still={still}
      notes={notes}
      groups={sheet.groups}
      frame={f}
      k={k}
      system={system}
      selected={still ? undefined : noteSel}
      movable={tool === 'select'}
      onSelect={setNoteSel}
      onMove={(id, q, first) => {
        if (first) dragKey.current++
        onNote(id, (n) => ({ ...n, x: q.x, y: q.y }), `note-move ${id} ${dragKey.current}`)
      }}
      onNudge={(id, q) => onNote(id, (n) => ({ ...n, x: q.x, y: q.y }), `note-nudge ${id}`)}
      onDelete={(id) => {
        onNote(id, () => undefined)
        setNoteSel(undefined)
      }}
      onEdit={editNote}
    />
  )
  const notesPanel = (
    <NotesPanel
      notes={notes}
      groups={sheet.groups}
      system={system}
      canAdd={!!frame}
      selected={noteSel}
      onAdd={addNote}
      onChange={(id, patch, key) => onNote(id, (n) => ({ ...n, ...patch }), key)}
      onDelete={(id) => onNote(id, () => undefined)}
      fieldRef={noteFields}
    />
  )

  /** The start of an empty sheet, as the workbench tab has it: a photo or shots on a drawn target. */
  const startActions = (size: 'xs' | 'sm') => (
    <span className="row-buttons start-actions">
      <Button
        size={size}
        variant="default"
        leftSection={<ImageIcon size={size === 'sm' ? 16 : 12} aria-hidden="true" />}
        onClick={() => fileInput.current?.click()}
      >
        {sheet.photo ? t('Replace photo') : t('Add photo')}
      </Button>
      <Button
        size={size}
        variant={tool === 'shot' ? 'filled' : 'default'}
        leftSection={<Target size={size === 'sm' ? 16 : 12} aria-hidden="true" />}
        disabled={!frame}
        onClick={() => startTool('shot')}
      >
        {t('Place shots')}
      </Button>
    </span>
  )
  const blankSheet = isBlank(compact, tool, sheet)

  /** Phones: the target fills the screen; a bottom sheet holds the panels. */
  const phone = !compact && width > 0 && width < 600
  const [phoneTop, setPhoneTop] = useState<number>()
  const expanded = expand?.expanded
  // the editor fills the window below its top edge; the expanded editor fills its dialog
  useLayoutEffect(() => {
    if (!phone || expanded) return setPhoneTop(undefined)
    const r = root.current?.getBoundingClientRect()
    if (r) setPhoneTop(Math.round(r.top + window.scrollY))
  }, [phone, expanded])
  const unscaled = isUnscaled(sheet, photo, frame)
  /** What the canvas layers over the target: scoring, notes and hole detection. */
  const layer = (k: number) => (
    <>
      {score.layer(k)}
      {frame && notesOn(frame, k)}
      {detect.layer(k)}
    </>
  )
  const ed: Ed = {
    sheet,
    group,
    frame,
    system,
    compact,
    tool,
    startTool,
    apply,
    applyCal,
    onGroup,
    root,
    score,
    groupScore,
    stats,
    keyValues,
    charges,
    stepLabels,
    step,
    uid,
    filter,
    setFilter,
    refKind,
    setRefKind,
    known,
    setKnown,
    calTool,
    newDistance,
    setActive,
    setSelected,
    deleteGroup,
    scrollFocus,
    shotWindow,
    setShotScroll,
    selected,
    shotAt,
    toggle,
    remove,
    optic,
    options,
    opticChoice,
    setOpticChoice,
    click,
    ladderRows,
    meta,
    setMeta,
    stored,
    sheets,
    setSheets,
    open,
    create: () => create(),
    deleteSheet,
    renaming,
    setRenaming,
    fileInput,
    cameraInput,
    takePhoto,
    removePhoto,
    coarse: !!coarse,
    pop,
    setPop,
    storeError,
    h,
    setH,
    overlays,
    toggleOverlay,
    heading,
    exportMenu,
    expand,
    toolbarKeys,
    unscaled,
    photo,
    pending,
    describe,
    addShot,
    dragKey,
    onPoint,
    view,
    detect,
    layer,
    hint,
    help,
    blankSheet,
    startActions,
    shotsOpen,
    setShotsOpen,
    notesPanel,
    side,
    setSide,
    panel,
    wide,
    phone,
    sheetOpen,
    setSheetOpen,
    fileData,
    kept: keptOf(
      saveFailed,
      sheet !== opened.current.data || meta.name !== opened.current.name,
      stored,
    ),
    storeFromMenu,
    reloadStored,
    printSheet,
  }

  return (
    <>
      <SheetPageBar ed={ed} />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: catches undo, redo and Escape from any control of the editor, and follows the focus for the field help */}
      <div
        ref={rootRef}
        role="presentation"
        className="target-editor"
        {...rootAttrs(wide && !compact, phone, phone && sheetOpen && !expanded)}
        style={editorStyle(phoneTop, sheetOpen)}
        onKeyDown={onKeyDown}
        onFocus={(e) => setHelp(helpOf(e.target))}
        onBlur={() => setHelp(undefined)}
      >
        <Toolbar ed={ed} />
        {printBox && (
          <TargetPrint
            name={meta.name}
            sheet={sheet}
            frame={frame}
            box={printBox}
            photo={shownPhoto(photo)}
            still={stillOf(false)}
            system={system}
            score={(g) => scoreLine(score.of(g.id))}
            summary={summary}
            photoRef={printPhoto}
          />
        )}
        <div className="target-body">
          <Body ed={ed} />
        </div>
      </div>
    </>
  )
}
