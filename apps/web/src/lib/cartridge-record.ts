import type { I18n, MessageDescriptor } from '@lingui/core'
import { type SpecValue, toSi } from '@rangefoundry/schema'
import { greek } from '@rangefoundry/svg-drawings'
import {
  conflictWording,
  differenceWording,
  type Figure,
  shotshellVariants,
} from '@rangefoundry/svg-drawings/cartridge'
import { linguiOf } from '../i18n/lingui.ts'
import { formatNumber, localizeNumber, plainNumber } from '../i18n/number.ts'
import type { CartridgeDetail } from './api-types.ts'
import { fieldSpecs, type Group, groups } from './cartridge-designer.ts'
import { inchText, type UnitSystem } from './units.ts'

/** What these functions give when no language is passed. */
const english = linguiOf('en')

/** Messages by their English text, the key the records and the designer's fields give. */
const byMessage = (list: MessageDescriptor[]) => new Map(list.map((m) => [m.message, m]))

/** A symbol as the drawing prints it: the Greek letters for alpha, alpha1, beta and delta. */
export const symbolText = (symbol: string) =>
  symbol
    .split(' ')
    .map((word) => greek[word] ?? word)
    .join(' ')

/** What a symbol stands for, outside table VII (the designer's field help) and in it. */
const meanings = new Map<string, string>([
  ...fieldSpecs.map((f): [string, string] => [`${f.side} ${f.symbol}`, f.meaning]),
  ['cartridge L3+G', 'cartridge L3 plus the chamber G'],
  ['chamber Z', 'groove diameter of the bore'],
  ['chamber N', 'number of grooves'],
  ['chamber u', 'twist, length per turn'],
  ['chamber Q', 'bore cross-section area'],
  [' Pmax', 'maximum mean pressure'],
  [' PE', 'proof pressure'],
  [' M', 'measuring position'],
  // the sheet prints EE in joules under "Pressures (Energies)" and does not spell it out
  [' EE', 'energy, as printed under Pressures (Energies)'],
])
const shotshellMeanings = new Map<string, string>([
  ['cartridge g', 'rim diameter'],
  ['cartridge t', 'rim thickness'],
  ['cartridge d', 'body diameter at the head'],
  ['cartridge d2', 'body diameter at l2'],
  ['cartridge h', 'diameter at the mouth (l)'],
  ['cartridge l', 'case length'],
  ['chamber G', 'rim recess diameter'],
  ['chamber T', 'rim recess depth'],
  ['chamber D', 'body diameter at the head'],
  ['chamber D1', 'diameter at L1'],
  ['chamber H', 'diameter at L'],
  ['chamber L', 'chamber length'],
  ['chamber B', 'bore diameter'],
  ['chamber alpha1', 'included angle of the forcing cone'],
])

