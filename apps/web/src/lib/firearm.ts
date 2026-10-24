import {
  type Firearm,
  firearm,
  type Optic,
  type OpticMount,
  type UserRecord,
} from '@openreloading/schema'
import type { FieldSpec } from './field-spec.ts'
import { formatNumber, formatQuantity, type UnitSystem, unitsOf, withUnit } from './units.ts'

export const firearmFields = [
  { key: 'barrelLength', label: 'Barrel length', quantity: 'barrelLength', min: 0 },
  { key: 'twist', label: 'Twist, length per turn', quantity: 'twist', min: 0 },
  { key: 'grooveDiameter', label: 'Groove diameter, measured', quantity: 'length', min: 0 },
  { key: 'boreDiameter', label: 'Bore diameter, measured', quantity: 'length', min: 0 },
  { key: 'freebore', label: 'Freebore', quantity: 'length', min: 0 },
  {
    key: 'baseToOgiveAtLands',
    label: 'Base to ogive at the lands, measured',
    help: 'Cartridge length to the bullet ogive with the bullet touching the lands.',
    quantity: 'length',
    min: 0,
  },
  { key: 'firearmMass', label: 'Mass', quantity: 'firearmMass', min: 0, positive: true },
  {
    key: 'roundCount',
    label: 'Round count',
    help: 'Rounds fired through the barrel so far.',
    quantity: 'ratio',
    min: 0,
    integer: true,
  },
] as const satisfies readonly FieldSpec[]

