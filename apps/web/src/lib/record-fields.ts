import {
  type Bullet,
  type Case,
  leadFree,
  type Powder,
  type Primer,
  type QuantityValue,
  toSi,
} from '@open-reloading/schema'
import { formatNumber, localizeDecimals } from '../i18n/number.ts'
import { type Message, msg, type Translator, translator } from '../i18n/translate.ts'
import { computedBulletRows } from './bullet.ts'
import {
  cupWording,
  rawWording,
  spacedWording,
  titleFromKebab,
  titleWording,
  yesNo,
} from './record-values.ts'
import {
  degreeText,
  formatQuantity,
  inchText,
  type Quantity,
  type UnitSystem,
  unitsOf,
  waterVolume,
  withUnit,
} from './units.ts'
import { say, verbatim, type Wording, worded } from './wording.ts'

export { titleFromKebab }

type Translate = Translator['t']

/** Without a catalogue every text is English: what the record functions give when no translation is passed. */
const english = translator().t

/**
 * One row of a record's value table: a text, or a quantity in SI that the table shows in the
 * viewer's unit; the text as printed and how a computed value is computed show on hover.
 */
export interface FieldRow {
  /** A message (`msg`), or `verbatim(name)` for a name as published (a drag model, a composition's substance). */
  label: Wording
  /** The drawing's symbol of the value (`data-symbol`), for the linked marking. */
  symbol?: string | undefined
  /** Shown as is: names, forms, values without a unit choice. The English of `words` where there are some. */
  text?: string
  /** The words of `text` in the language shown, joined by a comma: a value that is a word or a phrase, not a name as published. */
  words?: Wording[]
  /** `text` is numbers written with a point (built on the server, in English): shown with the language's decimal mark. */
  numeric?: boolean
  /** A text's unit, shown after it. */
  unit?: string | undefined
  /** The unit as words where it is no symbol; read instead of `unit`. */
  unitWords?: Wording | undefined
  /** `sig`: that many significant digits instead of the unit's decimals. */
  value?: { quantity: Quantity; si: number; significantDigits?: number }
  printed?: string
  method?: Wording | undefined
  /** SI velocity: the lower bound of a ballistic coefficient's band, after the label. */
  fromVelocity?: number
  /** The value as links, each with its text, in place of `text` on screen; `text` stays the plain value. */
  links?: { href: string; text: string }[]
}

/** Rows under a group heading row (Dimensions, Computed, Coefficients); no title, no heading row. */
export type FieldGroup = {
  title?: Wording
  /** The group filter's label (`FieldPanel`), shared by groups that filter together; else the title. */
  filter?: Wording
  rows: FieldRow[]
}

/** A row's unit: the symbol of its quantity, or the unit it names as text or words. */
const unitOf = (row: FieldRow, system: UnitSystem, t: Translate) =>
  row.value
    ? system[row.value.quantity].symbol
    : row.unitWords
      ? say(t, row.unitWords)
      : (row.unit ?? '')

/** A row's text part in the language of `t`. */
export const rowText = (row: FieldRow, t: Translate) =>
  row.words
    ? row.words.map((w) => say(t, w)).join(', ')
    : row.numeric
      ? localizeDecimals(row.text ?? '')
      : row.text

/** A row's value as shown in `system`: rounded to the unit's decimals, with its symbol. */
export function rowValue(row: FieldRow, system: UnitSystem, t: Translate = english): string {
  if (!row.value) {
    const text = rowText(row, t)
    const unit = unitOf(row, system, t)
    return unit ? `${text} ${unit}` : (text ?? '')
  }
  const { quantity: q, si, significantDigits: sig } = row.value
  const shown = `${sig ? inchText(formatSignificant(system[q].fromSi(si), sig), system[q].symbol) : formatQuantity(q, system, si)}${system[q].symbol ? ` ${system[q].symbol}` : ''}`
  return q === 'twist' ? t('1 turn in {length}', { length: shown }) : shown
}

