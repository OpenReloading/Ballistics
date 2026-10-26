'use client'

import { NativeSelect } from '@mantine/core'
import { fullSection, svgPath, toPartFrame } from '@open-reloading/drawing'
import { bulletDimensions } from '@open-reloading/drawing/bullet'
import { drawnTables } from '@open-reloading/drawing/cartridge'
import {
  bulletOutline,
  chamberOf,
  coalRange,
  jumpNote,
  leadeContact,
  previewDrawn,
  type Seating,
  seat,
  type Tagged,
} from '@open-reloading/drawing/seating'
import { type Bullet, fromSi, toSi } from '@open-reloading/schema'
import {
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../lib/api-fetch.ts'
import type { BulletSummary, CartridgeDetail, CaseSummary } from '../lib/api-types.ts'
import type { StripFigure } from '../lib/barrel-strip.ts'
import { designShape } from '../lib/bullet-designer.ts'
import { drawable } from '../lib/cartridge-sheet.ts'
import { renamedCasePath, type UsedWater, usedWater } from '../lib/case-capacity.ts'
import type { OwnCase } from '../lib/case-group.ts'
import type { FieldValue } from '../lib/field-spec.ts'
import { figureViews } from '../lib/figure-views.ts'
import type { Suggestion } from '../lib/input-defaults.ts'
import { productLabel, refName } from '../lib/manufacturers.ts'
import { nth } from '../lib/nth.ts'
import { type SeatingLengths, seatingLengthName } from '../lib/seating-ladder.ts'
import {
  drawingLengthUnit,
  fixedFieldText,
  formatQuantity,
  type UnitSystem,
  unitsOf,
  waterDensityGramsPerCm3,
  waterGrams,
  waterVolume,
  withUnit,
} from '../lib/units.ts'
import { storedRecords } from '../lib/user-store.ts'
import { type UserBulletView, userBullets } from '../lib/variants.ts'
import { AppModal } from './app-modal.tsx'
import { NumberField } from './number-field.tsx'
import { RecordSearch } from './record-search.tsx'
import { SegmentedRow } from './segmented-row.tsx'
import { SourceTitles } from './sources.tsx'
import { ErrorNote, Loading } from './states.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { measuredWaterCapacitySpec } from './workbench-inputs.tsx'
import { notReached } from './workbench-outcome.ts'

type Load<T> =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ok'; value: T }
  | { status: 'error' }

type Mode = 'overallLength' | 'baseToOgive'

const modeHelp = {
  overallLength: 'Cartridge overall length.',
  baseToOgive: 'Cartridge base to ogive.',
}
const tagText: Record<Tagged['tag'], string> = {
  entered: 'entered',
  sourced: 'sourced',
  derived: 'derived',
  approximate: 'approximate',
}

/**
 * A cartridge as designed instead of a catalogue record: its values give the case and the
 * chamber. What the design lacks is shown as not given, and no seating starts by itself.
 */
export interface DraftCartridge {
  spec: ReturnType<typeof drawable>
  /** Names the design in the drawing's title and description. */
  title: string
  /**
   * The workbench's card: the page's fields show what the rows leave out and the figure draws the
   * design itself, with the cartridge and chamber views. Without it the page is the designer, whose
   * own drawing is above.
   */
  card?: true
}

/** The seated bullet's volume (m³), travel, COAL and CBTO (m), for the page's fields and print. */
export type Seated = {
  /** The case volume to the mouth, m³ (the capacity record or the measured one), seated or not. */
  caseVolume?: number
  volume?: number | undefined
  travel?: number | undefined
  overallLength?: number
  baseToOgive?: number
  /** Seating depth and the barrel length of the seating, m, for print. */
  depth?: number
  barrel?: number
  /** The length the bullet is seated by; the other one is derived. */
  mode?: Mode | undefined
  /** The seating is the preview's own start (initial, L6 or mid-range), not a user move. */
  atStart?: boolean
  /** What the chart's barrel strip draws. */
  figure?: StripFigure
}

/** A record fetched through `apiFetch`; a later id aborts the earlier request. */
function useRecord<T>(url: string | undefined): Load<T> {
  const [state, setState] = useState<Load<T>>({ status: 'none' })
  useEffect(() => {
    if (!url) {
      setState({ status: 'none' })
      return
    }
    const controller = new AbortController()
    setState({ status: 'loading' })
    apiFetch(url, { signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const value = (await res.json()) as T
        if (!controller.signal.aborted) setState({ status: 'ok', value })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'error' })
      })
    return () => controller.abort()
  }, [url])
  return state
}

function Badge({ tag }: { tag: Tagged['tag'] }) {
  return <span className={`flag flag-${tag}`}>{tagText[tag]}</span>
}

function Row({
  term,
  value,
  unit,
  tag,
  note,
}: {
  term: string
  value: string
  /** The unit of `value`, in a column of its own in the workbench card. */
  unit?: string | undefined
  tag?: Tagged['tag'] | undefined
  note?: ReactNode
}) {
  return (
    <div className="seating-row">
      <dt>{term}</dt>
      <dd>
        <span className="num">{value}</span>
        {unit && <span className="row-unit"> {unit}</span>} {tag && <Badge tag={tag} />}
        {note && <span className="seating-basis">{note}</span>}
      </dd>
    </div>
  )
}

/** A value the inputs do not give: no number and no default, and what it needs. */
function NotGiven({ term, why }: { term: string; why: string }) {
  return <Row term={term} value="not given" note={`needs ${why}`} />
}

/** The seated bullet over the drawing, in the part frame (mm): inside the case mouth dimmed and dashed. */
function SeatedBullet({
  id,
  s,
  caseLength,
  leade,
  g1,
}: {
  id: string
  s: Seating
  caseLength: number
  leade?: number | undefined
  g1?: number | undefined
}) {
  const { outline, basePosition: base } = s
  const body = svgPath(fullSection(outline.points), true)
  const strokes = (approximate: boolean) =>
    outline.segments
      .filter((g) => g.approximate === approximate)
      .map((g) => svgPath(toPartFrame(g.points)) + svgPath(toPartFrame(g.points, -1)))
      .join('')
  const shape = (
    <>
      <path className="body" d={body} />
      <path className="line" d={strokes(false)} />
      <path className="line approx" d={strokes(true)} />
    </>
  )
  // the clips stay at the mouth while the bullet moves: in the bullet's frame the mouth is at caseLength - base
  const mouth = caseLength - base
  const r = Math.max(...outline.points.map(([y]) => y)) + 1
  const z = nth(outline.points, outline.points.length - 1)[1] + 1
  return (
    <g className="seating">
      {leade !== undefined && g1 !== undefined && (
        <path
          className="seating-leade"
          d={`M${leade} ${g1 / 2}V${g1 / 2 + 2.5}M${leade} ${-g1 / 2}V${-g1 / 2 - 2.5}`}
        />
      )}
      <g className="seating-bullet" transform={`translate(${base.toFixed(3)} 0)`}>
        <clipPath id={`${id}-out`}>
          <rect x={mouth} y={-r} width={Math.max(z - mouth, 0)} height={2 * r} />
        </clipPath>
        <clipPath id={`${id}-in`}>
          <rect x={-1} y={-r} width={Math.max(mouth + 1, 0)} height={2 * r} />
        </clipPath>
        <g className="seating-in" clipPath={`url(#${id}-in)`}>
          {shape}
        </g>
        <g clipPath={`url(#${id}-out)`}>{shape}</g>
      </g>
    </g>
  )
}

