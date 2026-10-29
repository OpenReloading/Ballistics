/**
 * Chronograph strings to ladder points of the powder fit: the mean of each string, weighted by the
 * pooled standard deviation of all shots about their string means over the root of the string's
 * shot count, `apps/docs/docs/models/interior-powder-fit.md`, "Strings and their weights".
 * Velocities in m/s, charges in kg.
 */

import { need } from '../errors.ts'
import { velocityStatistics } from '../groups/velocity-statistics.ts'
import type { LadderPoint } from './fit.ts'

/** One chronograph string: the shot velocities of one charge and the other values of its ladder point. */
export interface ChronographString extends Omit<LadderPoint, 'muzzleVelocity' | 'velocitySigma'> {
  /** Velocities of the shots, m/s; at least one. */
  velocities: readonly number[]
}

/**
 * Pooled sample standard deviation of the shots about their string means, m/s:
 * sqrt(sum (n - 1) s^2 / sum (n - 1)) over the strings of n >= 2 shots; `undefined` when no string
 * has 2 shots.
 */
export function pooledVelocitySd(strings: readonly ChronographString[]): number | undefined {
  let squares = 0
  let dof = 0
  for (const { velocities } of strings) {
    const sd = velocityStatistics(velocities)?.standardDeviation
    if (sd === undefined) continue
    squares += (velocities.length - 1) * sd ** 2
    dof += velocities.length - 1
  }
  return dof === 0 ? undefined : Math.sqrt(squares / dof)
}

/**
 * Ladder points of the strings in input order: the string mean as `muzzleVelocity` and the pooled
 * standard deviation over the root of the string's shot count as `velocitySigma`. Without a pooled
 * value above 0 the points carry no `velocitySigma`, and `fitPowder` fits them unweighted.
 */
export function stringLadder(strings: readonly ChronographString[]): LadderPoint[] {
  need(
    strings.every((s) => s.velocities.length > 0),
    'every string needs at least one velocity',
  )
  const sd = pooledVelocitySd(strings)
  return strings.map(({ velocities, ...point }) => ({
    ...point,
    muzzleVelocity: velocities.reduce((a, x) => a + x, 0) / velocities.length,
    ...(sd !== undefined && sd > 0 ? { velocitySigma: sd / Math.sqrt(velocities.length) } : {}),
  }))
}