/** A row's value split into its text and its unit symbol, for a unit column or a label. */
export function rowParts(row: FieldRow, system: UnitSystem, t: Translate = english) {
  const unit = unitOf(row, system, t)
  const text = rowValue(row, system, t)
  return {
    number: unit && text.endsWith(` ${unit}`) ? text.slice(0, -unit.length - 1) : text,
    unit,
  }
}

/** A row's label, with the band of a coefficient in `system`'s velocity unit. */
export function rowLabel(row: FieldRow, system: UnitSystem, t: Translate = english): string {
  const label = say(t, row.label)
  return row.fromVelocity === undefined
    ? label
    : t('{label} from {velocity}', {
        label,
        velocity: withUnit('velocity', system, row.fromVelocity),
      })
}

/** The hover notes of a row: the text as printed, then the method. */
export function rowNotes(row: FieldRow, t: Translate = english): string[] {
  const method = row.method && say(t, row.method)
  return [
    row.printed && t('As printed: {printed}', { printed: row.printed }),
    // a note of a numeric row holds numbers written with a point
    method && (row.numeric ? localizeDecimals(method) : method),
  ].filter((n): n is string => !!n)
}

/** Text of `x` with `n` significant digits and no exponent, trailing zeros kept. */
function formatSignificant(x: number, n: number): string {
  if (x === 0) return '0'
  return formatNumber(x, Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x)))))
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** A bullet's structure as a name: "Cup and core". */
export const structureText = (structure: string, t: Translator['t']) =>
  capitalised(say(t, rawWording(structure)).replaceAll('-', ' '))

/**
 * The construction in a few words: the structure, the core and jacket materials, the surface; a
 * wording with no structured field as printed. The manufacturer's wording shows as the printed text.
 */
export function constructionRows(c: Bullet['construction'], t: Translator['t']): FieldRow[] {
  if (!c) return []
  const material = (value: string) => say(t, spacedWording(value))
  const parts = [
    c.structure && structureText(c.structure, t),
    c.core && t('{material} core', { material: material(c.core.material) }),
    c.jacket &&
      (c.jacket.material
        ? t('{material} jacket', { material: material(c.jacket.material) })
        : t('jacket')),
    ...(c.surface ?? []).map(material),
    c.gasCheck && t('gas check'),
    c.drivingBands && t('{n} driving bands', { n: c.drivingBands }),
    leadFree(c) && t('lead free'),
  ].filter(Boolean)
  const text = parts.length > 0 ? capitalised(parts.join(', ')) : c.raw
  return [{ label: msg('Construction'), text, ...(text !== c.raw && { printed: c.raw }) }]
}

const yesNoText = (value: boolean | undefined, capitalised = false) =>
  value === undefined
    ? undefined
    : value
      ? capitalised
        ? 'Yes'
        : 'yes'
      : capitalised
        ? 'No'
        : 'no'

const text = (label: Wording, value: string | undefined): FieldRow[] =>
  value === undefined ? [] : [{ label, text: value }]

/** A text row whose value is a stored word: its English as `value` shows it, its words from `wording`. */
const word = (
  label: Message,
  value: string | undefined,
  wording: (value: string) => Wording,
  shownText = value,
): FieldRow[] =>
  value === undefined || shownText === undefined
    ? []
    : [{ label, text: shownText, words: [wording(value)] }]

/** A yes or no row. */
const flag = (label: Message, value: boolean | undefined, capitalised = false): FieldRow[] =>
  value === undefined
    ? []
    : [{ label, text: yesNoText(value, capitalised) ?? '', words: [yesNo(value, capitalised)] }]

