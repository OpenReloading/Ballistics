import { fillet } from '../core/fillet.ts'
import type {
  AngleMark,
  Annotation,
  Convention,
  Note as CoreNote,
  Profile as CoreProfile,
  Dimension,
  RadiusMark,
  SectionPoint,
  SpecValue,
} from '../core/types.ts'
import { deg } from '../core/units.ts'
import type { Side } from './figures.ts'

/** The codes of the notes of a cartridge or chamber outline. */
export type NoteCode =
  | 'cartridgeR'
  | 'headBelowP1'
  | 'grooveAngle'
  | 'grooveDerivedE'
  | 'beltSkipped'
  | 'mouthCone'
  | 'mouthStep'
  | 'noLeade'
  | 'noG1'
  | 'leadeStartBelowH'
  | 'leadeStartPastG'
  | 'leadeAngle'
  | 'throatDatum'
  | 'iInvalid'
  | 'closedFront'
  | 'shoulderOrder'
  | 'shoulderPartial'
  | 'shoulderAngle'
  | 'filletSkipped'
  | 'chamferSkipped'

/** A note of a cartridge or chamber outline, coded by `NoteCode`. */
export type Note = CoreNote<NoteCode>
/** The profile of a cartridge or chamber side, with `NoteCode` notes. */
export type Profile = CoreProfile<NoteCode>

/**
 * CIP tables whose symbol meanings were checked against the geometry and
 * that `cipProfile` draws; table VII is drawn by `shotshellProfile`.
 */
export const drawnTables = new Set(['I', 'II', 'III', 'IV', 'V', 'VIII', 'IX', 'X'])

const baseSymbols = ['R1', 'R', 'P1', 'L3', 'H2']
const mm = (x: number) => Number(x.toFixed(3))
// the callers run after `missing` found the base symbols, or after the check of the symbol itself
const stored = <S extends string[]>(v: (symbol: string) => number | undefined, ...symbols: S) =>
  symbols.map((s) => v(s) as number) as { [K in keyof S]: number }
/**
 * The value of a symbol on a side as drawn: with a value, of `variant` when given and stored,
 * else without a variant.
 */
export const storedValue = (
  values: SpecValue[],
  side: string,
  symbol: string,
  variant?: string,
) => {
  const of = (want?: string) =>
    values.find(
      (v) =>
        v.side === side &&
        v.symbol === symbol &&
        (want === undefined ? !v.variant : v.variant === want) &&
        v.value !== undefined,
    )
  return (variant === undefined ? undefined : of(variant)) ?? of(undefined)
}

/** A stored cone angle more than 1 degree off the angle the drawn lengths give. */
const angleOff = (angle: number | undefined, drawn: number) =>
  angle !== undefined && Math.abs(drawn - angle) > 1

/**
 * Names a cartridge whose L3 lies over 0.3 mm past chamber L3 + h, or whose L6 is below its own
 * L3: its front is closed or crimped (blanks, shot), so the cartridge side is not drawn.
 */
export function closedFront(values: SpecValue[]): Note | undefined {
  const [L3, chamberL3] = [
    storedValue(values, 'cartridge', 'L3')?.value,
    storedValue(values, 'chamber', 'L3')?.value,
  ]
  if (L3 === undefined) return undefined
  const front =
    chamberL3 === undefined
      ? undefined
      : chamberL3 + (storedValue(values, 'chamber', 'h')?.value ?? 0)
  if (front !== undefined && L3 > front + 0.3)
    return {
      code: 'closedFront',
      symbols: ['L3', 'h'],
      text: `Cartridge L3 ${L3} mm lies ${mm(L3 - front)} mm past chamber L3 + h ${mm(front)} mm: its front is closed or crimped, so the cartridge is not drawn.`,
    }
  const L6 = storedValue(values, 'cartridge', 'L6')?.value
  if (L6 !== undefined && L6 < L3)
    return {
      code: 'closedFront',
      symbols: ['L3', 'L6'],
      text: `Cartridge L6 ${L6} mm is below its L3 ${L3} mm: its front is closed or crimped, so the cartridge is not drawn.`,
    }
  return undefined
}

/**
 * Simplified half-section outline of one side of a CIP record: lengths draw, angles
 * check, and each disagreement becomes a note. Values with a variant are ignored.
 * The chamber recess ends at the chamber's own E, else its own R, else the cartridge R; it is
 * never narrower than P1.
 */