type PreviewProps = {
  /** The catalogue record to seat in; none for a `draft`. */
  cartridge?: { id: string; name: string } | undefined
  /** The cartridge design to seat in, instead of a record. */
  draft?: DraftCartridge | undefined
  system: UnitSystem
  /** The example's bullet id and barrel length (m); the seating of the example or an opened load (m). */
  initial?:
    | {
        bullet?: string | undefined
        barrel?: number | undefined
        seating?: { by: Mode; value: number } | undefined
      }
    | undefined
  /** The chosen firearm's barrel length, m: a new one replaces the field's value, the seating stays. */
  barrelLength?: number | undefined
  /** The barrel length used until one is typed or a gun gives one, m, with where it comes from. */
  barrelDefault?: Suggestion | undefined
  /** Volume (m³) and travel (m) of the seated bullet, on every change: the interior fields follow them. */
  onSeated: (values: Seated) => void
  /** The seating at another length, for a seating ladder; undefined while no bullet is seated. */
  onSeatLadder?: (seatAt: SeatingLengths | undefined) => void
  /**
   * The user's measured case capacity (water to the mouth, m³), held by the page so a remount keeps
   * it: replaces the record's.
   */
  measuredWaterCapacity?: FieldValue | undefined
  onMeasuredWaterCapacity?: (value: FieldValue) => void
  /** The capacity record chosen, held by the page so a load keeps it; without it the choice is the figure's own. */
  capacityId?: string | undefined
  onCapacityId?: (id: string | undefined) => void
  /** The case record chosen, held by the page so a load keeps it: its stated capacity is the default of the capacity. */
  caseId?: string | undefined
  onCaseId?: (id: string | undefined) => void
  /** The user's groups of cases of this cartridge, and the one chosen: its measured capacity is the page's measured capacity. */
  ownCases?: readonly OwnCase[] | undefined
  ownCaseId?: string | undefined
  onOwnCaseId?: (id: string | undefined) => void
  /**
   * The bullet record or design of the page's own bullet input: the preview seats it and
   * shows no bullet search or design choice of its own.
   */
  linked?: { bullet?: string | undefined; design?: string | undefined }
  /**
   * Where the controls go instead of beside the drawing: case capacity, seating and the
   * values in `cartridge`, the barrel length in `gun`; the figure keeps the drawing.
   */
  slots?: {
    cartridge: HTMLElement | null
    gun: HTMLElement | null
    /** Rarely needed parts: the capacity record (`more`) and further values (`moreValues`, a `dl`). */
    more?: HTMLElement | null
    moreValues?: HTMLElement | null
  }
  /** Combined: both outlines, no dimensions; Cartridge or Chamber: that side's dimensioned record figure. */
  view?: 'cartridge' | 'chamber' | 'combined' | undefined
  /** A seating ladder step to draw instead of the field's seating, m; the fields keep theirs. */
  ladderStep?: { by: Mode; value: number } | undefined
  /** The figure's full view: the same drawing in a modal at the window's height. */
  fullView?: { opened: boolean; onClose: () => void }
}

type Spec = NonNullable<ReturnType<typeof specOf>>
type Chamber = NonNullable<ReturnType<typeof chamberOf>>
type Shape = NonNullable<ReturnType<typeof shapeOf>>
type Capacity = CartridgeDetail['capacities'][number]
type Slots = PreviewProps['slots']

const emptyValue = (): FieldValue => ({ text: '', si: undefined })

/** The barrel length field for `m`, its text in the units shown; empty without a value. */
function barrelFieldValue(units: UnitSystem, m: number | undefined): FieldValue {
  return m === undefined ? emptyValue() : { text: fixedFieldText('barrelLength', units, m), si: m }
}

const detailUrl = (cartridge: PreviewProps['cartridge'], draft: DraftCartridge | undefined) =>
  cartridge && !draft ? `cartridges/${encodeURIComponent(cartridge.id)}` : undefined

const casesUrl = (cartridge: PreviewProps['cartridge'], draft: DraftCartridge | undefined) =>
  cartridge && !draft
    ? `cases?${new URLSearchParams({ cartridge: cartridge.id, limit: '200' })}`
    : undefined

const bulletUrl = (id: string | undefined) => (id ? `bullets/${encodeURIComponent(id)}` : undefined)

const nameOf = (draft: DraftCartridge | undefined, cartridge: PreviewProps['cartridge']) =>
  draft?.title ?? cartridge?.name ?? ''

/** The bullet record or design the preview seats: the page's own when linked, else the one searched or picked. */
function useBulletChoice(initialBullet: string | undefined, linked: PreviewProps['linked']) {
  const [bulletId, setBulletId] = useState(initialBullet)
  const [designs, setDesigns] = useState<UserBulletView[]>([])
  /** A bullet design of this browser seated instead of a record. */
  const [design, setDesign] = useState<UserBulletView>()
  const readDesigns = () => {
    storedRecords()
      .then(({ records }) => userBullets(records))
      .then(setDesigns)
      .catch(() => {})
  }
  useEffect(readDesigns, [])
  // a linked preview follows the page's bullet record or design
  const [linkedBullet, linkedDesign] = [linked?.bullet, linked?.design]
  const isLinked = Boolean(linked)
  useEffect(() => {
    if (!isLinked) return
    if (linkedBullet) setBulletId(linkedBullet)
    setDesign(linkedDesign ? designs.find((d) => d.id === linkedDesign) : undefined)
  }, [isLinked, linkedBullet, linkedDesign, designs])
  const record = useRecord<Bullet>(bulletUrl(bulletId))
  return { setBulletId, designs, design, setDesign, readDesigns, record }
}

/** The barrel length field: the gun's, the example's or typed, else the default. */
function useBarrel(o: {
  barrelLength: number | undefined
  initialBarrel: number | undefined
  barrelDefault: Suggestion | undefined
  system: UnitSystem
  shown: RefObject<UnitSystem>
}) {
  const { barrelLength, initialBarrel, barrelDefault, system, shown } = o
  const [barrel, setBarrel] = useState<FieldValue>(() =>
    barrelFieldValue(system, barrelLength ?? initialBarrel),
  )
  /** The barrel length is the gun's, the example's or typed: no longer the default. */
  const [barrelTyped, setBarrelTyped] = useState(
    () => (barrelLength ?? initialBarrel) !== undefined,
  )
  const defaultBarrel = barrelDefault?.si
  useEffect(() => {
    if (barrelLength === undefined) return
    setBarrel(barrelFieldValue(shown.current, barrelLength))
    setBarrelTyped(true)
  }, [barrelLength, shown])
  // the default follows the cartridge's class and the Settings until one is typed
  useEffect(() => {
    if (barrelTyped) return
    setBarrel(barrelFieldValue(shown.current, defaultBarrel))
  }, [barrelTyped, defaultBarrel, shown])
  return { barrel, setBarrel, barrelTyped, setBarrelTyped }
}

