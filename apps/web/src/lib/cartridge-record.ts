import { greek } from '@open-reloading/drawing'
import { conflictWording, type Figure, shotshellVariants } from '@open-reloading/drawing/cartridge'
import { type SpecValue, toSi } from '@open-reloading/schema'
import { formatNumber, localizeNumber, plainNumber } from '../i18n/number.ts'
import { type Message, msg, type Translator, translator } from '../i18n/translate.ts'
import type { CartridgeDetail } from './api-types.ts'
import { fieldSpecs, type Group, groups } from './cartridge-designer.ts'
import { degreeText, inchText, type UnitSystem } from './units.ts'

type Translate = Translator['t']

/** Without a catalogue every text is English: what these functions give when no translation is passed. */
const english = translator().t

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

/**
 * What the symbols stand for, by their English text, as messages. "measuring position" is left out:
 * the catalogue test requires the word for a shooting position in every text that says position.
 */
const meaningMessages: Readonly<Record<string, Message>> = {
  'extractor groove diameter': msg('extractor groove diameter'),
  'extractor groove width at E1': msg('extractor groove width at E1'),
  'groove front cone angle from the axis (table III: belt cone)': msg(
    'groove front cone angle from the axis (table III: belt cone)',
  ),
  'belt diameter (table III)': msg('belt diameter (table III)'),
  'body diameter at E': msg('body diameter at E'),
  'body diameter at L0 (double taper)': msg('body diameter at L0 (double taper)'),
  'head to P0': msg('head to P0'),
  'shoulder diameter at L1': msg('shoulder diameter at L1'),
  'head to the shoulder start (P2)': msg('head to the shoulder start (P2)'),
  'head to the neck start (H1)': msg('head to the neck start (H1)'),
  'neck diameter at L2': msg('neck diameter at L2'),
  'included shoulder angle': msg('included shoulder angle'),
  'head to where the shoulder cone meets the axis': msg(
    'head to where the shoulder cone meets the axis',
  ),
  'radius at the shoulder start': msg('radius at the shoulder start'),
  'radius at the neck start': msg('radius at the neck start'),
  'neck diameter at the mouth': msg('neck diameter at the mouth'),
  'case length': msg('case length'),
  'cartridge length': msg('cartridge length'),
  'bullet diameter': msg('bullet diameter'),
  'throat diameter': msg('throat diameter'),
  'length of the cone from H2 down to G1, from L3': msg(
    'length of the cone from H2 down to G1, from L3',
  ),
  'included angle of the h cone': msg('included angle of the h cone'),
  'L3 to the leade start (freebore)': msg('L3 to the leade start (freebore)'),
  'leade angle': msg('leade angle'),
  'L3 to the end of the leade': msg('L3 to the end of the leade'),
  'bore diameter': msg('bore diameter'),
  'cartridge L3 plus the chamber G': msg('cartridge L3 plus the chamber G'),
  'groove diameter of the bore': msg('groove diameter of the bore'),
  'number of grooves': msg('number of grooves'),
  'twist, length per turn': msg('twist, length per turn'),
  'bore cross-section area': msg('bore cross-section area'),
  'maximum mean pressure': msg('maximum mean pressure'),
  'proof pressure': msg('proof pressure'),
  'body diameter at the head': msg('body diameter at the head'),
  'body diameter at l2': msg('body diameter at l2'),
  'diameter at the mouth (l)': msg('diameter at the mouth (l)'),
  'diameter at L1': msg('diameter at L1'),
  'diameter at L': msg('diameter at L'),
  'chamber length': msg('chamber length'),
  'included angle of the forcing cone': msg('included angle of the forcing cone'),
  'rim diameter': msg('rim diameter'),
  'rim thickness': msg('rim thickness'),
  'rim recess diameter': msg('rim recess diameter'),
  'rim recess depth': msg('rim recess depth'),
}

const meaningText = (meaning: string, t: Translate) => {
  const known = meaningMessages[meaning]
  return known ? t(known) : meaning
}

/** The English labels of the row groups of the Dimensions table that have a German text (see `meaningMessages`). */
const groupMessages: Readonly<Record<string, Message>> = {
  Body: msg('Body'),
  Shoulder: msg('Shoulder'),
  'Neck and length': msg('Neck and length'),
  'Throat and leade': msg('Throat and leade'),
  Other: msg('Other'),
}