export const opticFields = [
  { key: 'clickValue', label: 'Click value', quantity: 'correction', min: 0, positive: true },
  { key: 'travel', label: 'Turret travel', quantity: 'correction', min: 0, positive: true },
  {
    key: 'minMagnification',
    label: 'Magnification, lowest',
    quantity: 'ratio',
    min: 0,
    positive: true,
  },
  {
    key: 'maxMagnification',
    label: 'Magnification, highest',
    quantity: 'ratio',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

export const mountFields = [
  {
    key: 'sightHeight',
    label: 'Sight height above the bore',
    quantity: 'length',
    required: true,
    min: 0,
  },
  {
    key: 'lateralOffset',
    label: 'Lateral offset',
    help: 'Optic center to the right of the bore; negative to the left.',
    quantity: 'length',
  },
  { key: 'cant', label: 'Cant', help: 'Clockwise as seen from behind.', quantity: 'angle' },
  {
    key: 'zeroRange',
    label: 'Zero range',
    quantity: 'range',
    required: true,
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

/** The zero air and the drag factor of a mount, all optional. */
export const zeroFields = [
  { key: 'zeroTemperature', label: 'Zero temperature', quantity: 'temperature' },
  {
    key: 'zeroPressure',
    label: 'Zero pressure',
    help: 'Absolute station pressure, not reduced to sea level.',
    quantity: 'airPressure',
    min: 0,
    positive: true,
  },
  { key: 'zeroHumidity', label: 'Zero humidity', quantity: 'percent', min: 0, max: 100 },
  {
    key: 'dragFactor',
    label: 'Drag factor',
    help: 'From truing: 100 % is the drag of the bullet as given.',
    quantity: 'dragFactor',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

const labels: Record<string, string> = {
  ...Object.fromEntries(
    [...firearmFields, ...opticFields, ...mountFields, ...zeroFields].map((s) => [s.key, s.label]),
  ),
  dragFactorSource: 'Drag factor source',
  mounted: 'Mounted on',
  removed: 'Removed on',
}

/** Zod issues of `firearm.safeParse(f)` in schema order, empty when valid. */
export const firearmIssues = (f: Firearm) => firearm.safeParse(f).error?.issues ?? []

/**
 * Why Save refuses a firearm, as a sentence with the field label and where it is; undefined when
 * the record is valid. `name` is the record name, which must not be empty.
 */
export function firearmProblem(name: string, f: Firearm): string | undefined {
  if (!name) return 'Enter a name.'
  const [issue] = firearmIssues(f)
  if (!issue) return
  const [list, i, , j] = issue.path
  let where = ''
  if (typeof i === 'number' && list === 'optics')
    where = ` in optic ${f.optics[i].name || f.optics[i].id}`
  if (typeof i === 'number' && list === 'configurations') {
    const c = f.configurations[i]
    where = ` in configuration ${c.name || c.id}${typeof j === 'number' ? `, mount ${j + 1}` : ''}`
  }
  const field = String(issue.path.findLast((p) => typeof p === 'string'))
  let reason = 'not valid'
  if (issue.code === 'custom') reason = issue.message[0].toLowerCase() + issue.message.slice(1)
  else if (issue.code === 'too_small' && issue.origin === 'number')
    reason = `must be ${issue.inclusive ? 'at least' : 'greater than'} ${issue.minimum}`
  else if (issue.code === 'too_big' && field === 'zeroHumidity') reason = 'must be from 0 to 100 %'
  else if (issue.code === 'invalid_type')
    reason = issue.expected === 'int' ? 'must be a whole number' : 'enter a number'
  return `${labels[field] ?? field}${where}: ${reason}.`
}

/** A new firearm: no optics or configurations yet. */
export const blankFirearm = (): Firearm => ({
  name: '',
  twistHand: 'right',
  optics: [],
  configurations: [],
})

/** The first `<prefix><n>` not in `taken`; optic and configuration ids are local to a firearm. */
export function freeId(prefix: string, taken: string[]) {
  for (let n = 1; ; n++) if (!taken.includes(`${prefix}${n}`)) return `${prefix}${n}`
}

/** What a choice fills in the Trajectory tab, SI. */
type SightFill = {
  sightHeight: number
  zeroRange: number
  /** The mounted optic's turret click, rad, with how the turrets are marked. */
  click?: { value: number; unit?: 'MOA' | 'mrad' }
  twist?: number
  twistHand: 'right' | 'left'
} & Pick<OpticMount, (typeof zeroFillKeys)[number]>

/** The mount values a choice fills beside sight height and zero range. */
export const zeroFillKeys = [
  'zeroTemperature',
  'zeroPressure',
  'zeroHumidity',
  'dragFactor',
  'dragFactorSource',
] as const

/**
 * Every mounted optic of the firearms among `records`, configuration by configuration, the active
 * configuration of each firearm first.
 */
function* mountedOptics(records: UserRecord[]) {
  for (const r of records) {
    if (r.kind !== 'firearm') continue
    const f = r.data
    const configs = [...f.configurations].sort(
      (a, b) => Number(b.id === f.active) - Number(a.id === f.active),
    )
    for (const c of configs) for (const [i, m] of c.mounts.entries()) yield { r, f, c, m, i }
  }
}

/** Option value and label of mount `i` of configuration `c`, with the optic named `optic`. */
const mountOption = (
  { r, f, c, i }: { r: UserRecord; f: Firearm; c: Firearm['configurations'][number]; i: number },
  optic: string,
) => ({
  value: `${r.id}/${c.id}/${i}`,
  label: `${r.name}, ${c.name}, ${optic}${c.id === f.active ? ' (active)' : ''}`,
})

/**
 * One option per mounted optic of every configuration of the firearms among `records`, the
 * active configuration of each firearm first.
 */
export function sightOptions(records: UserRecord[]) {
  return [...mountedOptics(records)].map((x) => {
    const optic = x.f.optics.find((o) => o.id === x.m.optic)
    return {
      ...mountOption(x, optic?.name ?? x.m.optic),
      fill: {
        sightHeight: x.m.sightHeight,
        zeroRange: x.m.zeroRange,
        ...(optic?.clickValue && { click: { value: optic.clickValue, unit: optic.clickUnit } }),
        ...Object.fromEntries(
          zeroFillKeys.flatMap((k) => (x.m[k] === undefined ? [] : [[k, x.m[k]]])),
        ),
        // a twist of 0 is no twist
        ...(x.f.twist && { twist: x.f.twist }),
        twistHand: x.f.twistHand,
      } as SightFill,
    }
  })
}

/**
 * Optics of the library with a click value, for the clicks to the point of aim: each
 * configuration's mounted optics, the active configuration first.
 */
export function clickOptions(records: UserRecord[]) {
  return [...mountedOptics(records)].flatMap((x) => {
    const o = x.f.optics.find((y) => y.id === x.m.optic)
    if (!o?.clickValue) return []
    return [{ ...mountOption(x, o.name), click: o.clickValue, unit: o.clickUnit }]
  })
}

/** The first optic with a click value of a firearm's active configuration (else its first). */
export function activeClick(r: UserRecord | undefined) {
  if (r?.kind !== 'firearm') return
  const c = r.data.active ?? r.data.configurations[0]?.id
  return clickOptions([r]).find((o) => o.value.startsWith(`${r.id}/${c}/`))
}

/** The twist as length per turn with its direction: "1:10.0 in, right". */
export const twistText = (f: Firearm, system: UnitSystem) =>
  f.twist ? `1:${withUnit('twist', system, f.twist)}, ${f.twistHand}` : undefined

/** An optic's click value in its turret marking, else in the units of `system`. */
export function clickText(o: Pick<Optic, 'clickValue' | 'clickUnit'>, system: UnitSystem) {
  if (!o.clickValue) return
  const unit =
    o.clickUnit === 'MOA'
      ? unitsOf.correction.MOA
      : o.clickUnit === 'mrad'
        ? unitsOf.correction.mrad
        : system.correction
  return `${formatNumber(unit.fromSi(o.clickValue), unit.decimals)} ${unit.symbol}`
}

/** The active configuration (else the first) at index `i`, its first mount and that mount's optic. */
function firstMount(f: Firearm) {
  const i = Math.max(
    0,
    f.configurations.findIndex((c) => c.id === f.active),
  )
  const config = f.configurations[i]
  const mount = config?.mounts[0]
  const optic = mount && f.optics.find((o) => o.id === mount.optic)
  return { i, config, mount, optic }
}

/**
 * The facts of a list card: barrel length and twist, and the first optic of the active
 * configuration (else the first) with its zero range.
 */
export function cardFacts(f: Firearm, system: UnitSystem) {
  const barrel = [
    f.barrelLength ? `${withUnit('barrelLength', system, f.barrelLength)} barrel` : undefined,
    twistText(f, system),
  ]
    .filter(Boolean)
    .join(', ')
  const { mount, optic } = firstMount(f)
  const sight = mount
    ? `${optic?.name || 'Optic'}, zero ${withUnit('range', system, mount.zeroRange)}`
    : undefined
  return { barrel: barrel || undefined, sight }
}

/**
 * The cells of a firearm's row in the library table, numbers in the units of `system` without
 * them. The optic and zero are those of the active configuration's first mount (else the first
 * configuration's), '' where nothing is entered.
 */
export function firearmCells(f: Firearm, system: UnitSystem) {
  const { i, config, mount, optic } = firstMount(f)
  return {
    barrel: f.barrelLength ? formatQuantity('barrelLength', system, f.barrelLength) : '',
    twist: f.twist ? formatQuantity('twist', system, f.twist) : '',
    hand: f.twist ? f.twistHand : '',
    optic: mount ? optic?.name || 'Optic' : '',
    zero: mount ? formatQuantity('range', system, mount.zeroRange) : '',
    configuration: config ? config.name || `Configuration ${i + 1}` : '',
  }
}