/** A unit switch rewrites the texts from the SI values. */
function useUnitRewrite(
  system: UnitSystem,
  shown: RefObject<UnitSystem>,
  setBarrel: Dispatch<SetStateAction<FieldValue>>,
  setPos: Dispatch<SetStateAction<FieldValue>>,
) {
  useEffect(() => {
    const was = shown.current
    shown.current = system
    const rewrite = (q: 'length' | 'barrelLength') => (f: FieldValue) =>
      f.si === undefined ? f : { text: fixedFieldText(q, system, f.si), si: f.si }
    if (was.barrelLength !== system.barrelLength) setBarrel(rewrite('barrelLength'))
    if (was.length !== system.length) setPos(rewrite('length'))
  }, [system, shown, setBarrel, setPos])
}

/** The record when its table draws, or the design's own. */
function specOf(draftSpec: DraftCartridge['spec'] | undefined, detail: Load<CartridgeDetail>) {
  if (draftSpec) return draftSpec
  return detail.status === 'ok' && drawnTables.has(detail.value.table)
    ? drawable(detail.value)
    : undefined
}

/** The bullet's shape in mm whatever the units: a unit switch must not move the bullet. */
function shapeOf(
  design: UserBulletView | undefined,
  bulletRecord: Bullet | undefined,
  units: UnitSystem,
) {
  return design
    ? designShape(design.resolved, units)
    : bulletRecord && bulletDimensions(bulletRecord)
}

/** Why a record whose dimensions cannot form an outline is not seated. */
function refusalOf(shaped: ReturnType<typeof shapeOf>) {
  const o = shaped && bulletOutline(shaped)
  return o && 'reason' in o ? o.reason : undefined
}

/** The slider range and the drawing: they depend on the records only, never on the position. */
function fixedOf(spec: Spec | undefined, chamber: Chamber | undefined, shape: Shape | undefined) {
  if (!spec || !chamber || !shape) return
  const contact = leadeContact(chamber, shape.diameter)
  const outline = bulletOutline(shape)
  const contactCoal =
    'z' in contact && 'noseLength' in outline && !outline.noseAssumed
      ? contact.z + outline.noseLength
      : undefined
  const range = coalRange(chamber, shape, contactCoal)
  const drawn = previewDrawn(spec.values, spec.table, range[1] + 2)
  if ('missing' in drawn) return { range, missing: drawn.missing }
  return { range, drawn }
}

/** The records the seating reads: cartridge, capacity, bullet, the shape and its outline. */
function useGeometry(o: {
  draft: DraftCartridge | undefined
  detail: Load<CartridgeDetail>
  record: Load<Bullet>
  design: UserBulletView | undefined
  shown: RefObject<UnitSystem>
}) {
  const { draft, detail, record, design, shown } = o
  const draftSpec = draft?.spec
  const spec = useMemo(() => specOf(draftSpec, detail), [draftSpec, detail])
  const chamber = useMemo(() => spec && chamberOf(spec.values), [spec])
  const capacities = capacitiesOf(detail)
  const bulletRecord = record.status === 'ok' && !design ? record.value : undefined
  const shaped = useMemo(
    () => shapeOf(design, bulletRecord, shown.current),
    [design, bulletRecord, shown],
  )
  // a record whose dimensions cannot form an outline is not seated; its reason is shown
  const refused = useMemo(() => refusalOf(shaped), [shaped])
  const shape = refused ? undefined : shaped
  const fixed = useMemo(() => fixedOf(spec, chamber, shape), [spec, chamber, shape])
  return { spec, chamber, capacities, bulletRecord, shaped, refused, shape, fixed }
}

const capacitiesOf = (detail: Load<CartridgeDetail>): Capacity[] =>
  detail.status === 'ok' ? detail.value.capacities : []

/** The seating a new bullet or cartridge starts at: the given one, else L6, else the middle of the range. */
function startOf(
  range: readonly [number, number],
  chamber: Chamber,
  by: Mode | undefined,
  value: number | undefined,
  canCbto: boolean,
) {
  // CBTO only with a base to ogive
  const given = value !== undefined && (by === 'overallLength' || canCbto)
  const si = given ? value : toSi('length', chamber.cartridgeL6 ?? (range[0] + range[1]) / 2)
  const mode: Mode = given && by === 'baseToOgive' ? 'baseToOgive' : 'overallLength'
  return { si, mode }
}

/** Starts the position at a new bullet or cartridge; a design starts empty. */
function useStart(o: {
  range: readonly [number, number] | undefined
  chamber: Chamber | undefined
  designed: boolean
  shape: Shape | undefined
  canCbto: boolean
  mode: Mode
  initial: PreviewProps['initial']
  shown: RefObject<UnitSystem>
  setMode: Dispatch<SetStateAction<Mode>>
  setPos: Dispatch<SetStateAction<FieldValue>>
  setStarted: Dispatch<SetStateAction<{ si: number; mode: Mode } | undefined>>
}) {
  const { range, chamber, designed, shape, canCbto, mode, shown, setMode, setPos, setStarted } = o
  const [initialBy, initialValue] = [o.initial?.seating?.by, o.initial?.seating?.value]
  useEffect(() => {
    // a design starts empty: a seating the user did not enter would be a default
    if (!range || !chamber || designed) return
    const start = startOf(range, chamber, initialBy, initialValue, canCbto)
    setMode(start.mode)
    setPos({ text: fixedFieldText('length', shown.current, start.si), si: start.si })
    setStarted(start)
  }, [
    range,
    chamber,
    designed,
    initialBy,
    initialValue,
    canCbto,
    shown,
    setMode,
    setPos,
    setStarted,
  ])
  // a bullet without a base-to-ogive cannot keep a CBTO entered for the one before
  useEffect(() => {
    if (!designed || !shape || canCbto || mode !== 'baseToOgive') return
    setMode('overallLength')
    setPos(emptyValue())
  }, [designed, shape, canCbto, mode, setMode, setPos])
}

const positive = (si: number | undefined) => (si !== undefined && si > 0 ? si : undefined)

/** The bullet seated by a length (mm), for the preview's position and each step of a seating ladder. */
function seatBuilder(o: {
  chamber: Chamber | undefined
  shape: Shape | undefined
  mode: Mode
  canCbto: boolean
  /** The water (g) the case holds. */
  water: number | undefined
  barrel: number | undefined
}) {
  const { chamber, shape, mode, canCbto, water, barrel } = o
  if (!chamber || !shape || (mode === 'baseToOgive' && !canCbto)) return
  return (by: number) =>
    seat({
      bullet: shape,
      chamber,
      waterCapacity: water,
      waterDensity: waterDensityGramsPerCm3,
      barrelLength: barrel === undefined ? undefined : fromSi('length', barrel),
      by: { kind: mode, value: by },
    })
}

/** The case volume to the mouth, m³: the measured one, else the water of the capacity record or the case record. */
const caseVolumeOf = (measured: number | undefined, water: UsedWater | undefined) =>
  measured !== undefined ? measured : water && waterVolume(water.grams)

type SeatFn = ReturnType<typeof seatBuilder>

/** The seating of the figure: a seating ladder step in the field's mode, else the field's seating. */
function ladderSeating(
  seatBy: SeatFn,
  ladder: { by: Mode | undefined; value: number | undefined },
  mode: Mode,
  seating: Seating | undefined,
) {
  return seatBy && ladder.by === mode && ladder.value !== undefined
    ? seatBy(fromSi('length', ladder.value))
    : seating
}

type Seated3 = { coal: number; cbto: number | undefined } | undefined

