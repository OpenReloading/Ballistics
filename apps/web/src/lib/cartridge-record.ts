import { greek } from '@open-reloading/drawing'
import { conflictWording, type Figure, shotshellVariants } from '@open-reloading/drawing/cartridge'
import type { CartridgeDetail, SpecValue } from './api-types.ts'
import { fieldSpecs, type Group, groups } from './cartridge-designer.ts'
import { degreeText, formatNumber, inchText, type UnitSystem } from './units.ts'

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

const sideWord = { cartridge: 'Cartridge', chamber: 'Chamber' } as const

/** A value's own notes: basic, the text as printed where it says more. */
function valueNotes(v: SpecValue) {
  const stored = v.quantity === 'angle' && v.value !== undefined ? `${degreeText(v.value)}°` : ''
  return [
    v.basic ? 'basic' : '',
    v.raw && v.value !== undefined && v.raw !== stored && v.raw !== String(v.value)
      ? `printed ${v.raw}`
      : '',
  ].filter(Boolean)
}

/** What a symbol stands for on the sides that give it; per side where they differ. */
function meaningOf(
  symbol: string,
  sides: ('cartridge' | 'chamber' | undefined)[],
  table?: string,
): string | undefined {
  const own = table === 'VII' ? shotshellMeanings : meanings
  const meant = sides.flatMap((s) => {
    const m = own.get(`${s ?? ''} ${symbol}`)
    return m ? [{ s, m }] : []
  })
  const distinct = [...new Set(meant.map((x) => x.m))]
  // G1: the cartridge's bullet diameter, the chamber's throat diameter
  return distinct.length > 1 ? meant.map(({ s, m }) => `${s} ${m}`).join('; ') : distinct[0]
}

/** The first hover line of a symbol: its spelled name where the table prints a Greek letter, then its meaning. */
function nameLine(symbol: string, sides: ('cartridge' | 'chamber' | undefined)[], table?: string) {
  const meaning = meaningOf(symbol, sides, table)
  if (!meaning && symbolText(symbol) === symbol) return []
  return [meaning ? `${symbol}: ${meaning}` : symbol]
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

/**
 * The record's own row order: the groups as the drawing runs from top to bottom (mouth to head,
 * the lengths a reloader looks up first at the top), not the designer's order, which starts at the
 * head. The sort is stable, so the record order holds within a group.
 */
const readingOrder: RowGroup[] = ['neck', 'shoulder', 'body', 'head', 'throat', 'other']
export const inReadingOrder = <T extends { group: RowGroup }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => readingOrder.indexOf(a.group) - readingOrder.indexOf(b.group))

/** The records' units (`packages/schema/src/units.ts`) as factors to SI and symbols. */
const stored = {
  length: [1e-3, 'mm'],
  pressure: [1e5, 'bar'],
  energy: [1, 'J'],
  area: [1e-6, 'mm²'],
} as const
type Converted = keyof typeof stored
export const converted = (q: string): q is Converted => Object.hasOwn(stored, q)

/** A stored number in the preset's unit: as recorded in the record's own unit, else rounded to the unit's decimals. */
export function specValueText(q: string, x: number, system: UnitSystem) {
  if (q === 'angle') return `${degreeText(x)}°`
  if (!converted(q)) return String(x)
  const [factor, symbol] = stored[q]
  const unit = system[q]
  return inchText(
    unit.symbol === symbol ? String(x) : formatNumber(unit.fromSi(x * factor), unit.decimals),
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

/** What the clearance note after a chamber value stands for. */
export const clearanceMeaning = 'chamber minimum minus cartridge maximum'

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
  description?: string
  group: RowGroup
  /** Hover lines: the spelled name of a Greek letter, then each side's notes. */
  notes: string[]
  cartridge?: SpecValue
  chamber?: SpecValue
  /** Chamber minimum minus cartridge maximum, mm, where it is a fit (`fits`). */
  clearance?: number
}

/** What the record rows read of a cartridge. */
type Sheet = Pick<CartridgeDetail, 'table' | 'values'>

type Draft = Omit<CombinedRow, 'storedSymbol' | 'group'> & { sideNotes: string[] }

/**
 * A draft row per symbol and variant, in record order: the sided values outside the shotshell
 * variant matrix, the first value of each side, its own notes as side notes.
 */
function rowsBySymbol(spec: Sheet): Map<string, Draft> {
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
    if (own.length) row.sideNotes.push(`${sideWord[v.side]}: ${own.join('; ')}`)
    rows.set(key, row)
  }
  return rows
}

/** A cartridge e derived from delta where the record gives none: in this table and the drawing's description only. */
function addDerivedE(rows: Map<string, Draft>, list: Figure[]) {
  const derivedE = list[0]?.drawn.find((d) => d.side === 'cartridge')?.p.derivedE
  if (derivedE === undefined || rows.get('e')?.cartridge) return
  const row = rows.get('e') ?? { key: 'e', symbol: 'e', notes: [], sideNotes: [] }
  row.cartridge = { side: 'cartridge', symbol: 'e', quantity: 'length', value: derivedE }
  row.sideNotes.unshift('Cartridge: derived, not dimensioned')
  rows.set('e', row)
}

