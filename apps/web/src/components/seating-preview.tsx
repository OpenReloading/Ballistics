'use client'

import { NativeSelect } from '@mantine/core'
import { fullSection, svgPath, toPartFrame } from '@openreloading/drawing'
import { bulletDimensions } from '@openreloading/drawing/bullet'
import { drawnTables } from '@openreloading/drawing/cartridge'
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
} from '@openreloading/drawing/seating'
import { type Bullet, fromSi, toSi } from '@openreloading/schema'
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { apiFetch } from '../lib/api-fetch.ts'
import type { BulletSummary, CartridgeDetail } from '../lib/api-types.ts'
import type { StripFigure } from '../lib/barrel-strip.ts'
import { designShape } from '../lib/bullet-designer.ts'
import { drawable } from '../lib/cartridge-sheet.ts'
import type { FieldValue } from '../lib/field-spec.ts'
import { figureViews } from '../lib/figure-views.ts'
import type { Suggestion } from '../lib/input-defaults.ts'
import { productLabel, refName } from '../lib/manufacturers.ts'
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
  volume?: number
  travel?: number
  overallLength?: number
  baseToOgive?: number
  /** Seating depth and the barrel length of the seating, m, for print. */
  depth?: number
  barrel?: number
  /** The length the bullet is seated by; the other one is derived. */
  mode?: Mode
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
  unit?: string
  tag?: Tagged['tag']
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
  leade?: number
  g1?: number
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
  const z = outline.points[outline.points.length - 1][1] + 1
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

/**
 * Live half-section of the chosen cartridge's case (CIP maximum, interior not shown) in its
 * chamber (CIP minimum) with the bullet seated by COAL or CBTO; seating depth, volume behind the
 * bullet, travel and jump follow the slider and the number field (`@openreloading/drawing/seating`).
 */