/** The card's Cartridge, Chamber and Combined views; the Cartridge view's L6 is the seated COAL. */
function cardModels(
  spec: Spec | undefined,
  designer: boolean,
  drawn: Parameters<typeof figureViews>[1],
  unit: Parameters<typeof figureViews>[2],
  seated: Seated3,
): ReturnType<typeof figureViews> {
  return spec && !designer ? figureViews(spec, drawn, unit, seated) : {}
}

/**
 * The workbench card also draws the figure level, shown where its panel is wider than tall; a
 * design draws it level only, in the room under its own drawing, framed to the combined view.
 */
function levelViewsOf(
  spec: Spec | undefined,
  drawIt: boolean,
  designer: boolean,
  drawn: Parameters<typeof figureViews>[1],
  unit: Parameters<typeof figureViews>[2],
  seated: Seated3,
): ReturnType<typeof figureViews> {
  return spec && drawIt
    ? figureViews(spec, drawn, unit, seated, 'print', designer ? ['combined'] : undefined)
    : {}
}

/** The seating mode's length minus COAL: the slider and the ladder show the mode's length. */
const ladderShiftOf = (shape: Shape | undefined, mode: Mode) =>
  shape?.baseToOgive !== undefined && mode === 'baseToOgive' ? shape.baseToOgive - shape.length : 0

function seatAtOf(
  seatBy: SeatFn,
  range: readonly [number, number] | undefined,
  mode: Mode,
  shift: number,
): SeatingLengths | undefined {
  if (!seatBy || !range) return undefined
  return {
    lengthKind: mode,
    range: [toSi('length', range[0] + shift), toSi('length', range[1] + shift)],
    at: (by) => {
      const s = seatBy(fromSi('length', by))
      return {
        volume: s.volumeBehindBullet && unitsOf.capacity.cm3.toSi(s.volumeBehindBullet.value),
        travel: s.travel && toSi('length', s.travel.value),
      }
    },
  }
}

const figureOf = (spec: Spec | undefined, seating: Seating | undefined) =>
  spec && seating
    ? {
        values: spec.values,
        table: spec.table,
        bullet: seating.outline.points,
        base: seating.basePosition,
      }
    : undefined

/** What the page's fields follow, from the seating; none seated reports `{}`. */
function seatedReport(o: {
  caseVolume: number | undefined
  seating: Seating | undefined
  barrel: number | undefined
  mode: Mode
  atStart: boolean
  figure: Seated['figure']
}): Seated {
  const { caseVolume, seating, barrel, mode, atStart, figure } = o
  const [volume, travel] = [seating?.volumeBehindBullet?.value, seating?.travel?.value]
  const [coal, cbto, depth] = [seating?.coal.value, seating?.cbto?.value, seating?.depth.value]
  return {
    ...(caseVolume !== undefined && { caseVolume }),
    ...(volume !== undefined && { volume: unitsOf.capacity.cm3.toSi(volume) }),
    ...(travel !== undefined && { travel: toSi('length', travel) }),
    ...(coal !== undefined && { overallLength: toSi('length', coal) }),
    ...(cbto !== undefined && { baseToOgive: toSi('length', cbto) }),
    ...(depth !== undefined && { depth: toSi('length', depth) }),
    ...(coal !== undefined && barrel !== undefined && { barrel }),
    ...(coal !== undefined && { mode, atStart }),
    ...(figure && { figure }),
  }
}

/** The interior fields follow the seated bullet, derived from COAL. */
function useReportSeated(
  onSeated: (values: Seated) => void,
  o: Parameters<typeof seatedReport>[0],
) {
  const seated = useRef(onSeated)
  seated.current = onSeated
  const { caseVolume, seating, barrel, mode, atStart, figure } = o
  const key = [
    caseVolume,
    seating?.volumeBehindBullet?.value,
    seating?.travel?.value,
    seating?.coal.value,
    seating?.cbto?.value,
    seating?.depth.value,
    barrel,
    mode,
    atStart,
  ]
  // no seated bullet reports {}: the page forgets the earlier seating
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reported values only, not the seating object
  useEffect(() => {
    seated.current(seatedReport({ caseVolume, seating, barrel, mode, atStart, figure }))
  }, [...key, figure])
}

function useLive(announce: string) {
  const [live, setLive] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setLive(announce), 600)
    return () => clearTimeout(timer)
  }, [announce])
  return live
}