/** What the symbols stand for, by their English text, as messages. */
const meaningMessages = byMessage([
  /*i18n*/ { id: 'cartridgeRecord.meaning.rimDiameterHead', message: 'rim diameter at the head' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.headToP1',
    message: 'head to the start of P1; in the chamber the depth of the rim recess',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.rimChamferLength',
    message: 'rim chamfer length along the axis',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.rimChamferAngle',
    message: 'rim chamfer angle from the head face',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.rimCornerRadius',
    message: 'radius of the rim corner at the head face',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.extractorGrooveDiameter',
    message: 'extractor groove diameter',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.extractorGrooveWidth',
    message: 'extractor groove width at E1',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.grooveFrontAngle',
    message: 'groove front cone angle from the axis (table III: belt cone)',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.beltDiameter', message: 'belt diameter (table III)' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.bodyAtE', message: 'body diameter at E' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.bodyAtL0',
    message: 'body diameter at L0 (double taper)',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.headToP0', message: 'head to P0' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.shoulderDiameter', message: 'shoulder diameter at L1' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.headToShoulder',
    message: 'head to the shoulder start (P2)',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.headToNeck', message: 'head to the neck start (H1)' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.neckAtL2', message: 'neck diameter at L2' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.shoulderAngle', message: 'included shoulder angle' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.headToShoulderApex',
    message: 'head to where the shoulder cone meets the axis',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.shoulderRadius',
    message: 'radius at the shoulder start',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.neckRadius', message: 'radius at the neck start' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.neckAtMouth', message: 'neck diameter at the mouth' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.caseLength', message: 'case length' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.cartridgeLength', message: 'cartridge length' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.bulletDiameter', message: 'bullet diameter' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.throatDiameter', message: 'throat diameter' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.throatConeLength',
    message: 'length of the cone from H2 down to G1, from L3',
  },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.throatConeAngle',
    message: 'included angle of the h cone',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.freebore', message: 'L3 to the leade start (freebore)' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.leadeAngle', message: 'leade angle' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.leadeEnd', message: 'L3 to the end of the leade' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.boreDiameter', message: 'bore diameter' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.l3PlusG', message: 'cartridge L3 plus the chamber G' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.boreGrooveDiameter',
    message: 'groove diameter of the bore',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.grooves', message: 'number of grooves' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.twist', message: 'twist, length per turn' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.boreArea', message: 'bore cross-section area' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.pmax', message: 'maximum mean pressure' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.proofPressure', message: 'proof pressure' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.measuringPosition', message: 'measuring position' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.energy',
    message: 'energy, as printed under Pressures (Energies)',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.bodyAtHead', message: 'body diameter at the head' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.bodyAtL2', message: 'body diameter at l2' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.mouthDiameter', message: 'diameter at the mouth (l)' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.diameterAtL1', message: 'diameter at L1' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.diameterAtL', message: 'diameter at L' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.chamberLength', message: 'chamber length' },
  /*i18n*/ {
    id: 'cartridgeRecord.meaning.forcingConeAngle',
    message: 'included angle of the forcing cone',
  },
  /*i18n*/ { id: 'cartridgeRecord.meaning.rimDiameter', message: 'rim diameter' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.rimThickness', message: 'rim thickness' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.rimRecessDiameter', message: 'rim recess diameter' },
  /*i18n*/ { id: 'cartridgeRecord.meaning.rimRecessDepth', message: 'rim recess depth' },
])

/** What a symbol stands for (its English text) in the language of `i18n`. */
export const meaningText = (meaning: string, i18n: I18n) => {
  const known = meaningMessages.get(meaning)
  return known ? i18n._(known) : meaning
}

/** The row groups of the Dimensions table by their English labels; a designer group without its message fails the typecheck. */
const groupMessages = new Map<string, MessageDescriptor>(
  Object.entries({
    'Head, rim and groove': /*i18n*/ {
      id: 'cartridgeRecord.group.head',
      message: 'Head, rim and groove',
    },
    Body: /*i18n*/ { id: 'cartridgeRecord.group.body', message: 'Body' },
    Shoulder: /*i18n*/ { id: 'cartridgeRecord.group.shoulder', message: 'Shoulder' },
    'Neck and length': /*i18n*/ { id: 'cartridgeRecord.group.neck', message: 'Neck and length' },
    'Throat and leade': /*i18n*/ {
      id: 'cartridgeRecord.group.throat',
      message: 'Throat and leade',
    },
    Other: /*i18n*/ { id: 'cartridgeRecord.group.other', message: 'Other' },
  } satisfies Record<(typeof groups)[Group] | 'Other', MessageDescriptor>),
)

/** The label of a row group (`rowGroups`) in the language of `i18n`. */
export const groupLabel = (label: string, i18n: I18n = english) => {
  const known = groupMessages.get(label)
  return known ? i18n._(known) : label
}

