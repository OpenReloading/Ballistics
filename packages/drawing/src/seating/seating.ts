import {
  assumedBelow,
  type BulletDimensions,
  bulletOutline,
  type Outline,
  revolutionVolume,
  type Tag,
} from '../bullet/outline.ts'
import { deg } from '../core/units.ts'
import type { SeatingValues } from './chamber.ts'

export {
  assumedBoatTailAngle,
  type BulletDimensions,
  bulletOutline,
  revolutionVolume,
} from '../bullet/outline.ts'

/** A computed value with the tag that tells where it comes from. */
export interface Tagged {
  value: number
  /**
   * `entered`: typed or slid by the user; `sourced`: taken from a record as stored; `derived`:
   * computed from those; `approximate`: resting on an assumed shape.
   */
  tag: Tag
}

/**
 * Where the bullet's diameter d meets the leade, from the head: chamber L3 + s + (G1 - d) / 2 /
 * tan(i). Without s the leade starts at L3 + G - (G1 - F) / 2 / tan(i), as the outline draws it.
 * Own derivation, not a CIP value and not checked against a measurement.
 */
export function leadeContact(
  ch: SeatingValues,
  d: number,
): { z: number; note?: string } | { missing: string[] } | { none: string } {
  const { chamberL3: L3, G1, F, leadeEnd: G, leadeStart: s, leadeAngle: i } = ch
  const missing = [
    ...(L3 === undefined ? ['L3'] : []),
    ...(G1 === undefined ? ['G1'] : []),
    ...(F === undefined ? ['F'] : []),
    ...(s === undefined && G === undefined ? ['s or G'] : []),
    ...(i === undefined || !(i > 0 && i < 90) ? ['i'] : []),
  ]
  if (missing.length) return { missing }
  // `missing` names every one of them that is undefined
  const [l3, g1, f, angle] = [L3, G1, F, i] as [number, number, number, number]
  const t = Math.tan(angle * deg)
  if (d <= f)
    return { none: `The bullet diameter ${d} mm is not above F ${f} mm: no land contact.` }
  const start = l3 + (s ?? (G as number) - (g1 - f) / 2 / t)
  if (d >= g1)
    return {
      z: start,
      note: `The bullet diameter ${d} mm is not below G1 ${g1} mm: contact taken at the leade start.`,
    }
  return { z: start + (g1 - d) / 2 / t }
}

/**
 * Input of `seat`: bullet dimensions, chamber and case values, water capacity (g), water density
 * (g/cm³), barrel length (mm) and the seating length entered as COAL or CBTO (mm).
 */
interface SeatInput {
  bullet: BulletDimensions
  chamber: SeatingValues
  /** Water capacity, g. */
  waterCapacity?: number
  /** Water density, g/cm³: turns the water capacity into a volume (the caller passes core's value). */
  waterDensity: number
  /** Barrel length from the breech face, mm. */
  barrelLength?: number
  by: { kind: 'overallLength' | 'baseToOgive'; value: number }
}

/** The seated bullet: its outline, lengths, volumes and jump, each with its tag, and notes. */
export interface Seating {
  outline: Outline
  /** z of the bullet base from the head, mm. */
  basePosition: number
  /** Cartridge overall length (COAL), mm. */
  coal: Tagged
  /** Cartridge base to ogive (CBTO), mm; none without the bullet base-to-ogive. */
  cbto?: Tagged
  /** Seating depth: case length (cartridge L3) less the base position, mm. */
  depth: Tagged
  /** Case volume to the mouth and volume behind the bullet, cm³. */
  caseVolume?: Tagged
  volumeBehindBullet?: Tagged
  travel?: Tagged
  /** Leade contact from the head, approximate. */
  leade?: number
  /** COAL at which the jump is 0. */
  contactCoal?: number
  /** Value undefined where a jump cannot be given; missing names what a derived value lacks. */
  jump: { value?: number; tag: 'derived' | 'approximate'; missing: string[] }
  /** The bullet touches the lands: a jump of 0 or less. */
  contact: boolean
  /** COAL above the CIP maximum L6. */
  aboveL6: boolean
  notes: string[]
}

