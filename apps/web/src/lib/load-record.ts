/**
 * The workbench state as a `Load` of the schema and back. The state holds SI values, the load
 * stored units (`packages/schema/src/units.ts`); a value goes through `storedOf`, which rounds to
 * 12 significant digits, so saving what was opened gives the same load again.
 */
import {
  type AnalysisKey,
  analysisKinds,
  type Load,
  ladderStepKinds,
  toSi,
  type UserRecord,
  userRecord,
} from '@open-reloading/schema'
import { storedOf } from './firearm.ts'
import type { LadderDirection, RunnableLadderKind } from './seating-ladder.ts'
import { waterGrams } from './units.ts'

/** The workbench fields a load may override, by key; `charge` is the load's own. */
export const overrideKeys = Object.keys(analysisKinds) as AnalysisKey[]

const isOverrideKey = (key: string): key is AnalysisKey => key in analysisKinds

/** A field value still equal to `from`, within 1e-9 relative. */
const same = (from: number | undefined, si: number | undefined) =>
  from !== undefined && si !== undefined && Math.abs(si - from) <= 1e-9 * Math.abs(from)

/** What gives a field its value without the user typing it. All SI. */
export interface Givers {
  /** The powder record's model values, only while the load keeps a reference to that record. */
  origin?: Record<string, number>
  /** The bullet record's or design's mass, only while the load keeps a reference to it. */
  bulletMass?: number
  /** The Settings defaults and the fields still holding one. */
  defaults: Record<string, number | undefined>
  defaulted: ReadonlySet<string>
  /** The fields that follow a default, and the default each has now. */
  followed: ReadonlySet<string>
  suggestions: Record<string, number | undefined>
  /** The values the seating preview wrote and whether it can write them again. */
  previewed: Record<string, number | undefined>
  seatingKept: boolean
  /** The gun weight is the firearm's and the load keeps a reference to the firearm. */
  gunMass: boolean
}

/**
 * The keys of `values` the user did not type: a record, the Settings, a followed default, the
 * seating or the firearm gives them again when the load opens. The other keys are the typed ones.
 */
export function givenKeys(values: Record<string, number | undefined>, g: Givers) {
  const given = new Set<string>()
  for (const [key, si] of Object.entries(values)) {
    if (si === undefined) continue
    if (
      same(g.origin?.[key], si) ||
      (key === 'bulletMass' && same(g.bulletMass, si)) ||
      (g.defaulted.has(key) && same(g.defaults[key], si)) ||
      (g.followed.has(key) && same(g.suggestions[key], si)) ||
      (g.seatingKept && si === g.previewed[key]) ||
      (key === 'firearmMass' && g.gunMass)
    )
      given.add(key)
  }
  return given
}

/** The grams of a measured capacity as the schema stores it, rounded like every stored value. */
const gramsOf = (m3: number) => Number(waterGrams(m3).toPrecision(12))

/**
 * The id of the user capacity record that holds the measured capacity `m3` (water to the mouth,
 * m3) of `cartridge` (a reference): a version 8 UUID derived from both, so the same measurement
 * is one record and a changed value is a record of its own, which a load saved earlier keeps.
 */