const sideNotesLine = {
  cartridge: /*i18n*/ { id: 'cartridgeRecord.sideNotes.cartridge', message: 'Cartridge: {notes}' },
  chamber: /*i18n*/ { id: 'cartridgeRecord.sideNotes.chamber', message: 'Chamber: {notes}' },
}
const sideMeaning = {
  cartridge: /*i18n*/ {
    id: 'cartridgeRecord.sideMeaning.cartridge',
    message: 'cartridge {meaning}',
  },
  chamber: /*i18n*/ { id: 'cartridgeRecord.sideMeaning.chamber', message: 'chamber {meaning}' },
}
const sideSymbol = {
  cartridge: /*i18n*/ { id: 'cartridgeRecord.sideSymbol.cartridge', message: 'Cartridge {symbol}' },
  chamber: /*i18n*/ { id: 'cartridgeRecord.sideSymbol.chamber', message: 'Chamber {symbol}' },
}

/** "G1: bullet diameter". */
const symbolMeaning = (i18n: I18n, symbol: string, meaning: string) =>
  i18n._({
    id: 'cartridgeRecord.symbolMeaning',
    message: '{symbol}: {meaning}',
    values: { symbol, meaning },
  })

/** An angle in degrees to 2 decimals at most (35°, 1.97°); the text as printed (1°57'57") is its note. */
const angleText = (x: number) => `${localizeNumber(String(Number(x.toFixed(2))))}°`

/** A value's own notes: basic, the text as printed where it says more. */
type ValueNote = { kind: 'basic' } | { kind: 'printed'; raw: string }

function valueNotes(v: SpecValue): ValueNote[] {
  const stored = v.quantity === 'angle' && v.value !== undefined ? angleText(v.value) : ''
  return [
    ...(v.basic ? [{ kind: 'basic' } as const] : []),
    ...(v.raw && v.value !== undefined && v.raw !== stored && v.raw !== String(v.value)
      ? [{ kind: 'printed', raw: v.raw } as const]
      : []),
  ]
}

/** A note after the side's name: "basic", "printed 7.62". */
const noteWord = (n: ValueNote, i18n: I18n) =>
  n.kind === 'basic'
    ? i18n._({ id: 'cartridgeRecord.note.basic', message: 'basic' })
    : i18n._({
        id: 'cartridgeRecord.note.printed',
        message: 'printed {raw}',
        values: { raw: n.raw },
      })

/** A note as a line of its own: "Basic", "Printed as 7.62". */
const noteLine = (n: ValueNote, i18n: I18n) =>
  n.kind === 'basic'
    ? i18n._({ id: 'cartridgeRecord.noteLine.basic', message: 'Basic' })
    : i18n._({
        id: 'cartridgeRecord.noteLine.printed',
        message: 'Printed as {raw}',
        values: { raw: n.raw },
      })

/** What a symbol stands for on the sides that give it; per side where they differ. */
function meaningOf(
  symbol: string,
  sides: ('cartridge' | 'chamber' | undefined)[],
  table: string | undefined,
  i18n: I18n,
): string | undefined {
  const own = table === 'VII' ? shotshellMeanings : meanings
  const meant = sides.flatMap((s) => {
    const m = own.get(`${s ?? ''} ${symbol}`)
    return m ? [{ s, m }] : []
  })
  const distinct = [...new Set(meant.map((x) => x.m))]
  // G1: the cartridge's bullet diameter, the chamber's throat diameter
  if (distinct.length > 1)
    return meant
      .map(({ s, m }) =>
        s
          ? i18n._({ ...sideMeaning[s], values: { meaning: meaningText(m, i18n) } })
          : meaningText(m, i18n),
      )
      .join('; ')
  const only = distinct[0]
  return only === undefined ? undefined : meaningText(only, i18n)
}

/** The first hover line of a symbol: its spelled name where the table prints a Greek letter, then its meaning. */
function nameLine(
  symbol: string,
  sides: ('cartridge' | 'chamber' | undefined)[],
  table: string | undefined,
  i18n: I18n,
) {
  const meaning = meaningOf(symbol, sides, table, i18n)
  if (!meaning && symbolText(symbol) === symbol) return []
  return [meaning ? symbolMeaning(i18n, symbol, meaning) : symbol]
}

