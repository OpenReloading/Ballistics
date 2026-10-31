/**
 * `POST /exterior/trajectory`, `/exterior/truing`, `/exterior/range-strings/plan` and `/fit` and
 * `GET /exterior/stability`: the answers, with the bullet of a `bullet` id resolved.
 */
import { InputError, icao, millerStability } from '@open-reloading/core'
import type { Bullet } from '@open-reloading/schema'
import { assertFinite, resolvedRecord } from './answer.ts'
import type { TrajectoryBody, TruingBody } from './exterior-schema.ts'
import { bulletProjectile, bulletSi } from './resolve.ts'
import { caps } from './schemas.ts'
import { type StabilityQuery, stabilityBounds } from './stability-schema.ts'
import type { RangeStringsFitBody, RangeStringsPlanBody } from './strings-schema.ts'
import type { ComputeRunner } from './tasks.ts'
import { responseUnits } from './units.ts'

/**
 * The compute runner and the bullet lookup an exterior request reads. The lookup fails an unknown
 * id with a 404 error.
 */
export type ExteriorContext = {
  compute: ComputeRunner
  /** The bullet record `id`. */
  findBullet: (id: string) => Bullet | Promise<Bullet>
}

/** Result paths where core can return NaN; JSON writes null. */
const nanPaths = {
  spinDrift: /^\.result\.points\.\d+\.spinDrift$/,
  truing: /^\.result\.(parameters\.\d+\.standardUncertainty|correlation\.\d+\.\d+)$/,
}

/**
 * Result paths of the range strings answers where a singular design gives an infinite number:
 * the standard uncertainties, variance inflation and condition number of a parameter in
 * the null direction. The correlations stay finite.
 */
const stringParameter = String.raw`parameters\.\d+\.(relativeStandardUncertainty|varianceInflation|standardUncertainty|posteriorSigma|prior\.ratio)`
const infinitePaths = {
  plan: new RegExp(String.raw`^\.result\.\d+\.plan\.(conditionNumber|${stringParameter})$`),
  fit: new RegExp(String.raw`^\.result\.(conditionNumber|${stringParameter})$`),
}

/** The shot with the projectile of its `bullet` id, and the `resolved` part of the answer. */
async function resolveShot<S extends TrajectoryBody['shot']>(
  findBullet: ExteriorContext['findBullet'],
  shot: S,
) {
  const p = shot.projectile
  if (!('bullet' in p)) return { shot: { ...shot, projectile: p }, resolved: undefined }
  const { projectile, bullet: echoed } = bulletProjectile(await findBullet(p.bullet), p)
  return { shot: { ...shot, projectile }, resolved: { bullet: echoed, projectile } }
}

/** One trajectory request: the body of the answer. */
export async function runTrajectory(
  context: ExteriorContext,
  body: TrajectoryBody,
): Promise<Record<string, unknown>> {
  const { shot, resolved } = await resolveShot(context.findBullet, body.shot)
  const result = await context.compute.run({
    kind: 'trajectory',
    args: [shot, body.ranges, { maxSteps: caps.trajectorySteps, ...body.options }],
  })
  const mpm = body.options?.model === 'modified-point-mass'
  return assertFinite(
    { units: responseUnits.exterior, result, resolved },
    mpm ? nanPaths.spinDrift : undefined,
  )
}

/** One truing request: the body of the answer. */
export async function runTruing(
  context: ExteriorContext,
  body: TruingBody,
): Promise<Record<string, unknown>> {
  const { shot, resolved } = await resolveShot(context.findBullet, body.shot)
  const o = {
    maxSteps: caps.truingSteps,
    maxIterations: caps.truingIterations,
    maxTotalSteps: caps.truingTotalSteps,
    ...body.options,
  }
  const fit = body.fit
  const result =
    fit.kind === 'muzzleVelocity'
      ? await context.compute.run({
          kind: 'truingMuzzleVelocity',
          args: [shot, body.observations, o],
        })
      : await context.compute.run({
          kind: 'truingDrag',
          args: [
            shot,
            body.observations,
            { knots: fit.knots, fitMuzzleVelocity: fit.fitMuzzleVelocity },
            o,
          ],
        })
  return assertFinite({ units: responseUnits.truing, result, resolved }, nanPaths.truing)
}

