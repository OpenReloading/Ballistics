import {
  type BulletDimensions,
  estimateIntrusion,
  intrusion,
} from '@open-reloading/drawing/seating'
import type { Bullet } from '@open-reloading/schema'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { classOf, type DensityClass, effectiveDensity } from './bullet-construction.ts'
import type { Suggestion } from './input-defaults.ts'

/** Why the bullet is not seated: the record has no length or diameter, its outline is refused, the cartridge has no case length, CBTO needs a base-to-ogive, no seating is entered. */
export type Unseated = 'dimensions' | 'outline' | 'chamber' | 'cbto' | 'seating'

/**
 * The bullet volume below the mouth of a bullet that is not seated, m³: with its interval and what
 * it rests on (`from`: the record's length, or its mass with a density; `coal`: the COAL entered or
 * L6 of the cartridge), or refused naming what is missing (English, for `t`).
 */
export type BelowMouth =
  | {
      kind: 'estimate'
      volume: number
      low: number
      high: number
      from: 'length' | DensityClass
      coal: 'entered' | 'L6'
      because: Unseated
    }
  | { kind: 'refused'; missing: Message[]; because: Unseated }

const cm3 = 1e-6

/** The first thing that keeps a chosen bullet from being seated. */
export function unseatedBecause(o: {
  /** The record gives a shape (a length and a diameter). */
  shaped: boolean
  /** The outline of that shape is refused. */
  refused: boolean
  /** The cartridge gives a case length. */
  chamber: boolean
  /** CBTO is chosen and the bullet has no base-to-ogive. */
  cbto: boolean
}): Unseated {
  if (!o.shaped) return 'dimensions'
  if (o.refused) return 'outline'
  if (!o.chamber) return 'chamber'
  return o.cbto ? 'cbto' : 'seating'
}

const becauseText: Record<Unseated, Message> = {
  dimensions: msg('the bullet has no length or diameter'),
  outline: msg('the bullet outline is refused'),
  chamber: msg('the cartridge has no case length'),
  cbto: msg('CBTO is chosen and the bullet has no base-to-ogive'),
  seating: msg('no seating length is entered'),
}

const coalText = { entered: msg('the COAL entered'), L6: msg('L6 of the cartridge') }

/**
 * The volume default of a bullet that is not seated: the capacity less the estimated bullet volume
 * below the mouth, approximate, with the interval of the volume behind the bullet in its source;
 * none where the bullet volume is refused or leaves nothing. A seated bullet (no `unseated`)
 * leaves the capacity as it is.
 */
export function lessBullet(
  capacity: Suggestion | undefined,
  unseated: BelowMouth | undefined,
  show: { text: (si: number) => string; unit: string },
  t: Translator['t'],
): Suggestion | undefined {
  if (!capacity || !unseated) return capacity
  if (unseated.kind === 'refused') return undefined
  const si = capacity.si - unseated.volume
  const [low, high] = [capacity.si - unseated.high, capacity.si - unseated.low]
  if (!(low > 0)) return undefined
  const [coal, because] = [t(coalText[unseated.coal]), t(becauseText[unseated.because])]
  const basis =
    unseated.from === 'length'
      ? t('Seated at {coal}, because {because}.', { coal, because })
      : t(
          'Length from diameter and mass with the effective density of the class {class}, seated at {coal}, because {because}.',
          { class: t(effectiveDensity[unseated.from].name), coal, because },
        )
  return {
    si,
    approximate: true,
    halfWidth: Math.max(si - low, high - si) / si,
    source: `${t(
      '{capacity}, less the bullet volume below the mouth, estimated at {volume} {unit}: approximate, interval {low} to {high} {unit}.',
      {
        capacity: capacity.source,
        volume: show.text(unseated.volume),
        unit: show.unit,
        low: show.text(low),
        high: show.text(high),
      },
    )} ${basis}`,
  }
}

/**
 * The volume the bullet takes below the mouth when it is not seated
 * (`apps/docs/docs/models/case-capacity.md`, "Bullet without a seated outline"), at the COAL
 * entered, else at the cartridge's maximum overall length L6. With the `shape` of the record (its
 * outline is built, only the seating is missing) from that outline; else from its diameter (the
 * record, typed, or the cartridge's groove diameter Z), mass and the effective density of its construction class.
 */
export function belowMouth(a: {
  /** The record with the typed values in place. */
  record: Partial<Bullet>
  /** The shape of the record in mm, when its outline is built. */
  shape: BulletDimensions | undefined
  /** The cartridge's groove diameter Z, mm. */
  groove: number | undefined
  /** The cartridge's case length L3 and maximum overall length L6, mm; none without an L3. */
  chamber: { caseLength: number; cartridgeL6?: number | undefined } | undefined
  /** The COAL entered, mm. */
  coal: number | undefined
  because: Unseated
}): BelowMouth {
  const { record, shape, chamber, because } = a
  const diameter = shape?.diameter ?? record.diameter?.value ?? a.groove
  const mass = record.mass?.value
  const coal = a.coal ?? chamber?.cartridgeL6
  const missing = [
    ...(diameter === undefined ? [msg('bullet diameter')] : []),
    ...(mass === undefined && !shape ? [msg('bullet mass')] : []),
    ...(chamber === undefined ? [msg('case length L3')] : []),
    ...(chamber && coal === undefined ? [msg('overall length COAL or L6')] : []),
  ]
  if (missing.length > 0 || !chamber || coal === undefined)
    return { kind: 'refused', missing, because }
  const basis = { because, coal: a.coal === undefined ? ('L6' as const) : ('entered' as const) }
  if (shape) {
    const e = intrusion({
      bullet: shape,
      caseLength: chamber.caseLength,
      coal,
      lengthSource: 'measured',
    })
    return {
      kind: 'estimate',
      volume: e.volume.value * cm3,
      low: e.low * cm3,
      high: e.high * cm3,
      from: 'length',
      ...basis,
    }
  }
  const density = classOf(record.construction)
  const e = estimateIntrusion({
    diameter: diameter as number,
    mass: mass as number,
    density: effectiveDensity[density],
    caseLength: chamber.caseLength,
    coal,
  })
  return {
    kind: 'estimate',
    volume: e.volume.value * cm3,
    low: e.low * cm3,
    high: e.high * cm3,
    from: density,
    ...basis,
  }
}