export function cipProfile(
  values: SpecValue[],
  side: Side,
  table?: string,
): Profile | { missing: string[] } {
  const find = (symbol: string, s: string = side) => storedValue(values, s, symbol)
  const v = (symbol: string) => find(symbol)?.value
  const E = v('E')
  const rim = side === 'chamber' ? (E ?? v('R') ?? find('R', 'cartridge')?.value) : v('R')
  const missing = baseSymbols.filter((s) => (s === 'R' ? rim : v(s)) === undefined)
  if (missing.length) return { missing }
  const R = rim as number
  const d = draft(side, find)
  const groove = grooveDepth(d, R, table)
  headProfile(d, R)
  const zP1 = grooveAndBelt(d, R, groove, table)
  const { points, marks } = d
  const [P1, L3] = stored(v, 'P1', 'L3')
  points.push([P1 / 2, zP1])
  marks.diameter('P1', zP1, { toward: 1 })
  const [P0, L0] = [v('P0'), v('L0')]
  if (P0 !== undefined && L0 !== undefined && zP1 < L0 && L0 < (v('L1') ?? L3)) {
    points.push([P0 / 2, L0])
    marks.diameter('P0', L0, { toward: 1 })
    marks.length('L0', 0)
    marks.edge(L0)
  }
  const shoulder = shoulderProfile(d, zP1)
  neckProfile(d, shoulder)
  if (side === 'chamber') {
    const zG1 = chamberMouth(d)
    if (zG1 !== undefined) chamberThroat(d, zG1)
  }
  const { derivedE } = groove
  return {
    points,
    notes: d.notes,
    annotation: marks.done(points),
    ...(derivedE === undefined ? {} : { derivedE: mm(derivedE) }),
  }
}

/** One side's outline while it is drawn: its stored values, points, notes and marks. */
interface Draft {
  side: Side
  /** The stored value of a symbol on this side, or on side `s`. */
  find: (symbol: string, s?: string) => SpecValue | undefined
  /** The value of a symbol on this side. */
  v: (symbol: string) => number | undefined
  points: SectionPoint[]
  notes: Note[]
  note: (code: NoteCode, symbols: string[], text: string, at: SectionPoint) => void
  marks: ReturnType<typeof annotationBuilder>
  /** `Cartridge` or `Chamber`, for the note texts. */
  name: string
}

/** An empty outline of a side that reads its stored values with `find`. */
function draft(side: Side, find: (symbol: string, s?: string) => SpecValue | undefined): Draft {
  const notes: Note[] = []
  return {
    side,
    find,
    v: (symbol) => find(symbol)?.value,
    points: [],
    notes,
    note: (code, symbols, text, at) => {
      notes.push({ code, symbols, text, at })
    },
    marks: annotationBuilder(find),
    name: side === 'chamber' ? 'Chamber' : 'Cartridge',
  }
}

/** The groove depth e drawn, and a cartridge e derived from delta where none is stored. */
interface GrooveDepth {
  e?: number
  derivedE?: number
}

/**
 * The cartridge groove depth: the stored e, else outside table III (where delta is the belt cone)
 * one cone from E1 at R to P1 at E (grooveDerivedE), drawn as 0 when negative.
 */
function grooveDepth({ side, v }: Draft, R: number, table?: string): GrooveDepth {
  const [P1, E, E1, storedE, delta] = [v('P1'), v('E'), v('E1'), v('e'), v('delta')]
  const validDelta = delta !== undefined && delta > 0 && delta < 90
  const derivedE =
    side === 'cartridge' &&
    storedE === undefined &&
    table !== 'III' &&
    validDelta &&
    E !== undefined &&
    E1 !== undefined
      ? E - R - ((P1 as number) - E1) / 2 / Math.tan(delta * deg)
      : undefined
  const e = storedE ?? (derivedE === undefined ? undefined : Math.max(0, derivedE))
  return { e, derivedE }
}

/** The head from the axis: the rim corner, the head face and the rim (cartridge) or recess (chamber) to R. */
function headProfile(d: Draft, R: number) {
  const { side, v, marks, note, points } = d
  const [R1, P1] = stored(v, 'R1', 'P1')
  const E = v('E')
  if (side === 'chamber' && E === undefined && v('R') === undefined)
    note(
      'cartridgeR',
      ['R'],
      `The chamber has no E or R: its recess is drawn to the cartridge R ${R} mm.`,
      [Math.max(R1, v('R3') ?? 0, P1) / 2, R],
    )
  const R3 = v('R3')
  // a table III chamber recess takes the belt; a case body cannot pass a recess narrower than P1
  const head = side === 'chamber' ? Math.max(R1, R3 ?? 0, P1) : R1
  if (side === 'chamber' && Math.max(R1, R3 ?? 0) < P1)
    note(
      'headBelowP1',
      ['R1', 'P1'],
      `Chamber R1 ${R1} mm is below P1 ${P1} mm: the head is drawn at P1.`,
      [head / 2, 0],
    )
  points.push([0, 0], ...rimCorner(d, head, R), [head / 2, R])
  marks.diameter('R1', 0, { behindHeadFace: true })
  if (side === 'chamber') {
    marks.diameter('R3', 0, { behindHeadFace: true })
    // the recess depth: the chamber's own E, else its own R; the cartridge R is not dimensioned
    marks.length(E === undefined ? 'R' : 'E', 0, undefined, { behindHeadFace: true })
  } else marks.length('R', 0, undefined, { behindHeadFace: true })
  marks.edge(R)
}