/** The row groups of the Dimensions table: the designer's field groups, then Other. */
type RowGroup = Group | 'other'
export const rowGroups = [...(Object.entries(groups) as [Group, string][]), ['other', 'Other']] as [
  RowGroup,
  string,
][]

/** Symbols outside the designer's fields, and the table VII ones, by group. */
const extraGroups: Record<string, RowGroup> = {
  'L3+G': 'neck',
  Z: 'throat',
  N: 'throat',
  u: 'throat',
  Q: 'throat',
  b: 'throat',
}
const shotshellGroups: Record<string, RowGroup> = {
  g: 'head',
  t: 'head',
  G: 'head',
  T: 'head',
  d: 'body',
  d2: 'body',
  D: 'body',
  D1: 'body',
  h: 'neck',
  H: 'neck',
  l: 'neck',
  L: 'neck',
  B: 'throat',
  alpha1: 'throat',
}

/** A symbol's group: the cartridge side's designer group where it has one (G1 is Neck), else the chamber's. */
function groupOf(symbol: string, sides: ('cartridge' | 'chamber')[], table?: string): RowGroup {
  if (table === 'VII') return shotshellGroups[symbol] ?? 'other'
  for (const side of sides) {
    const spec = fieldSpecs.find((f) => f.side === side && f.symbol === symbol)
    if (spec) return spec.group
  }
  return extraGroups[symbol] ?? 'other'
}

/** Mouth to head, as the drawing runs, so the lengths a reloader looks up first come first; the stable sort keeps record order within a group. */
const readingOrder: RowGroup[] = ['neck', 'shoulder', 'body', 'head', 'throat', 'other']
export const inReadingOrder = <T extends { group: RowGroup }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => readingOrder.indexOf(a.group) - readingOrder.indexOf(b.group))

/** The symbol of each quantity's stored unit (`packages/units/src/units.ts`). */
const stored = { length: 'mm', pressure: 'bar', energy: 'J', area: 'mm²' } as const
type Converted = keyof typeof stored
export const converted = (q: string): q is Converted => Object.hasOwn(stored, q)

/** A stored number in the preset's unit: as recorded in the record's own unit, else rounded to the unit's decimals; an angle to 2 decimals. */
export function specValueText(q: string, x: number, system: UnitSystem) {
  if (q === 'angle') return angleText(x)
  if (!converted(q)) return plainNumber(x)
  const symbol = stored[q]
  const unit = system[q]
  return inchText(
    unit.symbol === symbol ? plainNumber(x) : formatNumber(unit.fromSi(toSi(q, x)), unit.decimals),
    unit.symbol,
  )
}

/** A value's tolerance and limit as the fixed slot after it shows them: signed, minus as U+2212, no gap. */
export function toleranceText(v: SpecValue, system: UnitSystem) {
  const t = v.tolerance
  const part = (x: number) =>
    `${x < 0 ? '−' : '+'}${specValueText(v.quantity, Math.abs(x), system)}`
  return [t?.lower !== undefined && part(t.lower), t?.upper !== undefined && part(t.upper), v.limit]
    .filter(Boolean)
    .join(' ')
}

/** Minus as U+2212; a difference rounding to zero keeps its sign ("−0.00" stays a conflict), an exact zero is "±0". */
export function signedLength(x: number, system: UnitSystem) {
  const text = specValueText('length', Math.abs(x), system)
  if (text !== '0') return x < 0 ? `−${text}` : `+${text}`
  const zero = formatNumber(0, system.length.decimals)
  const shown = system.length.symbol === 'in' ? zero.slice(1) : zero
  // a difference of two printed values: an exact zero up to floating point noise
  return `${Math.abs(x) < 1e-9 ? '±' : x < 0 ? '−' : '+'}${shown}`
}

