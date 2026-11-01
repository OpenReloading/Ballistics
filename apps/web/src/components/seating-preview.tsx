'use client'

import { Anchor, NativeSelect } from '@mantine/core'
import { fullSection, svgPath, toPartFrame } from '@open-reloading/drawing'
import { bulletDimensions } from '@open-reloading/drawing/bullet'
import { drawnTables } from '@open-reloading/drawing/cartridge'
import {
  bulletOutline,
  chamberOf,
  coalRange,
  jumpNote,
  landsContactCoal,
  leadeContact,
  previewDrawn,
  type Seating,
  seat,
  type Tagged,
} from '@open-reloading/drawing/seating'
import { type Bullet, fromSi, toSi } from '@open-reloading/schema'
import dynamic from 'next/dynamic'
import {
  type Dispatch,
  type ReactNode,
  type RefObject,
  type SetStateAction,
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from '../i18n/language.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { apiFetch } from '../lib/api-fetch.ts'
import type { BulletSummary, CartridgeDetail, CaseSummary } from '../lib/api-types.ts'
import type { StripFigure } from '../lib/barrel-strip.ts'
import { type BaseType, type BulletValues, typedBullet } from '../lib/bullet.ts'
import { designShape } from '../lib/bullet-designer.ts'
import { drawable, withCaseLength } from '../lib/cartridge-sheet.ts'
import {
  measuredWaterCapacitySpec,
  renamedCasePath,
  type UsedWater,
  usedWater,
} from '../lib/case-capacity.ts'
import type { OwnCase } from '../lib/case-group.ts'
import { translateMessage } from '../lib/core-messages.ts'
import { capacityGuide } from '../lib/docs-url.ts'
import type { FieldValue } from '../lib/field-spec.ts'
import { figureViewBuilder } from '../lib/figure-views.ts'
import type { LandsContact } from '../lib/firearm.ts'
import type { Suggestion } from '../lib/input-defaults.ts'
import { productLabel, refName } from '../lib/manufacturers.ts'
import { nth } from '../lib/nth.ts'
import type { CaseRow } from '../lib/record-choosers.ts'
import { type SeatingLengths, seatingLengthName } from '../lib/seating-ladder.ts'
import {
  type ChargeFill,
  chargeFill,
  fillPercent,
  seatingValueRows,
} from '../lib/seating-values.ts'
import { controlSize } from '../lib/theme.ts'
import { trailing } from '../lib/trailing.ts'
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
import { RecordSearch, useChooser } from './record-search.tsx'
import { PanelTable } from './scroll-region.tsx'
import { SegmentedRow } from './segmented-row.tsx'
import { RecordSourcesLink } from './sources.tsx'
import { ErrorNote, Loading } from './states.tsx'
import { TechnicalDrawing } from './technical-drawing.tsx'
import { useManufacturerNames } from './use-manufacturer-names.ts'
import { notReached } from './workbench-outcome.ts'

type Load<T> =
  | { status: 'none' }
  | { status: 'loading' }
  | { status: 'ok'; value: T }
  | { status: 'error' }

type Mode = 'overallLength' | 'baseToOgive'

type T = Translator['t']

// in the module of every chooser, so their shared dialog is one chunk
const CaseChooser = dynamic(() => import('./record-choosers.tsx').then((m) => m.CaseChooser), {
  ssr: false,
})

const modeHelp = {
  overallLength: msg('Cartridge overall length.'),
  baseToOgive: msg('Cartridge base to ogive.'),
}
const tagText: Record<Tagged['tag'], Message> = {
  entered: msg('entered'),
  sourced: msg('sourced'),
  derived: msg('derived'),
  approximate: msg('approximate'),
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
  /** Jump to the lands or the leade, m, below 0 into them: the engraving ramp of a run starts there. */
  jump?: number
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
  const { t } = useTranslation()
  return <span className={`flag flag-${tag}`}>{t(tagText[tag])}</span>
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
function NotGiven({ term, why }: { term: string; why: Message }) {
  const { t } = useTranslation()
  return <Row term={term} value={t('not given')} note={t('needs {why}', { why: t(why) })} />
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

/** The powder charge in the case, in the part frame (mm): from the head to its level, tinted and hatched. */
function ChargeLevel({ id, level }: { id: string; level: number }) {
  return (
    <g className="seating-charge" clipPath={`url(#${id}-cartridge)`}>
      <pattern
        id={`${id}-hatch`}
        width="1"
        height="1"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <path d="M0 0V1" />
      </pattern>
      <rect className="tint" x={0} y={-50} width={level} height={100} />
      <rect x={0} y={-50} width={level} height={100} fill={`url(#${id}-hatch)`} />
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
  /**
   * The chosen firearm's lands contact measured with the bullet seated, m: the jump follows it
   * instead of the C.I.P. chamber. `landsOther`: the firearm has a contact of another bullet, not used.
   */
  lands?: LandsContact | undefined
  landsOther?: boolean | undefined
  /** The chosen firearm's measured freebore, m: the leade starts there past the chamber L3 instead of at the CIP s. */
  freebore?: number | undefined
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
  /** The field of the case lot, after the case record choice in the `choices` slot. */
  caseLot?: ReactNode
  /** The user's groups of cases of this cartridge, and the one chosen: its measured capacity is the page's measured capacity. */
  ownCases?: readonly OwnCase[] | undefined
  ownCaseId?: string | undefined
  onOwnCaseId?: (id: string | undefined) => void
  /**
   * The bullet record or design of the page's own bullet input: the preview seats it and
   * shows no bullet search or design choice of its own.
   */
  linked?: {
    bullet?: string | undefined
    design?: string | undefined
    /** The values typed over the record or design: the preview draws and seats the bullet with them. */
    values?: BulletValues | undefined
    /** The base form typed over the record's. */
    baseType?: BaseType | undefined
    /** The case length L3 typed over the sheet's, or the trim length of the chosen brass, mm. */
    caseLength?: number | undefined
    /** The name of the brass whose trim length `caseLength` is; none: the length was typed. */
    caseLengthBrass?: string | undefined
  }
  /**
   * Where the controls go instead of beside the drawing: case capacity, seating and the
   * values in `cartridge`, the barrel length in `gun`; the figure keeps the drawing.
   */
  slots?: {
    cartridge: HTMLElement | null
    gun: HTMLElement | null
    /** The brass and capacity record choices (`choices`), the notes (`more`) and further values (`moreValues`, a `dl`). */
    choices?: HTMLElement | null
    more?: HTMLElement | null
    moreValues?: HTMLElement | null
  }
  /** Combined: both outlines, no dimensions; Cartridge or Chamber: that side's dimensioned record figure. */
  view?: 'cartridge' | 'chamber' | 'combined' | undefined
  /** A seating ladder step to draw instead of the field's seating, m; the fields keep theirs. */
  ladderStep?: { by: Mode; value: number } | undefined
  /** The figure's full view: the same drawing in a modal at the window's height. */
  fullView?: { opened: boolean; onClose: () => void }
  /**
   * The load's charge (kg) and its powder's bulk density (kg/m³): the figure draws the powder fill.
   * A page without a charge leaves it out and shows no fill.
   */
  powder?: { charge: number | undefined; bulkDensity: number | undefined } | undefined
}

/** The lands contact in mm, as `seat` takes it. */
type LandsMm = { baseToOgive?: number | undefined; overallLength?: number | undefined }

const landsMm = (cbto: number | undefined, coal: number | undefined): LandsMm | undefined =>
  cbto === undefined && coal === undefined
    ? undefined
    : {
        baseToOgive: cbto === undefined ? undefined : fromSi('length', cbto),
        overallLength: coal === undefined ? undefined : fromSi('length', coal),
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
function refusalOf(shaped: ReturnType<typeof shapeOf>, unit: ReturnType<typeof drawingLengthUnit>) {
  const o = shaped && bulletOutline(shaped, 'sourced', unit)
  return o && 'reason' in o ? o.reason : undefined
}

/** The slider range and the drawing: they depend on the records only, never on the position. */
function fixedOf(
  spec: Spec | undefined,
  chamber: Chamber | undefined,
  shape: Shape | undefined,
  lands: LandsMm | undefined,
) {
  if (!spec || !chamber || !shape) return
  const contact = leadeContact(chamber, shape.diameter)
  const outline = bulletOutline(shape)
  const chamberCoal =
    'z' in contact && 'noseLength' in outline && !outline.noseAssumed
      ? contact.z + outline.noseLength
      : undefined
  const contactCoal = landsContactCoal(shape, lands) ?? chamberCoal
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
  values: BulletValues | undefined
  baseType: BaseType | undefined
  caseLength: number | undefined
  shown: RefObject<UnitSystem>
  lands: LandsMm | undefined
  /** The firearm's freebore, mm: the chamber's leade start s. */
  freebore: number | undefined
  /** The page's length unit, for the lengths in a refusal's reason. */
  unit: ReturnType<typeof drawingLengthUnit>
}) {
  const {
    draft,
    detail,
    record,
    design: chosen,
    values,
    baseType,
    caseLength,
    shown,
    lands,
    freebore,
    unit,
  } = o
  const draftSpec = draft?.spec
  // the record's own spec, apart from a typed L3: the seating starts again only when it changes
  const own = useMemo(() => specOf(draftSpec, detail), [draftSpec, detail])
  const spec = useMemo(
    () => (own && caseLength !== undefined ? withCaseLength(own, caseLength) : own),
    [own, caseLength],
  )
  const chamber = useMemo(() => {
    const c = spec && chamberOf(spec.values)
    return c && freebore !== undefined ? { ...c, leadeStart: freebore } : c
  }, [spec, freebore])
  const capacities = capacitiesOf(detail)
  // the typed values in place, one object per record, design or values, so the shape is not rebuilt for each render
  const design = useMemo(
    () =>
      chosen && values
        ? {
            ...chosen,
            resolved: {
              ...chosen.resolved,
              record: typedBullet(chosen.resolved.record, values, baseType),
            },
          }
        : chosen,
    [chosen, values, baseType],
  )
  const bulletRecord = useMemo(
    () =>
      record.status === 'ok' && !chosen
        ? values
          ? typedBullet(record.value, values, baseType)
          : record.value
        : undefined,
    [record, chosen, values, baseType],
  )
  const shaped = useMemo(
    () => shapeOf(design, bulletRecord, shown.current),
    [design, bulletRecord, shown],
  )
  // a record whose dimensions cannot form an outline is not seated; its reason is shown
  const refused = useMemo(() => refusalOf(shaped, unit), [shaped, unit])
  const shape = refused ? undefined : shaped
  const fixed = useMemo(() => fixedOf(spec, chamber, shape, lands), [spec, chamber, shape, lands])
  return { spec, own, chamber, capacities, bulletRecord, shaped, refused, shape, fixed }
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
  /** What the seating starts for, apart from a typed L3: the same one keeps the position. */
  startFor: unknown
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
  const { startFor } = o
  const startedFor = useRef<unknown[]>(undefined)
  useEffect(() => {
    // a design starts empty: a seating the user did not enter would be a default
    if (!range || !chamber || designed) return
    // a typed L3 rebuilds the chamber: the chosen position stays, its depth and volume follow
    const key = [startFor, shape, initialBy, initialValue, canCbto]
    const same = startedFor.current?.every((v, i) => v === key[i])
    startedFor.current = key
    if (same) return
    const start = startOf(range, chamber, initialBy, initialValue, canCbto)
    setMode(start.mode)
    setPos({ text: fixedFieldText('length', shown.current, start.si), si: start.si })
    setStarted(start)
  }, [
    range,
    chamber,
    startFor,
    shape,
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
  lands: LandsMm | undefined
  /** The page's length unit, for the lengths in the outline's notes. */
  unit: ReturnType<typeof drawingLengthUnit>
}) {
  const { chamber, shape, mode, canCbto, water, barrel, lands, unit } = o
  if (!chamber || !shape || (mode === 'baseToOgive' && !canCbto)) return
  return (by: number) =>
    seat({
      bullet: shape,
      chamber,
      waterCapacity: water,
      waterDensity: waterDensityGramsPerCm3,
      barrelLength: barrel === undefined ? undefined : fromSi('length', barrel),
      by: { kind: mode, value: by },
      lands,
      unit,
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

/** The views laid out for the seated lengths; the part that does not follow them is built once. */
type ViewsAt = (seated: Seated3) => ReturnType<ReturnType<typeof figureViewBuilder>>

const noViews: ViewsAt = () => ({})

/** The card's Cartridge, Chamber and Combined views; the Cartridge view's L6 is the seated COAL. */
function cardViewsOf(
  spec: Spec | undefined,
  designer: boolean,
  drawn: Parameters<typeof figureViewBuilder>[1],
  unit: Parameters<typeof figureViewBuilder>[2],
): ViewsAt {
  return spec && !designer ? figureViewBuilder(spec, drawn, unit) : noViews
}

/**
 * The workbench card also draws the figure level, shown where its panel is wider than tall; a
 * design draws it level only, in the room under its own drawing, framed to the combined view.
 */
function levelViewsOf(
  spec: Spec | undefined,
  drawIt: boolean,
  designer: boolean,
  drawn: Parameters<typeof figureViewBuilder>[1],
  unit: Parameters<typeof figureViewBuilder>[2],
): ViewsAt {
  return spec && drawIt
    ? figureViewBuilder(spec, drawn, unit, 'print', designer ? ['combined'] : undefined)
    : noViews
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
        jump: s.jump.value === undefined ? undefined : toSi('length', s.jump.value),
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
  const jump = seating?.jump.value
  return {
    ...(caseVolume !== undefined && { caseVolume }),
    ...(volume !== undefined && { volume: unitsOf.capacity.cm3.toSi(volume) }),
    ...(travel !== undefined && { travel: toSi('length', travel) }),
    ...(coal !== undefined && { overallLength: toSi('length', coal) }),
    ...(cbto !== undefined && { baseToOgive: toSi('length', cbto) }),
    ...(depth !== undefined && { depth: toSi('length', depth) }),
    ...(jump !== undefined && { jump: toSi('length', jump) }),
    ...(coal !== undefined && barrel !== undefined && { barrel }),
    ...(coal !== undefined && { mode, atStart }),
    ...(figure && { figure }),
  }
}

/** The wait after the last slider move before the page gets the seated values, ms. */
const slideWait = 150

/**
 * The interior fields follow the seated bullet, derived from COAL. The page recomputes from the
 * report, so it goes in a transition, the next slider move first. While the slider moves only the
 * last report is sent, after `slideWait` ms or at once when the slider is released.
 */
function useReportSeated(
  onSeated: (values: Seated) => void,
  o: Parameters<typeof seatedReport>[0],
  sliding: boolean,
) {
  const seated = useRef(onSeated)
  seated.current = onSeated
  const send = useMemo(
    () => trailing<Seated>((values) => startTransition(() => seated.current(values)), slideWait),
    [],
  )
  useEffect(() => () => send.cancel(), [send])
  const { caseVolume, seating, barrel, mode, atStart, figure } = o
  const key = [
    caseVolume,
    seating?.volumeBehindBullet?.value,
    seating?.travel?.value,
    seating?.coal.value,
    seating?.cbto?.value,
    seating?.depth.value,
    seating?.jump.value,
    barrel,
    mode,
    atStart,
  ]
  // no seated bullet reports {}: the page forgets the earlier seating
  // biome-ignore lint/correctness/useExhaustiveDependencies: the reported values only, not the seating object
  useEffect(() => {
    const values = seatedReport({ caseVolume, seating, barrel, mode, atStart, figure })
    if (sliding) return send.push(values)
    send.cancel()
    startTransition(() => seated.current(values))
  }, [...key, figure, sliding])
}

/** The seated lengths; while the slider moves, as they were `slideWait` ms after its last move. */
function useRestedLengths(coal: number | undefined, cbto: number | undefined, sliding: boolean) {
  const [rested, setRested] = useState({ coal, cbto })
  useEffect(() => {
    const rest = () => setRested((r) => (r.coal === coal && r.cbto === cbto ? r : { coal, cbto }))
    if (!sliding) return rest()
    const timer = setTimeout(rest, slideWait)
    return () => clearTimeout(timer)
  }, [coal, cbto, sliding])
  return sliding ? rested : { coal, cbto }
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
  const { t } = useTranslation()
  const { cartridge, draft, system, initial, onSeatLadder, slots, view = 'combined' } = p
  const { measuredWaterCapacity = emptyValue(), ladderStep } = p
  const id = useId().replace(/:/g, '')
  const detail = useRecord<CartridgeDetail>(detailUrl(cartridge, draft))
  const designed = draft !== undefined
  /** The designer page: its own drawing is above, its controls in one section. */
  const designer = isDesigner(draft)
  const name = nameOf(draft, cartridge)
  const bullet = useBulletChoice(initial?.bullet, p.linked)
  // the contact object is rebuilt only when a length changes, so the seating is not for each render
  const [landsCbto, landsCoal] = [p.lands?.baseToOgive, p.lands?.overallLength]
  const lands = useMemo(() => landsMm(landsCbto, landsCoal), [landsCbto, landsCoal])
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
  const { spec, own, chamber, capacities, shape, fixed, ...geometry } = useGeometry({
    values: p.linked?.values,
    baseType: p.linked?.baseType,
    caseLength: p.linked?.caseLength,
    draft,
    detail,
    record,
    design,
    shown,
    lands,
    freebore: p.freebore === undefined ? undefined : fromSi('length', p.freebore),
    unit: drawingLengthUnit(system),
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
    startFor: own,
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

  // the slider and the field follow the pointer; what is computed from the position (the
  // seating, the drawing, the values the page follows) renders after them and gives way to the
  // next move, with the mode in step so a seating never mixes the two
  const { pos: seatPos, mode: seatMode } = useDeferredValue(
    useMemo(() => ({ pos, mode }), [pos, mode]),
  )
  const value = lengthMm(pos)
  const seatValue = lengthMm(seatPos)
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
    () =>
      seatBuilder({
        chamber,
        shape,
        mode: seatMode,
        canCbto,
        water: waterUsed,
        barrel: barrel.si,
        lands,
        unit,
      }),
    [chamber, shape, seatMode, canCbto, waterUsed, barrel.si, lands, unit],
  )
  const seating = useMemo(
    () => (seatBy && seatValue !== undefined ? seatBy(seatValue) : undefined),
    [seatBy, seatValue],
  )
  const [stepBy, stepValue] = [ladderStep?.by, ladderStep?.value]
  const figureSeating = useMemo(
    () => ladderSeating(seatBy, { by: stepBy, value: stepValue }, seatMode, seating),
    [seatBy, stepBy, stepValue, seatMode, seating],
  )
  /** Set by the slider's moves, cleared by its release. */
  const [sliding, setSliding] = useState(false)
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
  const cardViews = useMemo(
    () => cardViewsOf(spec, designer, drawn, unit),
    [spec, designer, drawn, unit],
  )
  const levelViews = useMemo(
    () => levelViewsOf(spec, inCard || designer, designer, drawn, unit),
    [spec, inCard, designer, drawn, unit],
  )
  // the dimension layout is the costly part of a move: while the slider moves the lengths on the
  // drawing follow when it rests, the bullet itself follows each move
  const { coal: shownCoal, cbto: shownCbto } = useRestedLengths(coal, cbto, sliding)
  const models = useMemo(
    () => cardViews(inCard ? coalOf(shownCoal, shownCbto) : undefined),
    [cardViews, inCard, shownCoal, shownCbto],
  )
  const levelModels = useMemo(
    () => levelViews(coalOf(shownCoal, shownCbto)),
    [levelViews, shownCoal, shownCbto],
  )
  // the slider's range in the mode's length, for the seating ladder
  const ladderShift = ladderShiftOf(shape, mode)
  const seatShift = ladderShiftOf(shape, seatMode)
  const seatAt = useMemo(
    () => seatAtOf(seatBy, range, seatMode, seatShift),
    [seatBy, range, seatMode, seatShift],
  )
  const onSeatAt = useRef(onSeatLadder)
  onSeatAt.current = onSeatLadder
  useEffect(() => {
    onSeatAt.current?.(seatAt)
    return () => onSeatAt.current?.(undefined)
  }, [seatAt])

  const figure = useMemo(() => figureOf(spec, seating), [spec, seating])
  const atStart = seatPos.si === started?.si && seatMode === started?.mode
  const caseVolume = caseVolumeOf(measured, water)
  useReportSeated(
    p.onSeated,
    { caseVolume, seating, barrel: barrel.si, mode: seatMode, atStart, figure },
    sliding,
  )

  const fmt = unitFormats(system)
  const behind = figureSeating?.volumeBehindBullet?.value
  const fill =
    p.powder &&
    figureSeating &&
    chargeFill({
      ...p.powder,
      volume: behind === undefined ? undefined : unitsOf.capacity.cm3.toSi(behind),
      base: figureSeating.basePosition,
    })
  const contact = contactText(seating, fmt.mm, t)
  /** The workbench's cards: the fields there show what the rows below leave out. */
  const card = inCard
  const warnings = warningsOf(seating, chamber, designed, contact, fmt.mm, t)
  const live = useLive(announceOf(seating, fmt.mm, t))

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
    setSliding,
    canCbto,
    measuredWaterCapacity,
    fill,
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

const contactText = (seating: Seating | undefined, mm: (x: number) => string, t: T) =>
  seating?.contact &&
  (seating.jump.source === 'lands'
    ? t(
        'Contact with the lands (measured): the bullet reaches the lands at {coal} COAL; it is not moved back.',
        { coal: mm(seating.contactCoal as number) },
      )
    : t(
        'Contact with leade ({tag}): the bullet reaches the leade at {coal} COAL; it is not moved back.',
        { tag: t(tagText[seating.jump.tag]), coal: mm(seating.contactCoal as number) },
      ))

function warningsOf(
  seating: Seating | undefined,
  chamber: Chamber | undefined,
  designed: boolean,
  contact: string | false | undefined,
  mm: (x: number) => string,
  t: T,
) {
  const above =
    seating?.aboveL6 &&
    chamber?.cartridgeL6 !== undefined &&
    (designed
      ? t('Above the cartridge L6 of {length}', { length: mm(chamber.cartridgeL6) })
      : t('Above the CIP maximum L6 of {length}', { length: mm(chamber.cartridgeL6) }))
  return [above, contact].filter((w): w is string => !!w)
}

const jumpText = (s: Seating, mm: (x: number) => string, t: T) =>
  s.jump.value === undefined
    ? translateMessage(jumpNote(s.jump), t)
    : `${mm(s.jump.value)}, ${t(tagText[s.jump.tag])}`

function announceOf(seating: Seating | undefined, mm: (x: number) => string, t: T) {
  if (!seating) return ''
  const values = {
    coal: mm(seating.coal.value),
    depth: mm(seating.depth.value),
    jump: jumpText(seating, mm, t),
  }
  if (!seating.contact) return t('COAL {coal}, seating depth {depth}, jump {jump}.', values)
  return seating.jump.source === 'lands'
    ? t('COAL {coal}, seating depth {depth}, jump {jump}, contact with the lands.', values)
    : t('COAL {coal}, seating depth {depth}, jump {jump}, contact with leade.', values)
}

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
function gateOf(m: Model, t: T): { gate: ReactNode } | { spec: Spec; chamber: Chamber } {
  const { designed, detail, spec, chamber, name } = m
  if (!designed && (detail.status === 'loading' || detail.status === 'none'))
    return { gate: <Loading what="the cartridge record" inline /> }
  if (!designed && detail.status === 'error') return { gate: <p>{t(notReached)}</p> }
  if (spec && chamber) return { spec, chamber }
  return {
    gate: (
      <p>
        {designed
          ? t('Not given: the cartridge L3, which the seating needs.')
          : t(
              'No CIP drawing for {name}: the preview needs the CIP cartridge and chamber values.',
              {
                name,
              },
            )}
      </p>
    ),
  }
}

/** A part in its slot, or in place without slots; nothing while the slot is not mounted. */
function put(slots: Slots, node: ReactNode, target: HTMLElement | null | undefined) {
  if (!slots) return node
  return target ? createPortal(node, target) : null
}

/** A part in its own slot when the page gives one, else in place. */
function aside(slots: Slots, node: ReactNode, target: HTMLElement | null | undefined) {
  if (!slots || target === undefined) return node
  return target ? createPortal(node, target) : null
}

/** The workbench row's control height for the brass and capacity selects, the theme's elsewhere. */
const rowSize = (m: Model) => (m.slots?.choices ? { size: controlSize.row.input } : {})

/** The capacity record's description: its water, and its case maker when it has one. */
function capacityText(c: Capacity, names: Model['names'], t: T) {
  const values = { id: c.id, grams: c.waterCapacity.value }
  return c.caseManufacturer
    ? t('{id}: {grams} g water, {maker}', {
        ...values,
        maker: refName(names, c.caseManufacturer) || c.caseManufacturer,
      })
    : t('{id}: {grams} g water', values)
}

function BarrelField({ m }: { m: Model }) {
  const { t } = useTranslation()
  const { system, barrel, barrelTyped } = m
  const barrelDefault = m.p.barrelDefault
  return (
    <NumberField
      spec={{
        key: 'barrel',
        label: msg('Barrel length'),
        help: msg('From the breech face.'),
        quantity: 'barrelLength',
        min: 0,
      }}
      system={system}
      value={barrel}
      muted={!barrelTyped && barrel.si !== undefined}
      mark={
        !barrelTyped && barrelDefault
          ? t('Default: {source}.', { source: barrelDefault.source })
          : undefined
      }
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
  const { t } = useTranslation()
  const { design, designs, names } = m
  return (
    <>
      <RecordSearch<BulletSummary>
        kind="bullets"
        label={t('Search bullets by manufacturer or name')}
        describe={(b) => productLabel(b, names)}
        onSelect={(b) => {
          m.setDesign(undefined)
          m.setBulletId(b.id)
        }}
        noneText={t('No bullet found')}
        unreachableText={t(notReached)}
      />
      <NativeSelect
        label={t('Or a bullet design')}
        description={t('From your bullet designs in this browser.')}
        value={design?.id ?? ''}
        onFocus={m.readDesigns}
        onChange={(e) => m.setDesign(designs.find((d) => d.id === e.currentTarget.value))}
        data={[
          { value: '', label: designs.length ? t('None') : t('None in this browser') },
          ...designs.map((d) => ({ value: d.id, label: d.name })),
        ]}
      />
    </>
  )
}

/** What the bullet choice stands at: loading, failed, the record or design in use, and why it does not seat. */
function BulletStatus({ m }: { m: Model }) {
  const { t } = useTranslation()
  const { design, record, bulletRecord, shaped, refused, names } = m
  return (
    <>
      {!design && record.status === 'loading' && <Loading what="the bullet record" inline />}
      {!design && record.status === 'error' && <p>{t(notReached)}</p>}
      {design && (
        <p className="record">
          {t('Bullet: {name} (user design, not a catalogue record)', { name: design.name })}
        </p>
      )}
      {design && !shaped && (
        <p>{t('This bullet design has no length or does not draw: the preview needs both.')}</p>
      )}
      {bulletRecord && (
        <p className="record">
          {t('Bullet: {label}', { label: productLabel(bulletRecord, names) })} ({bulletRecord.id}
          {bulletRecord.provenance.sources[0] && (
            <>
              , <RecordSourcesLink kind="bullets" id={bulletRecord.id} />
            </>
          )}
          )
        </p>
      )}
      {bulletRecord && !shaped && (
        <p>{t('This bullet record has no length: the preview needs it.')}</p>
      )}
      {refused && (
        <p>
          {t('The bullet outline is not drawn: {reason}', {
            reason: translateMessage(refused, t),
          })}
        </p>
      )}
    </>
  )
}

/**
 * The brass of the cartridge in the field and the dialog: the user's groups of cases (an id with
 * `user:`) and the case products. Choosing a product makes its stated capacity the default.
 */
function CaseChoice({ m }: { m: Model }) {
  const { t } = useTranslation()
  const dialog = useChooser()
  const { caseList, names } = m
  const own = m.p.ownCases
  const ownId = m.p.ownCaseId
  const rows = useMemo((): CaseRow[] => {
    const items = caseList.status === 'ok' ? caseList.value.items : []
    return [
      ...(own ?? []).map((c) => ({
        id: `user:${c.id}`,
        name: c.name,
        manufacturerName: t('Your brass'),
        waterCapacity: c.grams,
      })),
      ...items.map((c) => ({
        id: c.id,
        name: c.name,
        manufacturerName: refName(names, c.manufacturer) || c.manufacturer,
        material: c.material,
        waterCapacity: c.waterCapacity,
      })),
    ]
  }, [caseList, own, names, t])
  const find = useMemo(
    () => async (text: string, limit: number) => {
      const { caseKeys, listMatches } = await import('../lib/record-choosers.ts')
      return listMatches(rows, text, limit, caseKeys)
    },
    [rows],
  )
  if (rows.length === 0 && !ownId) return null
  const ownCase = own?.find((c) => c.id === ownId)
  const choose = (id: string) => {
    if (id.startsWith('user:')) m.p.onOwnCaseId?.(id.slice('user:'.length))
    else m.setCaseId(id)
  }
  const chosen = ownId
    ? ownCase
      ? ownCaseText(ownCase, t)
      : // a load names a group this browser does not have
        t('A brass group not in this browser')
    : m.chosenCase && caseText(m.chosenCase, names, t)
  return (
    <>
      <RecordSearch<CaseRow>
        {...rowSize(m)}
        chevron
        label={t('Brass record')}
        picked={!!chosen}
        chosen={chosen || t('Search brass (optional)')}
        describe={(c) =>
          c.id.startsWith('user:')
            ? t('{name} (your brass)', { name: c.name })
            : `${c.manufacturerName} ${c.name}`.trim()
        }
        onSelect={(c) => choose(c.id)}
        noneText={t('No brass found')}
        unreachableText={t(notReached)}
        find={find}
        browse={{ label: t('Browse brass'), onOpen: dialog.open }}
        clear={{ label: t('Clear the brass record'), onClear: () => m.setCaseId(undefined) }}
      />
      <CaseChooser
        opened={dialog.opened}
        onClose={dialog.close}
        text={dialog.text}
        catalogue={rows}
        system={m.system}
        onChoose={(c) => {
          choose(c.id)
          dialog.close()
        }}
      />
    </>
  )
}

/** A group of the user's cases: its name and its measured water, which the workbench takes as measured. */
const ownCaseText = (c: OwnCase, t: T) =>
  c.grams === undefined
    ? c.name
    : t('{name}: {grams} g water, measured', { name: c.name, grams: c.grams })

/** The case record's description: its product, and its stated water when it has one. */
function caseText(c: CaseSummary, names: Model['names'], t: T) {
  const product = productLabel({ name: c.name, manufacturer: c.manufacturer }, names)
  return c.waterCapacity === undefined
    ? product
    : t('{product}: {grams} g water', { product, grams: c.waterCapacity })
}

function CapacityChoice({ m }: { m: Model }) {
  const { t } = useTranslation()
  const { capacities, capacity, names, designed, name } = m
  if (capacities.length > 0)
    return (
      <NativeSelect
        {...rowSize(m)}
        label={t('Case capacity record')}
        // with a case record's stated capacity in use, no capacity record is the choice
        value={capacity?.id ?? ''}
        onChange={(e) => m.setCapacityId(e.currentTarget.value || undefined)}
        data={[
          ...(m.chosenCase?.waterCapacity === undefined
            ? []
            : [{ value: '', label: t('From the brass record') }]),
          ...capacities.map((c) => ({ value: c.id, label: capacityText(c, names, t) })),
        ]}
      />
    )
  if (designed) return null
  // the workbench's row keeps its place: the measured capacity field's help says what to enter
  if (m.slots?.choices)
    return (
      <NativeSelect
        {...rowSize(m)}
        label={t('Case capacity record')}
        disabled
        data={[{ value: '', label: t('None') }]}
      />
    )
  return (
    <p>
      {t(
        'No case capacity record for {name}: enter your measured case capacity for the volume behind the bullet.',
        { name },
      )}
    </p>
  )
}

function MeasuredCapacity({ m }: { m: Model }) {
  const { t } = useTranslation()
  const { system, stock, chosenCase, names, designed, measuredWaterCapacity } = m
  return (
    <>
      <NumberField
        spec={{
          ...measuredWaterCapacitySpec,
          help: designed
            ? msg(
                'Measured: water to the mouth of your fired cases. Empty: not given, and so is the volume behind the bullet.',
              )
            : msg(
                "Measured: water to the mouth of your fired cases. Replaces the capacity or brass record; empty: the record's value.",
              ),
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
                text: stock.record
                  ? t(
                      'From the capacity record {record}. Type a measured capacity to replace it.',
                      {
                        record: capacityText(stock.record, names, t),
                      },
                    )
                  : t('From the brass record {record}. Type a measured capacity to replace it.', {
                      record: chosenCase ? caseText(chosenCase, names, t) : '',
                    }),
              }
            : undefined
        }
      />
      {/* the workbench card has no room for the row: its More popover holds the link */}
      {capacityGuide && !m.slots && (
        <p className="note">
          <Anchor href={capacityGuide} target="_blank" rel="noopener" size="sm">
            {t('How to measure case capacity')}
          </Anchor>
        </p>
      )}
    </>
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
  const { t } = useTranslation()
  const { id, mode, pos, length, system } = m
  const step = system.length.step
  const toShown = (x: number) => length.fromSi(toSi('length', x + m.ladderShift))
  const release = () => m.setSliding(false)
  return (
    <div className="field seating-slider">
      <label htmlFor={`${id}-slider`}>
        {t('Slide to change {name}', { name: seatingLengthName[mode] })}
      </label>
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
        onChange={(e) => {
          m.setSliding(true)
          m.setPos(slidTo(Number(e.target.value), m, step))
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onKeyUp={release}
        onBlur={release}
      />
    </div>
  )
}

/** The seating by COAL or CBTO: the mode, its field and the slider. */
function SeatFields({ m, range }: { m: Model; range: readonly [number, number] }) {
  const { t } = useTranslation()
  const { id, mode, pos, system, canCbto, card, warnings } = m
  return (
    <>
      <SegmentedRow
        legend={t('Seat the bullet by')}
        name={`${id}-mode`}
        value={mode}
        segments={(['overallLength', 'baseToOgive'] as const).map((s) => ({
          value: s,
          label: seatingLengthName[s],
          reason:
            s === 'baseToOgive' && !canCbto
              ? t("CBTO needs the bullet's base-to-ogive length. This bullet record has none.")
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
          {slots?.choices && m.p.caseLot}
          <CapacityChoice m={m} />
        </>,
        slots?.choices,
      )}
      {!card && <BarrelField m={m} />}
      <MeasuredCapacity m={m} />
      {shape && range && <SeatFields m={m} range={range} />}
    </div>
  )
}

/** The figure's description: the half section and the bullet seated in it, if any. */
function figureDesc(m: Model, spec: Spec, drawnSeating: Seating | undefined, t: T) {
  const { view, designed, name, mm } = m
  if (!drawnSeating) return undrawnDesc(view, designed ? undefined : spec.name, t)
  const values = {
    coal: mm(drawnSeating.coal.value),
    depth: mm(drawnSeating.depth.value),
    jump: jumpText(drawnSeating, mm, t),
  }
  return designed
    ? t(
        'Half section of the case of the {name} (maximum outline, interior not shown) in its chamber (minimum outline) with the bullet seated at COAL {coal}: seating depth {depth}, jump {jump}. Dashed lines are approximate geometry.',
        { ...values, name },
      )
    : t(
        'Half section of the {name} case (CIP maximum outline, interior not shown) in its chamber (CIP minimum outline) with the bullet seated at COAL {coal}: seating depth {depth}, jump {jump}. Dashed lines are approximate geometry.',
        { ...values, name: spec.name },
      )
}

/** The description of a half section with no bullet seated; `record` names the cartridge record, none for a design. */
function undrawnDesc(view: Model['view'], record: string | undefined, t: T) {
  if (record === undefined)
    return view === 'combined'
      ? t('Half section of the case in its chamber; no bullet seated.')
      : view === 'cartridge'
        ? t('Half section of the cartridge; no bullet seated.')
        : t('Half section of the chamber; no bullet or case drawn.')
  const name = record
  return view === 'combined'
    ? t('Half section of the {name} case in its chamber; no bullet seated.', { name })
    : view === 'cartridge'
      ? t('Half section of the {name} cartridge; no bullet seated.', { name })
      : t('Half section of the {name} chamber; no bullet or case drawn.', { name })
}

/** The figure's title and description for the view and the seating drawn. */
function figureText(m: Model, spec: Spec, drawnSeating: Seating | undefined, t: T) {
  const { view, designed, name, design } = m
  const where = designed ? name : `${spec.standard} ${spec.name}`
  const fill = drawnSeating && m.fill ? ` ${fillText(m.fill, m.system, t)}` : ''
  return {
    caption: captionOf(view, design?.name, where, t),
    desc: figureDesc(m, spec, drawnSeating, t) + fill,
  }
}

/** The powder fill as the legend and the description say it, or the inputs it needs. */
function fillText(fill: ChargeFill, system: UnitSystem, t: T) {
  if ('missing' in fill)
    return t('Powder fill not drawn: needs {missing}.', {
      missing: fill.missing.map((x) => t(x)).join(', '),
    })
  const values = { charge: withUnit('charge', system, fill.charge), fill: fillPercent(fill.ratio) }
  return fill.compressed
    ? t(
        'Hatched: the charge of {charge} at a case fill of {fill} %, compressed by the bullet.',
        values,
      )
    : t('Hatched: the charge of {charge} at a case fill of {fill} %.', values)
}

/** The figure's title: `design` is the name of the user design seated, none for a record's bullet. */
function captionOf(view: Model['view'], design: string | undefined, where: string, t: T) {
  if (view === 'chamber') return t('Chamber, {where}', { where })
  if (view === 'combined')
    return design === undefined
      ? t('Seated bullet, {where}', { where })
      : t('Seated user design {design}, {where}', { design, where })
  return design === undefined
    ? t('Cartridge with the seated bullet, {where}', { where })
    : t('Cartridge with the seated user design {design}, {where}', { design, where })
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
      {seating && m.fill && 'level' in m.fill && shown.cartridge && (
        <ChargeLevel id={id} level={m.fill.level} />
      )}
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
  const { t } = useTranslation()
  const { view, fixed, model, levelModel, designer, shape, p } = m
  const fullView = p.fullView
  // a chamber without a cartridge holds no bullet: the Chamber view draws the chamber alone
  const drawnSeating = view === 'chamber' ? undefined : m.figureSeating
  const text = figureText(m, spec, drawnSeating, t)
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
        <p>
          {t('The outline needs {missing}.', {
            missing: fixed.missing.map((x) => translateMessage(x, t)).join(', '),
          })}
        </p>
      )}
      {view !== 'combined' && !model && (
        <p>
          {view === 'cartridge'
            ? t('No cartridge drawing for this record.')
            : t('No chamber drawing for this record.')}
        </p>
      )}
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
          {t(
            'Dashed in the flag colour: approximate geometry (see the notes). Faint: the bullet inside the case. Dashed ticks: leade contact, approximate.',
          )}
        </p>
      )}
      {/* the workbench card's drawing fills it: the fill and the table go to the Cartridge card's More */}
      {drawnSeating && put(m.slots, <FigureValues m={m} seating={drawnSeating} />, m.slots?.more)}
      {!shape && view === 'combined' && !designer && (
        <p>{t('Choose a bullet with a length to seat it.')}</p>
      )}
    </div>
  )
}

/** The powder fill's legend and the values the figure draws as a table, from the model and fill the drawing reads. */
function FigureValues({ m, seating }: { m: Model; seating: Seating }) {
  const { t } = useTranslation()
  const { fill } = m
  const rows = seatingValueRows(
    {
      annotation: (m.model ?? m.levelModel)?.annotation,
      seating,
      fill,
      system: m.system,
    },
    t,
  )
  return (
    <div className="figure-values">
      {fill && (
        <p className="seating-legend">
          {fillText(fill, m.system, t)}{' '}
          {'level' in fill &&
            t(
              'The charge level is approximate: the volume behind the bullet is taken as even from the head to the bullet base.',
            )}
        </p>
      )}
      <details>
        <summary>{t('Values of the drawing')}</summary>
        <PanelTable
          label={t('Values of the drawing')}
          className="figure-values-table"
          caption={t('Values of the drawing (simulation inputs, not load data)')}
          columns={[t('Name'), t('Value'), t('Unit')]}
        >
          {rows.map((r) => (
            <tr key={`${r.name} ${r.value}`}>
              <th scope="row">{r.name}</th>
              <td className="num">{r.value}</td>
              <td>{r.unit}</td>
            </tr>
          ))}
        </PanelTable>
      </details>
    </div>
  )
}

function SeatingNotes({
  seating,
  landsOther,
  freebore,
}: {
  seating: Seating
  landsOther?: boolean | undefined
  freebore?: boolean | undefined
}) {
  const { t } = useTranslation()
  return (
    <>
      <p className="note">
        {seating.jump.source === 'lands'
          ? t(
              'The jump is your measured lands contact less the seated length, not a seating recommendation.',
            )
          : t('The jump is not a measured jump and not a seating recommendation.')}{' '}
        {t(
          'Staying at or below L6 says nothing about pressure, magazine fit or safety; seating depth changes pressure.',
        )}
      </p>
      {freebore && seating.jump.source === 'chamber' && (
        <p className="note">
          {t(
            "The leade starts at your firearm's measured freebore past the chamber L3, not at the CIP s.",
          )}
        </p>
      )}
      {landsOther && (
        <p className="note">
          {t(
            "The firearm's lands contact was measured with another bullet and is not used for this jump.",
          )}
        </p>
      )}
      {seating.notes.length > 0 && (
        <ul className="seating-notes">
          {seating.notes.map((n) => (
            <li key={n}>{translateMessage(n, t)}</li>
          ))}
        </ul>
      )}
    </>
  )
}

type RowsProps = { m: Model; seating: Seating; chamber: Chamber }

function CoalRow({ m, seating, chamber }: RowsProps) {
  const { t } = useTranslation()
  const { card, designed, len, mm, length } = m
  // in the workbench card the CBTO field's flag says it: no line of its own
  const above =
    !card && seating.aboveL6 && chamber.cartridgeL6 !== undefined ? (
      <strong className="exceeded">
        {designed
          ? t('above cartridge L6 ({length})', { length: mm(chamber.cartridgeL6) })
          : t('above CIP maximum L6 ({length})', { length: mm(chamber.cartridgeL6) })}
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
  return m.designed ? <NotGiven term="CBTO" why={msg('the bullet base-to-ogive')} /> : null
}

function CaseVolumeRow({ m, seating }: RowsProps) {
  const { t } = useTranslation()
  const { stock, chosenCase, measuredWaterCapacity, vol } = m
  if (!seating.caseVolume)
    return m.designed ? (
      <NotGiven term={t('Case volume to the mouth')} why={msg('a measured case capacity')} />
    ) : null
  return (
    <Row
      term={t('Case volume to the mouth')}
      value={vol(seating.caseVolume.value)}
      tag={seating.caseVolume.tag}
      note={
        measuredWaterCapacity.si !== undefined || !stock
          ? t('your measured case capacity')
          : t('{grams} g water ({id}) at {density} g/cm³', {
              grams: stock.grams,
              id: stock.record?.id ?? chosenCase?.id ?? '',
              density: waterDensityGramsPerCm3,
            })
      }
    />
  )
}

function VolumeRow({ m, seating }: RowsProps) {
  const { t } = useTranslation()
  if (seating.volumeBehindBullet)
    return (
      <Row
        term={t('Volume behind the bullet')}
        value={m.vol(seating.volumeBehindBullet.value)}
        tag={seating.volumeBehindBullet.tag}
      />
    )
  return m.designed ? (
    <NotGiven term={t('Volume behind the bullet')} why={msg('a measured case capacity')} />
  ) : null
}

function TravelRow({ m, seating }: RowsProps) {
  const { t } = useTranslation()
  if (seating.travel)
    return (
      <Row
        term={t('Travel to the muzzle')}
        value={m.mm(seating.travel.value)}
        tag={seating.travel.tag}
      />
    )
  return m.designed ? (
    <NotGiven term={t('Travel to the muzzle')} why={msg('the barrel length')} />
  ) : null
}

function LeadeRow({ m, seating }: RowsProps) {
  const { t } = useTranslation()
  if (seating.leade !== undefined)
    return (
      <Row
        term={t('Leade contact from the head')}
        value={m.mm(seating.leade)}
        tag="approximate"
        note={
          m.designed
            ? t('own derivation from the chamber of the design, not a CIP value')
            : t('own derivation from the CIP chamber, not a CIP value')
        }
      />
    )
  return m.designed ? (
    <NotGiven
      term={t('Leade contact from the head')}
      why={msg('the chamber L3, G1, F, i, and s or G')}
    />
  ) : null
}

function JumpRow({ m, seating }: RowsProps) {
  const { t } = useTranslation()
  const unknown = seating.jump.value === undefined
  return (
    <Row
      term={seating.jump.source === 'lands' ? t('Jump to the lands') : t('Jump to the leade')}
      value={seating.jump.value === undefined ? t('not given') : m.mm(seating.jump.value)}
      tag={unknown ? undefined : seating.jump.tag}
      note={translateMessage(jumpNote(seating.jump), t)}
    />
  )
}

/** The seating depth's note: where the case length comes from. */
function seatingNote(m: Model, chamber: Chamber, t: Translator['t']) {
  const length = m.mm(chamber.caseLength)
  const brass = m.p.linked?.caseLengthBrass
  if (brass !== undefined)
    return t('case length: trim length of your brass group {name} {length}', {
      name: brass,
      length,
    })
  if (m.p.linked?.caseLength !== undefined) return t('case length: L3 typed {length}', { length })
  return m.designed
    ? t('case length: cartridge L3 of the design {length}', { length })
    : t('case length: CIP L3 maximum {length}', { length })
}

function SeatingValues({ m, seating, chamber }: RowsProps) {
  const { t } = useTranslation()
  const { card, mode, slots, design, contact } = m
  const rows = { m, seating, chamber }
  const more = slots?.moreValues
  return (
    <div className="seating-values">
      {/* a linked figure sits on a page that states this in its own notice */}
      {!m.p.linked && (
        <p className="note screen-only">
          {t('Results from this software are simulations, not load data.')}
        </p>
      )}
      {design && (
        <p className="note user-design">
          {t('Seated from the user design {name}, not a catalogue record.', { name: design.name })}
        </p>
      )}
      <dl>
        {/* in the workbench's card the field shows the mode's length with its L6 flag and
            this list the other one, so both modes keep one height */}
        {(!card || mode === 'baseToOgive') && <CoalRow {...rows} />}
        {(!card || mode !== 'baseToOgive') && <CbtoRow {...rows} />}
        <Row
          term={t('Seating depth')}
          value={m.len(seating.depth.value)}
          unit={m.length.symbol}
          tag={seating.depth.tag}
          note={seatingNote(m, chamber, t)}
        />
        {aside(slots, <CaseVolumeRow {...rows} />, more)}
        {/* in the workbench the field "Usable case volume" shows it, flagged "from seating" */}
        {!card && <VolumeRow {...rows} />}
        {aside(slots, <TravelRow {...rows} />, more)}
        {aside(slots, <LeadeRow {...rows} />, more)}
        {aside(slots, <JumpRow {...rows} />, more)}
      </dl>
      {contact && !card && <ErrorNote color="orange">{contact}</ErrorNote>}
      {!card && (
        <SeatingNotes
          seating={seating}
          landsOther={m.p.landsOther}
          freebore={m.p.freebore !== undefined}
        />
      )}
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
            <SeatingNotes
              seating={seating}
              landsOther={m.p.landsOther}
              freebore={m.p.freebore !== undefined}
            />
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
  const { t } = useTranslation()
  const g = gateOf(m, t)
  if ('gate' in g) return g.gate
  return <PreviewBody m={m} spec={g.spec} chamber={g.chamber} />
}
