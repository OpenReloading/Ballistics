import {
  type Bullet,
  parseRef,
  type SessionRecord,
  toSi,
  type UserRecord,
} from '@open-reloading/schema'
import { type Message, msg } from '../i18n/translate.ts'
import { bulletDrag } from './bullet.ts'
import { sightOptions } from './firearm.ts'
import { type ManufacturerNames, productLabel } from './manufacturers.ts'
import { sessionRef } from './measurements.ts'
import { shotFields, type TrajectoryResult, trajectoryResult } from './trajectory-input.ts'
import type { UnitSystem } from './units.ts'

type LoadRecord = Extract<UserRecord, { kind: 'load' }>
type Sight = ReturnType<typeof sightOptions>[number]['fill']

/** The muzzle velocity a card uses: the mean of the kept shots of one session, m/s. */
export type MeasuredVelocity = { value: number; shots: number; date?: string | undefined }

/** One saved load of a firearm: what its card needs, or why it gets none. */
export type CardPlan = { id: string; name: string } & (
  | { bullet: string; velocity: MeasuredVelocity; sight: Sight }
  | { reason: Message }
)

/**
 * The mean of the shots kept in the latest session of `load` (by date, an undated one oldest), over
 * its strings of the load as it is: no variation, or the load's own charge. Undefined without one.
 */
export function measuredVelocity(
  load: LoadRecord,
  sessions: ReadonlyMap<string, SessionRecord>,
): MeasuredVelocity | undefined {
  const ref = sessionRef(load.id)
  const charge = load.data.charge?.value
  const found = (load.data.sessions ?? []).flatMap((r) => sessions.get(r) ?? [])
  const latest = found.sort((a, b) => (a.data.date ?? '').localeCompare(b.data.date ?? ''))
  for (const s of latest.reverse()) {
    const kept = s.data.strings
      .filter((x) => x.load === undefined || x.load === ref)
      .filter(
        (x) =>
          !x.variation || (x.variation.kind === 'charge' && x.variation.value.value === charge),
      )
      .flatMap((x) => x.shots.filter((shot) => !shot.excluded))
    if (kept.length === 0) continue
    const sum = kept.reduce((total, shot) => total + toSi('velocity', shot.velocity.value), 0)
    return { value: sum / kept.length, shots: kept.length, date: s.data.date }
  }
}

/**
 * The saved loads of the firearm `firearmId` among `records`, by name, each with the catalogue
 * bullet, the measured velocity and the firearm's active sight its card is computed from, or the
 * reason it gets no card.
 */
export function firearmCardPlans(records: readonly UserRecord[], firearmId: string): CardPlan[] {
  const sessions = new Map(
    records.flatMap((r) => (r.kind === 'session' ? [[sessionRef(r.id), r] as const] : [])),
  )
  const firearm = records.filter((r) => r.kind === 'firearm' && r.id === firearmId)
  // the workbench's Trajectory tab takes the first mount of the active configuration
  const sight = sightOptions(firearm as UserRecord[])[0]?.fill
  return records
    .filter((r): r is LoadRecord => {
      if (r.kind !== 'load' || r.data.firearm === undefined) return false
      const target = parseRef(r.data.firearm)
      return target?.scope === 'user' && target.id === firearmId
    })
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((r): CardPlan => {
      const base = { id: r.id, name: r.name }
      const bullet = typeof r.data.bullet === 'string' ? parseRef(r.data.bullet) : undefined
      if (bullet?.scope !== 'catalogue')
        return { ...base, reason: msg('The bullet is not from the database.') }
      const velocity = measuredVelocity(r, sessions)
      if (!velocity) return { ...base, reason: msg('No chronograph session with shots.') }
      if (!sight) return { ...base, reason: msg('The firearm has no mounted optic.') }
      return { ...base, bullet: bullet.id, velocity, sight }
    })
}

/**
 * The SI inputs of a card as the Trajectory tab starts with them (its conditions and distances,
 * range defaults round in the shown range unit) with the load's velocity and the firearm's sight.
 */
function cardValues(velocity: number, sight: Sight, system: UnitSystem) {
  const values: Record<string, number | undefined> = Object.fromEntries(
    shotFields.map((s) => {
      const initial: number | undefined = 'initial' in s ? s.initial : undefined
      return [
        s.key,
        initial !== undefined && s.quantity === 'range' ? system.range.toSi(initial) : initial,
      ]
    }),
  )
  return {
    ...values,
    muzzleVelocity: velocity,
    sightHeight: sight.sightHeight,
    zeroRange: sight.zeroRange,
    twist: sight.twist,
    zeroTemperature: sight.zeroTemperature,
    zeroPressure: sight.zeroPressure,
    zeroHumidity: sight.zeroHumidity,
    dragFactor: sight.dragFactor,
  }
}

/** What `RangeCard` draws for one load. */
export type LoadCard = TrajectoryResult & {
  bulletText: string
  si: Record<string, number | undefined>
  manual: false
  dragSource?: string
  click?: NonNullable<Sight['click']>
}

/**
 * The range card of a planned load with its bullet record, as `RangeCard` takes it: the record's
 * G7 BC as the Trajectory tab starts with, else its G1. A message when the record's BC cannot be
 * used; throws the input and core errors of the computation.
 */
export function cardResult(
  plan: Extract<CardPlan, { bullet: string }>,
  record: Bullet,
  names: ManufacturerNames,
  system: UnitSystem,
): LoadCard | { reason: Message } {
  const g7 = bulletDrag(record, 'G7')
  const model = g7.kind === 'none' ? 'G1' : 'G7'
  const drag = g7.kind === 'none' ? bulletDrag(record, 'G1') : g7
  if (drag.kind === 'none') return { reason: msg('The bullet has no BC in the database.') }
  if (drag.kind === 'choose')
    return { reason: msg('The bullet has several BC values; choose one in the workbench.') }
  const { sight } = plan
  const si = cardValues(plan.velocity.value, sight, system)
  return {
    ...trajectoryResult(si, drag.projectile, sight.twistHand),
    bulletText: `${productLabel(record, names)}, ${model}`,
    si,
    manual: false,
    ...(sight.dragFactor !== undefined &&
      sight.dragFactorSource && { dragSource: sight.dragFactorSource }),
    ...(sight.click && { click: sight.click }),
  }
}