export function measuredCapacityId(cartridge: string, m3: number): string {
  let [a, b, c, d] = [1779033703, 3144134277, 1013904242, 2773480762]
  for (const ch of `${cartridge}|${gramsOf(m3)}`) {
    const k = ch.codePointAt(0) ?? 0
    a = b ^ Math.imul(a ^ k, 597399067)
    b = c ^ Math.imul(b ^ k, 2869860233)
    c = d ^ Math.imul(c ^ k, 951274213)
    d = a ^ Math.imul(d ^ k, 2716044179)
  }
  const hex = [a, b, c, d]
    .map((w) => (Math.imul(w ^ (w >>> 15), 2246822507) >>> 0).toString(16).padStart(8, '0'))
    .join('')
  const variant = ((Number.parseInt(hex[16] ?? '0', 16) & 3) | 8).toString(16)
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-8${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

/** The reference a load keeps for the measured capacity `m3` of `cartridge`. */
export const measuredCapacityRef = (cartridge: string, m3: number) =>
  `user:${measuredCapacityId(cartridge, m3)}`

/**
 * The water capacity (g) of the stored record `raw` when it is a case capacity of `cartridge`
 * (a reference), else undefined: a record of another cartridge is no capacity of this load.
 */
export function capacityOfRecord(raw: unknown, cartridge: string): number | undefined {
  const r = userRecord.safeParse(raw)
  return r.success && r.data.kind === 'caseCapacity' && r.data.data.cartridge === cartridge
    ? r.data.data.waterCapacity.value
    : undefined
}

/**
 * The case capacity reference a load saves: the measured capacity's record, else the reference
 * asked for and not loaded, else the catalogue capacity chosen. A choice clears the request
 * (`got`), so it never stays behind a dangling `user:` reference.
 */
export function savedCapacityRef(
  measured: string | undefined,
  asked: string | undefined,
  chosen: string | undefined,
): string | undefined {
  return measured ?? asked ?? chosen
}

/** The user record of the measured capacity `m3` of `cartridge`, stored when the load is saved. */
export function capacityRecord(cartridge: string, m3: number, now: Date): UserRecord {
  const value = gramsOf(m3)
  return {
    kind: 'caseCapacity',
    id: measuredCapacityId(cartridge, m3),
    name: `Measured case capacity ${value} g water`,
    saved: now.toISOString(),
    data: { origin: 'user', cartridge, waterCapacity: { value } },
  }
}

/** What the workbench holds of a load, SI. */
export interface LoadParts {
  /** The value of each field; the solver values of `given` stay out of the load. */
  values: Record<string, number | undefined>
  given: ReadonlySet<string>
  cartridge?: string
  firearm?: string
  bullet?: string
  powder?: string
  notes: string
  /** The case capacity: a catalogue capacity, or the user record of the measured one. */
  capacity?: string
  /** m. */
  seating?: { by: 'overallLength' | 'baseToOgive'; value: number }
  ladder?: {
    kind: RunnableLadderKind
    stepCount: number
    /** In the SI unit of the kind: kg, m or K. */
    step?: number
    direction: LadderDirection
  }
  /** The chronograph sessions of the Measurements tab, as references. */
  sessions: readonly string[]
}

/** The load the workbench holds: only the typed solver values, the rest by reference. */
export function toLoad(p: LoadParts): Load {
  const overrides: Record<string, number> = {}
  for (const key of overrideKeys) {
    const si = p.values[key]
    if (si !== undefined && Number.isFinite(si) && !p.given.has(key))
      overrides[key] = storedOf(analysisKinds[key], si).value
  }
  const charge = p.values.charge
  const ladder = p.ladder
  return {
    origin: 'user',
    cartridge: p.cartridge,
    firearm: p.firearm,
    bullet: p.bullet,
    powder: p.powder,
    // a charge of 0 or less stays out: the schema would reject the load
    charge: charge !== undefined && charge > 0 ? storedOf('mass', charge) : undefined,
    capacity: p.capacity,
    seating: p.seating && { by: p.seating.by, value: storedOf('length', p.seating.value) },
    note: p.notes || undefined,
    analysis:
      Object.keys(overrides).length > 0 || ladder
        ? {
            ...(Object.keys(overrides).length > 0 && { overrides }),
            ...(ladder && {
              ladder: {
                // the charge is the default kind and stays out
                ...(ladder.kind !== 'charge' && { kind: ladder.kind }),
                stepCount: ladder.stepCount,
                // a step of 0 or less stays out: the schema would reject the load
                step:
                  ladder.step !== undefined && ladder.step > 0
                    ? storedOf(ladderStepKinds[ladder.kind], ladder.step).value
                    : undefined,
                direction: ladder.direction,
              } as NonNullable<NonNullable<Load['analysis']>['ladder']>,
            }),
          }
        : undefined,
    sessions: p.sessions.length > 0 ? [...p.sessions] : undefined,
  }
}

/** A load as the workbench fills itself from it. */
export interface OpenedLoad {
  /** The typed values and the options, SI, under the keys of the workbench link. */
  query: URLSearchParams
  /** The solver values the load carries; the fields without one follow their records. */
  typed: ReadonlySet<string>
  /** The references of the load's sessions. */
  sessions: string[]
}

/** The workbench state of `load`: a link's query, the typed keys and the session references. */
export function fromLoad(load: Load): OpenedLoad {
  const query = new URLSearchParams()
  const typed = new Set<string>()
  for (const [key, stored] of Object.entries(load.analysis?.overrides ?? {})) {
    if (stored === undefined || !isOverrideKey(key)) continue
    query.set(key, String(toSi(analysisKinds[key], stored)))
    typed.add(key)
  }
  if (load.charge) query.set('charge', String(toSi('mass', load.charge.value)))
  const ladder = load.analysis?.ladder
  if (ladder) {
    const kind = ladder.kind ?? 'charge'
    query.set('ladderSteps', String(ladder.stepCount))
    if (ladder.step !== undefined)
      query.set('ladderStep', String(toSi(ladderStepKinds[kind], ladder.step)))
    query.set('ladderDirection', ladder.direction)
    if (ladder.kind) query.set('ladderKind', ladder.kind)
  }
  if (load.seating) query.set(load.seating.by, String(toSi('length', load.seating.value.value)))
  return { query, typed, sessions: load.sessions ?? [] }
}