/** Core options of a strings request: the API's defaults and the caps under the request's values. */
const stringsOptions = (o: RangeStringsFitBody['options']) => {
  const { trajectoryOptions, ...rest } = o ?? {}
  return {
    maxIterations: caps.truingIterations,
    ...rest,
    trajectoryOptions: { maxSteps: caps.truingSteps, ...trajectoryOptions },
  }
}

/** One range strings plan request: the body of the answer. */
export async function runRangeStringsPlan(
  context: ExteriorContext,
  body: RangeStringsPlanBody,
): Promise<Record<string, unknown>> {
  const { shot, resolved } = await resolveShot(context.findBullet, body.shot)
  const { candidates, clickValue, dispersion } = body
  const result = await context.compute.run({
    kind: 'rangeStringsPlan',
    args: [{ shot, clickValue, dispersion }, candidates, stringsOptions(body.options)],
  })
  return assertFinite(
    { units: responseUnits.rangeStrings, result, resolved },
    infinitePaths.plan,
    true,
  )
}

/** One range strings fit request: the body of the answer. */
export async function runRangeStringsFit(
  context: ExteriorContext,
  body: RangeStringsFitBody,
): Promise<Record<string, unknown>> {
  const { shot, resolved } = await resolveShot(context.findBullet, body.shot)
  const { clickValue, entries, chronograph } = body
  const result = await context.compute.run({
    kind: 'rangeStringsFit',
    args: [{ shot, clickValue, entries, chronograph }, stringsOptions(body.options)],
  })
  return assertFinite(
    { units: responseUnits.rangeStrings, result, resolved },
    infinitePaths.fit,
    true,
  )
}

/** Mass, diameter and length of a stability query, the missing ones from the bullet `record`. */
function fillFromRecord(q: StabilityQuery, record: Bullet) {
  let { mass, diameter, length } = q
  const si = bulletSi(record)
  const fields = [
    ...(mass === undefined ? ['mass'] : []),
    ...(diameter === undefined ? ['diameter'] : []),
    ...(length === undefined && si.length !== undefined ? ['length'] : []),
  ]
  mass ??= si.mass
  diameter ??= si.diameter
  length ??= si.length
  return { mass, diameter, length, resolved: { bullet: resolvedRecord(record, fields) } }
}

/**
 * Mass, diameter and length of a stability query, the missing ones from the bullet `record`, each
 * checked against `stabilityBounds`, with the record's `resolved.bullet` part.
 */
function stabilityInputs(q: StabilityQuery, record: Bullet | undefined) {
  const { mass, diameter, length, resolved } = record
    ? fillFromRecord(q, record)
    : { ...q, resolved: undefined }
  if (mass === undefined || diameter === undefined || length === undefined)
    throw new InputError(
      diameter === undefined && length !== undefined
        ? `bullet ${q.bullet} has no diameter`
        : `bullet ${q.bullet} has no length`,
    )
  // request values have passed these bounds already; record values have not
  for (const [key, value] of Object.entries({ mass, diameter, length })) {
    const [lo, hi] = stabilityBounds[key as 'mass' | 'diameter' | 'length']
    const unit = key === 'mass' ? 'kg' : 'm'
    if (!(value >= lo && value <= hi))
      throw new InputError(
        `bullet ${q.bullet} ${key} ${value} ${unit} must be within ${lo} and ${hi} ${unit}`,
      )
  }
  return { mass, diameter, length, resolved }
}

/** One stability query, in this thread (closed form): the body of the answer. */
export async function runStability(
  context: Pick<ExteriorContext, 'findBullet'>,
  q: StabilityQuery,
): Promise<Record<string, unknown>> {
  const record = q.bullet === undefined ? undefined : await context.findBullet(q.bullet)
  const { mass, diameter, length, resolved } = stabilityInputs(q, record)
  const result = millerStability({
    mass,
    diameter,
    length,
    twist: q.twist,
    velocity: q.muzzleVelocity,
    air: {
      altitude: 0,
      pressure: q.pressure ?? icao.pressure,
      temperature: q.temperature ?? icao.temperature,
      humidity: 0,
    },
  })
  return assertFinite({ units: responseUnits.stability, method: 'miller', result, resolved })
}