/** A stored value in the record's unit of `q` (mm, g, deg, lb/in²) as a row in SI. */
const stored =
  <Q extends Quantity>(q: Q, unit: keyof (typeof unitsOf)[Q]) =>
  (label: Wording, s: QuantityValue | undefined, symbol?: string): FieldRow[] =>
    s
      ? [
          {
            label,
            ...(symbol && { symbol }),
            value: {
              quantity: q,
              si: (unitsOf[q][unit] as { toSi(x: number): number }).toSi(s.value),
            },
            ...(s.raw && { printed: s.raw }),
          },
        ]
      : []

const length = stored('length', 'mm')
const twist = stored('twist', 'mm')

/**
 * The build as one row per structured field (structure, jacket, core, surface), the manufacturer's
 * wording as printed on the first; the wording alone where nothing is structured.
 */
export function buildRows(c: Bullet['construction']): FieldRow[] {
  if (!c) return []
  const material = (m: string) => m.replaceAll('-', ' ')
  const jacket = c.jacket
  const rows: FieldRow[] = [
    ...word(msg('Structure'), c.structure, rawWording),
    ...(jacket
      ? jacket.material
        ? word(msg('Jacket'), jacket.material, spacedWording, material(jacket.material))
        : flag(msg('Jacket'), true)
      : []),
    ...length(msg('Jacket thickness'), jacket?.thickness),
    ...word(msg('Core'), c.core?.material, spacedWording, c.core && material(c.core.material)),
    ...text(msg('Core hardness (HBW)'), c.core?.hardness?.value.toString()),
    ...(c.surface
      ? [
          {
            label: msg('Surface'),
            text: c.surface.map(material).join(', '),
            words: c.surface.map(spacedWording),
          },
        ]
      : []),
    ...flag(msg('Gas check'), c.gasCheck),
    ...text(msg('Driving bands'), c.drivingBands?.toString()),
    ...flag(msg('Lead-free'), leadFree(c)),
  ]
  if (rows.length === 0) return [{ label: msg('Construction'), text: c.raw }]
  return rows.map((row, i) => (i === 0 ? { ...row, printed: c.raw } : row))
}

/**
 * The bullet data in groups (Size, Shape, Tip and base, Build, Twist, Computed), in record order,
 * each dimension with its drawing symbol; absent fields and empty groups are left out. The
 * manufacturer, product number, line and caliber are the page's title and badges.
 */
export function bulletDataGroups(b: Bullet): FieldGroup[] {
  const angle = b.base?.angle
  return [
    {
      title: msg('Size'),
      rows: [
        ...length(msg('Diameter'), b.diameter, 'd'),
        ...stored('mass', 'g')(msg('Mass'), b.mass),
        ...length(msg('Length'), b.length, 'L'),
      ],
    },
    {
      title: msg('Shape'),
      rows: [
        ...length(msg('Nose length'), b.noseLength, 'n'),
        ...length(msg('Base to ogive'), b.baseToOgive, 'BTO'),
        ...length(msg('Bearing length'), b.bearingLength, 'b'),
        ...word(msg('Ogive'), b.ogive?.form, rawWording),
        ...length(msg('Ogive radius'), b.ogive?.radius, 'R'),
        ...stored('ratio', '1')(msg('Ogive radius ratio'), b.ogive?.radiusRatio, 'Rt/R'),
        ...length(msg('Meplat diameter'), b.meplatDiameter, 'dm'),
      ],
    },
    {
      title: msg('Tip and base'),
      rows: [
        ...word(msg('Tip'), b.tip?.type, rawWording),
        ...length(msg('Tip length'), b.tip?.length, 'lt'),
        ...length(msg('Hollow-point mouth diameter'), b.tip?.mouthDiameter, 'dh'),
        ...word(msg('Base type'), b.base?.type, rawWording),
        ...length(msg('Base length'), b.base?.length, 't'),
        ...length(msg('Base diameter'), b.base?.diameter, 'db'),
        ...length(msg('Cavity diameter'), b.base?.cavityDiameter, 'dc'),
        ...length(msg('Cavity depth'), b.base?.cavityDepth),
        // degrees and minutes on manufacturer sheets: the stored decimal degrees, not rounded to whole degrees
        ...(angle
          ? [
              {
                label: msg('Boat-tail angle'),
                text: degreeText(angle.value),
                numeric: true as const,
                unit: 'deg',
                ...(angle.raw && { printed: angle.raw }),
              },
            ]
          : []),
      ],
    },
    { title: msg('Build'), rows: buildRows(b.construction) },
    {
      title: msg('Twist'),
      rows: [
        ...twist(msg('Recommended twist'), b.recommendedTwist),
        ...twist(msg('Slowest twist'), b.slowestTwist),
      ],
    },
    { title: msg('Computed'), rows: computedBulletRows(b) },
  ].filter((g) => g.rows.length > 0)
}