/** The label of a row group (`rowGroups`) in the language of `t`. */
export const groupLabel = (label: string, t: Translate = english) => {
  const known = groupMessages[label]
  return known ? t(known) : label
}

const sideNotesLine = {
  cartridge: msg('Cartridge: {notes}'),
  chamber: msg('Chamber: {notes}'),
} as const
const sideMeaning = {
  cartridge: msg('cartridge {meaning}'),
  chamber: msg('chamber {meaning}'),
} as const
const sideSymbol = {
  cartridge: msg('Cartridge {symbol}'),
  chamber: msg('Chamber {symbol}'),
} as const

/** A value's own notes in `t`: basic, the text as printed where it says more. */
type ValueNote = { kind: 'basic' } | { kind: 'printed'; raw: string }

function valueNotes(v: SpecValue): ValueNote[] {
  const stored =
    v.quantity === 'angle' && v.value !== undefined ? `${localizeNumber(degreeText(v.value))}°` : ''
  return [
    ...(v.basic ? [{ kind: 'basic' } as const] : []),
    ...(v.raw && v.value !== undefined && v.raw !== stored && v.raw !== String(v.value)
      ? [{ kind: 'printed', raw: v.raw } as const]
      : []),
  ]
}

/** A note after the side's name: "basic", "printed 7.62". */
const noteWord = (n: ValueNote, t: Translate) =>
  n.kind === 'basic' ? t('basic') : t('printed {raw}', { raw: n.raw })

/** A note as a line of its own: "Basic", "Printed as 7.62". */
const noteLine = (n: ValueNote, t: Translate) =>
  n.kind === 'basic' ? t('Basic') : t('Printed as {raw}', { raw: n.raw })

/** What a symbol stands for on the sides that give it; per side where they differ. */
function meaningOf(
  symbol: string,
  sides: ('cartridge' | 'chamber' | undefined)[],
  table: string | undefined,
  t: Translate,
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
        s ? t(sideMeaning[s], { meaning: meaningText(m, t) }) : meaningText(m, t),
      )
      .join('; ')
  const only = distinct[0]
  return only === undefined ? undefined : meaningText(only, t)
}

/** The first hover line of a symbol: its spelled name where the table prints a Greek letter, then its meaning. */
function nameLine(
  symbol: string,
  sides: ('cartridge' | 'chamber' | undefined)[],
  table: string | undefined,
  t: Translate,
) {
  const meaning = meaningOf(symbol, sides, table, t)
  if (!meaning && symbolText(symbol) === symbol) return []
  return [meaning ? t('{symbol}: {meaning}', { symbol, meaning }) : symbol]
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

/** The symbol of each quantity's stored unit (`packages/schema/src/units.ts`). */
const stored = { length: 'mm', pressure: 'bar', energy: 'J', area: 'mm²' } as const
type Converted = keyof typeof stored
export const converted = (q: string): q is Converted => Object.hasOwn(stored, q)

/** A stored number in the preset's unit: as recorded in the record's own unit, else rounded to the unit's decimals. */
export function specValueText(q: string, x: number, system: UnitSystem) {
  if (q === 'angle') return `${localizeNumber(degreeText(x))}°`
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

/** What the clearance note after a chamber value stands for. */
export const clearanceMeaning = msg('chamber minimum minus cartridge maximum')

/** The wording of a negative clearance: the drawing package's text, in the language of `t` where it is the one known. */
const conflictMessage = msg(
  'data conflict between published cartridge maximum and chamber minimum (check source)',
)
const conflictText = (t: Translate) =>
  conflictWording === conflictMessage ? t(conflictMessage) : conflictWording

/** A clearance line: "Clearance: {meaning}". */
export const clearanceLine = (meaning: string, t: Translate = english) =>
  t('Clearance: {meaning}', { meaning })

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

/**
 * A draft row per symbol and variant, in record order: the sided values outside the shotshell
 * variant matrix, the first value of each side, its own notes as side notes.
 */
function rowsBySymbol(spec: Sheet, t: Translate): Map<string, Draft> {
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
        t(sideNotesLine[v.side], { notes: own.map((n) => noteWord(n, t)).join('; ') }),
      )
    rows.set(key, row)
  }
  return rows
}