/** What the extractor groove is drawn from: its stored values, the belt, whether delta is a cone angle. */
interface GrooveShape {
  R: number
  e: number
  derivedE?: number
  E: number
  E1: number
  R3?: number
  delta?: number
  validDelta: boolean
  belt: boolean
  zBelt?: number
}

/** The groove's points and marks, the belt where there is one, and the notes on e and delta. */
function drawGroove({ v, marks, note, points }: Draft, c: GrooveShape) {
  const { R, e, derivedE, E, E1, R3, delta, validDelta, belt, zBelt } = c
  const P1 = v('P1') as number
  points.push([E1 / 2, R], [E1 / 2, R + e])
  marks.diameter('E1', 0, { behindHeadFace: true })
  marks.length('E', 0, undefined, { behindHeadFace: true })
  // a derived e is shown in the table and the description only
  if (v('e') !== undefined) marks.length('e', R, undefined, { behindHeadFace: true })
  marks.edge(R + e, E)
  const cone: SectionPoint = belt ? [(R3 as number) / 2, zBelt as number] : [P1 / 2, E]
  if (validDelta) marks.angle('delta', [E1 / 2, R + e], [[E1 / 2, R + e + (cone[1] - R - e)], cone])
  if (derivedE !== undefined)
    note(
      'grooveDerivedE',
      ['e', 'delta'],
      `Cartridge e is not published: delta ${delta} degrees from E1 at R to P1 at E gives e ${mm(derivedE)} mm${derivedE < 0 ? ', drawn as 0' : ''}.`,
      [E1 / 2, R + e],
    )
  if (belt) {
    points.push([(R3 as number) / 2, zBelt as number], [(R3 as number) / 2, E])
    marks.diameter('R3', 0, { behindHeadFace: true })
    marks.edge(zBelt as number)
  } else if (delta !== undefined) {
    const angle = Math.atan2((P1 - E1) / 2, E - R - e) / deg
    if (Math.abs(angle - delta) > 1)
      note(
        'grooveAngle',
        ['delta', 'E'],
        `Cartridge delta ${delta} degrees differs from the ${mm(angle)} degrees of the groove from E1 at R + e to P1 at E; the lengths are drawn.`,
        [(E1 + P1) / 4, (R + e + E) / 2],
      )
  }
}

/**
 * The cartridge extractor groove from E1 at R + e to P1 at E, through the belt from R3 to E
 * where table III gives one; returns the station of P1, E after a groove, else R.
 */
function grooveAndBelt(d: Draft, R: number, { e, derivedE }: GrooveDepth, table?: string) {
  const { side, v, note } = d
  const R1 = v('R1') as number
  const [E, E1, delta, R3] = [v('E'), v('E1'), v('delta'), v('R3')]
  const validDelta = delta !== undefined && delta > 0 && delta < 90
  const groove =
    side === 'cartridge' && E !== undefined && E1 !== undefined && e !== undefined && R + e < E
  // the belt front is the only length drawn from an angle: delta, from the axis, up to R3
  const zBelt =
    groove && R3 !== undefined && R3 > E1 && validDelta
      ? R + e + (R3 - E1) / 2 / Math.tan(delta * deg)
      : undefined
  const belt = zBelt !== undefined && zBelt <= (E as number)
  // in table III, E ends the belt, so without the belt the groove has no end
  if (side === 'cartridge' && table === 'III' && !belt)
    note(
      'beltSkipped',
      ['E1', 'e', 'E', 'R3', 'delta'],
      `Cartridge ${['E1', 'e', 'E', 'R3', 'delta'].map((s) => `${s} ${v(s) ?? 'missing'}`).join(', ')} (mm, delta in degrees) give no belt ending by E: the outline steps to P1 at R.`,
      [R1 / 2, R],
    )
  if (!(groove && (table !== 'III' || belt))) return R
  drawGroove(d, { R, e, derivedE, E, E1, R3, delta, validDelta, belt, zBelt })
  return E
}

/** One shoulder corner, r1 at P2 or r2 at H1: its fillet arc where one fits, else sharp. */
function shoulderCorner(
  { v, marks, note, points, name }: Draft,
  symbol: string,
  corner: SectionPoint,
  next: SectionPoint,
  [L1, L2]: [number, number],
) {
  const r = v(symbol)
  const prev = points.at(-1)
  const arc = r === undefined || !prev ? null : fillet(prev, corner, next, r)
  const [arcStart, arcEnd] = [arc?.[0], arc?.at(-1)]
  // P2 is dimensioned before the r1 arc, H1 after the r2 arc, on the straight lines
  if (symbol === 'r1') marks.diameter('P2', arcStart ? arcStart[1] : L1, { toward: -1 })
  else marks.diameter('H1', arcEnd ? arcEnd[1] : L2, { toward: 1 })
  if (arc) {
    points.push(...arc)
    marks.radius(symbol, corner)
    return
  }
  if (r !== undefined)
    note(
      'filletSkipped',
      [symbol],
      `${name} ${symbol} ${r} mm does not fit the corner at ${symbol === 'r1' ? 'P2 at L1' : 'H1 at L2'}: the corner is drawn sharp.`,
      corner,
    )
  points.push(corner)
}