/** The seating's state and values: every hook of the preview, so its parts only draw. */
function useSeatingModel(p: PreviewProps) {
  const { cartridge, draft, system, initial, onSeatLadder, slots, view = 'combined' } = p
  const { measuredWaterCapacity = emptyValue(), ladderStep } = p
  const id = useId().replace(/:/g, '')
  const detail = useRecord<CartridgeDetail>(detailUrl(cartridge, draft))
  const designed = draft !== undefined
  /** The designer page: its own drawing is above, its controls in one section. */
  const designer = isDesigner(draft)
  const name = nameOf(draft, cartridge)
  const bullet = useBulletChoice(initial?.bullet, p.linked)
  const { design, record } = bullet
  const names = useManufacturerNames()
  const [ownCapacityId, setOwnCapacityId] = useState<string | undefined>(undefined)
  const capacityId = p.onCapacityId ? p.capacityId : ownCapacityId
  const setCapacityId = p.onCapacityId ?? setOwnCapacityId
  const caseList = useRecord<{ items: CaseSummary[] }>(casesUrl(cartridge, draft))
  const [ownCaseId, setOwnCaseId] = useState<string | undefined>(undefined)
  const caseId = p.onCaseId ? p.caseId : ownCaseId
  const setCaseId = p.onCaseId ?? setOwnCaseId
  const shown = useRef(system)
  const { barrel, setBarrel, barrelTyped, setBarrelTyped } = useBarrel({
    barrelLength: p.barrelLength,
    initialBarrel: initial?.barrel,
    barrelDefault: p.barrelDefault,
    system,
    shown,
  })
  const [mode, setMode] = useState<Mode>('overallLength')
  const [pos, setPos] = useState<FieldValue>(emptyValue)
  /** The position and mode the preview last started at by itself. */
  const [started, setStarted] = useState<{ si: number; mode: Mode }>()
  useUnitRewrite(system, shown, setBarrel, setPos)
  const { spec, chamber, capacities, shape, fixed, ...geometry } = useGeometry({
    draft,
    detail,
    record,
    design,
    shown,
  })
  const chosenCase =
    caseList.status === 'ok' ? caseList.value.items.find((c) => c.id === caseId) : undefined
  // a renamed case answers with the record that replaced it: the choice takes that id
  const renamed = useRecord<{ id: string }>(
    renamedCasePath(caseId, caseList.status === 'ok' ? caseList.value.items : undefined),
  )
  const renamedTo = renamed.status === 'ok' ? renamed.value.id : undefined
  useEffect(() => {
    if (renamedTo !== undefined && renamedTo !== caseId) setCaseId(renamedTo)
  }, [renamedTo, caseId, setCaseId])
  // a case record is chosen but not read (loading, failed or no longer listed): no other record stands in
  const pendingCase = caseId !== undefined && chosenCase === undefined
  // apart from `fixed`: a unit switch relabels the drawing and keeps the seating position
  const unit = drawingLengthUnit(system)
  const canCbto = shape?.baseToOgive !== undefined
  const range = fixed?.range
  useStart({
    range,
    chamber,
    designed,
    shape,
    canCbto,
    mode,
    initial,
    shown,
    setMode,
    setPos,
    setStarted,
  })

  const value = lengthMm(pos)
  const measured = positive(measuredWaterCapacity.si)
  const stated = chosenCase?.waterCapacity
  // the records' water, and the water with a measured value typed over it
  const stock = usedWater({ capacities, capacityId, stated, pendingCase })
  const capacity = stock?.record
  const water = usedWater({
    measured: measured === undefined ? undefined : waterGrams(measured),
    capacities,
    capacityId,
    stated,
    pendingCase,
  })
  const waterUsed = water?.grams
  const seatBy = useMemo(
    () => seatBuilder({ chamber, shape, mode, canCbto, water: waterUsed, barrel: barrel.si }),
    [chamber, shape, mode, canCbto, waterUsed, barrel.si],
  )
  const seating = useMemo(
    () => (seatBy && value !== undefined ? seatBy(value) : undefined),
    [seatBy, value],
  )
  const [stepBy, stepValue] = [ladderStep?.by, ladderStep?.value]
  const figureSeating = useMemo(
    () => ladderSeating(seatBy, { by: stepBy, value: stepValue }, mode, seating),
    [seatBy, stepBy, stepValue, mode, seating],
  )
  // Combined without dimensions, each side's record figure with them, as on the cartridge page;
  // one frame for all, which reaches the longest COAL, so the bullet tip stays in view and the
  // outline stays put when the view changes; the bullet goes on top. In the workbench card the
  // Cartridge view's L6 is the seated COAL, with the seated CBTO added
  const [coal, cbto, inCard] = [
    figureSeating?.coal.value,
    figureSeating?.cbto?.value,
    isCard(slots, designer),
  ]
  const drawn = fixed?.drawn
  const models = useMemo(
    () => cardModels(spec, designer, drawn, unit, inCard ? coalOf(coal, cbto) : undefined),
    [spec, drawn, unit, inCard, designer, coal, cbto],
  )
  const levelModels = useMemo(
    () => levelViewsOf(spec, inCard || designer, designer, drawn, unit, coalOf(coal, cbto)),
    [spec, drawn, unit, inCard, designer, coal, cbto],
  )
  // the slider's range in the mode's length, for the seating ladder
  const ladderShift = ladderShiftOf(shape, mode)
  const seatAt = useMemo(
    () => seatAtOf(seatBy, range, mode, ladderShift),
    [seatBy, range, mode, ladderShift],
  )
  const onSeatAt = useRef(onSeatLadder)
  onSeatAt.current = onSeatLadder
  useEffect(() => {
    onSeatAt.current?.(seatAt)
    return () => onSeatAt.current?.(undefined)
  }, [seatAt])

  const figure = useMemo(() => figureOf(spec, seating), [spec, seating])
  const atStart = pos.si === started?.si && mode === started?.mode
  const caseVolume = caseVolumeOf(measured, water)
  useReportSeated(p.onSeated, { caseVolume, seating, barrel: barrel.si, mode, atStart, figure })

  const fmt = unitFormats(system)
  const contact = contactText(seating, fmt.mm)
  /** The workbench's cards: the fields there show what the rows below leave out. */
  const card = inCard
  const warnings = warningsOf(seating, chamber, designed, contact, fmt.mm)
  const live = useLive(announceOf(seating, fmt.mm))

  function changeMode(next: Mode) {
    if (next === mode || !shape) return
    const moved = movedPosition(value, next, shape, system)
    if (moved) setPos(moved)
    setMode(next)
  }

  return {
    ...geometry,
    ...bullet,
    ...fmt,
    p,
    id,
    detail,
    designed,
    designer,
    name,
    names,
    spec,
    chamber,
    capacities,
    capacity,
    stock,
    caseList,
    chosenCase,
    setCaseId,
    shape,
    fixed,
    range,
    view,
    slots,
    system,
    barrel,
    barrelTyped,
    setBarrel,
    setBarrelTyped,
    mode,
    pos,
    setPos,
    started,
    setCapacityId,
    seating,
    figureSeating,
    model: models[view],
    levelModel: levelModels[view],
    ladderShift,
    contact,
    card,
    warnings,
    live,
    changeMode,
    canCbto,
    measuredWaterCapacity,
  }
}

type Model = ReturnType<typeof useSeatingModel>

const isDesigner = (draft: DraftCartridge | undefined) => draft !== undefined && !draft.card
const isCard = (slots: Slots, designer: boolean) => Boolean(slots) && !designer
const coalOf = (coal: number | undefined, cbto: number | undefined): Seated3 =>
  coal === undefined ? undefined : { coal, cbto }
const lengthMm = (pos: FieldValue) => (pos.si === undefined ? undefined : fromSi('length', pos.si))

/** The length formats of the units shown: `len` the number, `mm` with its symbol, `vol` a cm³ volume. */
function unitFormats(system: UnitSystem) {
  const length = system.length
  const len = (x: number) => formatQuantity('length', system, toSi('length', x))
  return {
    length,
    len,
    mm: (x: number) => `${len(x)} ${length.symbol}`,
    vol: (cm3: number) => withUnit('capacity', system, unitsOf.capacity.cm3.toSi(cm3)),
  }
}

const contactText = (seating: Seating | undefined, mm: (x: number) => string) =>
  seating?.contact &&
  `Contact with leade (${seating.jump.tag}): the bullet reaches the leade at ${mm(seating.contactCoal as number)} COAL; it is not moved back.`

function warningsOf(
  seating: Seating | undefined,
  chamber: Chamber | undefined,
  designed: boolean,
  contact: string | false | undefined,
  mm: (x: number) => string,
) {
  const above =
    seating?.aboveL6 &&
    chamber?.cartridgeL6 !== undefined &&
    `Above the ${designed ? 'cartridge' : 'CIP maximum'} L6 of ${mm(chamber.cartridgeL6)}`
  return [above, contact].filter((w): w is string => !!w)
}

const jumpText = (s: Seating, mm: (x: number) => string) =>
  s.jump.value === undefined ? jumpNote(s.jump) : `${mm(s.jump.value)}, ${s.jump.tag}`

const announceOf = (seating: Seating | undefined, mm: (x: number) => string) =>
  seating
    ? `COAL ${mm(seating.coal.value)}, seating depth ${mm(seating.depth.value)}, jump ${jumpText(seating, mm)}${seating.contact ? ', contact with leade' : ''}.`
    : ''

/** The position in the other mode's length, or undefined when the bullet gives no shift. */
function movedPosition(
  value: number | undefined,
  next: Mode,
  shape: Shape,
  system: UnitSystem,
): FieldValue | undefined {
  if (value === undefined || shape.baseToOgive === undefined) return undefined
  const shift = shape.baseToOgive - shape.length
  const mmValue = next === 'baseToOgive' ? value + shift : value - shift
  return {
    text: fixedFieldText('length', system, toSi('length', mmValue)),
    si: toSi('length', mmValue),
  }
}

/** What stands in for the preview while the record loads, fails or lacks a drawing; else the spec and chamber. */
function gateOf(m: Model): { gate: ReactNode } | { spec: Spec; chamber: Chamber } {
  const { designed, detail, spec, chamber, name } = m
  if (!designed && (detail.status === 'loading' || detail.status === 'none'))
    return { gate: <Loading what="the cartridge record" inline /> }
  if (!designed && detail.status === 'error') return { gate: <p>{notReached}</p> }
  if (spec && chamber) return { spec, chamber }
  return {
    gate: (
      <p>
        {designed
          ? 'Not given: the cartridge L3, which the seating needs.'
          : `No CIP drawing for ${name}: the preview needs the CIP cartridge and chamber values.`}
      </p>
    ),
  }
}