/**
 * The bullet seated by COAL (base = COAL - length) or by CBTO (base = CBTO - bullet
 * base-to-ogive): seating depth = case length (cartridge L3) - base; volume behind the bullet =
 * water capacity / water density - the bullet volume below the mouth; travel = barrel - base;
 * jump = leade contact - (base + length - nose length).
 */
export function seat({
  bullet,
  chamber,
  waterCapacity,
  waterDensity,
  barrelLength,
  by,
}: SeatInput): Seating {
  const outline = bulletOutline(bullet)
  if ('reason' in outline) throw new RangeError(outline.reason)
  const notes = [...outline.notes]
  const { base, coal, cbto } = seatLengths(bullet, by)
  const depthValue = chamber.caseLength - base
  if (depthValue < 0) notes.push('The bullet base is in front of the case mouth: not seated.')
  if (depthValue > bullet.length) notes.push('The whole bullet is below the case mouth.')
  const cut = Math.min(Math.max(depthValue, 0), bullet.length)
  const { caseVolume, volume } = seatVolumes(outline, cut, waterCapacity, waterDensity)
  const byCbto = by.kind === 'baseToOgive'
  const contact = landContact(chamber, bullet, outline, byCbto)
  notes.push(...contact.notes)
  const { leade, missing } = contact
  const canJump = leade !== undefined && !outline.noseAssumed
  const jumpValue = canJump ? leade - (base + bullet.length - outline.noseLength) : undefined
  return {
    outline,
    basePosition: base,
    coal,
    ...(cbto && { cbto }),
    depth: { value: depthValue, tag: 'derived' },
    ...(caseVolume && { caseVolume, volumeBehindBullet: volume }),
    ...(barrelLength !== undefined && {
      travel: { value: barrelLength - base, tag: 'derived' as const },
    }),
    ...(leade !== undefined && { leade }),
    ...(canJump && { contactCoal: leade + outline.noseLength }),
    jump: { value: jumpValue, tag: byCbto ? 'derived' : 'approximate', missing },
    contact: jumpValue !== undefined && jumpValue <= 0,
    aboveL6: chamber.cartridgeL6 !== undefined && coal.value > chamber.cartridgeL6 + 1e-9,
    notes,
  }
}

/** The bullet base position from the head, COAL and CBTO for the length entered, mm. */
function seatLengths(bullet: BulletDimensions, by: SeatInput['by']) {
  const bto = bullet.baseToOgive
  if (by.kind === 'baseToOgive' && bto === undefined)
    throw new RangeError('CBTO needs the bullet base-to-ogive')
  const base = by.kind === 'overallLength' ? by.value - bullet.length : by.value - (bto as number)
  const coal: Tagged = {
    value: base + bullet.length,
    tag: by.kind === 'overallLength' ? 'entered' : 'derived',
  }
  const cbto: Tagged | undefined =
    bto === undefined
      ? undefined
      : { value: base + bto, tag: by.kind === 'baseToOgive' ? 'entered' : 'derived' }
  return { base, coal, cbto }
}

/**
 * Case volume and volume behind the bullet, cm³, with the bullet `cut` mm below the mouth;
 * none without a water capacity.
 */
function seatVolumes(
  outline: Outline,
  cut: number,
  water: number | undefined,
  waterDensity: number,
) {
  const caseVolume: Tagged | undefined =
    water === undefined ? undefined : { value: water / waterDensity, tag: 'derived' }
  const volume: Tagged | undefined = caseVolume && {
    value: caseVolume.value - revolutionVolume(outline.points, cut) / 1000,
    tag: assumedBelow(outline, cut) ? 'approximate' : 'derived',
  }
  return { caseVolume, volume }
}

/**
 * The leade contact of the bullet from the head, what a derived jump lacks, and the notes on the
 * contact.
 */
function landContact(
  chamber: SeatingValues,
  bullet: BulletDimensions,
  outline: Outline,
  byCbto: boolean,
) {
  const notes: string[] = []
  const contactAt = leadeContact(chamber, bullet.diameter)
  if ('note' in contactAt && contactAt.note) notes.push(contactAt.note)
  if ('none' in contactAt) notes.push(contactAt.none)
  const leade = 'z' in contactAt ? contactAt.z : undefined
  // Without land contact no input gives a jump, so nothing is named as missing.
  const missing =
    byCbto || 'none' in contactAt
      ? []
      : [
          'a measured CBTO',
          ...(bullet.baseToOgive === undefined ? ['the bullet base-to-ogive'] : []),
        ]
  if (outline.noseAssumed && !('none' in contactAt)) missing.push('the bullet nose length')
  if ('missing' in contactAt) missing.push(`chamber ${contactAt.missing.join(', ')}`)
  return { leade, missing, notes }
}

