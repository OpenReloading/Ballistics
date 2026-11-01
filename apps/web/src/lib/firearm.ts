import {
  type CompetitionEvent,
  type Firearm,
  firearm,
  fromSi,
  type OpticMount,
  parseRef,
  type QuantityKind,
  type QuantityValue,
  toSi,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import { formatNumber, untranslated } from '../i18n/number.ts'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { localDay } from './dates.ts'
import type { FieldSpec } from './field-spec.ts'
import { nth } from './nth.ts'
import { formatQuantity, type Quantity, type UnitSystem, unitsOf, withUnit } from './units.ts'

export const firearmFields = [
  { key: 'barrelLength', label: msg('Barrel length'), quantity: 'barrelLength', min: 0 },
  { key: 'twist', label: msg('Twist, length per turn'), quantity: 'twist', min: 0 },
  { key: 'grooveDiameter', label: msg('Groove diameter, measured'), quantity: 'length', min: 0 },
  { key: 'boreDiameter', label: msg('Bore diameter, measured'), quantity: 'length', min: 0 },
  { key: 'freebore', label: msg('Freebore'), quantity: 'length', min: 0 },
  {
    key: 'baseToOgiveAtLands',
    label: msg('Base to ogive at the lands'),
    help: msg(
      'Base to ogive at the lands, measured: cartridge length to the bullet ogive with the bullet touching the lands.',
    ),
    quantity: 'length',
    min: 0,
  },
  {
    key: 'overallLengthAtLands',
    label: msg('Overall length at the lands'),
    help: msg(
      'Overall length at the lands, measured: cartridge overall length with the bullet touching the lands.',
    ),
    quantity: 'length',
    min: 0,
  },
  { key: 'firearmMass', label: msg('Mass'), quantity: 'firearmMass', min: 0, positive: true },
  {
    key: 'roundCount',
    label: msg('Round count'),
    help: msg('Rounds fired through the barrel so far.'),
    quantity: 'ratio',
    min: 0,
    integer: true,
  },
  {
    key: 'noteAtRoundCount',
    label: msg('Note at round count'),
    help: msg('A saved load shot from this firearm gets a note when a session passes this count.'),
    quantity: 'ratio',
    min: 0,
    positive: true,
    integer: true,
  },
] as const satisfies readonly FieldSpec[]

export const opticFields = [
  { key: 'clickValue', label: msg('Click value'), quantity: 'correction', min: 0, positive: true },
  { key: 'travel', label: msg('Turret travel'), quantity: 'correction', min: 0, positive: true },
  {
    key: 'minMagnification',
    label: msg('Magnification, lowest'),
    quantity: 'ratio',
    min: 0,
    positive: true,
  },
  {
    key: 'maxMagnification',
    label: msg('Magnification, highest'),
    quantity: 'ratio',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

export const mountFields = [
  {
    key: 'sightHeight',
    label: msg('Sight height above the bore'),
    quantity: 'length',
    required: true,
    min: 0,
  },
  {
    key: 'lateralOffset',
    label: msg('Lateral offset'),
    help: msg('Optic center to the right of the bore; negative to the left.'),
    quantity: 'length',
  },
  { key: 'cant', label: msg('Cant'), help: 'Clockwise as seen from behind.', quantity: 'angle' },
  {
    key: 'zeroRange',
    label: msg('Zero range'),
    quantity: 'range',
    required: true,
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

/** The zero air and the drag factor of a mount, all optional. */
export const zeroFields = [
  { key: 'zeroTemperature', label: msg('Zero temperature'), quantity: 'temperature' },
  {
    key: 'zeroPressure',
    label: msg('Zero pressure'),
    help: msg('Absolute station pressure, not reduced to sea level.'),
    quantity: 'airPressure',
    min: 0,
    positive: true,
  },
  { key: 'zeroHumidity', label: msg('Zero humidity'), quantity: 'percent', min: 0, max: 100 },
  {
    key: 'dragFactor',
    label: msg('Drag factor'),
    help: msg('From truing: 100 % is the drag of the bullet as given.'),
    quantity: 'dragFactor',
    min: 0,
    positive: true,
  },
] as const satisfies readonly FieldSpec[]

const labels: Record<string, Message> = {
  ...Object.fromEntries(
    [...firearmFields, ...opticFields, ...mountFields, ...zeroFields].map((s) => [s.key, s.label]),
  ),
  landsBullet: msg('Bullet of the lands contact'),
  dragFactorSource: msg('Drag factor source'),
  mounted: msg('Mounted on'),
  removed: msg('Removed on'),
}

/** Zod issues of `firearm.safeParse(f)` in schema order, empty when valid. */
export const firearmIssues = (f: Firearm) => firearm.safeParse(f).error?.issues ?? []

/**
 * Why Save refuses a firearm, as a sentence with the field label and where it is; undefined when
 * the record is valid. `name` is the record name, which must not be empty.
 */
export function firearmProblem(
  name: string,
  f: Firearm,
  t: Translator['t'] = untranslated(),
): string | undefined {
  if (!name) return t('Enter a name.')
  const [issue] = firearmIssues(f)
  if (!issue) return
  // a stored quantity is `{ value }`: the field is the key above it
  const field = String(issue.path.findLast((p) => typeof p === 'string' && p !== 'value'))
  const values = {
    field: labels[field] ? t(labels[field]) : field,
    where: issueWhere(f, issue.path, t),
    reason: issueReason(issue, field, t),
  }
  return values.where ? t('{field} {where}: {reason}.', values) : t('{field}: {reason}.', values)
}

/** The schema's own refusals of a firearm, by their text, as messages the catalogue holds. */
const schemaMessages: Record<string, Message> = {
  'Below the lowest magnification': msg('Below the lowest magnification'),
  'Before the mount date': msg('Before the mount date'),
  'Duplicate id': msg('Duplicate id'),
  'Name the bullet the lands contact was measured with': msg(
    'Name the bullet the lands contact was measured with',
  ),
  'Not an optic of this firearm': msg('Not an optic of this firearm'),
  'Not a configuration of this firearm': msg('Not a configuration of this firearm'),
}

/** A refusal of the schema in the language of `t`; a text the table lacks stays as it is. */
export const schemaMessage = (text: string, t: Translator['t'] = untranslated()) => {
  const known = schemaMessages[text]
  return known ? t(known) : text
}

type FirearmIssue = ReturnType<typeof firearmIssues>[number]

/** Where in the record an issue is: the optic or configuration (and mount) it names, else nothing. */
function issueWhere(f: Firearm, path: FirearmIssue['path'], t: Translator['t']): string {
  const [list, i, , j] = path
  if (typeof i !== 'number') return ''
  if (list === 'optics') {
    const optic = nth(f.optics, i)
    return t('in optic {name}', { name: optic.name || optic.id })
  }
  if (list !== 'configurations') return ''
  const c = nth(f.configurations, i)
  const name = c.name || c.id
  return typeof j === 'number'
    ? t('in configuration {name}, mount {n}', { name, n: j + 1 })
    : t('in configuration {name}', { name })
}

function issueReason(issue: FirearmIssue, field: string, t: Translator['t']): string {
  if (issue.code === 'custom') {
    const said = schemaMessage(issue.message, t)
    // English reads the refusal after a colon in lower case; a translation keeps its own case
    return said === issue.message ? said.charAt(0).toLowerCase() + said.slice(1) : said
  }
  if (issue.code === 'too_small' && field === 'zeroTemperature')
    return t('must be above absolute zero')
  if (issue.code === 'too_small' && issue.origin === 'number')
    return issue.inclusive
      ? t('must be at least {min}', { min: Number(issue.minimum) })
      : t('must be greater than {min}', { min: Number(issue.minimum) })
  if (issue.code === 'too_big' && field === 'zeroHumidity') return t('must be from 0 to 100 %')
  if (issue.code === 'invalid_type')
    return issue.expected === 'int' ? t('must be a whole number') : t('enter a number')
  return t('not valid')
}

/** A stored quantity in SI, undefined without one. */
export const siOf = (kind: QuantityKind, q: QuantityValue | undefined) =>
  q === undefined ? undefined : toSi(kind, q.value)

/** An SI value as the stored quantity of `kind`, without the noise of the unit round trip. */
export const storedOf = (kind: QuantityKind, si: number): QuantityValue => ({
  value: Number(fromSi(kind, si).toPrecision(12)),
})

/** The stored kind of each form quantity a firearm field holds; the others are plain numbers. */
const storedKinds: Partial<Record<Quantity, QuantityKind>> = {
  barrelLength: 'length',
  twist: 'length',
  length: 'length',
  range: 'length',
  firearmMass: 'mass',
  mass: 'mass',
  correction: 'angle',
  angle: 'angle',
  temperature: 'temperature',
  airPressure: 'pressure',
  percent: 'relativeHumidity',
}

/** A firearm field's value in SI: a stored quantity converted, a plain number as it is. */
export function fieldSi(spec: { quantity: Quantity }, v: number | QuantityValue | undefined) {
  if (v === undefined) return
  const kind = storedKinds[spec.quantity]
  return typeof v === 'number' || !kind ? (v as number) : toSi(kind, v.value)
}

/** An SI field value as the record stores it: a quantity in its stored unit, or the plain number. */
export function fieldStored(spec: { quantity: Quantity }, si: number | undefined) {
  const kind = storedKinds[spec.quantity]
  return si === undefined || !kind ? si : storedOf(kind, si)
}

/** A firearm's measured lands contact, m: the bullet reference it was measured with and the lengths. */
export interface LandsContact {
  bullet: string
  baseToOgive?: number | undefined
  overallLength?: number | undefined
}

/** The lands contact of a firearm; undefined without a measured length and the bullet it names. */
export function landsOf(f: Firearm): LandsContact | undefined {
  const [baseToOgive, overallLength] = [
    siOf('length', f.baseToOgiveAtLands),
    siOf('length', f.overallLengthAtLands),
  ]
  if (f.landsBullet === undefined || (baseToOgive === undefined && overallLength === undefined))
    return undefined
  return { bullet: f.landsBullet, baseToOgive, overallLength }
}

/**
 * The lands contact for the bullet in use: `contact` when it was measured with that bullet, else
 * `other` says a contact exists for another bullet, which the jump does not use.
 */
export function landsFor(lands: LandsContact | undefined, bulletRef: string | undefined) {
  const same = lands !== undefined && lands.bullet === bulletRef
  return { contact: same ? lands : undefined, other: lands !== undefined && !same }
}

/**
 * What a firearm gives the workbench: twist, barrel length, measured bore and groove diameter and
 * freebore (m), mass (kg) and lands contact.
 */
export const gunValues = (f: Firearm) => ({
  twist: siOf('length', f.twist),
  barrelLength: siOf('length', f.barrelLength),
  boreDiameter: siOf('length', f.boreDiameter),
  grooveDiameter: siOf('length', f.grooveDiameter),
  freebore: siOf('length', f.freebore),
  firearmMass: siOf('mass', f.firearmMass),
  lands: landsOf(f),
})

/** A firearm of the Gun chooser: its name, barrel length and twist (m). */
export interface FirearmRow {
  id: string
  name: string
  barrelLength?: number | undefined
  twist?: number | undefined
}

const firearmRow = (id: string, name: string, f: Firearm): FirearmRow => ({
  id,
  name,
  barrelLength: siOf('length', f.barrelLength),
  twist: siOf('length', f.twist),
})

/**
 * The workbench's Gun picker: the browser's firearms, then the built-in example rifle, which is
 * never stored, so a fresh browser still has one to choose.
 */
export const gunPicker = (
  stored: readonly { id: string; name: string; data: Firearm }[],
  example: { id: string; name: string; data: Record<string, unknown> },
  t: Translator['t'],
) => ({
  rows: [
    ...stored.map((f) => firearmRow(f.id, f.name, f.data)),
    // the example rifle's data is a firearm (`example-data.ts`)
    firearmRow(example.id, t('{name} (example)', { name: example.name }), example.data as Firearm),
  ],
  placeholder: stored.length
    ? t('Choose a firearm')
    : t('No firearm saved yet. Pick the example rifle, or add yours under Firearms.'),
})

/** The catalogue record id a cartridge reference names; undefined for a `user:` reference. */
export const catalogueCartridgeId = (ref: string | undefined) => {
  const parsed = ref === undefined ? undefined : parseRef(ref)
  return parsed?.scope === 'catalogue' ? parsed.id : undefined
}

/**
 * The entries `countedSessions` holds at most (the schema's limit): a shooting log entry has no
 * snapshot to fall back on, so a dropped one would offer its rounds again (#928).
 */
const maxCountedSessions = 5000

/** A new firearm: no optics or configurations yet. */
export const blankFirearm = (): Firearm => ({
  origin: 'user',
  name: '',
  twistHand: 'right',
  optics: [],
  configurations: [],
})

/**
 * `p` over `f`: a changed round count is dated to the local day of `now`, a cleared one loses its
 * date, and any other edit keeps the date, so it tells how old the count is, not the record.
 */
export function firearmPatch(f: Firearm, p: Partial<Firearm>, now = new Date()): Firearm {
  const next = { ...f, ...p }
  if (!('roundCount' in p) || p.roundCount === f.roundCount) return next
  return { ...next, roundCountDate: p.roundCount === undefined ? undefined : localDay(now) }
}

/**
 * The rounds of the session `session` (`shots` shots, its snapshot recorded the count `base`) that
 * the count of `f` does not hold yet: the shots minus the rounds counted for the session, or for a
 * session without an entry in `countedSessions` all its shots unless the count is at least
 * `base + shots` already. 0 without a count, or without a base and an entry.
 */
export function roundsDue(f: Firearm, session: string, base: number | undefined, shots: number) {
  if (f.roundCount === undefined) return 0
  const counted = f.countedSessions?.find((c) => c.session === session)?.rounds
  if (counted !== undefined) return Math.max(0, shots - counted)
  return base === undefined || f.roundCount >= base + shots ? 0 : shots
}

/**
 * The stored firearm `record` with `n` rounds added to its count for the session `session`, dated
 * through `firearmPatch`, and the rounds counted for the session in `countedSessions` (the oldest
 * entry dropped at the limit). undefined, leaving the record, when it is no firearm or
 * {@link roundsDue} is 0 (the session was added, here or in another tab).
 */
export function withSessionRounds(
  record: UserRecord,
  session: string,
  base: number | undefined,
  shots: number,
  n: number,
  now = new Date(),
): UserRecord | undefined {
  if (record.kind !== 'firearm' || n < 1) return undefined
  if (roundsDue(record.data, session, base, shots) < 1) return undefined
  return withCountedRounds(record, session, n, now)
}

/** The firearm `record` with `n` rounds added for `key` in `countedSessions`, the oldest entry dropped at the limit. */
function withCountedRounds(
  record: Extract<UserRecord, { kind: 'firearm' }>,
  key: string,
  n: number,
  now: Date,
): UserRecord | undefined {
  const f = record.data
  if (f.roundCount === undefined) return undefined
  const entries = f.countedSessions ?? []
  const counted = entries.find((c) => c.session === key)?.rounds ?? 0
  const countedSessions = [
    ...entries.filter((c) => c.session !== key),
    { session: key, rounds: counted + n },
  ].slice(-maxCountedSessions)
  return userRecord.parse({
    ...record,
    saved: now.toISOString(),
    data: { ...firearmPatch(f, { roundCount: f.roundCount + n }, now), countedSessions },
  })
}

/**
 * The rounds a competition event adds to a firearm's count: its `rounds`, else the shots of its
 * ring series when every series lists them; undefined when neither tells.
 */
export function eventRounds(e: CompetitionEvent): number | undefined {
  if (e.rounds !== undefined) return e.rounds
  if (e.results.method !== 'rings' || e.results.series.length === 0) return undefined
  let shots = 0
  for (const s of e.results.series) {
    if (!s.shots) return undefined
    shots += s.shots.length
  }
  return shots
}

/**
 * The rounds of the event `event` (its reference, `user:<id>`, with `rounds` rounds) that the
 * count of `f` does not hold yet: the rounds less those counted for the event before. 0 without a
 * count. The event shares `countedSessions` with the sessions, so it is counted once (#633).
 */
export function eventRoundsDue(f: Firearm, event: string, rounds: number) {
  if (f.roundCount === undefined) return 0
  const counted = f.countedSessions?.find((c) => c.session === event)?.rounds ?? 0
  return Math.max(0, rounds - counted)
}

/**
 * The stored firearm `record` with `n` of the event's rounds added to its count, through the same
 * one-confirm flow as a session's rounds. undefined, leaving the record, when it is no firearm or
 * {@link eventRoundsDue} is 0.
 */
export function withEventRounds(
  record: UserRecord,
  event: string,
  rounds: number,
  n: number,
  now = new Date(),
): UserRecord | undefined {
  if (record.kind !== 'firearm' || n < 1) return undefined
  const due = eventRoundsDue(record.data, event, rounds)
  return due < 1 ? undefined : withCountedRounds(record, event, Math.min(n, due), now)
}

/** The first `<prefix><n>` not in `taken`; optic and configuration ids are local to a firearm. */
export function freeId(prefix: string, taken: string[]) {
  for (let n = 1; ; n++) if (!taken.includes(`${prefix}${n}`)) return `${prefix}${n}`
}

/** What a choice fills in the Trajectory tab, SI. */
type SightFill = {
  sightHeight: number
  zeroRange: number
  /** The mounted optic's turret click, rad, with how the turrets are marked. */
  click?: { value: number; unit?: 'MOA' | 'mrad' | undefined }
  twist?: number
  twistHand: 'right' | 'left'
  /** The zero air: K, Pa and a fraction. */
  zeroTemperature?: number
  zeroPressure?: number
  zeroHumidity?: number
  dragFactor?: number
  dragFactorSource?: string
}

/** The mount's zero air in the stored kind of each. */
const zeroAirKinds = {
  zeroTemperature: 'temperature',
  zeroPressure: 'pressure',
  zeroHumidity: 'relativeHumidity',
} as const satisfies Partial<Record<keyof OpticMount, QuantityKind>>

/** The mount's zero air, drag factor and its source, as {@link SightFill} holds them. */
export function zeroFill(m: OpticMount): Partial<SightFill> {
  return {
    ...Object.fromEntries(
      Object.entries(zeroAirKinds).flatMap(([k, kind]) => {
        const q = m[k as keyof typeof zeroAirKinds]
        return q === undefined ? [] : [[k, toSi(kind, q.value)]]
      }),
    ),
    ...(m.dragFactor !== undefined && { dragFactor: m.dragFactor }),
    ...(m.dragFactorSource !== undefined && { dragFactorSource: m.dragFactorSource }),
  }
}

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
  t: Translator['t'],
) => ({
  value: `${r.id}/${c.id}/${i}`,
  label:
    c.id === f.active
      ? t('{record}, {configuration}, {optic} (active)', {
          record: r.name,
          configuration: c.name,
          optic,
        })
      : `${r.name}, ${c.name}, ${optic}`,
})

/**
 * One option per mounted optic of every configuration of the firearms among `records`, the
 * active configuration of each firearm first.
 */
export function sightOptions(records: UserRecord[], t: Translator['t'] = untranslated()) {
  return [...mountedOptics(records)].map((x) => {
    const optic = x.f.optics.find((o) => o.id === x.m.optic)
    return {
      ...mountOption(x, optic?.name ?? x.m.optic, t),
      fill: {
        sightHeight: toSi('length', x.m.sightHeight.value),
        zeroRange: toSi('length', x.m.zeroRange.value),
        ...(optic?.clickValue && {
          click: { value: toSi('angle', optic.clickValue.value), unit: optic.clickUnit },
        }),
        ...zeroFill(x.m),
        // a twist of 0 is no twist
        ...(x.f.twist?.value && { twist: toSi('length', x.f.twist.value) }),
        twistHand: x.f.twistHand,
      } satisfies SightFill as SightFill,
    }
  })
}

/**
 * The Trajectory tab's sight choice: the sights of the browser's firearms, then those of the
 * built-in example rifle, which is never stored, and the label of the empty choice.
 */
export function sightPicker(records: UserRecord[], example: UserRecord, t: Translator['t']) {
  return {
    options: [
      ...sightOptions(records, t),
      ...sightOptions([example], t).map((o) => ({
        ...o,
        label: t('{name} (example)', { name: o.label }),
      })),
    ],
    none: records.some((r) => r.kind === 'firearm')
      ? t('None')
      : t('No firearm saved yet. Pick the example rifle, or add yours under Firearms.'),
  }
}

/**
 * Optics of the library with a click value, for the clicks to the point of aim: each
 * configuration's mounted optics, the active configuration first.
 */
export function clickOptions(records: UserRecord[], t: Translator['t'] = untranslated()) {
  return [...mountedOptics(records)].flatMap((x) => {
    const o = x.f.optics.find((y) => y.id === x.m.optic)
    if (!o?.clickValue) return []
    return [
      { ...mountOption(x, o.name, t), click: toSi('angle', o.clickValue.value), unit: o.clickUnit },
    ]
  })
}

/** The first optic with a click value of a firearm's active configuration (else its first). */
export function activeClick(r: UserRecord | undefined) {
  if (r?.kind !== 'firearm') return
  const c = r.data.active ?? r.data.configurations[0]?.id
  return clickOptions([r]).find((o) => o.value.startsWith(`${r.id}/${c}/`))
}

/** The twist as length per turn with its direction: "1:10.0 in, right". */
export const twistText = (f: Firearm, system: UnitSystem, t: Translator['t'] = untranslated()) =>
  f.twist?.value
    ? t('1:{twist}, {hand}', {
        twist: withUnit('twist', system, toSi('length', f.twist.value)),
        hand: f.twistHand === 'left' ? t('left') : t('right'),
      })
    : undefined

/** A click value (rad) in the turret marking `clickUnit`, else in the units of `system`. */
export function clickText(
  o: { clickValue?: number | undefined; clickUnit?: 'MOA' | 'mrad' | undefined },
  system: UnitSystem,
) {
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
export function cardFacts(f: Firearm, system: UnitSystem, t: Translator['t']) {
  const barrel = [
    f.barrelLength?.value
      ? t('{length} barrel', {
          length: withUnit('barrelLength', system, toSi('length', f.barrelLength.value)),
        })
      : undefined,
    f.twist?.value
      ? t('1:{twist}, {hand}', {
          twist: withUnit('twist', system, toSi('length', f.twist.value)),
          hand: f.twistHand === 'left' ? t('left') : t('right'),
        })
      : undefined,
  ]
    .filter(Boolean)
    .join(', ')
  const { mount, optic } = firstMount(f)
  const sight = mount
    ? t('{optic}, zero {range}', {
        optic: optic?.name || t('Optic'),
        range: withUnit('range', system, toSi('length', mount.zeroRange.value)),
      })
    : undefined
  return { barrel: barrel || undefined, sight }
}

/**
 * The cells of a firearm's row in the library table, numbers in the units of `system` without
 * them. The optic and zero are those of the active configuration's first mount (else the first
 * configuration's), '' where nothing is entered.
 */
export function firearmCells(f: Firearm, system: UnitSystem, t: Translator['t']) {
  const { i, config, mount, optic } = firstMount(f)
  return {
    barrel: f.barrelLength?.value
      ? formatQuantity('barrelLength', system, toSi('length', f.barrelLength.value))
      : '',
    twist: f.twist?.value ? formatQuantity('twist', system, toSi('length', f.twist.value)) : '',
    hand: f.twist?.value ? f.twistHand : '',
    optic: mount ? optic?.name || t('Optic') : '',
    zero: mount ? formatQuantity('range', system, toSi('length', mount.zeroRange.value)) : '',
    configuration: config ? config.name || t('Configuration {n}', { n: i + 1 }) : '',
  }
}