/** The drawn shoulder: its lengths, the cone angle, the corners with their fillets. */
function drawShoulder(d: Draft, [P2, L1, L2, H1]: [number, number, number, number]) {
  const { v, marks, note, name } = d
  const [L3, H2] = stored(v, 'L3', 'H2')
  marks.length('L1', 0)
  marks.length('L2', 0)
  marks.length('S', 0, undefined, { far: true })
  marks.edge(L1, L2)
  // where the cone through P2 at L1 and H1 at L2 meets the axis
  if (H1 < P2) {
    const vertex = L1 + ((L2 - L1) * P2) / (P2 - H1)
    marks.angle(
      'alpha',
      [0, vertex],
      [
        [P2 / 2, L1],
        [-P2 / 2, L1],
      ],
    )
  }
  const alpha = v('alpha')
  const cone = (2 * Math.atan2((P2 - H1) / 2, L2 - L1)) / deg
  if (angleOff(alpha, cone))
    note(
      'shoulderAngle',
      ['alpha', 'L1', 'L2'],
      `${name} alpha ${alpha} degrees differs from the ${mm(cone)} degrees of the shoulder from P2 at L1 to H1 at L2; the lengths are drawn.`,
      [(P2 + H1) / 4, (L1 + L2) / 2],
    )
  const corners: [string, SectionPoint, SectionPoint][] = [
    ['r1', [P2 / 2, L1], [H1 / 2, L2]],
    ['r2', [H1 / 2, L2], [H2 / 2, L3]],
  ]
  // r2 starts where the r1 arc leaves the shoulder, so the two never overlap
  for (const [symbol, corner, next] of corners) shoulderCorner(d, symbol, corner, next, [L1, L2])
}

/** The note on a shoulder with only some of P2, L1, L2 and H1 stored. */
function noteShoulderPartial({ v, note, name }: Draft, zP1: number) {
  const [P1, L3, H2] = stored(v, 'P1', 'L3', 'H2')
  const shoulderSet = ['P2', 'L1', 'L2', 'H1']
  const shoulderStored = shoulderSet.filter((s) => v(s) !== undefined)
  if (!shoulderStored.length || shoulderStored.length >= 4) return
  const fillets = ['r1', 'r2'].filter((s) => v(s) !== undefined)
  note(
    'shoulderPartial',
    shoulderSet,
    `${name} ${shoulderStored.map((s) => `${s} ${v(s)}`).join(', ')} mm without ${shoulderSet.filter((s) => v(s) === undefined).join(', ')}: no shoulder is drawn, the wall runs straight from P1 to H2${fillets.length ? `, ${fillets.join(' and ')} not drawn` : ''}.`,
    [(P1 + H2) / 4, (zP1 + L3) / 2],
  )
}

/**
 * The shoulder from P2 at L1 to H1 at L2 with its fillets r1 and r2, where all four are stored and
 * in order; whether it is drawn.
 */
function shoulderProfile(d: Draft, zP1: number) {
  const { v, note, name } = d
  const [P1, L3, H2] = stored(v, 'P1', 'L3', 'H2')
  const [P2, L1, L2, H1] = [v('P2'), v('L1'), v('L2'), v('H1')]
  noteShoulderPartial(d, zP1)
  if (P2 === undefined || L1 === undefined || L2 === undefined || H1 === undefined) return false
  if (!(zP1 < L1 && L1 < L2 && L2 <= L3 && H1 <= P2)) {
    note(
      'shoulderOrder',
      ['L1', 'L2', 'L3', 'P2', 'H1'],
      `${name} L1 ${L1}, L2 ${L2} and L3 ${L3} mm past the P1 station ${zP1} mm, or H1 ${H1} and P2 ${P2} mm, are out of order: no shoulder is drawn.`,
      [(P1 + H2) / 4, (zP1 + L3) / 2],
    )
    return false
  }
  drawShoulder(d, [P2, L1, L2, H1])
  return true
}

/** The neck to H2 at L3; on the cartridge L6, G1 past the mouth and the neck length L3 - L2. */
function neckProfile(d: Draft, shoulder: boolean) {
  const { side, v, marks, points } = d
  const [L3, H2] = stored(v, 'L3', 'H2')
  const L2 = v('L2')
  points.push([H2 / 2, L3])
  marks.diameter('H2', L3, { toward: -1 })
  marks.length('L3', 0)
  if (side === 'cartridge') {
    marks.length('L6', 0)
    marks.diameter('G1', L3, { front: true })
    // L2 = L3: a shoulder with no neck
    if (shoulder && L3 - (L2 as number) > 1e-6)
      marks.chain('L3−L2', L3 - (L2 as number), L2 as number, L3)
  }
}