/** What the clearance note after a chamber value stands for. */
export const clearanceMeaning = /*i18n*/ {
  id: 'cartridgeRecord.clearanceMeaning',
  message: 'chamber minimum minus cartridge maximum',
}

/** The wording of a negative clearance: the drawing package's text, in the language of `i18n` where it is the one known. */
const conflictMessage = /*i18n*/ {
  id: 'cartridgeRecord.conflict',
  message: 'data conflict between published cartridge maximum and chamber minimum (check source)',
}
const differenceMessage = /*i18n*/ {
  id: 'cartridgeRecord.difference',
  message: 'nominal minimum difference of published dimensions',
}
/** The caption wording of a region difference, translated the same way. */
export const differenceText = (i18n: I18n) =>
  differenceWording === differenceMessage.message ? i18n._(differenceMessage) : differenceWording
export const conflictText = (i18n: I18n) =>
  conflictWording === conflictMessage.message ? i18n._(conflictMessage) : conflictWording

/** A clearance line: "Clearance: {meaning}". */
export const clearanceLine = (meaning: string, i18n: I18n = english) =>
  i18n._({
    id: 'cartridgeRecord.clearanceLine',
    message: 'Clearance: {meaning}',
    values: { meaning },
  })

/** The symbols whose chamber minimum minus cartridge maximum is a fit: diameters and the case length. */
const fitSymbols = ['R1', 'R3', 'P1', 'P2', 'H1', 'H2', 'G1', 'L3']

/** The stored value when it is its side's limit: a cartridge maximum, a chamber minimum. */
function limitOf(values: SpecValue[], side: 'cartridge' | 'chamber', symbol: string) {
  const v = values.find(
    (x) => x.side === side && x.symbol === symbol && !x.variant && x.value !== undefined,
  )
  if (v?.value === undefined) return
  const beyond = side === 'cartridge' ? v.tolerance?.upper : v.tolerance?.lower
  return v.limit === (side === 'cartridge' ? 'min' : 'max') || beyond ? undefined : v.value
}

/** Chamber minimum minus cartridge maximum, mm, of each fit symbol both sides give as their limit. */
function fits(values: SpecValue[]) {
  return new Map(
    fitSymbols.flatMap((symbol): [string, number][] => {
      const [c, ch] = [limitOf(values, 'cartridge', symbol), limitOf(values, 'chamber', symbol)]
      return c === undefined || ch === undefined ? [] : [[symbol, Number((ch - c).toFixed(3))]]
    }),
  )
}

export interface CombinedRow {
  key: string
  /** As printed, with Greek letters and the variant. */
  symbol: string
  /** The stored symbol (`alpha`, `L3+G`): the drawing names its dimensions by it (`data-symbol`). */
  storedSymbol: string
  /** What the symbol stands for, the table's Description column. */
  description?: string | undefined
  group: RowGroup
  /** Hover lines: the spelled name of a Greek letter, then each side's notes. */
  notes: string[]
  cartridge?: SpecValue | undefined
  chamber?: SpecValue
  /** Chamber minimum minus cartridge maximum, mm, where it is a fit (`fits`). */
  clearance?: number | undefined
  /** The cartridge value is derived, not dimensioned. */
  derived?: boolean | undefined
}

/** What the record rows read of a cartridge. */
type Sheet = Pick<CartridgeDetail, 'table' | 'values'>

type Draft = Omit<CombinedRow, 'storedSymbol' | 'group'> & { sideNotes: string[] }

/** Record order; the first value of each side, its own notes as side notes. */
function rowsBySymbol(spec: Sheet, i18n: I18n): Map<string, Draft> {
  const matrix = new Set(variantColumns(spec))
  const sided = spec.values.filter(
    (v): v is SpecValue & { side: 'cartridge' | 'chamber' } =>
      v.side !== undefined && !(v.variant && matrix.has(v.variant)),
  )
  const rows = new Map<string, Draft>()
  for (const v of sided) {
    const key = v.variant ? `${v.symbol} ${v.variant}` : v.symbol
    const row = rows.get(key) ?? {
      key,
      symbol: v.variant ? `${symbolText(v.symbol)} (${v.variant})` : symbolText(v.symbol),
      notes: [],
      sideNotes: [],
    }
    if (row[v.side]) continue
    row[v.side] = v
    const own = valueNotes(v)
    if (own.length)
      row.sideNotes.push(
        i18n._({
          ...sideNotesLine[v.side],
          values: { notes: own.map((n) => noteWord(n, i18n)).join('; ') },
        }),
      )
    rows.set(key, row)
  }
  return rows
}

