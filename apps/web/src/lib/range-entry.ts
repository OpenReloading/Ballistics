import type { Load, SessionRecord, UserRecord } from '@open-reloading/schema'
import { chronoSession, fromSi, toSi, userRecord } from '@open-reloading/schema'
import { ambiguousMessage, parseNumber } from '../i18n/number.ts'
import { stringStats } from './string-stats.ts'
import { type Unit, type UnitSystem, withUnit } from './units.ts'

type SessionString = SessionRecord['data']['strings'][number]
type Conditions = NonNullable<SessionString['conditions']>

/** The source title of a session entered by hand. */
const rangeSource = 'Entered at the range'

/** The reason a shot excluded at the range carries. */
export const rangeExcluded = 'excluded at the range'

/** Largest velocity the range page accepts, m/s: a typo such as an extra digit is refused. */
const maxVelocity = 3000

/** One string of the range session: a rung of the load's ladder, or the load as it is. */
export interface RangeStep {
  /** Identifies the step across reloads: the charge to 0.1 mg, or `load` without a charge. */
  key: string
  /** The rung against the main charge: `0`, `+1`, `−2`; undefined without a ladder. */
  offset: number | undefined
  /** The charge of the step, g (stored unit); undefined when the load has none. */
  charge: number | undefined
}

/** The charge ladder of `load` as steps, lowest first; a load without a usable ladder has one step. */
export function rangeSteps(load: Load): RangeStep[] {
  const charge = load.charge?.value
  const key = (g: number | undefined) => (g === undefined ? 'load' : `charge:${g.toFixed(4)}`)
  const ladder = load.analysis?.ladder
  if (
    charge === undefined ||
    ladder === undefined ||
    (ladder.kind ?? 'charge') !== 'charge' ||
    ladder.step === undefined
  )
    return [{ key: key(charge), offset: charge === undefined ? undefined : 0, charge }]
  const { stepCount: n, step, direction } = ladder
  const offsets = Array.from({ length: n }, (_, i) =>
    direction === 'around' ? i - (n - 1) / 2 : direction === 'up' ? i : -i,
  ).sort((a, b) => a - b)
  return offsets.map((k) => {
    const g = Number((charge + k * step).toFixed(4))
    return { key: key(g), offset: k, charge: g }
  })
}

/** The local calendar day of `now`, ISO 8601. */
export const localDate = (now: Date) =>
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

const fnv = (text: string, seed: number) => {
  let h = seed
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0
  return h.toString(16).padStart(8, '0')
}

/**
 * The id of the range session of `loadRef` on `date`: derived from both, so every tab and every
 * reload that enters shots for that load that day writes the one record. A UUID of the shape
 * `userId` takes; four FNV-1a hashes with different seeds, not a secret.
 */
export function rangeSessionId(loadRef: string, date: string) {
  const text = `range:${loadRef}:${date}`
  const [a = '', b = '', c = '', d = ''] = [2166136261, 3339675911, 1013904223, 1664525].map((x) =>
    fnv(text, x),
  )
  return `${a}-${b.slice(0, 4)}-8${b.slice(5, 8)}-a${c.slice(1, 4)}-${c.slice(4)}${d}`
}

/** The index of the string of `step` in `session`, -1 when none was entered. */
export const stringIndex = (session: SessionRecord | undefined, step: RangeStep) =>
  session?.data.strings.findIndex((s) =>
    step.charge === undefined
      ? s.variation === undefined
      : s.variation?.kind === 'charge' && s.variation.value.value.toFixed(4) === step.key.slice(7),
  ) ?? -1

/** What a change of the range session needs to create it. */
export interface RangeContext {
  id: string
  name: string
  loadRef: string
  now: Date
}

/**
 * A change of one string of the range session: `edit` applied to the string of `step`, a new one
 * when none exists. The returned function takes the stored record as written (undefined when
 * absent) and gives the record to store, so the store applies it to what is stored at that moment.
 * It throws for a stored record that is not a session of this load: that record is left alone.
 */