/** The mouth cone's length from its included angle alpha1; 180 degrees is a step; none without an angle. */
function mouthConeLength(alpha1: number | undefined, H2: number, G1: number) {
  if (alpha1 === undefined || !(alpha1 > 0)) return
  return alpha1 >= 180 ? 0 : Math.max(0, (H2 - G1) / 2 / Math.tan((alpha1 / 2) * deg))
}

/**
 * The chamber mouth from H2 at L3 to G1, by h or the alpha1 cone; returns the station of G1, none
 * without G1.
 */
function chamberMouth(d: Draft): number | undefined {
  const { v, marks, note, points } = d
  const [L3, H2] = stored(v, 'L3', 'H2')
  const [G1, h, alpha1] = [v('G1'), v('h'), v('alpha1')]
  const throat = ['G', 'F', 'h', 's'].filter((symbol) => v(symbol) !== undefined)
  if (G1 === undefined) {
    if (throat.length)
      note(
        'noG1',
        ['G1', ...throat],
        `Chamber has no G1: the outline ends at H2 at L3, ${throat.map((symbol) => `${symbol} ${v(symbol)}`).join(', ')} mm not drawn.`,
        [H2 / 2, L3],
      )
    return
  }
  const hCone = mouthConeLength(alpha1, H2, G1)
  if (h !== undefined && hCone !== undefined && Math.abs(h - hCone) > 0.05)
    note(
      'mouthCone',
      ['h', 'alpha1'],
      `Chamber h ${h} mm differs from the ${mm(hCone)} mm the alpha1 cone of ${alpha1} degrees gives; h is drawn.`,
      [(H2 + G1) / 4, L3 + h / 2],
    )
  if (h === undefined && hCone === undefined && H2 !== G1)
    note(
      'mouthStep',
      ['h', 'alpha1'],
      `Chamber ${alpha1 === undefined ? 'has no h or alpha1' : `has no h and alpha1 ${alpha1} is not a cone angle`}: the mouth is drawn as a step from H2 ${H2} to G1 ${G1} mm at L3.`,
      [(H2 + G1) / 4, L3],
    )
  const zG1 = L3 + (h ?? hCone ?? 0)
  points.push([G1 / 2, zG1])
  marks.edge(L3, zG1)
  marks.length('h', L3)
  if (alpha1 !== undefined && zG1 > L3 && H2 > G1)
    marks.angle(
      'alpha1',
      [0, L3 + ((zG1 - L3) * H2) / (H2 - G1)],
      [
        [H2 / 2, L3],
        [-H2 / 2, L3],
      ],
    )
  return zG1
}

/**
 * The chamber throat from G1 at `zG1`: the leade to F at L3 + G and a bore stub, or a G1 stub
 * without G or F.
 */
function chamberThroat(d: Draft, zG1: number) {
  const { v, find, marks, note, points } = d
  const [L3, G1] = stored(v, 'L3', 'G1')
  const [G, F] = [v('G'), v('F')]
  if (G === undefined || F === undefined) {
    points.push([G1 / 2, zG1 + 0.1 * L3])
    marks.diameter('G1', zG1, { toward: 1 })
    marks.convention('g1Stub', G1 / 2, zG1, zG1 + 0.1 * L3)
    return
  }
  // h, s and G share chamber L3 as datum; the stored L3+G mostly adds G to the cartridge L3
  const [sum, cartridgeL3] = [find('L3+G', 'cartridge')?.value, find('L3', 'cartridge')?.value]
  const off = (base: number | undefined) =>
    base === undefined || Math.abs((sum as number) - base - G) > 0.015
  if (sum !== undefined && off(L3) && off(cartridgeL3))
    note(
      'throatDatum',
      ['L3+G', 'L3', 'G'],
      `Cartridge L3+G ${sum} mm is ${cartridgeL3 === undefined ? 'not' : 'neither'} chamber L3 + G ${mm(L3 + G)} mm, where the leade ends${cartridgeL3 === undefined ? '' : `, nor cartridge L3 + G ${mm(cartridgeL3 + G)} mm`}.`,
      [F / 2, L3 + G],
    )
  const zEnd = Math.max(L3 + G, zG1)
  marks.length('G', L3)
  const free = leadeProfile(d, zG1, zEnd)
  marks.diameter('G1', (zG1 + free) / 2, { toward: 1 })
  points.push([F / 2, zEnd], [F / 2, zEnd + 0.1 * L3])
  marks.diameter('F', zEnd)
  marks.edge(zEnd)
  marks.convention('boreStub', F / 2, zEnd, zEnd + 0.1 * L3)
}

/**
 * The leade from G1 to F at `zEnd`, at the angle i from s or back from L3 + G; a step without a
 * leade. Returns where the free bore at G1 ends.
 */