/** A cartridge e derived from delta where the record gives none: in this table and the drawing's description only. */
function addDerivedE(rows: Map<string, Draft>, list: Figure[], i18n: I18n) {
  const derivedE = list[0]?.drawn.find((d) => d.side === 'cartridge')?.p.derivedE
  if (derivedE === undefined || rows.get('e')?.cartridge) return
  const row = rows.get('e') ?? { key: 'e', symbol: 'e', notes: [], sideNotes: [] }
  row.cartridge = { side: 'cartridge', symbol: 'e', quantity: 'length', value: derivedE }
  row.sideNotes.unshift(
    i18n._({
      id: 'cartridgeRecord.derivedCartridge',
      message: 'Cartridge: derived, not dimensioned',
    }),
  )
  row.derived = true
  rows.set('e', row)
}

/** The finished row: its stored symbol, description and group, the hover notes and the clearance of a fit (`fits`). */
function withClearanceAndGroup(
  { sideNotes, ...row }: Draft,
  clearance: Map<string, number>,
  table: string | undefined,
  i18n: I18n,
): CombinedRow {
  const sides = [row.cartridge?.side, row.chamber?.side].filter(
    (s): s is 'cartridge' | 'chamber' => s !== undefined,
  )
  const variant = row.cartridge?.variant ?? row.chamber?.variant
  const gap = variant ? undefined : clearance.get(row.key)
  const storedSymbol = row.cartridge?.symbol ?? row.chamber?.symbol ?? row.key
  const description = meaningOf(storedSymbol, sides, table, i18n)
  return {
    ...row,
    storedSymbol,
    ...(description && { description }),
    group: groupOf(storedSymbol, sides, table),
    notes: [
      ...(symbolText(storedSymbol) === storedSymbol ? [] : [storedSymbol]),
      ...sideNotes,
      ...(gap !== undefined && gap < 0 ? [clearanceLine(conflictText(i18n), i18n)] : []),
    ],
    ...(gap !== undefined && { clearance: gap }),
  }
}

/** The clearance is our own fit, not published by CIP; symbols differing only in case (r1, R1) stay apart. */
export function combinedRows(spec: Sheet, list: Figure[], i18n: I18n = english): CombinedRow[] {
  const rows = rowsBySymbol(spec, i18n)
  addDerivedE(rows, list, i18n)
  const clearance = fits(spec.values)
  const out = [...rows.values()].map((row) =>
    withClearanceAndGroup(row, clearance, spec.table, i18n),
  )
  // grouped as the designer, record order within a group
  const rank = (r: CombinedRow) => rowGroups.findIndex(([g]) => g === r.group)
  return out.sort((a, b) => rank(a) - rank(b))
}

/** A Greek letter without a meaning shows its spelled name. */
export function sideHint(
  r: CombinedRow,
  side: 'cartridge' | 'chamber',
  table?: string,
  i18n: I18n = english,
): string[] {
  const v = r[side]
  if (!v) return []
  const meaning = meaningOf(r.storedSymbol, [side], table, i18n)
  const derived = side === 'cartridge' && r.derived === true
  const conflict = side === 'chamber' && r.clearance !== undefined && r.clearance < 0
  return [
    meaning
      ? symbolMeaning(i18n, r.storedSymbol, meaning)
      : symbolText(r.storedSymbol) !== r.storedSymbol
        ? r.storedSymbol
        : '',
    ...valueNotes(v).map((n) => noteLine(n, i18n)),
    ...(derived
      ? [i18n._({ id: 'cartridgeRecord.derived', message: 'Derived, not dimensioned' })]
      : []),
    // the note after the value is hover only; the symbol is the keyboard stop of the row
    ...(side === 'chamber' && r.clearance !== undefined
      ? [clearanceLine(i18n._(clearanceMeaning), i18n)]
      : []),
    ...(conflict ? [clearanceLine(conflictText(i18n), i18n)] : []),
  ].filter(Boolean)
}