/** A part in its slot, or in place without slots; nothing while the slot is not mounted. */
function put(slots: Slots, node: ReactNode, target: HTMLElement | null | undefined) {
  if (!slots) return node
  return target ? createPortal(node, target) : null
}

/** A rarely needed part: in the `more` slot when the page gives one, else in place. */
function aside(slots: Slots, node: ReactNode, target: HTMLElement | null | undefined) {
  if (!slots || target === undefined) return node
  return target ? createPortal(node, target) : null
}

/** The capacity record's description: its water, and its case maker when it has one. */
function capacityText(c: Capacity, names: Model['names']) {
  const maker = c.caseManufacturer
    ? `, ${refName(names, c.caseManufacturer) || c.caseManufacturer}`
    : ''
  return `${c.id}: ${c.waterCapacity.value} g water${maker}`
}

function BarrelField({ m }: { m: Model }) {
  const { system, barrel, barrelTyped } = m
  const barrelDefault = m.p.barrelDefault
  return (
    <NumberField
      spec={{
        key: 'barrel',
        label: 'Barrel length',
        help: 'From the breech face.',
        quantity: 'barrelLength',
        min: 0,
      }}
      system={system}
      value={barrel}
      muted={!barrelTyped && barrel.si !== undefined}
      mark={!barrelTyped && barrelDefault ? `Default: ${barrelDefault.source}.` : undefined}
      onChange={(v) => {
        m.setBarrel(v)
        m.setBarrelTyped(true)
      }}
      // an emptied field takes the default again
      onBlur={() => barrel.text.trim() === '' && m.setBarrelTyped(false)}
    />
  )
}

function BulletPicker({ m }: { m: Model }) {
  const { design, designs, names } = m
  return (
    <>
      <RecordSearch<BulletSummary>
        kind="bullets"
        label="Search bullets by manufacturer or name"
        describe={(b) => productLabel(b, names)}
        onSelect={(b) => {
          m.setDesign(undefined)
          m.setBulletId(b.id)
        }}
        noneText="No bullet found"
        unreachableText={notReached}
      />
      <NativeSelect
        label="Or a bullet design"
        description="From your bullet designs in this browser."
        value={design?.id ?? ''}
        onFocus={m.readDesigns}
        onChange={(e) => m.setDesign(designs.find((d) => d.id === e.currentTarget.value))}
        data={[
          { value: '', label: designs.length ? 'None' : 'None in this browser' },
          ...designs.map((d) => ({ value: d.id, label: d.name })),
        ]}
      />
    </>
  )
}

/** What the bullet choice stands at: loading, failed, the record or design in use, and why it does not seat. */
function BulletStatus({ m }: { m: Model }) {
  const { design, record, bulletRecord, shaped, refused, names } = m
  return (
    <>
      {!design && record.status === 'loading' && <Loading what="the bullet record" inline />}
      {!design && record.status === 'error' && <p>{notReached}</p>}
      {design && (
        <p className="record">Bullet: {design.name} (user design, not a catalogue record)</p>
      )}
      {design && !shaped && (
        <p>This bullet design has no length or does not draw: the preview needs both.</p>
      )}
      {bulletRecord && (
        <p className="record">
          Bullet: {productLabel(bulletRecord, names)} ({bulletRecord.id}
          {bulletRecord.provenance.sources[0] && (
            <>
              , <SourceTitles sources={bulletRecord.provenance.sources.slice(0, 1)} />
            </>
          )}
          )
        </p>
      )}
      {bulletRecord && !shaped && <p>This bullet record has no length: the preview needs it.</p>}
      {refused && <p>The bullet outline is not drawn: {refused}</p>}
    </>
  )
}

/** The case products of the cartridge: choosing one makes its stated capacity the default. */
function CaseChoice({ m }: { m: Model }) {
  const { caseList, names } = m
  const items = caseList.status === 'ok' ? caseList.value.items : []
  const own = m.p.ownCases ?? []
  const ownId = m.p.ownCaseId
  if (items.length === 0 && own.length === 0 && !ownId) return null
  const ownItems = [
    ...own.map((c) => ({ value: `user:${c.id}`, label: ownCaseText(c) })),
    // a load names a group this browser does not have
    ...(ownId && !own.some((c) => c.id === ownId)
      ? [{ value: `user:${ownId}`, label: 'A case group not in this browser' }]
      : []),
  ]
  return (
    <NativeSelect
      label="Case record"
      value={ownId ? `user:${ownId}` : (m.chosenCase?.id ?? '')}
      onChange={(e) => {
        const v = e.currentTarget.value
        if (v.startsWith('user:')) m.p.onOwnCaseId?.(v.slice('user:'.length))
        else m.setCaseId(v || undefined)
      }}
      data={[
        { value: '', label: 'None' },
        ...(ownItems.length > 0 ? [{ group: 'Your cases', items: ownItems }] : []),
        ...(items.length > 0
          ? [
              {
                group: 'Products',
                items: items.map((c) => ({ value: c.id, label: caseText(c, names) })),
              },
            ]
          : []),
      ]}
    />
  )
}

/** A group of the user's cases: its name and its measured water, which the workbench takes as measured. */
const ownCaseText = (c: OwnCase) =>
  c.grams === undefined ? c.name : `${c.name}: ${c.grams} g water, measured`

/** The case record's description: its product, and its stated water when it has one. */
function caseText(c: CaseSummary, names: Model['names']) {
  const water = c.waterCapacity === undefined ? '' : `: ${c.waterCapacity} g water`
  return `${productLabel({ name: c.name, manufacturer: c.manufacturer }, names)}${water}`
}

function CapacityChoice({ m }: { m: Model }) {
  const { capacities, capacity, names, designed, name } = m
  if (capacities.length > 0)
    return (
      <NativeSelect
        label="Case capacity record"
        // with a case record's stated capacity in use, no capacity record is the choice
        value={capacity?.id ?? ''}
        onChange={(e) => m.setCapacityId(e.currentTarget.value || undefined)}
        data={[
          ...(m.chosenCase?.waterCapacity === undefined
            ? []
            : [{ value: '', label: 'From the case record' }]),
          ...capacities.map((c) => ({ value: c.id, label: capacityText(c, names) })),
        ]}
      />
    )
  if (designed) return null
  return (
    <p>
      No case capacity record for {name}: enter your measured case capacity for the volume behind
      the bullet.
    </p>
  )
}

function MeasuredCapacity({ m }: { m: Model }) {
  const { system, stock, chosenCase, names, designed, measuredWaterCapacity } = m
  return (
    <NumberField
      spec={{
        ...measuredWaterCapacitySpec,
        help: designed
          ? 'Measured: water to the mouth of your fired cases. Empty: not given, and so is the volume behind the bullet.'
          : "Measured: water to the mouth of your fired cases. Replaces the capacity or case record; empty: the record's value.",
      }}
      system={system}
      value={measuredWaterCapacity}
      onChange={(v) => m.p.onMeasuredWaterCapacity?.(v)}
      // the record's capacity in the field while none is typed
      placeholder={
        stock ? (s) => formatQuantity('capacity', s, waterVolume(stock.grams)) : undefined
      }
      flag={
        stock && measuredWaterCapacity.si === undefined
          ? {
              kind: 'record',
              text: `From ${
                stock.record
                  ? `the capacity record ${capacityText(stock.record, names)}`
                  : `the case record ${chosenCase ? caseText(chosenCase, names) : ''}`
              }. Type a measured capacity to replace it.`,
            }
          : undefined
      }
    />
  )
}