/** The ballistic coefficient rows of a bullet page: drag model, band and note in record order. */
export function ballisticCoefficientRows(b: Pick<Bullet, 'ballisticCoefficients'>): FieldRow[] {
  return (b.ballisticCoefficients ?? []).map((bc) => ({
    label: verbatim(bc.dragModel),
    value: {
      quantity: 'ballisticCoefficient',
      si: unitsOf.ballisticCoefficient['lb/in2'].toSi(bc.value),
    },
    ...(bc.minVelocity && { fromVelocity: bc.minVelocity.value }),
    ...(bc.note && { method: verbatim(bc.note) }),
  }))
}

/** A thermochemistry value with its extremes over the composition ranges. */
type ComputedRange = NonNullable<Powder['thermochemistry']>['gamma']

const computed = (label: Message, unit: string, r: ComputedRange): FieldRow => ({
  label,
  text: `${r.value}${unit}`,
  numeric: true,
  method: worded(msg('Over the composition ranges: {min} to {max}.'), { min: r.min, max: r.max }),
})

/** The cartridges the manufacturer lists a powder for, each a link to its record page. */
function listedRows(
  ids: readonly string[] | undefined,
  names: ReadonlyMap<string, string>,
): FieldRow[] {
  if (!ids?.length) return []
  const links = ids.map((id) => ({
    href: `/cartridges/${encodeURIComponent(id)}`,
    text: names.get(id) ?? id,
  }))
  return [
    {
      label: msg('Listed by the manufacturer for'),
      text: links.map((l) => l.text).join('; '),
      links,
    },
  ]
}

/**
 * The groups of a powder page's Properties table, in record order; absent fields are left out.
 * Manufacturer, form, base, bulk density and country are the cards of `powderStrip`.
 */
export function powderRowGroups(
  p: Powder,
  cartridgeNames: ReadonlyMap<string, string> = new Map(),
): FieldGroup[] {
  const t = p.thermochemistry
  return [
    {
      rows: [
        ...text(msg('Aliases'), p.aliases?.join('; ')),
        ...listedRows(p.listedCartridges, cartridgeNames),
      ],
    },
    {
      title: msg('Composition'),
      rows: (p.composition ?? []).map(
        (c): FieldRow => ({
          label: verbatim(c.name),
          text: c.min === c.max ? `${c.min} %` : `${c.min} to ${c.max} %`,
          words: [
            c.min === c.max
              ? worded(msg('{value} %'), { value: c.min })
              : worded(msg('{min} to {max} %'), { min: c.min, max: c.max }),
          ],
          numeric: true,
          ...(c.raw && { printed: c.raw }),
        }),
      ),
    },
    {
      title: msg('Thermochemistry'),
      rows: t
        ? [
            {
              label: msg('Loading density'),
              text: `${t.loadingDensity.value} g/cm³`,
              numeric: true,
            },
            computed(msg('Flame temperature'), ' K', t.flameTemperature),
            computed(msg('Impetus'), ' J/kg', t.impetus),
            computed(msg('Ratio of specific heats'), '', t.gamma),
            computed(msg('Molar mass'), ' kg/kmol', t.molarMass),
            computed(msg('Covolume'), ' m³/kg', t.covolume),
          ]
        : [],
    },
  ]
}