export function SeatingPreview({
  cartridge,
  draft,
  system,
  initial,
  barrelLength,
  barrelDefault,
  onSeated,
  onSeatLadder,
  measuredWaterCapacity = { text: '', si: undefined },
  onMeasuredWaterCapacity,
  capacityId: chosenId,
  onCapacityId,
  linked,
  slots,
  view = 'combined',
  ladderStep,
  fullView,
}: {
  /** The catalogue record to seat in; none for a `draft`. */
  cartridge?: { id: string; name: string }
  /** The cartridge design to seat in, instead of a record. */
  draft?: DraftCartridge
  system: UnitSystem
  /** The example's bullet id and barrel length (m); the seating of the example or an opened load (m). */
  initial?: {
    bullet?: string
    barrel?: number
    seating?: { by: Mode; value: number }
  }
  /** The chosen firearm's barrel length, m: a new one replaces the field's value, the seating stays. */
  barrelLength?: number
  /** The barrel length used until one is typed or a gun gives one, m, with where it comes from. */
  barrelDefault?: Suggestion
  /** Volume (m³) and travel (m) of the seated bullet, on every change: the interior fields follow them. */
  onSeated: (values: Seated) => void
  /** The seating at another length, for a seating ladder; undefined while no bullet is seated. */
  onSeatLadder?: (seatAt: SeatingLengths | undefined) => void
  /**
   * The user's measured case capacity (water to the mouth, m³), held by the page so a remount keeps
   * it: replaces the record's.
   */
  measuredWaterCapacity?: FieldValue
  onMeasuredWaterCapacity?: (value: FieldValue) => void
  /** The capacity record chosen, held by the page so a load keeps it; without it the choice is the figure's own. */
  capacityId?: string
  onCapacityId?: (id: string) => void
  /**
   * The bullet record or design of the page's own bullet input: the preview seats it and
   * shows no bullet search or design choice of its own.
   */
  linked?: { bullet?: string; design?: string }
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
  view?: 'cartridge' | 'chamber' | 'combined'
  /** A seating ladder step to draw instead of the field's seating, m; the fields keep theirs. */
  ladderStep?: { by: Mode; value: number }
  /** The figure's full view: the same drawing in a modal at the window's height. */
  fullView?: { opened: boolean; onClose: () => void }
}) {
  const id = useId().replace(/:/g, '')
  const detail = useRecord<CartridgeDetail>(
    cartridge && !draft ? `cartridges/${encodeURIComponent(cartridge.id)}` : undefined,
  )
  const draftSpec = draft?.spec
  const designed = draft !== undefined
  /** The designer page: its own drawing is above, its controls in one section. */
  const designer = designed && !draft.card
  const name = draft?.title ?? cartridge?.name ?? ''
  const [bulletId, setBulletId] = useState(initial?.bullet)
  const names = useManufacturerNames()
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
  const record = useRecord<Bullet>(bulletId ? `bullets/${encodeURIComponent(bulletId)}` : undefined)
  const [ownCapacityId, setOwnCapacityId] = useState<string | undefined>(undefined)
  const capacityId = onCapacityId ? chosenId : ownCapacityId
  const setCapacityId = onCapacityId ?? setOwnCapacityId
  const [barrel, setBarrel] = useState<FieldValue>(() => {
    const m = barrelLength ?? initial?.barrel
    return m === undefined
      ? { text: '', si: undefined }
      : { text: fixedFieldText('barrelLength', system, m), si: m }
  })
  /** The barrel length is the gun's, the example's or typed: no longer the default. */
  const [barrelTyped, setBarrelTyped] = useState(
    () => (barrelLength ?? initial?.barrel) !== undefined,
  )
  const defaultBarrel = barrelDefault?.si
  const [mode, setMode] = useState<Mode>('overallLength')
  const [pos, setPos] = useState<FieldValue>({ text: '', si: undefined })
  /** The position and mode the preview last started at by itself. */
  const [started, setStarted] = useState<{ si: number; mode: Mode }>()
  const shown = useRef(system)
  useEffect(() => {
    if (barrelLength === undefined) return
    setBarrel({
      text: fixedFieldText('barrelLength', shown.current, barrelLength),
      si: barrelLength,
    })
    setBarrelTyped(true)
  }, [barrelLength])
  // the default follows the cartridge's class and the Settings until one is typed
  useEffect(() => {
    if (barrelTyped) return
    setBarrel(
      defaultBarrel === undefined
        ? { text: '', si: undefined }
        : {
            text: fixedFieldText('barrelLength', shown.current, defaultBarrel),
            si: defaultBarrel,
          },
    )
  }, [barrelTyped, defaultBarrel])

  // a unit switch rewrites the texts from the SI values
  useEffect(() => {
    const was = shown.current
    shown.current = system
    const rewrite = (q: 'length' | 'barrelLength') => (f: FieldValue) =>
      f.si === undefined ? f : { text: fixedFieldText(q, system, f.si), si: f.si }
    if (was.barrelLength !== system.barrelLength) setBarrel(rewrite('barrelLength'))
    if (was.length !== system.length) setPos(rewrite('length'))
  }, [system])

  // the record when its table draws
  const spec = useMemo(
    () =>
      draftSpec ??
      (detail.status === 'ok' && drawnTables.has(detail.value.table)
        ? drawable(detail.value)
        : undefined),
    [draftSpec, detail],
  )
  const chamber = useMemo(() => spec && chamberOf(spec.values), [spec])
  const capacities = detail.status === 'ok' ? detail.value.capacities : []
  const capacity = capacities.find((c) => c.id === capacityId) ?? capacities[0]
  const bulletRecord = record.status === 'ok' && !design ? record.value : undefined
  // the design's shape in mm whatever the units: a unit switch must not move the bullet
  const shaped = useMemo(
    () =>
      design
        ? designShape(design.resolved, shown.current)
        : bulletRecord && bulletDimensions(bulletRecord),
    [design, bulletRecord],
  )
  // a record whose dimensions cannot form an outline is not seated; its reason is shown
  const refused = useMemo(() => {
    const o = shaped && bulletOutline(shaped)
    return o && 'reason' in o ? o.reason : undefined
  }, [shaped])
  const shape = refused ? undefined : shaped

  // the slider range and the drawing depend on the records only, never on the position
  const fixed = useMemo(() => {
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
  }, [spec, chamber, shape])
  // apart from `fixed`: a unit switch relabels the drawing and keeps the seating position
  const unit = drawingLengthUnit(system)

  const canCbto = shape?.baseToOgive !== undefined
  // a new bullet or cartridge starts at the initial seating (CBTO only with a base to ogive), else at
  // L6, else in the middle of the range
  const start = fixed?.range
  const [initialBy, initialValue] = [initial?.seating?.by, initial?.seating?.value]
  useEffect(() => {
    // a design starts empty: a seating the user did not enter would be a default
    if (!start || !chamber || designed) return
    const given = initialValue !== undefined && (initialBy === 'overallLength' || canCbto)
    const m = given
      ? initialValue
      : toSi('length', chamber.cartridgeL6 ?? (start[0] + start[1]) / 2)
    const startMode = given && initialBy === 'baseToOgive' ? 'baseToOgive' : 'overallLength'
    setMode(startMode)
    setPos({ text: fixedFieldText('length', shown.current, m), si: m })
    setStarted({ si: m, mode: startMode })
  }, [start, chamber, designed, initialBy, initialValue, canCbto])
  // a bullet without a base-to-ogive cannot keep a CBTO entered for the one before
  useEffect(() => {
    if (!designed || !shape || canCbto || mode !== 'baseToOgive') return
    setMode('overallLength')
    setPos({ text: '', si: undefined })
  }, [designed, shape, canCbto, mode])

  const value = pos.si === undefined ? undefined : fromSi('length', pos.si)
  // the bullet seated by a length (mm): the preview's own position, and each step of a seating ladder
  const seatBy = useMemo(() => {
    if (!chamber || !shape || (mode === 'baseToOgive' && !canCbto)) return
    return (by: number) =>
      seat({
        bullet: shape,
        chamber,
        waterCapacity:
          measuredWaterCapacity.si !== undefined && measuredWaterCapacity.si > 0
            ? waterGrams(measuredWaterCapacity.si)
            : capacity?.waterCapacity.value,
        waterDensity: waterDensityGramsPerCm3,
        barrelLength: barrel.si === undefined ? undefined : fromSi('length', barrel.si),
        by: { kind: mode, value: by },
      })
  }, [chamber, shape, mode, canCbto, capacity, measuredWaterCapacity.si, barrel.si])
  const seating = useMemo(
    () => (seatBy && value !== undefined ? seatBy(value) : undefined),
    [seatBy, value],
  )
  const [stepBy, stepValue] = [ladderStep?.by, ladderStep?.value]
  const figureSeating = useMemo(
    () =>
      seatBy && stepBy === mode && stepValue !== undefined
        ? seatBy(fromSi('length', stepValue))
        : seating,
    [seatBy, stepBy, stepValue, mode, seating],
  )
  // Combined without dimensions, each side's record figure with them, as on the cartridge page;
  // one frame for all, which reaches the longest COAL, so the bullet tip stays in view and the
  // outline stays put when the view changes; the bullet goes on top. In the workbench card the
  // Cartridge view's L6 is the seated COAL, with the seated CBTO added
  const [coal, cbto, inCard] = [
    figureSeating?.coal.value,
    figureSeating?.cbto?.value,
    Boolean(slots) && !designer,
  ]
  const models = useMemo(
    () =>
      spec && !designer
        ? figureViews(
            spec,
            fixed?.drawn,
            unit,
            inCard && coal !== undefined ? { coal, cbto } : undefined,
          )
        : {},
    [spec, fixed, unit, inCard, designer, coal, cbto],
  )
  const model = models[view]
  // the workbench card also draws the figure level, shown where its panel is wider than tall; a
  // design draws it level only, in the room under its own drawing
  const levelModels = useMemo(
    () =>
      spec && (inCard || designer)
        ? figureViews(
            spec,
            fixed?.drawn,
            unit,
            coal === undefined ? undefined : { coal, cbto },
            'print',
            // the design's own drawing above shows its sides: the frame fits the combined view
            designer ? ['combined'] : undefined,
          )
        : {},
    [spec, fixed, unit, inCard, designer, coal, cbto],
  )
  const levelModel = levelModels[view]
  // the slider's range in the mode's length, for the seating ladder
  const seatRange = fixed?.range
  // the seating mode's length minus COAL: the slider and the ladder show the mode's length
  const ladderShift =
    shape?.baseToOgive !== undefined && mode === 'baseToOgive'
      ? shape.baseToOgive - shape.length
      : 0
  const seatAt = useMemo<SeatingLengths | undefined>(() => {
    if (!seatBy || !seatRange) return
    return {
      lengthKind: mode,
      range: [
        toSi('length', seatRange[0] + ladderShift),
        toSi('length', seatRange[1] + ladderShift),
      ],
      at: (by) => {
        const s = seatBy(fromSi('length', by))
        return {
          volume: s.volumeBehindBullet && unitsOf.capacity.cm3.toSi(s.volumeBehindBullet.value),
          travel: s.travel && toSi('length', s.travel.value),
        }
      },
    }
  }, [seatBy, seatRange, mode, ladderShift])
  const onSeatAt = useRef(onSeatLadder)
  onSeatAt.current = onSeatLadder
  useEffect(() => {
    onSeatAt.current?.(seatAt)
    return () => onSeatAt.current?.(undefined)
  }, [seatAt])

  // the interior fields follow the seated bullet, derived from COAL
  const seated = useRef(onSeated)
  seated.current = onSeated
  const [seatedVolume, seatedTravel] = [seating?.volumeBehindBullet?.value, seating?.travel?.value]
  const caseVolume =
    measuredWaterCapacity.si !== undefined && measuredWaterCapacity.si > 0
      ? measuredWaterCapacity.si
      : capacity && waterVolume(capacity.waterCapacity.value)
  const [seatedCoal, seatedCbto] = [seating?.coal.value, seating?.cbto?.value]
  const [seatedDepth, barrelSi] = [seating?.depth.value, barrel.si]
  const atStart = pos.si === started?.si && mode === started?.mode
  const figure = useMemo(
    () =>
      spec &&
      seating && {
        values: spec.values,
        table: spec.table,
        bullet: seating.outline.points,
        base: seating.basePosition,
      },
    [spec, seating],
  )
  // no seated bullet reports {}: the page forgets the earlier seating
  useEffect(() => {
    seated.current({
      ...(caseVolume !== undefined && { caseVolume }),
      ...(seatedVolume !== undefined && { volume: unitsOf.capacity.cm3.toSi(seatedVolume) }),
      ...(seatedTravel !== undefined && { travel: toSi('length', seatedTravel) }),
      ...(seatedCoal !== undefined && { overallLength: toSi('length', seatedCoal) }),
      ...(seatedCbto !== undefined && { baseToOgive: toSi('length', seatedCbto) }),
      ...(seatedDepth !== undefined && { depth: toSi('length', seatedDepth) }),
      ...(seatedCoal !== undefined && barrelSi !== undefined && { barrel: barrelSi }),
      ...(seatedCoal !== undefined && { mode, atStart }),
      ...(figure && { figure }),
    })
  }, [
    caseVolume,
    seatedVolume,
    seatedTravel,
    seatedCoal,
    seatedCbto,
    seatedDepth,
    barrelSi,
    mode,
    atStart,
    figure,
  ])

  const length = system.length
  const len = (x: number) => formatQuantity('length', system, toSi('length', x))
  const mm = (x: number) => `${len(x)} ${length.symbol}`
  /** A volume in cm³ in the case capacity unit. */
  const vol = (cm3: number) => withUnit('capacity', system, unitsOf.capacity.cm3.toSi(cm3))

  const contact =
    seating?.contact &&
    `Contact with leade (${seating.jump.tag}): the bullet reaches the leade at ${mm(seating.contactCoal as number)} COAL; it is not moved back.`
  /** The workbench's cards: the fields there show what the rows below leave out. */
  const card = Boolean(slots) && !designer
  const warnings = [
    seating?.aboveL6 &&
      chamber?.cartridgeL6 !== undefined &&
      `Above the ${designed ? 'cartridge' : 'CIP maximum'} L6 of ${mm(chamber.cartridgeL6)}`,
    contact,
  ].filter((w): w is string => !!w)

  const jumpText = (s: Seating) =>
    s.jump.value === undefined ? jumpNote(s.jump) : `${mm(s.jump.value)}, ${s.jump.tag}`
  const announce = seating
    ? `COAL ${mm(seating.coal.value)}, seating depth ${mm(seating.depth.value)}, jump ${jumpText(seating)}${seating.contact ? ', contact with leade' : ''}.`
    : ''
  const [live, setLive] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setLive(announce), 600)
    return () => clearTimeout(timer)
  }, [announce])

  function changeMode(next: Mode) {
    if (next === mode || !shape) return
    if (value !== undefined && shape.baseToOgive !== undefined) {
      const shift = shape.baseToOgive - shape.length
      const mmValue = next === 'baseToOgive' ? value + shift : value - shift
      setPos({
        text: fixedFieldText('length', system, toSi('length', mmValue)),
        si: toSi('length', mmValue),
      })
    }
    setMode(next)
  }

  if (!designed && (detail.status === 'loading' || detail.status === 'none'))
    return <Loading what="the cartridge record" inline />
  if (!designed && detail.status === 'error') return <p>{notReached}</p>
  if (!spec || !chamber)
    return (
      <p>
        {designed
          ? 'Not given: the cartridge L3, which the seating needs.'
          : `No CIP drawing for ${name}: the preview needs the CIP cartridge and chamber values.`}
      </p>
    )

  const range = fixed?.range
  const toShown = (x: number) => length.fromSi(toSi('length', x + ladderShift))
  const step = system.length.step
  const what = view === 'combined' ? 'case in its chamber' : view
  // a chamber without a cartridge holds no bullet: the Chamber view draws the chamber alone
  const drawnSeating = view === 'chamber' ? undefined : figureSeating
  const where = designed ? name : `${spec.standard} ${spec.name}`
  const caption =
    view === 'chamber'
      ? `Chamber, ${where}`
      : `${view === 'combined' ? 'Seated' : 'Cartridge with the seated'} ${design ? `user design ${design.name}` : 'bullet'}, ${where}`
  const desc = drawnSeating
    ? `Half section of the ${designed ? `case of the ${name}` : `${spec.name} case`} (${designed ? 'maximum' : 'CIP maximum'} outline, interior not shown) in its chamber (${designed ? 'minimum' : 'CIP minimum'} outline) with the bullet seated at COAL ${mm(drawnSeating.coal.value)}: seating depth ${mm(drawnSeating.depth.value)}, jump ${jumpText(drawnSeating)}. Dashed lines are approximate geometry.`
    : `Half section of the ${designed ? what : `${spec.name} ${what}`}; no bullet ${view === 'chamber' ? 'or case drawn' : 'seated'}.`
  const drawing = (name: string, shown = model) =>
    shown && (
      <TechnicalDrawing
        id={`${id}-${name}`}
        title={caption}
        desc={desc}
        model={shown}
        level={shown.medium === 'print'}
      >
        {drawnSeating && (
          <SeatedBullet
            id={`${id}-${name}`}
            s={drawnSeating}
            caseLength={chamber.caseLength}
            leade={drawnSeating.leade}
            g1={chamber.G1}
          />
        )}
      </TechnicalDrawing>
    )

  const barrelField = (
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
        setBarrel(v)
        setBarrelTyped(true)
      }}
      // an emptied field takes the default again
      onBlur={() => barrel.text.trim() === '' && setBarrelTyped(false)}
    />
  )
  const notes = seating && (
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
  /** A part in its slot, or in place without slots; nothing while the slot is not mounted. */
  const put = (node: ReactNode, target: HTMLElement | null | undefined) =>
    !slots ? node : target ? createPortal(node, target) : null
  /** A rarely needed part: in the `more` slot when the page gives one, else in place. */
  const aside = (node: ReactNode, target: HTMLElement | null | undefined) =>
    slots && target !== undefined ? (target ? createPortal(node, target) : null) : node

  return (
    <div className="seating-preview" data-split={slots ? '' : undefined}>
      {card && put(barrelField, slots?.gun)}
      {put(
        <div className="seating-controls">
          {!linked && (
            <>
              <RecordSearch<BulletSummary>
                kind="bullets"
                label="Search bullets by manufacturer or name"
                describe={(b) => productLabel(b, names)}
                onSelect={(b) => {
                  setDesign(undefined)
                  setBulletId(b.id)
                }}
                noneText="No bullet found"
                unreachableText={notReached}
              />
              <NativeSelect
                label="Or a bullet design"
                description="From your bullet designs in this browser."
                value={design?.id ?? ''}
                onFocus={readDesigns}
                onChange={(e) => setDesign(designs.find((d) => d.id === e.currentTarget.value))}
                data={[
                  { value: '', label: designs.length ? 'None' : 'None in this browser' },
                  ...designs.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
            </>
          )}
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
          {bulletRecord && !shaped && (
            <p>This bullet record has no length: the preview needs it.</p>
          )}
          {refused && <p>The bullet outline is not drawn: {refused}</p>}
          {aside(
            capacities.length > 0 ? (
              <NativeSelect
                label="Case capacity record"
                value={capacity?.id}
                onChange={(e) => setCapacityId(e.currentTarget.value)}
                data={capacities.map((c) => ({
                  value: c.id,
                  label: `${c.id}: ${c.waterCapacity.value} g water${c.caseManufacturer ? `, ${refName(names, c.caseManufacturer) || c.caseManufacturer}` : ''}`,
                }))}
              />
            ) : (
              !designed && (
                <p>
                  No case capacity record for {name}: enter your measured case capacity for the
                  volume behind the bullet.
                </p>
              )
            ),
            slots?.more,
          )}
          {!card && barrelField}
          <NumberField
            spec={{
              ...measuredWaterCapacitySpec,
              help: designed
                ? 'Measured: water to the mouth of your fired cases. Empty: not given, and so is the volume behind the bullet.'
                : "Measured: water to the mouth of your fired cases. Replaces the capacity record; empty: the record's value.",
            }}
            system={system}
            value={measuredWaterCapacity}
            onChange={(v) => onMeasuredWaterCapacity?.(v)}
            // the record's capacity in the field while none is typed
            placeholder={
              capacity
                ? (s) => formatQuantity('capacity', s, waterVolume(capacity.waterCapacity.value))
                : undefined
            }
            flag={
              capacity && measuredWaterCapacity.si === undefined
                ? {
                    kind: 'record',
                    text: `From the capacity record ${capacity.id}: ${capacity.waterCapacity.value} g water${capacity.caseManufacturer ? `, ${refName(names, capacity.caseManufacturer) || capacity.caseManufacturer}` : ''}. Type a measured capacity to replace it.`,
                  }
                : undefined
            }
          />
          {shape && range && (
            <>
              <SegmentedRow
                legend="Seat the bullet by"
                name={`${id}-mode`}
                value={mode}
                segments={(['overallLength', 'baseToOgive'] as const).map((m) => ({
                  value: m,
                  label: seatingLengthName[m],
                  reason:
                    m === 'baseToOgive' && !canCbto
                      ? "CBTO needs the bullet's base-to-ogive length. This bullet record has none."
                      : undefined,
                }))}
                onChange={changeMode}
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
                onChange={setPos}
                // in the workbench card the field carries the L6 and leade warnings: no rows of their own
                flag={
                  card && warnings.length > 0
                    ? { kind: 'exceeded', text: warnings.join('. ') }
                    : undefined
                }
              />
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
                  onChange={(e) => {
                    const slid = length.toSi(Number(e.target.value))
                    // the slider's step grid misses the start: within half a step it is the start
                    const si =
                      started?.mode === mode &&
                      Math.abs(slid - started.si) <= length.toSi(step ?? 0) / 2
                        ? started.si
                        : slid
                    // the display decimals; the exact value stays
                    setPos({ text: fixedFieldText('length', system, si), si })
                  }}
                />
              </div>
            </>
          )}
        </div>,
        slots?.cartridge,
      )}
      <div className="seating-figure">
        {view === 'combined' && fixed?.missing && (
          <p>The outline needs {fixed.missing.join(', ')}.</p>
        )}
        {view !== 'combined' && !model && <p>No {view} drawing for this record.</p>}
        {model && drawing('drawing')}
        {/* a design's own drawing is above: this one shows once a bullet is seated in it */}
        {levelModel && (!designer || drawnSeating) && drawing('level', levelModel)}
        {model && fullView && (
          <AppModal
            opened={fullView.opened}
            onClose={fullView.onClose}
            title={caption}
            size="auto"
            className="figure-full"
          >
            {drawing('full')}
          </AppModal>
        )}
        {drawnSeating && (
          <p className="seating-legend">
            Dashed in the flag colour: approximate geometry (see the notes). Faint: the bullet
            inside the case. Dashed ticks: leade contact, approximate.
          </p>
        )}
        {!shape && view === 'combined' && !designer && (
          <p>Choose a bullet with a length to seat it.</p>
        )}
      </div>
      {seating &&
        put(
          <div className="seating-values">
            {/* a linked figure sits on a page that states this in its own notice */}
            {!linked && (
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
              {(!card || mode === 'baseToOgive') && (
                <Row
                  term="COAL"
                  value={len(seating.coal.value)}
                  unit={length.symbol}
                  tag={seating.coal.tag}
                  // in the workbench card the CBTO field's flag says it: no line of its own
                  note={
                    !card && seating.aboveL6 && chamber.cartridgeL6 !== undefined ? (
                      <strong className="exceeded">
                        above {designed ? 'cartridge' : 'CIP maximum'} L6 ({mm(chamber.cartridgeL6)}
                        )
                      </strong>
                    ) : undefined
                  }
                />
              )}
              {(!card || mode !== 'baseToOgive') &&
                (seating.cbto ? (
                  <Row
                    term="CBTO"
                    value={len(seating.cbto.value)}
                    unit={length.symbol}
                    tag={seating.cbto.tag}
                  />
                ) : (
                  designed && <NotGiven term="CBTO" why="the bullet base-to-ogive" />
                ))}
              <Row
                term="Seating depth"
                value={len(seating.depth.value)}
                unit={length.symbol}
                tag={seating.depth.tag}
                note={`case length: ${designed ? 'cartridge L3 of the design' : 'CIP L3 maximum'} ${mm(chamber.caseLength)}`}
              />
              {aside(
                seating.caseVolume ? (
                  <Row
                    term="Case volume to the mouth"
                    value={vol(seating.caseVolume.value)}
                    tag={seating.caseVolume.tag}
                    note={
                      measuredWaterCapacity.si !== undefined || !capacity
                        ? 'your measured case capacity'
                        : `${capacity.waterCapacity.value} g water (${capacity.id}) at ${waterDensityGramsPerCm3} g/cm³`
                    }
                  />
                ) : (
                  designed && (
                    <NotGiven term="Case volume to the mouth" why="a measured case capacity" />
                  )
                ),
                slots?.moreValues,
              )}
              {/* in the workbench the field "Usable case volume" shows it, flagged "from seating" */}
              {!card &&
                (seating.volumeBehindBullet ? (
                  <Row
                    term="Volume behind the bullet"
                    value={vol(seating.volumeBehindBullet.value)}
                    tag={seating.volumeBehindBullet.tag}
                  />
                ) : (
                  designed && (
                    <NotGiven term="Volume behind the bullet" why="a measured case capacity" />
                  )
                ))}
              {aside(
                seating.travel ? (
                  <Row
                    term="Travel to the muzzle"
                    value={mm(seating.travel.value)}
                    tag={seating.travel.tag}
                  />
                ) : (
                  designed && <NotGiven term="Travel to the muzzle" why="the barrel length" />
                ),
                slots?.moreValues,
              )}
              {aside(
                seating.leade !== undefined ? (
                  <Row
                    term="Leade contact from the head"
                    value={mm(seating.leade)}
                    tag="approximate"
                    note={`own derivation from the ${designed ? 'chamber of the design' : 'CIP chamber'}, not a CIP value`}
                  />
                ) : (
                  designed && (
                    <NotGiven
                      term="Leade contact from the head"
                      why="the chamber L3, G1, F, i, and s or G"
                    />
                  )
                ),
                slots?.moreValues,
              )}
              {aside(
                <Row
                  term="Jump to the leade"
                  value={seating.jump.value === undefined ? 'not given' : mm(seating.jump.value)}
                  tag={seating.jump.value === undefined ? undefined : seating.jump.tag}
                  note={jumpNote(seating.jump)}
                />,
                slots?.moreValues,
              )}
            </dl>
            {contact && !card && <ErrorNote color="orange">{contact}</ErrorNote>}
            {!card && notes}
          </div>,
          slots?.cartridge,
        )}
      {/* in the workbench the notes (staying below L6 says nothing about pressure or safety) sit in
          the Cartridge card's More, beside the further values */}
      {slots?.more && seating && createPortal(<div>{notes}</div>, slots.more)}
      <p className="seating-live" aria-live="polite">
        {live}
      </p>
    </div>
  )
}