const changeString =
  (context: RangeContext, step: RangeStep, edit: (s: SessionString | undefined) => SessionString) =>
  (stored: unknown): SessionRecord => {
    const found = stored === undefined ? undefined : userRecord.safeParse(stored)
    if (found && !(found.success && found.data.kind === 'session'))
      throw new Error('The stored record of this session is not a valid session.')
    const base: SessionRecord =
      found?.data.kind === 'session'
        ? found.data
        : {
            kind: 'session',
            id: context.id,
            name: context.name,
            saved: '',
            data: {
              origin: 'user',
              date: localDate(context.now),
              device: { kind: 'other' },
              strings: [],
              provenance: { kind: 'measured', sources: [{ title: rangeSource }] },
            },
          }
    const at = stringIndex(base, step)
    const strings = [...base.data.strings]
    const made = edit(at < 0 ? undefined : strings[at])
    if (at < 0) strings.push(made)
    else strings[at] = made
    // never a record the schema rejects: it would block every later change of this session
    return {
      ...base,
      saved: context.now.toISOString(),
      data: chronoSession.parse({ ...base.data, strings }),
    }
  }

/** A new string of `step` for `loadRef` holding `shots`. */
const freshString = (
  loadRef: string,
  step: RangeStep,
  shots: SessionString['shots'],
): SessionString => ({
  load: loadRef,
  ...(step.offset !== undefined && {
    label: step.offset === 0 ? 'Main charge' : `Step ${signed(step.offset)}`,
  }),
  ...(step.charge !== undefined && {
    variation: { kind: 'charge' as const, value: { value: step.charge } },
  }),
  shots,
})

/** `+1` or `−1` (minus sign U+2212). */
const signed = (k: number) => `${k > 0 ? '+' : '−'}${Math.abs(k)}`

/** The change that appends a shot of `velocity` m/s, with the weather and note typed so far for a new string. */
export const addShot = (
  context: RangeContext,
  step: RangeStep,
  velocity: number,
  typed: { conditions?: Conditions | undefined; note?: string | undefined } = {},
) =>
  changeString(context, step, (s) => {
    const shots = [...(s?.shots ?? []), { velocity: { value: velocity } }]
    return s
      ? { ...s, shots }
      : {
          ...freshString(context.loadRef, step, shots),
          ...(typed.conditions && { conditions: typed.conditions }),
          ...(typed.note && { note: typed.note }),
        }
  })

/** The change that marks shot `index` as excluded, or takes the mark off. A missing shot changes nothing. */
export const setExcluded = (
  context: RangeContext,
  step: RangeStep,
  index: number,
  excluded: boolean,
) =>
  changeString(context, step, (s) => {
    if (!s || index < 0 || index >= s.shots.length) throw new RangeError('No such shot.')
    return {
      ...s,
      shots: s.shots.map((shot, i) => {
        if (i !== index) return shot
        const { excluded: _, ...rest } = shot
        return excluded ? { ...rest, excluded: rangeExcluded } : rest
      }),
    }
  })

/** The change that sets the weather of a string (a field left out is removed) and its note. */
export const setNotes = (
  context: RangeContext,
  step: RangeStep,
  fields: { conditions: Conditions; note: string },
) =>
  changeString(context, step, (s) => {
    if (!s) throw new RangeError('The string has no shot yet.')
    const { conditions: _c, note: _n, ...rest } = s
    return {
      ...rest,
      ...(Object.keys(fields.conditions).length > 0 && { conditions: fields.conditions }),
      ...(fields.note && { note: fields.note }),
    }
  })

/** The statistics of a string over its shots that are not excluded; undefined when none is left. */
export const rangeStats = (s: SessionString | undefined) => s && stringStats(s.shots)

/**
 * A velocity typed as text, in the unit `toSi` converts from: m/s, or the reason it is refused.
 * Either decimal mark is accepted ({@link parseNumber}).
 */
export function parseVelocity(
  text: string,
  toSi: (x: number) => number,
): { velocity: number } | { error: string } {
  const p = parseNumber(text)
  if (p.kind === 'ambiguous') return { error: ambiguousMessage(p) }
  if (p.kind !== 'number' || p.value <= 0)
    return { error: 'Enter the velocity as a number above zero.' }
  const si = toSi(p.value)
  return si > maxVelocity ? { error: 'That is too fast for a velocity.' } : { velocity: si }
}

/**
 * The references a Save of a load writes: the ones it holds (`current`) and those another tab
 * stored since it was opened (`stored` not in `opened`), such as a session the range page added.
 * A reference it removed after opening (in `opened`, not in `current`) stays removed.
 */
export const mergeSessionRefs = (
  stored: readonly string[],
  opened: readonly string[],
  current: readonly string[],
) => [...current, ...stored.filter((r) => !opened.includes(r) && !current.includes(r))]

/**
 * `record`, a load about to be saved, with the sessions the stored copy `stored` gained since the
 * load was opened with `opened`; the same record when there are none.
 */
