/**
 * Powder fit over chronograph sessions that differ in barrel length or powder temperature, with
 * the parameters the sessions do not resolve held at their input values,
 * `apps/docs/docs/models/interior-powder-fit.md`, "Several barrel lengths and temperatures". SI in
 * and out.
 */

import { need, nth } from '../errors.ts'
import {
  fitPowder,
  type LadderPoint,
  type PowderFit,
  PowderFitError,
  type PowderFitOptions,
  type PowderFitReason,
  type PowderParameter,
} from './fit.ts'
import type { InteriorLoad } from './model.ts'

/** One chronograph session: a ladder fired from one barrel at one powder temperature. */
export interface PowderSession {
  /** Projectile travel to the muzzle of the barrel fired, m; default the load's. */
  barrelLength?: number | undefined
  /** Propellant temperature of the session, K; default the load's. */
  propellantTemperature?: number | undefined
  /** The session's charges with their mean velocities and optional peak pressures. */
  ladder: readonly LadderPoint[]
}

/** A requested parameter that the sessions did not resolve: not fitted, its input value kept. */
export interface HeldPowderParameter {
  /** Which parameter. */
  name: PowderParameter
  /** Why the fit gave it up: the reason of the failure that named it. */
  reason: Extract<PowderFitReason, 'underdetermined' | 'unresolved' | 'ill-conditioned'>
}

/** Result of `fitPowderSessions`: the fit of the parameters the sessions resolved. */
export interface PowderSessionsFit extends PowderFit {
  /** The parameters that were fitted, in the order of the fit's `parameters`. */
  resolved: PowderParameter[]
  /** The requested parameters that were not: they keep the value of the input load. */
  held: HeldPowderParameter[]
}

/** The parameter to give up after `error`, never the burn coefficient; undefined where none is left. */
function giveUp(error: PowderFitError, parameters: readonly PowderParameter[]) {
  const open = parameters.flatMap((name, k) => (name === 'burnRate' ? [] : [k]))
  const named =
    error.reason === 'unresolved'
      ? open.find((k) => error.unresolved?.includes(k))
      : error.reason === 'ill-conditioned'
        ? // the direction the sessions leave open: the one the most weight of it lies on
          open.reduce<number | undefined>(
            (best, k) =>
              best === undefined ||
              Math.abs(nth(error.direction ?? [], k)) > Math.abs(nth(error.direction ?? [], best))
                ? k
                : best,
            undefined,
          )
        : error.reason === 'underdetermined'
          ? open.at(-1)
          : undefined
  return named === undefined ? undefined : nth(parameters, named)
}

/**
 * Fits the powder parameters of `load` to ladders fired at several barrel lengths and powder
 * temperatures with shared parameters (`apps/docs/docs/models/interior-powder-fit.md`, "Several
 * barrel lengths and temperatures"). A requested parameter other than the burn coefficient that
 * the sessions do not resolve is dropped one at a time and listed in `held`; the fit then runs
 * again without it. The burn coefficient must be among `options.parameters` (default only it),
 * and failures that name no other parameter are thrown as `fitPowder` throws them.
 */
export function fitPowderSessions(
  load: InteriorLoad,
  sessions: readonly PowderSession[],
  options: PowderFitOptions = {},
): PowderSessionsFit {
  need(sessions.length > 0, 'at least one session')
  const ladder = sessions.flatMap((s) =>
    s.ladder.map(
      (x): LadderPoint => ({
        ...x,
        // a condition a point states itself is kept
        ...(x.barrelLength !== undefined || s.barrelLength === undefined
          ? {}
          : { barrelLength: s.barrelLength }),
        ...(x.propellantTemperature !== undefined || s.propellantTemperature === undefined
          ? {}
          : { propellantTemperature: s.propellantTemperature }),
      }),
    ),
  )
  let parameters = options.parameters ?? ['burnRate']
  need(parameters.includes('burnRate'), 'the burn coefficient is always fitted')
  const requested = parameters
  need(
    Object.entries(options.priors ?? {}).every(
      ([name, prior]) => prior === undefined || requested.includes(name as PowderParameter),
    ),
    'a prior needs its parameter in parameters',
  )
  const held: HeldPowderParameter[] = []
  for (;;) {
    try {
      const priors = Object.fromEntries(
        Object.entries(options.priors ?? {}).filter(([name]) =>
          parameters.includes(name as PowderParameter),
        ),
      )
      return {
        ...fitPowder(load, ladder, { ...options, parameters, priors }),
        resolved: [...parameters],
        held,
      }
    } catch (error) {
      const name = error instanceof PowderFitError ? giveUp(error, parameters) : undefined
      if (name === undefined || !(error instanceof PowderFitError)) throw error
      held.push({ name, reason: error.reason as HeldPowderParameter['reason'] })
      parameters = parameters.filter((p) => p !== name)
    }
  }
}
