import type { I18n, MessageDescriptor } from '@lingui/core'
import {
  type Bullet,
  type Case,
  leadFree,
  type Powder,
  type Primer,
  type QuantityValue,
  toSi,
} from '@rangefoundry/schema'
import { linguiOf } from '../i18n/lingui.ts'
import { formatNumber, localizeDecimals } from '../i18n/number.ts'
import { computedBulletRows } from './bullet.ts'
import {
  cupWording,
  materialCore,
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
import { type LinguiWording, sayLingui, verbatim } from './wording.ts'

export { titleFromKebab }

/** What the record functions give when no language is passed. */
const englishLingui = linguiOf('en')

/** A quantity in SI shows in the viewer's unit; the printed text and how a computed value is computed show on hover. */
export interface FieldRow {
  /** A message descriptor, or `verbatim(name)` for a name as published (a drag model, a composition's substance). */
  label: LinguiWording
  /** The drawing's symbol of the value (`data-symbol`), for the linked marking. */
  symbol?: string | undefined
  /** Shown as is: names, forms, values without a unit choice. The English of `words` where there are some. */
  text?: string
  /** The words of `text` in the language shown, joined by a comma: a value that is a word or a phrase, not a name as published. */
  words?: LinguiWording[]
  /** `text` is numbers written with a point (built on the server, in English): shown with the language's decimal mark. */
  numeric?: boolean
  /** A text's unit, shown after it. */
  unit?: string | undefined
  /** The unit as words where it is no symbol; read instead of `unit`. */
  unitWords?: LinguiWording | undefined
  /** `sig`: that many significant digits instead of the unit's decimals. */
  value?: { quantity: Quantity; si: number; significantDigits?: number }
  printed?: string
  method?: LinguiWording | undefined
  /** SI velocity: the lower bound of a ballistic coefficient's band, after the label. */
  fromVelocity?: number
  /** The value as links, each with its text, in place of `text` on screen; `text` stays the plain value. */
  links?: { href: string; text: string }[]
}

/** Rows under a group heading row (Dimensions, Computed, Coefficients); no title, no heading row. */
export type FieldGroup = {
  title?: LinguiWording
  /** The group filter's label (`FieldPanel`), shared by groups that filter together; else the title. */
  filter?: LinguiWording
  rows: FieldRow[]
}

/** A row's unit: the symbol of its quantity, or the unit it names as text or words. */
const unitOf = (row: FieldRow, system: UnitSystem, i18n: I18n) =>
  row.value
    ? system[row.value.quantity].symbol
    : row.unitWords
      ? sayLingui(i18n, row.unitWords)
      : (row.unit ?? '')

/** A row's text part in the language of `i18n`. */
export const rowText = (row: FieldRow, i18n: I18n) =>
  row.words
    ? row.words.map((w) => sayLingui(i18n, w)).join(', ')
    : row.numeric
      ? localizeDecimals(row.text ?? '')
      : row.text

/** A twist's length per turn as text. */
export const turnIn = /*i18n*/ { id: 'recordFields.turnIn', message: '1 turn in {length}' }

/** A row's value as shown in `system`: rounded to the unit's decimals, with its symbol. */
export function rowValue(row: FieldRow, system: UnitSystem, i18n: I18n = englishLingui): string {
  if (!row.value) {
    const text = rowText(row, i18n)
    const unit = unitOf(row, system, i18n)
    return unit ? `${text} ${unit}` : (text ?? '')
  }
  const { quantity: q, si, significantDigits: sig } = row.value
  const shown = `${sig ? inchText(formatSignificant(system[q].fromSi(si), sig), system[q].symbol) : formatQuantity(q, system, si)}${system[q].symbol ? ` ${system[q].symbol}` : ''}`
  return q === 'twist' ? i18n._({ ...turnIn, values: { length: shown } }) : shown
}

/** A row's value split into its text and its unit symbol, for a unit column or a label. */
export function rowParts(row: FieldRow, system: UnitSystem, i18n: I18n = englishLingui) {
  const unit = unitOf(row, system, i18n)
  const text = rowValue(row, system, i18n)
  return {
    number: unit && text.endsWith(` ${unit}`) ? text.slice(0, -unit.length - 1) : text,
    unit,
  }
}

/** A row's label, with the band of a coefficient in `system`'s velocity unit. */
export function rowLabel(row: FieldRow, system: UnitSystem, i18n: I18n = englishLingui): string {
  const label = sayLingui(i18n, row.label)
  return row.fromVelocity === undefined
    ? label
    : i18n._({
        id: 'fieldStrip.bandFrom',
        message: '{label} from {velocity}',
        values: { label, velocity: withUnit('velocity', system, row.fromVelocity) },
      })
}

/** The hover notes of a row: the text as printed, then the method. */
export function rowNotes(row: FieldRow, i18n = englishLingui): string[] {
  const method = row.method && sayLingui(i18n, row.method)
  return [
    row.printed &&
      i18n._({
        id: 'recordFields.asPrinted',
        message: 'As printed: {printed}',
        values: { printed: row.printed },
      }),
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
export const structureText = (structure: string, i18n: I18n) =>
  capitalised(sayLingui(i18n, rawWording(structure)).replaceAll('-', ' '))

/** The group titles and row labels of a bullet's data. */
export const bulletLabels = {
  construction: /*i18n*/ { id: 'recordFields.construction', message: 'Construction' },
  structure: /*i18n*/ { id: 'recordFields.structure', message: 'Structure' },
  jacket: /*i18n*/ { id: 'recordFields.jacket', message: 'Jacket' },
  jacketThickness: /*i18n*/ { id: 'recordFields.jacketThickness', message: 'Jacket thickness' },
  core: /*i18n*/ { id: 'recordFields.core', message: 'Core' },
  coreHardness: /*i18n*/ { id: 'recordFields.coreHardness', message: 'Core hardness (HBW)' },
  surface: /*i18n*/ { id: 'recordFields.surface', message: 'Surface' },
  gasCheck: /*i18n*/ { id: 'recordFields.gasCheck', message: 'Gas check' },
  drivingBands: /*i18n*/ { id: 'recordFields.drivingBands', message: 'Driving bands' },
  leadFree: /*i18n*/ { id: 'recordFields.leadFree', message: 'Lead-free' },
  size: /*i18n*/ { id: 'recordFields.size', message: 'Size' },
  diameter: /*i18n*/ { id: 'recordFields.diameter', message: 'Diameter' },
  mass: /*i18n*/ { id: 'recordFields.mass', message: 'Mass' },
  length: /*i18n*/ { id: 'recordFields.length', message: 'Length' },
  shape: /*i18n*/ { id: 'recordFields.shape', message: 'Shape' },
  noseLength: /*i18n*/ { id: 'recordFields.noseLength', message: 'Nose length' },
  baseToOgive: /*i18n*/ { id: 'recordFields.baseToOgive', message: 'Base to ogive' },
  bearingLength: /*i18n*/ { id: 'recordFields.bearingLength', message: 'Bearing length' },
  ogive: /*i18n*/ { id: 'recordFields.ogive', message: 'Ogive' },
  ogiveRadius: /*i18n*/ { id: 'recordFields.ogiveRadius', message: 'Ogive radius' },
  ogiveRadiusRatio: /*i18n*/ { id: 'recordFields.ogiveRadiusRatio', message: 'Ogive radius ratio' },
  meplatDiameter: /*i18n*/ { id: 'recordFields.meplatDiameter', message: 'Meplat diameter' },
  tipAndBase: /*i18n*/ { id: 'recordFields.tipAndBase', message: 'Tip and base' },
  tip: /*i18n*/ { id: 'recordFields.tip', message: 'Tip' },
  tipLength: /*i18n*/ { id: 'recordFields.tipLength', message: 'Tip length' },
  hollowPointMouthDiameter: /*i18n*/ {
    id: 'recordFields.hollowPointMouthDiameter',
    message: 'Hollow-point mouth diameter',
  },
  baseType: /*i18n*/ { id: 'recordFields.baseType', message: 'Base type' },
  baseLength: /*i18n*/ { id: 'recordFields.baseLength', message: 'Base length' },
  baseDiameter: /*i18n*/ { id: 'recordFields.baseDiameter', message: 'Base diameter' },
  cavityDiameter: /*i18n*/ { id: 'recordFields.cavityDiameter', message: 'Cavity diameter' },
  cavityDepth: /*i18n*/ { id: 'recordFields.cavityDepth', message: 'Cavity depth' },
  boatTailAngle: /*i18n*/ { id: 'recordFields.boatTailAngle', message: 'Boat-tail angle' },
  build: /*i18n*/ { id: 'recordFields.build', message: 'Build' },
  twist: /*i18n*/ { id: 'recordFields.twist', message: 'Twist' },
  recommendedTwist: /*i18n*/ { id: 'recordFields.recommendedTwist', message: 'Recommended twist' },
  slowestTwist: /*i18n*/ { id: 'recordFields.slowestTwist', message: 'Slowest twist' },
  computed: /*i18n*/ { id: 'recordFields.computed', message: 'Computed' },
} satisfies Record<string, MessageDescriptor>

/** The manufacturer's wording shows as the printed text. */
export function constructionRows(c: Bullet['construction'], i18n: I18n): FieldRow[] {
  if (!c) return []
  const material = (value: string) => sayLingui(i18n, spacedWording(value))
  const parts = [
    c.structure && structureText(c.structure, i18n),
    c.core && i18n._({ ...materialCore, values: { material: material(c.core.material) } }),
    c.jacket &&
      (c.jacket.material
        ? i18n._({
            id: 'construction.materialJacket',
            message: '{material} jacket',
            values: { material: material(c.jacket.material) },
          })
        : i18n._({ id: 'construction.jacket', message: 'jacket' })),
    ...(c.surface ?? []).map(material),
    c.gasCheck && i18n._({ id: 'construction.gasCheck', message: 'gas check' }),
    c.drivingBands &&
      i18n._({
        id: 'construction.drivingBands',
        message: '{n} driving bands',
        values: { n: c.drivingBands },
      }),
    leadFree(c) && i18n._({ id: 'construction.leadFree', message: 'lead free' }),
  ].filter(Boolean)
  const text = parts.length > 0 ? capitalised(parts.join(', ')) : c.raw
  return [{ label: bulletLabels.construction, text, ...(text !== c.raw && { printed: c.raw }) }]
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

const text = (label: LinguiWording, value: string | undefined): FieldRow[] =>
  value === undefined ? [] : [{ label, text: value }]

/** A text row whose value is a stored word: its English as `value` shows it, its words from `wording`. */
const word = (
  label: LinguiWording,
  value: string | undefined,
  wording: (value: string) => LinguiWording,
  shownText = value,
): FieldRow[] =>
  value === undefined || shownText === undefined
    ? []
    : [{ label, text: shownText, words: [wording(value)] }]

/** A yes or no row. */
const flag = (label: LinguiWording, value: boolean | undefined, capitalised = false): FieldRow[] =>
  value === undefined
    ? []
    : [{ label, text: yesNoText(value, capitalised) ?? '', words: [yesNo(value, capitalised)] }]

/** A stored value in the record's unit of `q` (mm, g, deg, lb/in²) as a row in SI. */
const stored =
  <Q extends Quantity>(q: Q, unit: keyof (typeof unitsOf)[Q]) =>
  (label: LinguiWording, s: QuantityValue | undefined, symbol?: string): FieldRow[] =>
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

/** The manufacturer's wording as printed on the first row. */
export function buildRows(c: Bullet['construction']): FieldRow[] {
  if (!c) return []
  const material = (m: string) => m.replaceAll('-', ' ')
  const jacket = c.jacket
  const rows: FieldRow[] = [
    ...word(bulletLabels.structure, c.structure, rawWording),
    ...(jacket
      ? jacket.material
        ? word(bulletLabels.jacket, jacket.material, spacedWording, material(jacket.material))
        : flag(bulletLabels.jacket, true)
      : []),
    ...length(bulletLabels.jacketThickness, jacket?.thickness),
    ...word(
      bulletLabels.core,
      c.core?.material,
      spacedWording,
      c.core && material(c.core.material),
    ),
    ...text(bulletLabels.coreHardness, c.core?.hardness?.value.toString()),
    ...(c.surface
      ? [
          {
            label: bulletLabels.surface,
            text: c.surface.map(material).join(', '),
            words: c.surface.map(spacedWording),
          },
        ]
      : []),
    ...flag(bulletLabels.gasCheck, c.gasCheck),
    ...text(bulletLabels.drivingBands, c.drivingBands?.toString()),
    ...flag(bulletLabels.leadFree, leadFree(c)),
  ]
  if (rows.length === 0) return [{ label: bulletLabels.construction, text: c.raw }]
  return rows.map((row, i) => (i === 0 ? { ...row, printed: c.raw } : row))
}

/** Record order; maker, product number, line and caliber are the page's title and badges. */
export function bulletDataGroups(b: Bullet): FieldGroup[] {
  const angle = b.base?.angle
  return [
    {
      title: bulletLabels.size,
      rows: [
        ...length(bulletLabels.diameter, b.diameter, 'd'),
        ...stored('mass', 'g')(bulletLabels.mass, b.mass),
        ...length(bulletLabels.length, b.length, 'L'),
      ],
    },
    {
      title: bulletLabels.shape,
      rows: [
        ...length(bulletLabels.noseLength, b.noseLength, 'n'),
        ...length(bulletLabels.baseToOgive, b.baseToOgive, 'BTO'),
        ...length(bulletLabels.bearingLength, b.bearingLength, 'b'),
        ...word(bulletLabels.ogive, b.ogive?.form, rawWording),
        ...length(bulletLabels.ogiveRadius, b.ogive?.radius, 'R'),
        ...stored('ratio', '1')(bulletLabels.ogiveRadiusRatio, b.ogive?.radiusRatio, 'Rt/R'),
        ...length(bulletLabels.meplatDiameter, b.meplatDiameter, 'dm'),
      ],
    },
    {
      title: bulletLabels.tipAndBase,
      rows: [
        ...word(bulletLabels.tip, b.tip?.type, rawWording),
        ...length(bulletLabels.tipLength, b.tip?.length, 'lt'),
        ...length(bulletLabels.hollowPointMouthDiameter, b.tip?.mouthDiameter, 'dh'),
        ...word(bulletLabels.baseType, b.base?.type, rawWording),
        ...length(bulletLabels.baseLength, b.base?.length, 't'),
        ...length(bulletLabels.baseDiameter, b.base?.diameter, 'db'),
        ...length(bulletLabels.cavityDiameter, b.base?.cavityDiameter, 'dc'),
        ...length(bulletLabels.cavityDepth, b.base?.cavityDepth),
        // degrees and minutes on manufacturer sheets: the stored decimal degrees, not rounded to whole degrees
        ...(angle
          ? [
              {
                label: bulletLabels.boatTailAngle,
                text: degreeText(angle.value),
                numeric: true as const,
                unit: 'deg',
                ...(angle.raw && { printed: angle.raw }),
              },
            ]
          : []),
      ],
    },
    { title: bulletLabels.build, rows: buildRows(b.construction) },
    {
      title: bulletLabels.twist,
      rows: [
        ...twist(bulletLabels.recommendedTwist, b.recommendedTwist),
        ...twist(bulletLabels.slowestTwist, b.slowestTwist),
      ],
    },
    { title: bulletLabels.computed, rows: computedBulletRows(b) },
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

/** The group titles and row labels of a powder's, a case's and a primer's data. */
const recordLabels = {
  listedFor: /*i18n*/ { id: 'recordFields.listedFor', message: 'Listed by the manufacturer for' },
  aliases: /*i18n*/ { id: 'recordFields.aliases', message: 'Aliases' },
  composition: /*i18n*/ { id: 'recordFields.composition', message: 'Composition' },
  thermochemistry: /*i18n*/ { id: 'recordFields.thermochemistry', message: 'Thermochemistry' },
  loadingDensity: /*i18n*/ { id: 'recordFields.loadingDensity', message: 'Loading density' },
  flameTemperature: /*i18n*/ { id: 'recordFields.flameTemperature', message: 'Flame temperature' },
  impetus: /*i18n*/ { id: 'recordFields.impetus', message: 'Impetus' },
  gamma: /*i18n*/ { id: 'recordFields.gamma', message: 'Ratio of specific heats' },
  molarMass: /*i18n*/ { id: 'recordFields.molarMass', message: 'Molar mass' },
  covolume: /*i18n*/ { id: 'recordFields.covolume', message: 'Covolume' },
  vivacity: /*i18n*/ { id: 'recordFields.vivacity', message: 'Vivacity' },
  energy: /*i18n*/ { id: 'recordFields.energy', message: 'Energy' },
  burnFormA: /*i18n*/ { id: 'recordFields.burnFormA', message: 'Burn form a' },
  energyRatio: /*i18n*/ { id: 'recordFields.energyRatio', message: 'Energy ratio' },
  solidDensity: /*i18n*/ { id: 'recordFields.solidDensity', message: 'Solid density' },
  referencePressure: /*i18n*/ {
    id: 'recordFields.referencePressure',
    message: 'Reference pressure',
  },
  ignitionPressure: /*i18n*/ { id: 'recordFields.ignitionPressure', message: 'Ignition pressure' },
  startPressure: /*i18n*/ { id: 'recordFields.startPressure', message: 'Start pressure' },
  perLoadRow: /*i18n*/ { id: 'recordFields.perLoadRow', message: 'per load row' },
  startPressureNote: /*i18n*/ {
    id: 'recordFields.startPressureNote',
    message: 'Set per load row by the barrel length and the bullet construction.',
  },
  propellantTemperature: /*i18n*/ {
    id: 'recordFields.propellantTemperature',
    message: 'Propellant temperature',
  },
  pressureExponent: /*i18n*/ { id: 'recordFields.pressureExponent', message: 'Pressure exponent' },
  boreResistance: /*i18n*/ { id: 'recordFields.boreResistance', message: 'Bore resistance' },
  burnFormM: /*i18n*/ { id: 'recordFields.burnFormM', message: 'Burn form m' },
  burnFormQ: /*i18n*/ { id: 'recordFields.burnFormQ', message: 'Burn form q' },
  burnFormZ1: /*i18n*/ { id: 'recordFields.burnFormZ1', message: 'Burn form z1' },
  fittedFilter: /*i18n*/ { id: 'recordFields.fittedFilter', message: 'Fitted' },
  fixedInputsGroup: /*i18n*/ { id: 'recordFields.fixedInputsGroup', message: 'Fixed model inputs' },
  fixedInputsFilter: /*i18n*/ { id: 'recordFields.fixedInputsFilter', message: 'Fixed inputs' },
  burnFormGroup: /*i18n*/ { id: 'recordFields.burnFormGroup', message: 'Burn form, two-stage' },
  type: /*i18n*/ { id: 'recordFields.type', message: 'Type' },
  sectionalDensity: /*i18n*/ { id: 'recordFields.sectionalDensity', message: 'Sectional density' },
  manufacturer: /*i18n*/ { id: 'recordFields.manufacturer', message: 'Manufacturer' },
  form: /*i18n*/ { id: 'recordFields.form', message: 'Form' },
  base: /*i18n*/ { id: 'recordFields.base', message: 'Base' },
  burnRate: /*i18n*/ { id: 'recordFields.burnRate', message: 'Burn rate' },
  fastest: /*i18n*/ { id: 'recordFields.fastest', message: '1 = fastest' },
  bulkDensity: /*i18n*/ { id: 'recordFields.bulkDensity', message: 'Bulk density' },
  waterCapacity: /*i18n*/ { id: 'recordFields.waterCapacity', message: 'Water capacity' },
  material: /*i18n*/ { id: 'recordFields.material', message: 'Material' },
  primingCompound: /*i18n*/ { id: 'recordFields.primingCompound', message: 'Priming compound' },
  productNumber: /*i18n*/ { id: 'recordFields.productNumber', message: 'Product number' },
  magnum: /*i18n*/ { id: 'recordFields.magnum', message: 'Magnum' },
  cupMaterial: /*i18n*/ { id: 'recordFields.cupMaterial', message: 'Cup material' },
  cupThickness: /*i18n*/ { id: 'recordFields.cupThickness', message: 'Cup thickness' },
  intendedUse: /*i18n*/ { id: 'recordFields.intendedUse', message: 'Intended use' },
  headstamp: /*i18n*/ { id: 'recordFields.headstamp', message: 'Headstamp' },
  primerPocket: /*i18n*/ { id: 'recordFields.primerPocket', message: 'Primer pocket' },
  flashHole: /*i18n*/ { id: 'recordFields.flashHole', message: 'Flash hole diameter' },
  annealed: /*i18n*/ { id: 'recordFields.annealed', message: 'Annealed' },
} satisfies Record<string, MessageDescriptor>

/** A thermochemistry value with its extremes over the composition ranges. */
type ComputedRange = NonNullable<Powder['thermochemistry']>['gamma']

const computed = (label: MessageDescriptor, unit: string, r: ComputedRange): FieldRow => ({
  label,
  text: `${r.value}${unit}`,
  numeric: true,
  method: /*i18n*/ {
    id: 'recordFields.computedRange',
    message: 'Over the composition ranges: {min, decimal} to {max, decimal}.',
    values: { min: r.min, max: r.max },
  },
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
      label: recordLabels.listedFor,
      text: links.map((l) => l.text).join('; '),
      links,
    },
  ]
}

/** Maker, form, base, bulk density and country are the cards of `powderStrip`. */
export function powderRowGroups(
  p: Powder,
  cartridgeNames: ReadonlyMap<string, string> = new Map(),
): FieldGroup[] {
  const t = p.thermochemistry
  return [
    {
      rows: [
        ...text(recordLabels.aliases, p.aliases?.join('; ')),
        ...listedRows(p.listedCartridges, cartridgeNames),
      ],
    },
    {
      title: recordLabels.composition,
      rows: (p.composition ?? []).map(
        (c): FieldRow => ({
          label: verbatim(c.name),
          text: c.min === c.max ? `${c.min} %` : `${c.min} to ${c.max} %`,
          words: [
            c.min === c.max
              ? /*i18n*/ {
                  id: 'recordFields.percent',
                  message: '{value, decimal} %',
                  values: { value: c.min },
                }
              : /*i18n*/ {
                  id: 'recordFields.percentRange',
                  message: '{min, decimal} to {max, decimal} %',
                  values: { min: c.min, max: c.max },
                },
          ],
          numeric: true,
          ...(c.raw && { printed: c.raw }),
        }),
      ),
    },
    {
      title: recordLabels.thermochemistry,
      rows: t
        ? [
            {
              label: recordLabels.loadingDensity,
              text: `${t.loadingDensity.value} g/cm³`,
              numeric: true,
            },
            computed(recordLabels.flameTemperature, ' K', t.flameTemperature),
            computed(recordLabels.impetus, ' J/kg', t.impetus),
            computed(recordLabels.gamma, '', t.gamma),
            computed(recordLabels.molarMass, ' kg/kmol', t.molarMass),
            computed(recordLabels.covolume, ' m³/kg', t.covolume),
          ]
        : [],
    },
  ]
}

/** Interval to two significant digits, value to the same place, the interval also in percent (whole from 10 %); no-break spaces so it wraps only before the percent. */
export function intervalText(value: number, half: number | undefined): string {
  if (half === undefined || !(half > 0)) return `${value}`
  const digits = Math.max(0, 1 - Math.floor(Math.log10(half)))
  const percent = (100 * half) / Math.abs(value)
  return `${formatNumber(value, digits)}\u00a0±\u00a0${formatNumber(half, digits)} (±\u00a0${formatNumber(percent, percent >= 10 ? 0 : 1)}\u00a0%)`
}

const fittedNote = (k: number) => /*i18n*/ ({
  id: 'recordFields.fittedNote',
  message:
    'Fitted: plus and minus {k, decimal} standard uncertainties, a lower bound (the rows of one load table are correlated).',
  values: { k },
})

/** `ratio`: fitted over thermochemistry energy, with the median of powders that have one. */
export function fittedParameterRows(
  p: Powder,
  k: number,
  ratio?: { value: number; median?: number; powders?: number },
): FieldRow[] {
  const i = p.interior
  if (!i) return []
  const row = (
    label: MessageDescriptor,
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
      ? [row(recordLabels.vivacity, i.vivacity.value, i.vivacity.standardUncertainty, '1/s')]
      : []),
    // stored in J/kg
    ...(i.fitted.includes('energy')
      ? [
          row(
            recordLabels.energy,
            e.value / 1e6,
            e.standardUncertainty === undefined ? undefined : e.standardUncertainty / 1e6,
            'MJ/kg',
          ),
        ]
      : []),
    ...(i.fitted.includes('form.a')
      ? [
          {
            ...row(
              recordLabels.burnFormA,
              i.burnForm.a.value,
              i.burnForm.a.standardUncertainty,
              '',
            ),
            symbol: 'a',
          },
        ]
      : []),
    ...(ratio
      ? [
          {
            label: recordLabels.energyRatio,
            text: formatNumber(ratio.value, 2),
            numeric: true,
            method:
              ratio.median === undefined
                ? /*i18n*/ {
                    id: 'recordFields.energyRatioNote',
                    message:
                      'Fitted energy over thermochemistry energy (impetus over gamma minus 1). Below 1 is expected: the fit also carries the losses the model leaves out.',
                  }
                : /*i18n*/ {
                    id: 'recordFields.energyRatioMedianNote',
                    message:
                      'Fitted energy over thermochemistry energy (impetus over gamma minus 1); median of the {powders} powders with thermochemistry {median}. Below 1 is expected: the fit also carries the losses the model leaves out.',
                    values: { powders: ratio.powders ?? 0, median: formatNumber(ratio.median, 2) },
                  },
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
  const bar = (label: MessageDescriptor, s: QuantityValue | undefined): FieldRow[] =>
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
    { label: recordLabels.gamma, text: formatSignificant(i.gamma, 4), numeric: true },
    {
      label: recordLabels.covolume,
      value: { quantity: 'covolume', si: i.covolume.value, significantDigits: 3 },
    },
    // stored in g/cm³
    {
      label: recordLabels.solidDensity,
      value: { quantity: 'density', si: toSi('density', i.density.value), significantDigits: 3 },
    },
    ...bar(recordLabels.referencePressure, i.referencePressure),
    ...bar(recordLabels.ignitionPressure, i.ignitionPressure),
    ...(i.startPressure
      ? bar(recordLabels.startPressure, i.startPressure)
      : [
          {
            label: recordLabels.startPressure,
            text: 'per load row',
            words: [recordLabels.perLoadRow],
            method: recordLabels.startPressureNote,
          },
        ]),
    // stored in °C
    {
      label: recordLabels.propellantTemperature,
      value: { quantity: 'temperature', si: toSi('temperature', i.propellantTemperature.value) },
    },
    { label: recordLabels.pressureExponent, text: String(i.pressureExponent), numeric: true },
    ...(r
      ? bar(recordLabels.boreResistance, r.stress).map((row) => ({
          ...row,
          method: /*i18n*/ {
            id: 'recordFields.boreResistanceNote',
            message:
              'Stress; groove oversize {oversize, decimal} per percent, engraving {engraving, decimal} of the start pressure.',
            values: { oversize: r.oversize, engraving: r.engraving },
          },
        }))
      : []),
  ]
}

const burnFormLabels = {
  a: recordLabels.burnFormA,
  m: recordLabels.burnFormM,
  q: recordLabels.burnFormQ,
  z1: recordLabels.burnFormZ1,
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

/** Fitted values first, then fixed inputs and the burn form under the Fixed inputs filter. */
export function powderParameterGroups(
  p: Powder,
  k: number,
  ratio?: { value: number; median?: number; powders?: number },
): FieldGroup[] {
  return [
    {
      title: /*i18n*/ {
        id: 'recordFields.fittedGroup',
        message: 'Fitted (simulated, with {k, decimal} standard uncertainties)',
        values: { k },
      },
      filter: recordLabels.fittedFilter,
      rows: fittedParameterRows(p, k, ratio),
    },
    {
      title: recordLabels.fixedInputsGroup,
      filter: recordLabels.fixedInputsFilter,
      rows: modelInputRows(p),
    },
    // twoStage is the one burn form of the schema
    {
      title: recordLabels.burnFormGroup,
      filter: recordLabels.fixedInputsFilter,
      rows: burnFormRows(p),
    },
  ].filter((g) => g.rows.length > 0)
}

/** One value of a record's spec strip: a labeled row, in the viewer's unit where it is a quantity. */
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
  words?: LinguiWording
  row: FieldRow
}

const bcItem = (dragModel: string, rows: FieldRow[]): StripItem[] =>
  rows[0]
    ? [
        {
          icon: 'ballisticCoefficient',
          label: `BC ${dragModel}`,
          words: /*i18n*/ {
            id: 'recordFields.coefficient',
            message: 'BC {model}',
            values: { model: dragModel },
          },
          row: rows[0],
        },
      ]
    : []

/** A bullet's type for the strip: its tip and its base as words ("hollow-point, boat-tail"), what the record gives. */
const bulletType = (b: Bullet): FieldRow[] => {
  const parts = [b.tip?.type, b.base?.type].flatMap((x): string[] => (x ? [x] : []))
  return parts.length === 0
    ? []
    : [{ label: recordLabels.type, text: parts.join(', '), words: parts.map((p) => rawWording(p)) }]
}

export function bulletStrip(b: Bullet): StripItem[] {
  const bcs = b.ballisticCoefficients ?? []
  const shown = ['G1', 'G7'].flatMap((m) => {
    const c = bcs.find((x) => x.dragModel === m)
    return c ? [c] : []
  })
  const item = stripItem
  const sd = computedBulletRows(b).find((r) => r.value?.quantity === 'sectionalDensity')
  return [
    ...item('diameter', bulletLabels.diameter, length(bulletLabels.diameter, b.diameter)),
    ...item('mass', bulletLabels.mass, stored('mass', 'g')(bulletLabels.mass, b.mass)),
    ...item('length', bulletLabels.length, length(bulletLabels.length, b.length)),
    // the same icon: `FieldStrip` puts both in one card
    ...shown.flatMap((bc) =>
      bcItem(bc.dragModel, ballisticCoefficientRows({ ballisticCoefficients: [bc] })),
    ),
    ...item('sectionalDensity', recordLabels.sectionalDensity, sd ? [sd] : []),
    ...item('form', recordLabels.type, bulletType(b)),
  ]
}

/** A strip card: a label, in English as the plain text and as the message the language shown translates, over a row's value. */
const stripItem = (
  icon: StripItem['icon'],
  label: MessageDescriptor,
  rows: FieldRow[],
): StripItem[] =>
  rows[0] ? [{ icon, label: englishLingui._(label), words: label, row: rows[0] }] : []

/** The burn-rate position only when fitted. */
export function powderStrip(
  p: Powder,
  place?: { order: number; total: number },
  manufacturerName?: string,
): StripItem[] {
  return [
    ...stripItem(
      'manufacturer',
      recordLabels.manufacturer,
      text(recordLabels.manufacturer, manufacturerName || undefined),
    ),
    ...stripItem('form', recordLabels.form, word(recordLabels.form, p.grainForm, rawWording)),
    ...stripItem('base', recordLabels.base, word(recordLabels.base, p.propellantBase, rawWording)),
    ...(place
      ? stripItem('burnRate', recordLabels.burnRate, [
          {
            label: recordLabels.burnRate,
            text: `${place.order} of ${place.total}`,
            words: [
              /*i18n*/ {
                id: 'recordFields.burnRateOrder',
                message: '{order} of {total}',
                values: { order: place.order, total: place.total },
              },
            ],
            unit: '1 = fastest',
            unitWords: recordLabels.fastest,
          },
        ])
      : []),
    ...(p.interior
      ? stripItem('density', recordLabels.solidDensity, [
          {
            label: recordLabels.solidDensity,
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
      ? stripItem('bulkDensity', recordLabels.bulkDensity, [
          {
            label: recordLabels.bulkDensity,
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
          label: recordLabels.waterCapacity,
          value: { quantity: 'capacity', si: waterVolume(c.waterCapacity.value) },
          ...(c.waterCapacity.raw && { printed: c.waterCapacity.raw }),
        },
      ]
    : []

export function caseStrip(c: Case, manufacturerName?: string): StripItem[] {
  return [
    ...stripItem(
      'manufacturer',
      recordLabels.manufacturer,
      text(recordLabels.manufacturer, manufacturerName || undefined),
    ),
    ...stripItem(
      'material',
      recordLabels.material,
      word(recordLabels.material, c.material, titleWording, titleFromKebab(c.material)),
    ),
    ...stripItem('mass', bulletLabels.mass, stored('mass', 'g')(bulletLabels.mass, c.mass)),
    ...stripItem('capacity', recordLabels.waterCapacity, capacityRow(c)),
  ]
}

export function primerStrip(p: Primer, manufacturerName?: string): StripItem[] {
  return [
    ...stripItem(
      'manufacturer',
      recordLabels.manufacturer,
      text(recordLabels.manufacturer, manufacturerName || undefined),
    ),
    ...stripItem(
      'form',
      bulletLabels.size,
      word(bulletLabels.size, p.size, titleWording, titleFromKebab(p.size)),
    ),
    ...stripItem(
      'material',
      recordLabels.primingCompound,
      word(
        recordLabels.primingCompound,
        p.compound,
        titleWording,
        p.compound && titleFromKebab(p.compound),
      ),
    ),
  ]
}

/** Each as the source prints it; maker, size and compound are the cards of `primerStrip`. */
export function primerRowGroups(p: Primer): FieldGroup[] {
  return [
    {
      rows: [
        ...text(recordLabels.productNumber, p.productNumber),
        ...flag(recordLabels.magnum, p.magnum, true),
        ...word(
          recordLabels.cupMaterial,
          p.cup?.material,
          cupWording,
          p.cup?.material && titleFromKebab(p.cup.material),
        ),
        ...length(recordLabels.cupThickness, p.cup?.thickness),
        ...text(recordLabels.intendedUse, p.intendedUse),
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

/** Maker, material, mass and capacity are the cards of `caseStrip`. */
export function caseRowGroups(c: Case): FieldGroup[] {
  return [
    {
      rows: [
        ...text(recordLabels.productNumber, c.productNumber),
        ...text(recordLabels.headstamp, c.headstamp),
        ...(c.primerPocket
          ? [
              {
                label: recordLabels.primerPocket,
                text: pocketText(c.primerPocket),
                words: pocketWords(c.primerPocket),
              },
            ]
          : []),
        ...length(recordLabels.flashHole, c.flashHole),
        ...flag(recordLabels.annealed, c.annealed, true),
      ],
    },
  ]
}