/**
 * A fitted value with its interval `half` (plus and minus) as text: the interval to two significant
 * digits, the value to the same decimal place, and the interval in percent (whole from 10 %).
 * Without an interval the value as stored. No-break spaces, so it wraps only before the percent.
 */
export function intervalText(value: number, half: number | undefined): string {
  if (half === undefined || !(half > 0)) return `${value}`
  const digits = Math.max(0, 1 - Math.floor(Math.log10(half)))
  const percent = (100 * half) / Math.abs(value)
  return `${formatNumber(value, digits)}\u00a0±\u00a0${formatNumber(half, digits)} (±\u00a0${formatNumber(percent, percent >= 10 ? 0 : 1)}\u00a0%)`
}

const fittedNote = (k: number) =>
  worded(
    msg(
      'Fitted: plus and minus {k} standard uncertainties, a lower bound (the rows of one load table are correlated).',
    ),
    { k },
  )

/**
 * The fitted parameters of a powder's model fit with their intervals of plus and minus `k`
 * standard uncertainties; `ratio`: the fitted energy over the thermochemistry energy and the
 * median of the powders that have one.
 */
export function fittedParameterRows(
  p: Powder,
  k: number,
  ratio?: { value: number; median?: number; powders?: number },
): FieldRow[] {
  const i = p.interior
  if (!i) return []
  const row = (
    label: Message,
    value: number,
    sigma: number | undefined,
    unit: string,
  ): FieldRow => ({
    label,
    text: intervalText(value, sigma === undefined ? undefined : k * sigma),
    numeric: true,
    ...(unit && { unit }),
    method: fittedNote(k),
  })
  const { energy: e } = i
  return [
    ...(i.fitted.includes('vivacity')
      ? [row(msg('Vivacity'), i.vivacity.value, i.vivacity.standardUncertainty, '1/s')]
      : []),
    // stored in J/kg
    ...(i.fitted.includes('energy')
      ? [
          row(
            msg('Energy'),
            e.value / 1e6,
            e.standardUncertainty === undefined ? undefined : e.standardUncertainty / 1e6,
            'MJ/kg',
          ),
        ]
      : []),
    ...(i.fitted.includes('form.a')
      ? [
          {
            ...row(msg('Burn form a'), i.burnForm.a.value, i.burnForm.a.standardUncertainty, ''),
            symbol: 'a',
          },
        ]
      : []),
    ...(ratio
      ? [
          {
            label: msg('Energy ratio'),
            text: formatNumber(ratio.value, 2),
            numeric: true,
            method:
              ratio.median === undefined
                ? msg(
                    'Fitted energy over thermochemistry energy (impetus over gamma minus 1). Below 1 is expected: the fit also carries the losses the model leaves out.',
                  )
                : worded(
                    msg(
                      'Fitted energy over thermochemistry energy (impetus over gamma minus 1); median of the {powders} powders with thermochemistry {median}. Below 1 is expected: the fit also carries the losses the model leaves out.',
                    ),
                    { powders: ratio.powders ?? 0, median: formatNumber(ratio.median, 2) },
                  ),
          },
        ]
      : []),
  ]
}