/** The finished row: its stored symbol, description and group, the hover notes and the clearance of a fit (`fits`). */
function withClearanceAndGroup(
  { sideNotes, ...row }: Draft,
  clearance: Map<string, number>,
  table?: string,
): CombinedRow {
  const sides = [row.cartridge?.side, row.chamber?.side].filter(
    (s): s is 'cartridge' | 'chamber' => s !== undefined,
  )
  const variant = row.cartridge?.variant ?? row.chamber?.variant
  const gap = variant ? undefined : clearance.get(row.key)
  const storedSymbol = row.cartridge?.symbol ?? row.chamber?.symbol ?? row.key
  const description = meaningOf(storedSymbol, sides, table)
  return {
    ...row,
    storedSymbol,
    ...(description && { description }),
    group: groupOf(storedSymbol, sides, table),
    notes: [
      ...(symbolText(storedSymbol) === storedSymbol ? [] : [storedSymbol]),
      ...sideNotes,
      ...(gap !== undefined && gap < 0 ? [`Clearance: ${conflictWording}`] : []),
    ],
    ...(gap !== undefined && { clearance: gap }),
  }
}

/**
 * The cartridge and chamber dimensions of a record as one table: a row per symbol and
 * variant, the cartridge maximum and the chamber minimum side by side, in record order (the chamber
 * symbols the cartridge lacks after). The clearance is our own fit, not published by CIP (`fits`:
 * the diameters and the case length, each value the
 * side's own limit); symbols that differ only in case (r1 and R1, e and E) stay apart. Values of a
 * shotshell variant go to the variant matrix instead; a derived cartridge e joins as a note.
 */
export function combinedRows(spec: Sheet, list: Figure[]): CombinedRow[] {
  const rows = rowsBySymbol(spec)
  addDerivedE(rows, list)
  const clearance = fits(spec.values)
  const out = [...rows.values()].map((row) => withClearanceAndGroup(row, clearance, spec.table))
  // grouped as the designer, record order within a group
  const rank = (r: CombinedRow) => rowGroups.findIndex(([g]) => g === r.group)
  return out.sort((a, b) => rank(a) - rank(b))
}

const noteText = (n: string) =>
  n === 'basic' ? 'Basic' : n.startsWith('printed ') ? `Printed as ${n.slice(8)}` : n

/**
 * The hover lines of a symbol in the table of one side: the symbol and what it stands for there,
 * the spelled name of a Greek letter without a meaning, then that side's notes (basic, the text as
 * printed, derived), the meaning of a clearance note and a clearance that is a data conflict.
 */
export function sideHint(r: CombinedRow, side: 'cartridge' | 'chamber', table?: string): string[] {
  const v = r[side]
  if (!v) return []
  const meaning = meaningOf(r.storedSymbol, [side], table)
  const derived = side === 'cartridge' && r.notes.includes('Cartridge: derived, not dimensioned')
  const conflict = side === 'chamber' && r.clearance !== undefined && r.clearance < 0
  return [
    meaning
      ? `${r.storedSymbol}: ${meaning}`
      : symbolText(r.storedSymbol) !== r.storedSymbol
        ? r.storedSymbol
        : '',
    ...valueNotes(v).map(noteText),
    ...(derived ? ['Derived, not dimensioned'] : []),
    // the note after the value is hover only; the symbol is the keyboard stop of the row
    ...(side === 'chamber' && r.clearance !== undefined ? [`Clearance: ${clearanceMeaning}`] : []),
    ...(conflict ? [`Clearance: ${conflictWording}`] : []),
  ].filter(Boolean)
}

/** The case length variants of a table VII record (12/70, 12/76), the columns of its matrix; else none. */
function variantColumns(spec: Sheet): string[] {
  if (spec.table !== 'VII') return []
  return shotshellVariants(spec.values).filter((v): v is string => v !== undefined)
}

/**
 * The variant the shotshell select starts on: a convenience default for the most common case
 * length, no source and no data. The case length is the number after the slash of the label
 * (12/70, 24/63,5): 76 mm for the 410 bore, 70 mm for every other gauge, else the nearest one
 * (10 gauge: 12/76), the first variant where no label gives a length.
 */
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

/**
 * The shotshell matrix: rows Pmax, PK, PE, M, then the variant lengths (cartridge l,
 * chamber L) and any other value of a variant; columns the variants.
 */
export function variantMatrix(spec: Sheet): { variants: string[]; rows: MatrixRow[] } {
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
        label: side ? `${sideWord[side]} ${symbolText(symbol)}` : symbolText(symbol),
        notes: nameLine(symbol, [side || undefined], spec.table),
        quantity: cells.find((c) => c)?.quantity ?? '',
        cells,
      }
    }),
  }
}

/** The values of the pressure strip: pressures, energies and positions without a side or variant. */
export const pressureStripValues = (spec: Sheet) => spec.values.filter((v) => !v.side && !v.variant)

/** Hover lines of a pressure strip value: symbol and meaning, or none when the symbol has neither. */
export const pressureStripNote = (v: SpecValue, table?: string) =>
  nameLine(v.symbol, [undefined], table)
