import type { TrajectoryPoint } from '@open-reloading/ballistics'
import type { TargetFace } from '@open-reloading/schema'
import { toSi } from '@open-reloading/schema'
import type { HitIssue, ScoringZone } from '@open-reloading/shot-groups'
import { InputError } from '@open-reloading/statistics'
import { type Message, msg, type Translator } from '../i18n/translate.ts'
import { refusalText, translateMessage } from './core-messages.ts'
import { nth } from './nth.ts'

const hitWords = {
  distances: msg('distances must be positive'),
  'group-dispersion': msg('the group dispersion must be positive'),
  'speed-spread': msg('the speed spread must not be negative'),
  'speed-height': msg(
    'the height spread from the muzzle speed exceeds the vertical spread of the group',
  ),
  wind: msg('wind inputs must not be negative'),
  'range-uncertainty': msg('the range uncertainty must not be negative'),
  'semi-axes': msg('the semi-axes must be positive'),
  'standard-deviations': msg('the standard deviations must be positive'),
  offset: msg('the offset must be finite'),
  'hit-probability': msg('the hit probability must be between 0 and 1'),
  'wanted-probability': msg('the wanted probability must be between 0 and 1 exclusive'),
  zones: msg('a face needs at least one zone'),
} satisfies Record<HitIssue['code'], Message>

const isHitCode = (code: string): code is HitIssue['code'] => Object.hasOwn(hitWords, code)

/** Why the hit probability failed, in the language shown: its refusal, else the error's text. */
export function hitFailureText(e: unknown, t: Translator['t']): string {
  if (e instanceof InputError && e.issue && isHitCode(e.issue.code))
    return t(hitWords[e.issue.code])
  return translateMessage(refusalText(e), t)
}

/**
 * The scoring zones of a face for a hole of diameter `hole` m, outermost first: each ring grown by
 * the hole's radius, as `scoreShot` counts a touched ring. An oval ring keeps its height.
 */
export function faceZones(face: TargetFace, hole: number): ScoringZone[] {
  const g = hole / 2
  return face.rings.map((r) => ({
    halfWidth: toSi('length', r.diameter.value / 2) + g,
    halfHeight: toSi('length', (r.height ?? r.diameter).value / 2) + g,
    value: r.value,
  }))
}

/** What the trajectory says about the point of impact at one table range. */
export interface ImpactSensitivity {
  /** Lateral displacement per 1 m/s of crosswind, m. */
  perCrosswind: number
  /** Change of the height of impact per metre of range, m/m. */
  verticalPerMetre: number
}

/**
 * The sensitivities at `points[i]`: the windage hold per 1 m/s of crosswind (`windHold`, rad, one
 * per point) times the range, and the slope of the height over the neighbouring table points.
 * Undefined with fewer than two points.
 */
export function impactSensitivity(
  points: readonly TrajectoryPoint[],
  windHold: readonly number[],
  i: number,
): ImpactSensitivity | undefined {
  const at = points[i]
  if (points.length < 2 || !at) return undefined
  const a = nth(points, Math.max(0, i - 1))
  const b = nth(points, Math.min(points.length - 1, i + 1))
  return {
    perCrosswind: (windHold[i] ?? 0) * at.range,
    verticalPerMetre: (b.height - a.height) / (b.range - a.range),
  }
}