/** The case length variants of a table VII record (12/70, 12/76), the columns of its matrix; else none. */
function variantColumns(spec: Sheet): string[] {
  if (spec.table !== 'VII') return []
  return shotshellVariants(spec.values).filter((v): v is string => v !== undefined)
}

/** A convenience default with no source: 76 mm for the 410 bore, 70 mm for other gauges, else the nearest length. */
export function defaultVariantIndex(variants: string[]): number {
  const length = (label: string) =>
    Number.parseFloat(label.split('/').at(-1)?.replace(',', '.') ?? '')
  const target = variants[0]?.split('/')[0] === '410' ? 76 : 70
  const away = variants.map((label) => Math.abs(length(label) - target))
  return Math.max(0, away.indexOf(Math.min(...away.filter((d) => !Number.isNaN(d)))))
}

export interface MatrixRow {
  key: string
  label: string
  notes: string[]
  quantity: string
  /** One per variant column; absent where the record gives none. */
  cells: (SpecValue | undefined)[]
}

/** Rows Pmax, PK, PE, M, then the variant lengths and other values; columns the variants. */
export function variantMatrix(
  spec: Sheet,
  i18n: I18n = english,
): { variants: string[]; rows: MatrixRow[] } {
  const variants = variantColumns(spec)
  const keyOf = (v: SpecValue) => `${v.side ?? ''} ${v.symbol}`
  const keys: string[] = []
  for (const v of spec.values)
    if (v.variant && variants.includes(v.variant) && !keys.includes(keyOf(v))) keys.push(keyOf(v))
  const rank = (key: string) => {
    const i = [' Pmax', ' PK', ' PE', ' M'].indexOf(key)
    return i < 0 ? 4 : i
  }
  keys.sort((a, b) => rank(a) - rank(b))
  return {
    variants,
    rows: keys.map((key) => {
      const [side, symbol] = key.split(' ') as ['' | 'cartridge' | 'chamber', string]
      const cells = variants.map((variant) =>
        spec.values.find((v) => keyOf(v) === key && v.variant === variant),
      )
      return {
        key,
        label: side
          ? i18n._({ ...sideSymbol[side], values: { symbol: symbolText(symbol) } })
          : symbolText(symbol),
        notes: nameLine(symbol, [side || undefined], spec.table, i18n),
        quantity: cells.find((c) => c)?.quantity ?? '',
        cells,
      }
    }),
  }
}

/** The values of the pressure strip: pressures, energies and positions without a side or variant. */
export const pressureStripValues = (spec: Sheet) => spec.values.filter((v) => !v.side && !v.variant)

/** The cartridge dimensions of the fact row, in this order: case length, maximum overall length, bullet diameter. */
const stripDimensions = ['L3', 'L6', 'G1']

/** The fact row's cartridge dimensions (L3, L6, G1) the record gives as a number, outside a shotshell variant. */
export const dimensionStripValues = (spec: Sheet) =>
  stripDimensions.flatMap((symbol) =>
    spec.values.filter(
      (v) => v.side === 'cartridge' && v.symbol === symbol && !v.variant && v.value !== undefined,
    ),
  )

/** Hover lines of a fact row value: symbol and meaning (on its side), or none when the symbol has neither. */
export const pressureStripNote = (v: SpecValue, table?: string, i18n: I18n = english) =>
  nameLine(v.symbol, [v.side], table, i18n)