/** A cartridge e derived from delta where the record gives none: in this table and the drawing's description only. */
function addDerivedE(rows: Map<string, Draft>, list: Figure[], t: Translate) {
  const derivedE = list[0]?.drawn.find((d) => d.side === 'cartridge')?.p.derivedE
  if (derivedE === undefined || rows.get('e')?.cartridge) return
  const row = rows.get('e') ?? { key: 'e', symbol: 'e', notes: [], sideNotes: [] }
  row.cartridge = { side: 'cartridge', symbol: 'e', quantity: 'length', value: derivedE }
  row.sideNotes.unshift(t('Cartridge: derived, not dimensioned'))
  row.derived = true
  rows.set('e', row)
}

/** The finished row: its stored symbol, description and group, the hover notes and the clearance of a fit (`fits`). */
function withClearanceAndGroup(
  { sideNotes, ...row }: Draft,
  clearance: Map<string, number>,
  table: string | undefined,
  t: Translate,
): CombinedRow {
  const sides = [row.cartridge?.side, row.chamber?.side].filter(
    (s): s is 'cartridge' | 'chamber' => s !== undefined,
  )
  const variant = row.cartridge?.variant ?? row.chamber?.variant
  const gap = variant ? undefined : clearance.get(row.key)
  const storedSymbol = row.cartridge?.symbol ?? row.chamber?.symbol ?? row.key
  const description = meaningOf(storedSymbol, sides, table, t)
  return {
    ...row,
    storedSymbol,
    ...(description && { description }),
    group: groupOf(storedSymbol, sides, table),
    notes: [
      ...(symbolText(storedSymbol) === storedSymbol ? [] : [storedSymbol]),
      ...sideNotes,
      ...(gap !== undefined && gap < 0 ? [clearanceLine(conflictText(t), t)] : []),
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
export function combinedRows(spec: Sheet, list: Figure[], t: Translate = english): CombinedRow[] {
  const rows = rowsBySymbol(spec, t)
  addDerivedE(rows, list, t)
  const clearance = fits(spec.values)
  const out = [...rows.values()].map((row) => withClearanceAndGroup(row, clearance, spec.table, t))
  // grouped as the designer, record order within a group
  const rank = (r: CombinedRow) => rowGroups.findIndex(([g]) => g === r.group)
  return out.sort((a, b) => rank(a) - rank(b))
}

/**
 * The hover lines of a symbol in the table of one side: the symbol and what it stands for there,
 * the spelled name of a Greek letter without a meaning, then that side's notes (basic, the text as
 * printed, derived), the meaning of a clearance note and a clearance that is a data conflict.
 */
export function sideHint(
  r: CombinedRow,
  side: 'cartridge' | 'chamber',
  table?: string,
  t: Translate = english,
): string[] {
  const v = r[side]
  if (!v) return []
  const meaning = meaningOf(r.storedSymbol, [side], table, t)
  const derived = side === 'cartridge' && r.derived === true
  const conflict = side === 'chamber' && r.clearance !== undefined && r.clearance < 0
  return [
    meaning
      ? t('{symbol}: {meaning}', { symbol: r.storedSymbol, meaning })
      : symbolText(r.storedSymbol) !== r.storedSymbol
        ? r.storedSymbol
        : '',
    ...valueNotes(v).map((n) => noteLine(n, t)),
    ...(derived ? [t('Derived, not dimensioned')] : []),
    // the note after the value is hover only; the symbol is the keyboard stop of the row
    ...(side === 'chamber' && r.clearance !== undefined
      ? [clearanceLine(t(clearanceMeaning), t)]
      : []),
    ...(conflict ? [clearanceLine(conflictText(t), t)] : []),
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
export function variantMatrix(
  spec: Sheet,
  t: Translate = english,
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
        label: side ? t(sideSymbol[side], { symbol: symbolText(symbol) }) : symbolText(symbol),
        notes: nameLine(symbol, [side || undefined], spec.table, t),
        quantity: cells.find((c) => c)?.quantity ?? '',
        cells,
      }
    }),
  }
}

/** The values of the pressure strip: pressures, energies and positions without a side or variant. */
export const pressureStripValues = (spec: Sheet) => spec.values.filter((v) => !v.side && !v.variant)

/** Hover lines of a pressure strip value: symbol and meaning, or none when the symbol has neither. */
export const pressureStripNote = (v: SpecValue, table?: string, t: Translate = english) =>
  nameLine(v.symbol, [undefined], table, t)