/** The fixed inputs of a powder's model fit from their stored units, at 3 significant digits. */
export function modelInputRows(p: Powder): FieldRow[] {
  const i = p.interior
  if (!i) return []
  // stored in bar
  const bar = (label: Message, s: QuantityValue | undefined): FieldRow[] =>
    s
      ? [
          {
            label,
            value: { quantity: 'pressure', si: toSi('pressure', s.value), significantDigits: 3 },
          },
        ]
      : []
  const r = i.resistance
  return [
    { label: msg('Ratio of specific heats'), text: formatSignificant(i.gamma, 4), numeric: true },
    {
      label: msg('Covolume'),
      value: { quantity: 'covolume', si: i.covolume.value, significantDigits: 3 },
    },
    // stored in g/cm³
    {
      label: msg('Solid density'),
      value: { quantity: 'density', si: toSi('density', i.density.value), significantDigits: 3 },
    },
    ...bar(msg('Reference pressure'), i.referencePressure),
    ...bar(msg('Ignition pressure'), i.ignitionPressure),
    ...(i.startPressure
      ? bar(msg('Start pressure'), i.startPressure)
      : [
          {
            label: msg('Start pressure'),
            text: 'per load row',
            words: [msg('per load row')],
            method: msg('Set per load row by the barrel length and the bullet construction.'),
          },
        ]),
    // stored in °C
    {
      label: msg('Propellant temperature'),
      value: { quantity: 'temperature', si: toSi('temperature', i.propellantTemperature.value) },
    },
    { label: msg('Pressure exponent'), text: String(i.pressureExponent), numeric: true },
    ...(r
      ? bar(msg('Bore resistance'), r.stress).map((row) => ({
          ...row,
          method: worded(
            msg(
              'Stress; groove oversize {oversize} per percent, engraving {engraving} of the start pressure.',
            ),
            { oversize: r.oversize, engraving: r.engraving },
          ),
        }))
      : []),
  ]
}

const burnFormLabels = {
  a: msg('Burn form a'),
  m: msg('Burn form m'),
  q: msg('Burn form q'),
  z1: msg('Burn form z1'),
} as const

/** The burn form's constants with their symbols; `a` only where it was not fitted. */
export function burnFormRows(p: Powder): FieldRow[] {
  const f = p.interior?.burnForm
  if (!f) return []
  const row = (symbol: 'a' | 'm' | 'q' | 'z1', value: number): FieldRow => ({
    symbol,
    label: burnFormLabels[symbol],
    text: String(value),
    numeric: true,
  })
  return [
    ...(p.interior?.fitted.includes('form.a') ? [] : [row('a', f.a.value)]),
    row('m', f.m),
    row('q', f.q),
    row('z1', f.z1),
  ]
}

/**
 * The Model parameters table of a fitted powder: the fitted values first (`fittedParameterRows`
 * with `k` and `ratio`), then the fixed inputs and the burn form, both under the filter Fixed inputs.
 */
export function powderParameterGroups(
  p: Powder,
  k: number,
  ratio?: { value: number; median?: number; powders?: number },
): FieldGroup[] {
  return [
    {
      title: worded(msg('Fitted (simulated, with {k} standard uncertainties)'), { k }),
      filter: msg('Fitted'),
      rows: fittedParameterRows(p, k, ratio),
    },
    { title: msg('Fixed model inputs'), filter: msg('Fixed inputs'), rows: modelInputRows(p) },
    // twoStage is the one burn form of the schema
    { title: msg('Burn form, two-stage'), filter: msg('Fixed inputs'), rows: burnFormRows(p) },
  ].filter((g) => g.rows.length > 0)
}

/** One value of a record's spec strip: a labelled row, in the viewer's unit where it is a quantity. */
export type StripItem = {
  icon:
    | 'manufacturer'
    | 'diameter'
    | 'mass'
    | 'length'
    | 'ballisticCoefficient'
    | 'sectionalDensity'
    | 'form'
    | 'burnRate'
    | 'base'
    | 'density'
    | 'bulkDensity'
    | 'capacity'
    | 'material'
    | 'federation'
    | 'distance'
    | 'rings'
    | 'black'
  label: string
  /** `label` in the language shown; read instead of `label` where present. */
  words?: Wording
  row: FieldRow
}

const bcItem = (dragModel: string, rows: FieldRow[]): StripItem[] =>
  rows[0]
    ? [
        {
          icon: 'ballisticCoefficient',
          label: `BC ${dragModel}`,
          words: worded(msg('BC {model}'), { model: dragModel }),
          row: rows[0],
        },
      ]
    : []

