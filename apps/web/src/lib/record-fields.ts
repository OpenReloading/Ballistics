import {
  type Bullet,
  type Case,
  leadFree,
  type Powder,
  type QuantityValue,
  toSi,
} from '@open-reloading/schema'
import { computedBulletRows } from './bullet.ts'
import {
  degreeText,
  formatNumber,
  formatQuantity,
  inchText,
  type Quantity,
  type UnitSystem,
  unitsOf,
  waterVolume,
  withUnit,
} from './units.ts'

/**
 * One row of a record's value table: a text, or a quantity in SI that the table shows in the
 * viewer's unit; the text as printed and how a computed value is computed show on hover.
 */
export interface FieldRow {
  label: string
  /** The drawing's symbol of the value (`data-symbol`), for the linked marking. */
  symbol?: string | undefined
  /** Shown as is: names, forms, values without a unit choice. */
  text?: string
  /** A text's unit, shown after it. */
  unit?: string | undefined
  /** `sig`: that many significant digits instead of the unit's decimals. */
  value?: { quantity: Quantity; si: number; significantDigits?: number }
  printed?: string
  method?: string | undefined
  /** SI velocity: the lower bound of a ballistic coefficient's band, after the label. */
  fromVelocity?: number
}

/** Rows under a group heading row (Dimensions, Computed, Coefficients); no title, no heading row. */
export type FieldGroup = {
  title?: string
  /** The group filter's label (`FieldPanel`), shared by groups that filter together; else the title. */
  filter?: string
  rows: FieldRow[]
}

/** The text before a twist's length per turn. */
export const turnPrefix = '1 turn in '

/** A row's value as shown in `system`: rounded to the unit's decimals, with its symbol. */
export function rowValue(row: FieldRow, system: UnitSystem): string {
  if (!row.value) return row.unit ? `${row.text} ${row.unit}` : (row.text ?? '')
  const { quantity: q, si, significantDigits: sig } = row.value
  const shown = `${sig ? inchText(formatSignificant(system[q].fromSi(si), sig), system[q].symbol) : formatQuantity(q, system, si)}${system[q].symbol ? ` ${system[q].symbol}` : ''}`
  return q === 'twist' ? `${turnPrefix}${shown}` : shown
}

/** A row's value split into its text and its unit symbol, for a unit column or a label. */
export function rowParts(row: FieldRow, system: UnitSystem) {
  const unit = row.value ? system[row.value.quantity].symbol : (row.unit ?? '')
  const text = rowValue(row, system)
  return {
    number: unit && text.endsWith(` ${unit}`) ? text.slice(0, -unit.length - 1) : text,
    unit,
  }
}

/** A row's label, with the band of a coefficient in `system`'s velocity unit. */
export function rowLabel(row: FieldRow, system: UnitSystem): string {
  return row.fromVelocity === undefined
    ? row.label
    : `${row.label} from ${withUnit('velocity', system, row.fromVelocity)}`
}

/** The hover notes of a row: the text as printed, then the method. */
export function rowNotes(row: FieldRow): string[] {
  return [row.printed && `As printed: ${row.printed}`, row.method].filter((n): n is string => !!n)
}

/** Text of `x` with `n` significant digits and no exponent, trailing zeros kept. */
function formatSignificant(x: number, n: number): string {
  if (x === 0) return '0'
  return formatNumber(x, Math.max(0, n - 1 - Math.floor(Math.log10(Math.abs(x)))))
}

/** A record value as a name: "hollow-point" as "Hollow point". */
export const titleFromKebab = (value: string) =>
  (value.charAt(0).toUpperCase() + value.slice(1)).replaceAll('-', ' ')

/**
 * The construction in a few words: the structure, the core and jacket materials, the surface; a
 * wording with no structured field as printed. The manufacturer's wording shows as the printed text.
 */
export function constructionRows(c: Bullet['construction']): FieldRow[] {
  if (!c) return []
  const parts = [
    c.structure,
    c.core && `${c.core.material} core`,
    c.jacket && `${c.jacket.material ?? ''} jacket`.trim(),
    ...(c.surface ?? []),
    c.gasCheck && 'gas check',
    c.drivingBands && `${c.drivingBands} driving bands`,
    leadFree(c) && 'lead-free',
  ].filter(Boolean)
  const text = parts.length > 0 ? titleFromKebab(parts.join(', ')) : c.raw
  return [{ label: 'Construction', text, ...(text !== c.raw && { printed: c.raw }) }]
}

