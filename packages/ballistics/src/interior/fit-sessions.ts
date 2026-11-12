/** Over sessions that differ in barrel length or powder temperature, holding the parameters they do not resolve at their input values (`apps/docs/docs/models/interior-powder-fit.md`, "Several barrel lengths and temperatures"); SI in and out. */

import { nth } from '@rangefoundry/statistics'
import { need } from '../issue.ts'
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

/** The entry of `open` that carries the most weight of `direction`. */
function heaviest(open: readonly number[], direction: readonly number[]): number | undefined {
  return open.reduce<number | undefined>(
    (best, k) =>
      best === undefined || Math.abs(nth(direction, k)) > Math.abs(nth(direction, best)) ? k : best,
    undefined,
  )
}

/** The index of the parameter `error` names, among the `open` ones. */
function namedIndex(error: PowderFitError, open: readonly number[]): number | undefined {
  if (error.reason === 'unresolved') return open.find((k) => error.unresolved?.includes(k))
  // the direction the sessions leave open: the one the most weight of it lies on
  if (error.reason === 'ill-conditioned') return heaviest(open, error.direction ?? [])
  return error.reason === 'underdetermined' ? open.at(-1) : undefined
}

const isHeldReason = (reason: PowderFitReason): reason is HeldPowderParameter['reason'] =>
  reason === 'underdetermined' || reason === 'unresolved' || reason === 'ill-conditioned'

/** The parameter to give up after `error`, never the burn coefficient, with the failure's reason; undefined where none is left. */
function giveUp(
  error: PowderFitError,
  parameters: readonly PowderParameter[],
): HeldPowderParameter | undefined {
  const open = parameters.flatMap((name, k) => (name === 'burnRate' ? [] : [k]))
  const named = namedIndex(error, open)
  const reason = error.reason
  return named === undefined || !isHeldReason(reason)
    ? undefined
    : { name: nth(parameters, named), reason }
}

/** Shared parameters over ladders at several barrel lengths and temperatures (`apps/docs/docs/models/interior-powder-fit.md`, "Several barrel lengths and temperatures"); a requested parameter the sessions do not resolve, other than the burn coefficient, is dropped one at a time into `held` and the fit run again; the burn coefficient must be among `options.parameters` (default only it), and failures naming no other parameter are thrown as `fitPowder` throws them. */
export function fitPowderSessions(
  load: InteriorLoad,
  sessions: readonly PowderSession[],
  options: PowderFitOptions = {},
): PowderSessionsFit {
  need(sessions.length > 0, { code: 'noSession', params: {} })
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
  need(parameters.includes('burnRate'), { code: 'burnCoefficientNotFitted', params: {} })
  const requested = parameters
  need(
    Object.entries(options.priors ?? {}).every(
      ([name, prior]) => prior === undefined || (requested as readonly string[]).includes(name),
    ),
    { code: 'priorParameterNotFitted', params: {} },
  )
  const held: HeldPowderParameter[] = []
  for (;;) {
    try {
      const priors = Object.fromEntries(
        Object.entries(options.priors ?? {}).filter(([name]) =>
          (parameters as readonly string[]).includes(name),
        ),
      )
      return {
        ...fitPowder(load, ladder, { ...options, parameters, priors }),
        resolved: [...parameters],
        held,
      }
    } catch (error) {
      const given = error instanceof PowderFitError ? giveUp(error, parameters) : undefined
      if (given === undefined) throw error
      held.push(given)
      parameters = parameters.filter((p) => p !== given.name)
    }
  }
}