/** The slider's value after a move: within half a step of the start it is the start. */
function slidTo(
  raw: number,
  m: Pick<Model, 'length' | 'started' | 'mode' | 'system'>,
  step: number | undefined,
) {
  const slid = m.length.toSi(raw)
  const si =
    m.started?.mode === m.mode && Math.abs(slid - m.started.si) <= m.length.toSi(step ?? 0) / 2
      ? m.started.si
      : slid
  // the display decimals; the exact value stays
  return { text: fixedFieldText('length', m.system, si), si }
}

function SeatSlider({ m, range }: { m: Model; range: readonly [number, number] }) {
  const { id, mode, pos, length, system } = m
  const step = system.length.step
  const toShown = (x: number) => length.fromSi(toSi('length', x + m.ladderShift))
  return (
    <div className="field seating-slider">
      <label htmlFor={`${id}-slider`}>Slide to change {seatingLengthName[mode]}</label>
      <input
        id={`${id}-slider`}
        type="range"
        min={toShown(range[0])}
        max={toShown(range[1])}
        step={step}
        value={pos.si === undefined ? toShown(range[0]) : length.fromSi(pos.si)}
        aria-valuetext={
          pos.si === undefined
            ? undefined
            : `${formatQuantity('length', system, pos.si)} ${length.symbol}`
        }
        onChange={(e) => m.setPos(slidTo(Number(e.target.value), m, step))}
      />
    </div>
  )
}

/** The seating by COAL or CBTO: the mode, its field and the slider. */
function SeatFields({ m, range }: { m: Model; range: readonly [number, number] }) {
  const { id, mode, pos, system, canCbto, card, warnings } = m
  return (
    <>
      <SegmentedRow
        legend="Seat the bullet by"
        name={`${id}-mode`}
        value={mode}
        segments={(['overallLength', 'baseToOgive'] as const).map((s) => ({
          value: s,
          label: seatingLengthName[s],
          reason:
            s === 'baseToOgive' && !canCbto
              ? "CBTO needs the bullet's base-to-ogive length. This bullet record has none."
              : undefined,
        }))}
        onChange={m.changeMode}
      />
      <NumberField
        spec={{
          key: 'position',
          label: seatingLengthName[mode],
          help: modeHelp[mode],
          quantity: 'length',
          min: 0,
        }}
        system={system}
        value={pos}
        onChange={m.setPos}
        // in the workbench card the field carries the L6 and leade warnings: no rows of their own
        flag={
          card && warnings.length > 0 ? { kind: 'exceeded', text: warnings.join('. ') } : undefined
        }
      />
      <SeatSlider m={m} range={range} />
    </>
  )
}

function SeatingControls({ m }: { m: Model }) {
  const { slots, linked, shape, range, card } = { ...m, linked: m.p.linked }
  return (
    <div className="seating-controls">
      {!linked && <BulletPicker m={m} />}
      <BulletStatus m={m} />
      {aside(
        slots,
        <>
          <CaseChoice m={m} />
          <CapacityChoice m={m} />
        </>,
        slots?.more,
      )}
      {!card && <BarrelField m={m} />}
      <MeasuredCapacity m={m} />
      {shape && range && <SeatFields m={m} range={range} />}
    </div>
  )
}

/** The figure's description: the half section and the bullet seated in it, if any. */
function figureDesc(m: Model, spec: Spec, drawnSeating: Seating | undefined) {
  const { view, designed, name, mm } = m
  if (!drawnSeating) {
    const what = view === 'combined' ? 'case in its chamber' : view
    return `Half section of the ${designed ? what : `${spec.name} ${what}`}; no bullet ${view === 'chamber' ? 'or case drawn' : 'seated'}.`
  }
  const [maximum, minimum] = designed ? ['maximum', 'minimum'] : ['CIP maximum', 'CIP minimum']
  const the = designed ? `case of the ${name}` : `${spec.name} case`
  return `Half section of the ${the} (${maximum} outline, interior not shown) in its chamber (${minimum} outline) with the bullet seated at COAL ${mm(drawnSeating.coal.value)}: seating depth ${mm(drawnSeating.depth.value)}, jump ${jumpText(drawnSeating, mm)}. Dashed lines are approximate geometry.`
}

/** The figure's title and description for the view and the seating drawn. */
function figureText(m: Model, spec: Spec, drawnSeating: Seating | undefined) {
  const { view, designed, name, design } = m
  const where = designed ? name : `${spec.standard} ${spec.name}`
  const seated = `${view === 'combined' ? 'Seated' : 'Cartridge with the seated'} ${design ? `user design ${design.name}` : 'bullet'}`
  const caption = view === 'chamber' ? `Chamber, ${where}` : `${seated}, ${where}`
  return { caption, desc: figureDesc(m, spec, drawnSeating) }
}

type FigureModel = NonNullable<Model['model']>

function DrawnFigure({
  m,
  name,
  shown,
  text,
  seating,
  chamber,
}: {
  m: Model
  name: string
  shown: FigureModel
  text: { caption: string; desc: string }
  seating: Seating | undefined
  chamber: Chamber
}) {
  const id = `${m.id}-${name}`
  return (
    <TechnicalDrawing
      id={id}
      title={text.caption}
      desc={text.desc}
      model={shown}
      level={shown.medium === 'print'}
    >
      {seating && (
        <SeatedBullet
          id={id}
          s={seating}
          caseLength={chamber.caseLength}
          leade={seating.leade}
          g1={chamber.G1}
        />
      )}
    </TechnicalDrawing>
  )
}

function SeatingFigure({ m, spec, chamber }: { m: Model; spec: Spec; chamber: Chamber }) {
  const { view, fixed, model, levelModel, designer, shape, p } = m
  const fullView = p.fullView
  // a chamber without a cartridge holds no bullet: the Chamber view draws the chamber alone
  const drawnSeating = view === 'chamber' ? undefined : m.figureSeating
  const text = figureText(m, spec, drawnSeating)
  const draw = (name: string, shown: FigureModel) => (
    <DrawnFigure
      m={m}
      name={name}
      shown={shown}
      text={text}
      seating={drawnSeating}
      chamber={chamber}
    />
  )
  return (
    <div className="seating-figure">
      {view === 'combined' && fixed?.missing && (
        <p>The outline needs {fixed.missing.join(', ')}.</p>
      )}
      {view !== 'combined' && !model && <p>No {view} drawing for this record.</p>}
      {model && draw('drawing', model)}
      {/* a design's own drawing is above: this one shows once a bullet is seated in it */}
      {levelModel && (!designer || drawnSeating) && draw('level', levelModel)}
      {model && fullView && (
        <AppModal
          opened={fullView.opened}
          onClose={fullView.onClose}
          title={text.caption}
          size="auto"
          className="figure-full"
        >
          {draw('full', model)}
        </AppModal>
      )}
      {drawnSeating && (
        <p className="seating-legend">
          Dashed in the flag colour: approximate geometry (see the notes). Faint: the bullet inside
          the case. Dashed ticks: leade contact, approximate.
        </p>
      )}
      {!shape && view === 'combined' && !designer && (
        <p>Choose a bullet with a length to seat it.</p>
      )}
    </div>
  )
}