const yesNo = (value: boolean | undefined) =>
  value === undefined ? undefined : value ? 'yes' : 'no'

const text = (label: string, value: string | undefined): FieldRow[] =>
  value === undefined ? [] : [{ label, text: value }]

/** A stored value in the record's unit of `q` (mm, g, deg, lb/in²) as a row in SI. */
const stored =
  <Q extends Quantity>(q: Q, unit: keyof (typeof unitsOf)[Q]) =>
  (label: string, s: QuantityValue | undefined, symbol?: string): FieldRow[] =>
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
  const rows = [
    ...text('Structure', c.structure),
    ...text('Jacket', c.jacket && (c.jacket.material ? material(c.jacket.material) : 'yes')),
    ...length('Jacket thickness', c.jacket?.thickness),
    ...text('Core', c.core && material(c.core.material)),
    ...text('Core hardness (HBW)', c.core?.hardness?.value.toString()),
    ...text('Surface', c.surface?.map(material).join(', ')),
    ...(c.gasCheck === undefined ? [] : text('Gas check', c.gasCheck ? 'yes' : 'no')),
    ...text('Driving bands', c.drivingBands?.toString()),
    ...text('Lead-free', yesNo(leadFree(c))),
  ]
  if (rows.length === 0) return [{ label: 'Construction', text: c.raw }]
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
      title: 'Size',
      rows: [
        ...length('Diameter', b.diameter, 'd'),
        ...stored('mass', 'g')('Mass', b.mass),
        ...length('Length', b.length, 'L'),
      ],
    },
    {
      title: 'Shape',
      rows: [
        ...length('Nose length', b.noseLength, 'n'),
        ...length('Base to ogive', b.baseToOgive, 'BTO'),
        ...length('Bearing length', b.bearingLength, 'b'),
        ...text('Ogive', b.ogive?.form),
        ...length('Ogive radius', b.ogive?.radius, 'R'),
        ...stored('ratio', '1')('Ogive radius ratio', b.ogive?.radiusRatio, 'Rt/R'),
        ...length('Meplat diameter', b.meplatDiameter, 'dm'),
      ],
    },
    {
      title: 'Tip and base',
      rows: [
        ...text('Tip', b.tip?.type),
        ...length('Tip length', b.tip?.length, 'lt'),
        ...length('Hollow-point mouth diameter', b.tip?.mouthDiameter, 'dh'),
        ...text('Base type', b.base?.type),
        ...length('Base length', b.base?.length, 't'),
        ...length('Base diameter', b.base?.diameter, 'db'),
        ...length('Cavity diameter', b.base?.cavityDiameter, 'dc'),
        // degrees and minutes on manufacturer sheets: the stored decimal degrees, not rounded to whole degrees
        ...(angle
          ? [
              {
                label: 'Boat-tail angle',
                text: degreeText(angle.value),
                unit: 'deg',
                ...(angle.raw && { printed: angle.raw }),
              },
            ]
          : []),
      ],
    },
    { title: 'Build', rows: buildRows(b.construction) },
    {
      title: 'Twist',
      rows: [
        ...twist('Recommended twist', b.recommendedTwist),
        ...twist('Slowest twist', b.slowestTwist),
      ],
    },
    { title: 'Computed', rows: computedBulletRows(b) },
  ].filter((g) => g.rows.length > 0)
}

/** The ballistic coefficient rows of a bullet page: drag model, band and note in record order. */
export function ballisticCoefficientRows(b: Pick<Bullet, 'ballisticCoefficients'>): FieldRow[] {
  return (b.ballisticCoefficients ?? []).map((bc) => ({
    label: bc.dragModel,
    value: {
      quantity: 'ballisticCoefficient',
      si: unitsOf.ballisticCoefficient['lb/in2'].toSi(bc.value),
    },
    ...(bc.minVelocity && { fromVelocity: bc.minVelocity.value }),
    ...(bc.note && { method: bc.note }),
  }))
}

/** A thermochemistry value with its extremes over the composition ranges. */
type ComputedRange = NonNullable<Powder['thermochemistry']>['gamma']

const computed = (label: string, unit: string, r: ComputedRange): FieldRow => ({
  label,
  text: `${r.value}${unit}`,
  method: `Over the composition ranges: ${r.min} to ${r.max}.`,
})