function leadeProfile(d: Draft, zG1: number, zEnd: number): number {
  const { v, marks, note, points } = d
  const [L3, G1, G, F] = stored(v, 'L3', 'G1', 'G', 'F')
  const [i, s] = [v('i'), v('s')]
  if (G1 <= F) {
    note(
      'noLeade',
      ['G1', 'F'],
      `Chamber G1 ${G1} mm is not above F ${F} mm: no leade, a step at L3 + G.`,
      [G1 / 2, zEnd],
    )
    points.push([G1 / 2, zEnd])
    return zEnd
  }
  if (!(i !== undefined && i > 0 && i < 90)) {
    note(
      'iInvalid',
      ['i'],
      `Chamber i ${i ?? 'missing'} is not an angle between 0 and 90 degrees: the leade is drawn straight from G1 to F.`,
      [(G1 + F) / 4, (zG1 + zEnd) / 2],
    )
    return zG1
  }
  const leade = (G1 - F) / 2 / Math.tan(i * deg)
  const start = s === undefined ? L3 + G - leade : L3 + s
  const drawn = Math.min(zEnd, Math.max(zG1, start))
  if (s !== undefined && Math.abs(G - s - leade) > 0.1)
    note(
      'leadeAngle',
      ['s', 'i'],
      `Chamber s ${s} mm and i ${mm(i)} degrees disagree: G - s is ${mm(G - s)} mm, the leade at i ${mm(leade)} mm; the leade is drawn from ${mm(drawn - L3)} mm past L3.`,
      [G1 / 2, drawn],
    )
  // within 0.1 mm the start is the rounding of the stored values and is clamped silently
  if (start < zG1 - 0.1)
    note(
      'leadeStartBelowH',
      s === undefined ? ['G', 'i', 'h'] : ['s', 'h'],
      `The chamber leade starts ${mm(start - L3)} mm past L3 (${s === undefined ? 'from G and i' : 's'}), before h ${mm(zG1 - L3)} mm; it is drawn from L3 + h.`,
      [G1 / 2, drawn],
    )
  // only s can pass G: a start from i lies before L3 + G
  if (start > zEnd + 0.1)
    note(
      'leadeStartPastG',
      ['s', 'G'],
      `Chamber s ${s} mm lies beyond the leade end at L3 + ${mm(zEnd - L3)} mm (G ${G} mm): the leade is drawn as a step there.`,
      [G1 / 2, drawn],
    )
  points.push([G1 / 2, drawn])
  if (s !== undefined) marks.length('s', L3)
  marks.edge(drawn)
  if (drawn < zEnd)
    marks.angle(
      'i',
      [G1 / 2, drawn],
      [
        [G1 / 2, zEnd],
        [F / 2, zEnd],
      ],
    )
  return drawn
}

/**
 * The cartridge rim corner at the head face, from the head face to the rim side at r: a chamfer
 * where f and beta are stored (beta from the head face line, f along the axis, so the face ends
 * f / tan(beta) inside the rim), else a round of r0 where stored, else the sharp corner.
 */
function rimCorner({ side, v, marks, note }: Draft, head: number, R: number): SectionPoint[] {
  const corner: SectionPoint = [head / 2, 0]
  if (side !== 'cartridge') return [corner]
  const [f, beta, r0] = [v('f'), v('beta'), v('r0')]
  let chamfer = false
  if (f !== undefined && beta !== undefined) {
    const inset = f / Math.tan(beta * deg)
    if (beta > 0 && beta < 90 && f > 0 && f < R && inset < head / 2) chamfer = true
    else
      note(
        'chamferSkipped',
        ['f', 'beta'],
        `Cartridge f ${f} mm and beta ${beta} degrees give no chamfer inside the rim (R ${R} mm): the rim corner is drawn sharp.`,
        corner,
      )
    if (chamfer) {
      const foot: SectionPoint = [head / 2 - inset, 0]
      const top: SectionPoint = [head / 2, f]
      marks.angle('beta', foot, [corner, top])
      marks.length('f', 0, undefined, { behindHeadFace: true })
      if (r0 !== undefined)
        note(
          'filletSkipped',
          ['r0'],
          `Cartridge r0 ${r0} mm is not drawn beside the chamfer: no sheet shows which corner it rounds.`,
          corner,
        )
      return [foot, top]
    }
  }
  if (r0 === undefined) return [corner]
  const arc = fillet([0, 0], corner, [head / 2, R], r0)
  if (!arc) {
    note(
      'filletSkipped',
      ['r0'],
      `Cartridge r0 ${r0} mm does not fit the rim corner at the head face: the corner is drawn sharp.`,
      corner,
    )
    return [corner]
  }
  marks.radius('r0', corner)
  return arc
}