function SeatingNotes({ seating }: { seating: Seating }) {
  return (
    <>
      <p className="note">
        The jump is not a measured jump and not a seating recommendation. Staying at or below L6
        says nothing about pressure, magazine fit or safety; seating depth changes pressure.
      </p>
      {seating.notes.length > 0 && (
        <ul className="seating-notes">
          {seating.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
    </>
  )
}

type RowsProps = { m: Model; seating: Seating; chamber: Chamber }

function CoalRow({ m, seating, chamber }: RowsProps) {
  const { card, designed, len, mm, length } = m
  // in the workbench card the CBTO field's flag says it: no line of its own
  const above =
    !card && seating.aboveL6 && chamber.cartridgeL6 !== undefined ? (
      <strong className="exceeded">
        above {designed ? 'cartridge' : 'CIP maximum'} L6 ({mm(chamber.cartridgeL6)})
      </strong>
    ) : undefined
  return (
    <Row
      term="COAL"
      value={len(seating.coal.value)}
      unit={length.symbol}
      tag={seating.coal.tag}
      note={above}
    />
  )
}

function CbtoRow({ m, seating }: RowsProps) {
  if (seating.cbto)
    return (
      <Row
        term="CBTO"
        value={m.len(seating.cbto.value)}
        unit={m.length.symbol}
        tag={seating.cbto.tag}
      />
    )
  return m.designed ? <NotGiven term="CBTO" why="the bullet base-to-ogive" /> : null
}

function CaseVolumeRow({ m, seating }: RowsProps) {
  const { stock, chosenCase, measuredWaterCapacity, vol } = m
  if (!seating.caseVolume)
    return m.designed ? (
      <NotGiven term="Case volume to the mouth" why="a measured case capacity" />
    ) : null
  return (
    <Row
      term="Case volume to the mouth"
      value={vol(seating.caseVolume.value)}
      tag={seating.caseVolume.tag}
      note={
        measuredWaterCapacity.si !== undefined || !stock
          ? 'your measured case capacity'
          : `${stock.grams} g water (${stock.record?.id ?? chosenCase?.id}) at ${waterDensityGramsPerCm3} g/cm³`
      }
    />
  )
}

function VolumeRow({ m, seating }: RowsProps) {
  if (seating.volumeBehindBullet)
    return (
      <Row
        term="Volume behind the bullet"
        value={m.vol(seating.volumeBehindBullet.value)}
        tag={seating.volumeBehindBullet.tag}
      />
    )
  return m.designed ? (
    <NotGiven term="Volume behind the bullet" why="a measured case capacity" />
  ) : null
}

function TravelRow({ m, seating }: RowsProps) {
  if (seating.travel)
    return (
      <Row
        term="Travel to the muzzle"
        value={m.mm(seating.travel.value)}
        tag={seating.travel.tag}
      />
    )
  return m.designed ? <NotGiven term="Travel to the muzzle" why="the barrel length" /> : null
}

function LeadeRow({ m, seating }: RowsProps) {
  if (seating.leade !== undefined)
    return (
      <Row
        term="Leade contact from the head"
        value={m.mm(seating.leade)}
        tag="approximate"
        note={`own derivation from the ${m.designed ? 'chamber of the design' : 'CIP chamber'}, not a CIP value`}
      />
    )
  return m.designed ? (
    <NotGiven term="Leade contact from the head" why="the chamber L3, G1, F, i, and s or G" />
  ) : null
}

function JumpRow({ m, seating }: RowsProps) {
  const unknown = seating.jump.value === undefined
  return (
    <Row
      term="Jump to the leade"
      value={seating.jump.value === undefined ? 'not given' : m.mm(seating.jump.value)}
      tag={unknown ? undefined : seating.jump.tag}
      note={jumpNote(seating.jump)}
    />
  )
}

function SeatingValues({ m, seating, chamber }: RowsProps) {
  const { card, mode, slots, design, contact } = m
  const rows = { m, seating, chamber }
  const more = slots?.moreValues
  return (
    <div className="seating-values">
      {/* a linked figure sits on a page that states this in its own notice */}
      {!m.p.linked && (
        <p className="note screen-only">
          Results from this software are simulations, not load data.
        </p>
      )}
      {design && (
        <p className="note user-design">
          Seated from the user design {design.name}, not a catalogue record.
        </p>
      )}
      <dl>
        {/* in the workbench's card the field shows the mode's length with its L6 flag and
            this list the other one, so both modes keep one height */}
        {(!card || mode === 'baseToOgive') && <CoalRow {...rows} />}
        {(!card || mode !== 'baseToOgive') && <CbtoRow {...rows} />}
        <Row
          term="Seating depth"
          value={m.len(seating.depth.value)}
          unit={m.length.symbol}
          tag={seating.depth.tag}
          note={`case length: ${m.designed ? 'cartridge L3 of the design' : 'CIP L3 maximum'} ${m.mm(chamber.caseLength)}`}
        />
        {aside(slots, <CaseVolumeRow {...rows} />, more)}
        {/* in the workbench the field "Usable case volume" shows it, flagged "from seating" */}
        {!card && <VolumeRow {...rows} />}
        {aside(slots, <TravelRow {...rows} />, more)}
        {aside(slots, <LeadeRow {...rows} />, more)}
        {aside(slots, <JumpRow {...rows} />, more)}
      </dl>
      {contact && !card && <ErrorNote color="orange">{contact}</ErrorNote>}
      {!card && <SeatingNotes seating={seating} />}
    </div>
  )
}

function PreviewBody({ m, spec, chamber }: { m: Model; spec: Spec; chamber: Chamber }) {
  const { slots, seating, card, live } = m
  return (
    <div className="seating-preview" data-split={slots ? '' : undefined}>
      {card && put(slots, <BarrelField m={m} />, slots?.gun)}
      {put(slots, <SeatingControls m={m} />, slots?.cartridge)}
      <SeatingFigure m={m} spec={spec} chamber={chamber} />
      {seating &&
        put(slots, <SeatingValues m={m} seating={seating} chamber={chamber} />, slots?.cartridge)}
      {/* in the workbench the notes (staying below L6 says nothing about pressure or safety) sit in
          the Cartridge card's More, beside the further values */}
      {slots?.more &&
        seating &&
        createPortal(
          <div>
            <SeatingNotes seating={seating} />
          </div>,
          slots.more,
        )}
      <p className="seating-live" aria-live="polite">
        {live}
      </p>
    </div>
  )
}

/**
 * Live half-section of the chosen cartridge's case (CIP maximum, interior not shown) in its
 * chamber (CIP minimum) with the bullet seated by COAL or CBTO; seating depth, volume behind the
 * bullet, travel and jump follow the slider and the number field (`@open-reloading/drawing/seating`).
 */
export function SeatingPreview(props: PreviewProps) {
  const m = useSeatingModel(props)
  const g = gateOf(m)
  if ('gate' in g) return g.gate
  return <PreviewBody m={m} spec={g.spec} chamber={g.chamber} />
}