/**
 * The groups of a powder page's Properties table, in record order; absent fields are left out.
 * Manufacturer, form, base, bulk density and country are the cards of `powderStrip`.
 */
export function powderRowGroups(p: Powder): FieldGroup[] {
  const t = p.thermochemistry
  return [
    { rows: text('Aliases', p.aliases?.join('; ')) },
    {
      title: 'Composition',
      rows: (p.composition ?? []).map(
        (c): FieldRow => ({
          label: c.name,
          text: c.min === c.max ? `${c.min} %` : `${c.min} to ${c.max} %`,
          ...(c.raw && { printed: c.raw }),
        }),
      ),
    },
    {
      title: 'Thermochemistry',
      rows: t
        ? [
            { label: 'Loading density', text: `${t.loadingDensity.value} g/cm³` },
            computed('Flame temperature', ' K', t.flameTemperature),
            computed('Impetus', ' J/kg', t.impetus),
            computed('Ratio of specific heats', '', t.gamma),
            computed('Molar mass', ' kg/kmol', t.molarMass),
            computed('Covolume', ' m³/kg', t.covolume),
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
  `Fitted: plus and minus ${k} standard uncertainties, a lower bound (the rows of one load table are correlated).`

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
    label: string,
    value: number,
    sigma: number | undefined,
    unit: string,
  ): FieldRow => ({
    label,
    text: intervalText(value, sigma === undefined ? undefined : k * sigma),
    ...(unit && { unit }),
    method: fittedNote(k),
  })
  const { energy: e } = i
  return [
    ...(i.fitted.includes('vivacity')
      ? [row('Vivacity', i.vivacity.value, i.vivacity.standardUncertainty, '1/s')]
      : []),
    // stored in J/kg
    ...(i.fitted.includes('energy')
      ? [
          row(
            'Energy',
            e.value / 1e6,
            e.standardUncertainty === undefined ? undefined : e.standardUncertainty / 1e6,
            'MJ/kg',
          ),
        ]
      : []),
    ...(i.fitted.includes('form.a')
      ? [
          {
            ...row('Burn form a', i.burnForm.a.value, i.burnForm.a.standardUncertainty, ''),
            symbol: 'a',
          },
        ]
      : []),
    ...(ratio
      ? [
          {
            label: 'Energy ratio',
            text: formatNumber(ratio.value, 2),
            method: `The fitted energy over the energy of the thermochemistry (impetus over gamma minus 1)${
              ratio.median === undefined
                ? ''
                : `; median of the ${ratio.powders} powders with thermochemistry ${formatNumber(ratio.median, 2)}`
            }. Below 1 is expected: the fitted energy also carries the losses the model leaves out.`,
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
  const bar = (label: string, s: QuantityValue | undefined): FieldRow[] =>
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
    { label: 'Ratio of specific heats', text: formatSignificant(i.gamma, 4) },
    {
      label: 'Covolume',
      value: { quantity: 'covolume', si: i.covolume.value, significantDigits: 3 },
    },
    // stored in g/cm³
    {
      label: 'Solid density',
      value: { quantity: 'density', si: toSi('density', i.density.value), significantDigits: 3 },
    },
    ...bar('Reference pressure', i.referencePressure),
    ...bar('Ignition pressure', i.ignitionPressure),
    ...(i.startPressure
      ? bar('Start pressure', i.startPressure)
      : [
          {
            label: 'Start pressure',
            text: 'per load row',
            method: 'Set per load row by the barrel length and the bullet construction.',
          },
        ]),
    // stored in °C
    {
      label: 'Propellant temperature',
      value: { quantity: 'temperature', si: toSi('temperature', i.propellantTemperature.value) },
    },
    { label: 'Pressure exponent', text: String(i.pressureExponent) },
    ...(r
      ? bar('Bore resistance', r.stress).map((row) => ({
          ...row,
          method: `Stress; groove oversize ${r.oversize} per percent, engraving ${r.engraving} of the start pressure.`,
        }))
      : []),
  ]
}

/** The burn form's constants with their symbols; `a` only where it was not fitted. */
export function burnFormRows(p: Powder): FieldRow[] {
  const f = p.interior?.burnForm
  if (!f) return []
  const row = (symbol: string, value: number): FieldRow => ({
    symbol,
    label: `Burn form ${symbol}`,
    text: String(value),
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
      title: `Fitted (simulated, with ${k} standard uncertainties)`,
      filter: 'Fitted',
      rows: fittedParameterRows(p, k, ratio),
    },
    { title: 'Fixed model inputs', filter: 'Fixed inputs', rows: modelInputRows(p) },
    // twoStage is the one burn form of the schema
    { title: 'Burn form, two-stage', filter: 'Fixed inputs', rows: burnFormRows(p) },
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
  row: FieldRow
}

/**
 * The bullet strip: diameter, mass, length, the BC (G7 where given, else G1, its drag model in the
 * label) and the sectional density; only what the record has.
 */
export function bulletStrip(b: Bullet): StripItem[] {
  const bcs = b.ballisticCoefficients ?? []
  const bc =
    bcs.find((c) => c.dragModel === 'G7') ?? bcs.find((c) => c.dragModel === 'G1') ?? bcs[0]
  const item = (icon: StripItem['icon'], label: string, rows: FieldRow[]): StripItem[] =>
    rows[0] ? [{ icon, label, row: rows[0] }] : []
  const sd = computedBulletRows(b).find((r) => r.value?.quantity === 'sectionalDensity')
  return [
    ...item('diameter', 'Diameter', length('Diameter', b.diameter)),
    ...item('mass', 'Mass', stored('mass', 'g')('Mass', b.mass)),
    ...item('length', 'Length', length('Length', b.length)),
    ...(bc
      ? item(
          'ballisticCoefficient',
          `BC ${bc.dragModel}`,
          ballisticCoefficientRows({ ballisticCoefficients: [bc] }),
        )
      : []),
    ...item('sectionalDensity', 'Sectional density', sd ? [sd] : []),
  ]
}

/**
 * The powder strip: manufacturer (`manufacturerName`), form, base, the burn-rate position (when
 * fitted), the solid density of the model and the bulk density.
 */
export function powderStrip(
  p: Powder,
  place?: { order: number; total: number },
  manufacturerName?: string,
): StripItem[] {
  const text = (icon: StripItem['icon'], label: string, t: string | undefined): StripItem[] =>
    t ? [{ icon, label, row: { label, text: t } }] : []
  return [
    ...text('manufacturer', 'Manufacturer', manufacturerName),
    ...text('form', 'Form', p.grainForm),
    ...text('base', 'Base', p.propellantBase),
    ...(place
      ? [
          {
            icon: 'burnRate' as const,
            label: 'Burn rate',
            row: {
              label: 'Burn rate',
              text: `${place.order} of ${place.total}`,
              unit: '1 = fastest',
            },
          },
        ]
      : []),
    ...(p.interior
      ? [
          {
            icon: 'density' as const,
            label: 'Solid density',
            row: {
              label: 'Solid density',
              // stored in g/cm³
              value: {
                quantity: 'density' as const,
                si: toSi('density', p.interior.density.value),
                significantDigits: 3,
              },
            },
          },
        ]
      : []),
    ...(p.bulkDensity
      ? [
          {
            icon: 'bulkDensity' as const,
            label: 'Bulk density',
            row: {
              label: 'Bulk density',
              text: `${p.bulkDensity.value}`,
              unit: 'g/cm³',
              ...(p.bulkDensity.raw && { printed: p.bulkDensity.raw }),
            },
          },
        ]
      : []),
  ]
}

/** The stated water capacity of a case as a row: the mass of water in g, shown as the volume it fills. */
const capacityRow = (c: Pick<Case, 'waterCapacity'>): FieldRow[] =>
  c.waterCapacity
    ? [
        {
          label: 'Water capacity',
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
  const item = (icon: StripItem['icon'], label: string, rows: FieldRow[]): StripItem[] =>
    rows[0] ? [{ icon, label, row: rows[0] }] : []
  return [
    ...item('manufacturer', 'Manufacturer', text('Manufacturer', manufacturerName || undefined)),
    ...item('material', 'Material', text('Material', titleFromKebab(c.material))),
    ...item('mass', 'Mass', stored('mass', 'g')('Mass', c.mass)),
    ...item('capacity', 'Water capacity', capacityRow(c)),
  ]
}

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
        ...text('Product number', c.productNumber),
        ...text('Headstamp', c.headstamp),
        ...text('Primer pocket', c.primerPocket && pocketText(c.primerPocket)),
        ...length('Flash hole diameter', c.flashHole),
        ...text('Annealed', c.annealed === undefined ? undefined : c.annealed ? 'Yes' : 'No'),
      ],
    },
  ]
}