/** Collects the annotation of one side; `find` gives the stored value of a symbol. */
function annotationBuilder(find: (symbol: string) => SpecValue | undefined) {
  const dimensions: Dimension[] = []
  const angles: AngleMark[] = []
  const radii: RadiusMark[] = []
  const stations: number[] = []
  const conventions: Convention[] = []
  type Extra = Pick<Dimension, 'behindHeadFace' | 'front' | 'far' | 'toward'>
  const value = (symbol: string) => {
    const stored = find(symbol)
    return stored === undefined ? undefined : { stored, value: stored.value as number }
  }
  return {
    /** A stored length from `from`, to `from` plus its value unless `to` is given. */
    length(symbol: string, from: number, to?: number, extra: Extra = {}) {
      const v = value(symbol)
      if (v)
        dimensions.push({
          kind: from === 0 ? 'length' : 'chain',
          symbol,
          ...v,
          from,
          to: to ?? from + v.value,
          ...extra,
        })
    },
    chain(symbol: string, derived: number, from: number, to: number) {
      dimensions.push({
        kind: 'chain',
        symbol,
        value: Number(derived.toFixed(3)),
        derived: true,
        from,
        to,
      })
    },
    diameter(symbol: string, z: number, extra: Extra = {}) {
      const v = value(symbol)
      if (v)
        dimensions.push({
          kind: 'diameter',
          symbol,
          ...v,
          from: z,
          to: z,
          radius: v.value / 2,
          ...extra,
        })
    },
    angle(symbol: string, vertex: SectionPoint, flanks: [SectionPoint, SectionPoint]) {
      const v = value(symbol)
      if (v) angles.push({ kind: 'angle', symbol, ...v, vertex, flanks })
    },
    radius(symbol: string, corner: SectionPoint) {
      const v = value(symbol)
      if (v) {
        radii.push({ kind: 'radius', symbol, ...v, corner })
        stations.push(corner[1])
      }
    },
    edge(...z: number[]) {
      stations.push(...z)
    },
    convention(kind: Convention['kind'], r: number, from: number, to: number) {
      conventions.push({ kind, r, from, to })
    },
    /** The annotation, with the edges at the stations where the outline turns or steps. */
    done(points: SectionPoint[]): Annotation {
      return {
        dimensions,
        angles,
        radii,
        edges: edgeStations(points, stations, radii),
        conventions,
      }
    },
  }
}

/** The stations past the head where the outline turns or steps, or a radius rounds a corner, rising. */
function edgeStations(points: SectionPoint[], stations: number[], radii: RadiusMark[]): number[] {
  const corners = new Set(radii.map((c) => c.corner[1]))
  return [...new Set(stations)]
    .filter((z) => z > 0 && (corners.has(z) || turns(points, z)))
    .sort((a, b) => a - b)
}

/** Whether the outline changes direction or steps at the station z. */
function turns(points: SectionPoint[], z: number): boolean {
  const at = points.flatMap((p, k) => (Math.abs(p[1] - z) < 1e-9 ? [{ k, p }] : []))
  const [first, last] = [at[0], at[at.length - 1]]
  if (!first || !last) return false
  // the directions into and out of the station, skipping repeated points
  const before = points.slice(0, first.k).findLast(([r, pz]) => r !== first.p[0] || pz !== z)
  const after = points.slice(last.k + 1).find(([r, pz]) => r !== last.p[0] || pz !== z)
  if (!before || !after) return false
  if (first.p[0] !== last.p[0]) return true
  const [r, pz] = first.p
  const a = Math.atan2(r - before[0], pz - before[1])
  const b = Math.atan2(after[0] - r, after[1] - pz)
  return Math.abs(a - b) > 1e-6
}

/** Variants of the cartridge l of a table VII record, or [undefined] when l has none. */
export function shotshellVariants(values: SpecValue[]): (string | undefined)[] {
  const variants = values.flatMap((v) =>
    v.side === 'cartridge' && v.symbol === 'l' && v.variant ? [v.variant] : [],
  )
  return variants.length ? [...new Set(variants)] : [undefined]
}

/**
 * Half section of one side of a CIP table VII record (shotshell): rim g to t, then the body from d
 * at t to h at l (chamber G, T, D, H, L); with l1 and l2 a cone from d at l1 to d2 at l2 (chamber
 * D1 to B). The chamber goes on with the forcing cone from H at L to the bore B at the included
 * angle alpha1, a max limit, so the shortest cone. l and L take the value of the variant, the
 * other symbols their value without one. No head height or crimp: no value gives them.
 */
export function shotshellProfile(
  values: SpecValue[],
  side: Side,
  variant?: string,
): Profile | { missing: string[] } {
  const chamber = side === 'chamber'
  const names = chamber ? shotshellNames.chamber : shotshellNames.cartridge
  const [gS, tS, dS, hS, lS] = names
  // only the case and chamber lengths are published per variant
  const outline = draft(side, (symbol) =>
    storedValue(values, side, symbol, symbol === lS ? variant : undefined),
  )
  const { v, points, marks } = outline
  const missing = [gS, tS, dS, hS, lS, ...(chamber ? ['B'] : [])].filter((s) => v(s) === undefined)
  if (missing.length) return { missing }
  const [g, t, d, h, l] = stored(v, gS, tS, dS, hS, lS)
  points.push([0, 0], [g / 2, 0], [g / 2, t], [d / 2, t])
  marks.diameter(gS, 0, { behindHeadFace: true })
  marks.diameter(dS, 0, { behindHeadFace: true })
  marks.length(tS, 0, undefined, { behindHeadFace: true })
  marks.length(lS, 0)
  marks.diameter(hS, l, { toward: -1 })
  marks.edge(t)
  const drawCone = shotshellCone(outline, names)
  points.push([h / 2, l])
  if (chamber) forcingCone(outline, names, drawCone)
  return { points, notes: outline.notes, annotation: marks.done(points) }
}