export function withStoredSessions(
  record: UserRecord,
  stored: UserRecord | undefined,
  opened: readonly string[],
): UserRecord {
  if (record.kind !== 'load') return record
  const refs =
    stored?.kind === 'load' && Array.isArray(stored.data.sessions) ? stored.data.sessions : []
  const own = record.data.sessions ?? []
  const merged = mergeSessionRefs(refs, opened, own)
  if (merged.length === own.length) return record
  // the snapshots of the sessions added go with them
  const snapshots = (stored?.kind === 'load' ? (stored.data.snapshots ?? []) : []).filter(
    (x) => merged.includes(x.session) && !own.includes(x.session),
  )
  return {
    ...record,
    data: {
      ...record.data,
      sessions: merged,
      ...(snapshots.length > 0 && { snapshots: [...(record.data.snapshots ?? []), ...snapshots] }),
    },
  }
}

/** The weather fields as typed, in the units shown. */
export interface WeatherText {
  temperature: string
  pressure: string
  wind: string
}

/**
 * The weather typed for a string as stored values; an empty field is left out. The first field that
 * is not a number, or is out of range (pressure above zero, wind not negative), gives its reason.
 */
export function parseWeather(
  text: WeatherText,
  units: { temperature: Unit; airPressure: Unit; windSpeed: Unit },
): { conditions: Conditions } | { error: string } {
  const conditions: Conditions = {}
  const read = (typed: string, name: string, valid: (x: number) => boolean) => {
    const p = parseNumber(typed)
    if (p.kind === 'empty') return
    return p.kind === 'number' && valid(p.value) ? p.value : name
  }
  const temperature = read(text.temperature, 'temperature', () => true)
  const pressure = read(text.pressure, 'air pressure', (x) => x > 0)
  const wind = read(text.wind, 'wind speed', (x) => x >= 0)
  for (const [x, name] of [
    [temperature, 'temperature'],
    [pressure, 'air pressure'],
    [wind, 'wind speed'],
  ] as const)
    if (typeof x === 'string') return { error: `Enter the ${name} as a number.` }
  if (typeof temperature === 'number')
    conditions.airTemperature = {
      value: fromSi('temperature', units.temperature.toSi(temperature)),
    }
  if (typeof pressure === 'number')
    conditions.stationPressure = { value: fromSi('pressure', units.airPressure.toSi(pressure)) }
  if (typeof wind === 'number')
    conditions.windSpeed = { value: fromSi('velocity', units.windSpeed.toSi(wind)) }
  return { conditions }
}

/** The weather of a string as one line in the units shown, `''` without any. */
export function conditionsText(c: Conditions | undefined, system: UnitSystem) {
  return [
    c?.airTemperature &&
      `air ${withUnit('temperature', system, toSi('temperature', c.airTemperature.value))}`,
    c?.stationPressure &&
      `${withUnit('airPressure', system, toSi('pressure', c.stationPressure.value))}`,
    c?.windSpeed && `wind ${withUnit('windSpeed', system, toSi('velocity', c.windSpeed.value))}`,
  ]
    .filter((x) => x)
    .join(', ')
}

/** Sessions a load names at most (`Load.sessions`, and as many snapshots). */
const maxSessions = 50

const lot = (text: string | undefined) => text?.trim() || undefined

/**
 * The stored load `record` naming the session `ref`, with the snapshot of the load as it is now (its
 * lots, seating and `roundCount` of the firearm) so the session does not read later changes of
 * the load. undefined when it names the session already; throws for a record that is not a load
 * and for a load at its limit of sessions.
 */
export function withSession(
  record: UserRecord,
  ref: string,
  roundCount: number | undefined,
  now: Date,
): UserRecord | undefined {
  if (record.kind !== 'load') throw new Error('The stored load is not a valid load.')
  const d = record.data
  const sessions = d.sessions ?? []
  if (sessions.includes(ref)) return undefined
  if (sessions.length >= maxSessions)
    throw new Error(`A load keeps ${maxSessions} sessions at most.`)
  const lots = {
    powderLot: lot(d.powderLot),
    primerLot: lot(d.primer?.lot),
    caseLot: lot(d.case?.lot),
  }
  const snapshot = {
    session: ref,
    ...Object.fromEntries(Object.entries(lots).filter(([, v]) => v !== undefined)),
    ...(d.seating && { seating: d.seating }),
    ...(roundCount !== undefined && { roundCount }),
  }
  return userRecord.parse({
    ...record,
    saved: now.toISOString(),
    data: {
      ...d,
      sessions: [...sessions, ref],
      snapshots: [...(d.snapshots ?? []).filter((x) => x.session !== ref), snapshot],
    },
  })
}
