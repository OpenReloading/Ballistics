import { type TrajectoryInput, trajectory } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import {
  rangeStringsFitResponse,
  rangeStringsPlanResponse,
  stabilityResponse,
  trajectoryResponse,
  truingResponse,
} from '../src/compute/exterior-response.ts'
import { inlineRunner } from '../src/compute/tasks.ts'
import { API_PREFIX } from '../src/version.ts'
import { defined } from './defined.ts'
import { rifleProjectile as projectile, rifleShot } from './fixtures.ts'
import { checkBody, withApi } from './setup.ts'

const api = withApi({ compute: inlineRunner })

async function post(path: string, payload: unknown) {
  const res = await api.post(`${API_PREFIX}${path}`, payload)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body
}

async function get(path: string) {
  const res = await api.get(`${API_PREFIX}${path}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body
}

const shot: TrajectoryInput = { ...rifleShot, site: { latitude: 0.8, azimuth: 1 } }
const tight = { relativeTolerance: 1e-10, absoluteTolerance: 1e-9, zeroTolerance: 1e-9 }

describe('exterior response schemas', () => {
  it('match the trajectory answers', async () => {
    checkBody(
      trajectoryResponse,
      await post('/exterior/trajectory', { shot, ranges: [0, 100, 300] }),
    )
    const byId = await post('/exterior/trajectory', {
      shot: { ...shot, projectile: { bullet: 'example-a-1', dragModel: 'G1' } },
      ranges: [0, 100, 300],
    })
    expect(byId.resolved.bullet.id).toBe('example-a-1')
    checkBody(trajectoryResponse, byId)
    // the point-mass twin stops at its apex before 3700 m, so that spin drift is null
    const steep = {
      ...shot,
      projectile: {
        ...projectile,
        aerodynamics: { liftSlope: 2.6, momentSlope: 2.8, magnusForceSlope: -2 },
      },
      wind: undefined,
      site: undefined,
      lookAngle: 0.8,
      zero: { elevationAngle: 0, windageAngle: 0 },
    }
    const mpm = await post('/exterior/trajectory', {
      shot: steep,
      ranges: [3000, 3700],
      options: { model: 'modified-point-mass' },
    })
    expect(mpm.result.points[0].spinDrift).toBeTypeOf('number')
    expect(mpm.result.points[1].spinDrift).toBeNull()
    expect(mpm.result.points[0].yaw).toBeTypeOf('number')
    checkBody(trajectoryResponse, mpm)
  })

  it('match the truing answers', async () => {
    const exact = trajectory(shot, [300, 500], tight).points
    const muzzle = await post('/exterior/truing', {
      shot,
      observations: exact.map((p) => ({ kind: 'height', range: p.range, value: p.height })),
      fit: { kind: 'muzzleVelocity' },
    })
    expect(muzzle.result.correlation).toEqual([[null]])
    checkBody(truingResponse, muzzle)
    const truth = trajectory({ ...shot, muzzleVelocity: 810 }, [100, 300, 500, 700, 900], tight)
    const observations = truth.points.flatMap((p) => [
      { kind: 'velocity', range: p.range, value: p.velocity * 0.99, standardUncertainty: 1 },
      { kind: 'height', range: p.range, value: p.height, standardUncertainty: 0.01 },
    ])
    const dragFit = await post('/exterior/truing', {
      shot,
      observations,
      fit: { kind: 'drag', knots: [1.3, 2], fitMuzzleVelocity: true },
    })
    expect(dragFit.result.shot.projectile.drag.kind).toBe('curve')
    checkBody(truingResponse, dragFit)
  })

  const strings = { shot, clickValue: 0.1e-3 }

  it('matches the range strings plan answer', async () => {
    const plan = await post('/exterior/range-strings/plan', {
      ...strings,
      dispersion: 0.2e-3,
      candidates: [
        { name: 'one', entries: [{ kind: 'impact', range: 300, shotCount: 5 }] },
        {
          entries: [300, 600, 900].map((range) => ({ kind: 'impact', range, shotCount: 5 })),
          chronograph: { shotCount: 10, standardDeviation: 4 },
        },
      ],
      options: { fitZeroOffset: true, priors: { zeroOffset: 2e-4, dragFactor: 0.05 } },
    })
    expect(plan.result[0].plan.conditionNumber).toBeNull()
    checkBody(rangeStringsPlanResponse, plan)
  })

  it('matches the range strings fit answers', async () => {
    const truth = trajectory(shot, [0, 300, 600, 900], tight).points
    const entries = truth.slice(1).map((p) => ({
      kind: 'impact',
      range: p.range,
      value: p.height + 1e-4 * p.range,
      shotCount: 5,
      standardDeviation: 0.2e-3 * p.range,
    }))
    const chronograph = { mean: defined(truth[0]).velocity, shotCount: 10, standardDeviation: 4 }
    const fit = await post('/exterior/range-strings/fit', {
      ...strings,
      entries,
      chronograph,
      options: { fitZeroOffset: true, priors: { muzzleVelocity: 0.01 } },
    })
    expect(fit.result.parameters[0].interval).toBeDefined()
    checkBody(rangeStringsFitResponse, fit)
    const singular = await post('/exterior/range-strings/fit', {
      ...strings,
      entries: entries.slice(0, 1),
    })
    expect(singular.result.conditionNumber).toBeNull()
    checkBody(rangeStringsFitResponse, singular)
  })

  it('matches the stability answers with and without a bullet id', async () => {
    const query = 'twist=0.254&muzzleVelocity=800'
    const explicit = await get(
      `/exterior/stability?mass=0.01134&diameter=0.00782&length=0.0312&${query}`,
    )
    expect(explicit.resolved).toBeUndefined()
    checkBody(stabilityResponse, explicit)
    const byId = await get(`/exterior/stability?bullet=example-a-1&length=0.0312&${query}`)
    expect(byId.resolved.bullet.suppliedFields).toEqual(['mass', 'diameter'])
    checkBody(stabilityResponse, byId)
  })
})