type ShotshellNames = [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
]

/**
 * The symbols of a shotshell side in the order rim, rim length, body start, body end, length,
 * cone start, cone end, cone start length, cone end length, cone angle.
 */
const shotshellNames: Record<Side, ShotshellNames> = {
  chamber: ['G', 'T', 'D', 'H', 'L', 'D1', 'B', 'L1', 'L2', 'alpha1'],
  cartridge: ['g', 't', 'd', 'h', 'l', 'd', 'd2', 'l1', 'l2', 'alpha'],
}

/**
 * The body cone from the start diameter at l1 to the end diameter at l2, where both are stored
 * and in order; whether it is drawn.
 */
function shotshellCone(o: Draft, names: ShotshellNames): boolean {
  const { side, v, points, marks, note, name } = o
  const chamber = side === 'chamber'
  const [, tS, dS, hS, lS, startS, endS, l1S, l2S, angleS] = names
  const [t, d, h, l] = stored(v, tS, dS, hS, lS)
  const [start, end, l1, l2, angle] = [v(startS), v(endS), v(l1S), v(l2S), v(angleS)]
  // the cone set without B, which every chamber stores for the bore
  const set = [chamber ? startS : endS, l1S, l2S]
  const cone = set.filter((s) => v(s) !== undefined)
  const drawCone =
    start !== undefined &&
    end !== undefined &&
    l1 !== undefined &&
    l2 !== undefined &&
    t < l1 &&
    l1 < l2 &&
    l2 < l
  if (drawCone) {
    points.push([start / 2, l1], [end / 2, l2])
    marks.length(l1S, 0)
    marks.length(l2S, 0)
    marks.diameter(chamber ? startS : endS, chamber ? l1 : l2, { toward: chamber ? -1 : 1 })
    marks.edge(l1, l2)
    if (start > end)
      marks.angle(
        angleS,
        [0, l1 + ((l2 - l1) * start) / (start - end)],
        [
          [start / 2, l1],
          [-start / 2, l1],
        ],
      )
    const drawn = (2 * Math.atan2((start - end) / 2, l2 - l1)) / deg
    if (angleOff(angle, drawn))
      note(
        'shoulderAngle',
        [angleS, l1S, l2S],
        `${name} ${angleS} ${angle} degrees differs from the ${mm(drawn)} degrees of the cone from ${startS} at ${l1S} to ${endS} at ${l2S}; the lengths are drawn.`,
        [(start + end) / 4, (l1 + l2) / 2],
      )
  } else if (cone.length)
    note(
      'shoulderPartial',
      set,
      `${name} ${cone.map((s) => `${s} ${v(s)}`).join(', ')} mm are incomplete or out of order: no cone is drawn, the body runs straight from ${dS} to ${hS}.`,
      [(d + h) / 4, (t + l) / 2],
    )
  return drawCone
}

/** The chamber forcing cone from H at L to the bore B, and a bore stub. */
function forcingCone(o: Draft, names: ShotshellNames, drawCone: boolean) {
  const { v, points, marks, note } = o
  const [, , , hS, lS, , , , , angleS] = names
  const [h, l] = stored(v, hS, lS)
  const angle = v(angleS)
  const B = v('B') as number
  // alpha1 is the included angle of the forcing cone; 180 degrees is a step
  const valid = angle !== undefined && angle > 0 && angle <= 180
  if (h > B && !valid)
    note(
      'mouthStep',
      ['alpha1'],
      `Chamber alpha1 ${angle ?? 'missing'} is not a cone angle: the forcing cone is drawn as a step from H ${h} to B ${B} mm at L.`,
      [(h + B) / 4, l],
    )
  const zB = l + (h > B && valid && angle < 180 ? (h - B) / 2 / Math.tan((angle / 2) * deg) : 0)
  // H = B (9 C.F. Mori): the bore goes on from H at L
  if (B !== h) {
    points.push([B / 2, zB])
    marks.diameter('B', zB)
    marks.edge(l, zB)
    if (!drawCone && zB > l)
      marks.angle(
        angleS,
        [0, l + ((zB - l) * h) / (h - B)],
        [
          [h / 2, l],
          [-h / 2, l],
        ],
      )
  }
  points.push([B / 2, zB + 0.1 * l])
  marks.convention('boreStub', B / 2, zB, zB + 0.1 * l)
}

/** Symbol, stored value, then tolerance (signed) or limit, as the description gives them. */
export function valueParts(value: SpecValue): string[] {
  const t = value.tolerance
  const tolerance = [t?.lower, t?.upper === undefined ? undefined : `+${t.upper}`]
    .filter((x) => x !== undefined)
    .join(' ')
  return [value.symbol, String(value.value), tolerance, value.limit ?? ''].filter((x) => x)
}