/**
 * Assumed bullet length uncertainty, mm: `measured` absolute, `estimated` relative to the length.
 * Unverified assumptions without a source; the estimated one follows an input finding.
 */
export const bulletLengthTolerance = Object.freeze({ measured: 0.05, estimated: 0.15 })

/**
 * Input of `intrusion`: bullet dimensions, case length to the mouth (mm), cartridge overall length
 * COAL (mm) and whether the bullet length is measured or estimated.
 */
interface IntrusionInput {
  bullet: BulletDimensions
  /** Case length to the mouth, mm: the water capacity is taken to the mouth. */
  caseLength: number
  coal: number
  /** Required, so no length counts as measured by default. */
  lengthSource: 'measured' | 'estimated'
}

/** The bullet volume below the case mouth with bounds from the length tolerance. */
interface Intrusion {
  /** Seating depth, mm. */
  depth: number
  /** Bullet volume below the case mouth, cm³. */
  volume: Tagged
  /** Bounds of `volume` for the length tolerance of the source, cm³. */
  low: number
  high: number
  notes: string[]
}

/**
 * The bullet volume inside the case (`apps/docs/docs/models/case-capacity.md`, "Bullet volume below the mouth"): base = COAL -
 * length, so at fixed COAL a length error dL moves the depth by dL and the volume by at most
 * pi d^2 / 4 dL, which gives the bounds (the lower one
 * clamped at 0).
 */
export function intrusion({ bullet, caseLength, coal, lengthSource }: IntrusionInput): Intrusion {
  const outline = bulletOutline(bullet)
  if ('reason' in outline) throw new RangeError(outline.reason)
  const notes = [...outline.notes]
  const depth = caseLength - (coal - bullet.length)
  if (depth < 0) notes.push('The bullet base is in front of the case mouth: not seated.')
  if (depth > bullet.length) notes.push('The whole bullet is below the case mouth.')
  const cut = Math.min(Math.max(depth, 0), bullet.length)
  const estimated = lengthSource === 'estimated'
  if (estimated) notes.push('The bullet length is estimated: measure it for the volume.')
  const assumed = assumedBelow(outline, cut)
  const value = revolutionVolume(outline.points, cut) / 1000
  const dL = estimated
    ? bulletLengthTolerance.estimated * bullet.length
    : bulletLengthTolerance.measured
  const band = ((Math.PI / 4) * bullet.diameter ** 2 * dL) / 1000
  return {
    depth,
    volume: { value, tag: estimated || assumed ? 'approximate' : 'derived' },
    low: Math.max(value - band, 0),
    high: value + band,
    notes,
  }
}

/** The basis line of the jump row: what is missing first when no jump can be given. */
export function jumpNote(jump: Seating['jump']): string {
  if (jump.value === undefined)
    return jump.missing.length
      ? `not given: missing ${jump.missing.join(', ')}`
      : 'not given: the bullet does not reach the lands (see the notes)'
  return jump.tag === 'derived'
    ? 'derived: from the entered CBTO and the bullet base-to-ogive against the CIP minimum chamber, assuming the same comparator'
    : `approximate: from COAL and the bullet length; missing: ${jump.missing.join(', ')}`
}

/**
 * Slider range of COAL, mm: from a quarter of the bullet out of the case to a tenth of the bullet
 * length past the larger of L6 and the COAL of leade contact (mouth plus bullet length without L6).
 */
export function coalRange(
  chamber: SeatingValues,
  bullet: BulletDimensions,
  contactCoal?: number,
): [number, number] {
  const lo = chamber.caseLength + 0.25 * bullet.length
  const top = Math.max(chamber.cartridgeL6 ?? chamber.caseLength + bullet.length, contactCoal ?? 0)
  return [Math.floor(lo * 10) / 10, Math.ceil((top + 0.1 * bullet.length) * 10) / 10]
}