/** A bullet's type for the strip: its tip and its base as words ("hollow-point, boat-tail"), what the record gives. */
const bulletType = (b: Bullet): FieldRow[] => {
  const parts = [b.tip?.type, b.base?.type].flatMap((x): string[] => (x ? [x] : []))
  return parts.length === 0
    ? []
    : [{ label: msg('Type'), text: parts.join(', '), words: parts.map((p) => rawWording(p)) }]
}

/**
 * The bullet strip: diameter, mass, length, the BCs G1 and G7 (one card), the sectional density
 * and the type (tip and base); only what the record has.
 */
export function bulletStrip(b: Bullet): StripItem[] {
  const bcs = b.ballisticCoefficients ?? []
  const shown = ['G1', 'G7'].flatMap((m) => {
    const c = bcs.find((x) => x.dragModel === m)
    return c ? [c] : []
  })
  const item = stripItem
  const sd = computedBulletRows(b).find((r) => r.value?.quantity === 'sectionalDensity')
  return [
    ...item('diameter', msg('Diameter'), length(msg('Diameter'), b.diameter)),
    ...item('mass', msg('Mass'), stored('mass', 'g')(msg('Mass'), b.mass)),
    ...item('length', msg('Length'), length(msg('Length'), b.length)),
    // the same icon: `FieldStrip` puts both in one card
    ...shown.flatMap((bc) =>
      bcItem(bc.dragModel, ballisticCoefficientRows({ ballisticCoefficients: [bc] })),
    ),
    ...item('sectionalDensity', msg('Sectional density'), sd ? [sd] : []),
    ...item('form', msg('Type'), bulletType(b)),
  ]
}

/** A strip card: a label, in English as the plain text and as the message the language shown translates, over a row's value. */
const stripItem = (icon: StripItem['icon'], label: Message, rows: FieldRow[]): StripItem[] =>
  rows[0] ? [{ icon, label: say(english, label), words: label, row: rows[0] }] : []

/**
 * The powder strip: manufacturer (`manufacturerName`), form, base, the burn-rate position (when
 * fitted), the solid density of the model and the bulk density.
 */
export function powderStrip(
  p: Powder,
  place?: { order: number; total: number },
  manufacturerName?: string,
): StripItem[] {
  return [
    ...stripItem(
      'manufacturer',
      msg('Manufacturer'),
      text(msg('Manufacturer'), manufacturerName || undefined),
    ),
    ...stripItem('form', msg('Form'), word(msg('Form'), p.grainForm, rawWording)),
    ...stripItem('base', msg('Base'), word(msg('Base'), p.propellantBase, rawWording)),
    ...(place
      ? stripItem('burnRate', msg('Burn rate'), [
          {
            label: msg('Burn rate'),
            text: `${place.order} of ${place.total}`,
            words: [worded(msg('{order} of {total}'), { order: place.order, total: place.total })],
            unit: '1 = fastest',
            unitWords: msg('1 = fastest'),
          },
        ])
      : []),
    ...(p.interior
      ? stripItem('density', msg('Solid density'), [
          {
            label: msg('Solid density'),
            // stored in g/cm³
            value: {
              quantity: 'density',
              si: toSi('density', p.interior.density.value),
              significantDigits: 3,
            },
          },
        ])
      : []),
    ...(p.bulkDensity
      ? stripItem('bulkDensity', msg('Bulk density'), [
          {
            label: msg('Bulk density'),
            text: `${p.bulkDensity.value}`,
            numeric: true,
            unit: 'g/cm³',
            ...(p.bulkDensity.raw && { printed: p.bulkDensity.raw }),
          },
        ])
      : []),
  ]
}

/** The stated water capacity of a case as a row: the mass of water in g, shown as the volume it fills. */
const capacityRow = (c: Pick<Case, 'waterCapacity'>): FieldRow[] =>
  c.waterCapacity
    ? [
        {
          label: msg('Water capacity'),
          value: { quantity: 'capacity', si: waterVolume(c.waterCapacity.value) },
          ...(c.waterCapacity.raw && { printed: c.waterCapacity.raw }),
        },
      ]
    : []

/**
 * The case strip: manufacturer (`manufacturerName`), material, empty mass and the stated water
 * capacity; only what the record has.
 */
export function caseStrip(c: Case, manufacturerName?: string): StripItem[] {
  return [
    ...stripItem(
      'manufacturer',
      msg('Manufacturer'),
      text(msg('Manufacturer'), manufacturerName || undefined),
    ),
    ...stripItem(
      'material',
      msg('Material'),
      word(msg('Material'), c.material, titleWording, titleFromKebab(c.material)),
    ),
    ...stripItem('mass', msg('Mass'), stored('mass', 'g')(msg('Mass'), c.mass)),
    ...stripItem('capacity', msg('Water capacity'), capacityRow(c)),
  ]
}

/**
 * The primer strip: manufacturer (`manufacturerName`), size and priming compound; only what the
 * record has.
 */
export function primerStrip(p: Primer, manufacturerName?: string): StripItem[] {
  return [
    ...stripItem(
      'manufacturer',
      msg('Manufacturer'),
      text(msg('Manufacturer'), manufacturerName || undefined),
    ),
    ...stripItem(
      'form',
      msg('Size'),
      word(msg('Size'), p.size, titleWording, titleFromKebab(p.size)),
    ),
    ...stripItem(
      'material',
      msg('Priming compound'),
      word(
        msg('Priming compound'),
        p.compound,
        titleWording,
        p.compound && titleFromKebab(p.compound),
      ),
    ),
  ]
}

/**
 * The groups of a primer page's Properties table: product number, magnum flag, cup metal and
 * thickness, intended use and the published figures, each as the source prints it. Manufacturer,
 * size and compound are the cards of `primerStrip`.
 */
export function primerRowGroups(p: Primer): FieldGroup[] {
  return [
    {
      rows: [
        ...text(msg('Product number'), p.productNumber),
        ...flag(msg('Magnum'), p.magnum, true),
        ...word(
          msg('Cup material'),
          p.cup?.material,
          cupWording,
          p.cup?.material && titleFromKebab(p.cup.material),
        ),
        ...length(msg('Cup thickness'), p.cup?.thickness),
        ...text(msg('Intended use'), p.intendedUse),
        ...(p.performance ?? []).flatMap((f) => text(verbatim(f.property), f.value)),
      ],
    },
  ]
}

/** `Boxer, large rifle`: the primer pocket's type and size as words: the type, then the size as the source names it. */
const pocketWords = (p: NonNullable<Case['primerPocket']>) => [
  titleWording(p.type),
  ...(p.size ? [verbatim(p.size)] : []),
]

/** `Boxer, large rifle`: the primer pocket's type and size. */
const pocketText = (p: NonNullable<Case['primerPocket']>) =>
  [titleFromKebab(p.type), p.size].filter(Boolean).join(', ')

/**
 * The groups of a case page's Properties table: product number, headstamp, primer pocket, flash
 * hole and whether it is annealed. Manufacturer, material, mass and
 * capacity are the cards of `caseStrip`.
 */
export function caseRowGroups(c: Case): FieldGroup[] {
  return [
    {
      rows: [
        ...text(msg('Product number'), c.productNumber),
        ...text(msg('Headstamp'), c.headstamp),
        ...(c.primerPocket
          ? [
              {
                label: msg('Primer pocket'),
                text: pocketText(c.primerPocket),
                words: pocketWords(c.primerPocket),
              },
            ]
          : []),
        ...length(msg('Flash hole diameter'), c.flashHole),
        ...flag(msg('Annealed'), c.annealed, true),
      ],
    },
  ]
}
