import { type TrajectoryInput, trajectory } from '@open-reloading/core'
import { describe, expect, it } from 'vitest'
import {
  type ExteriorContext,
  rangeStringsFitBody,
  rangeStringsPlanBody,
  runRangeStringsFit,
  runRangeStringsPlan,
  runStability,
  runTrajectory,
  runTruing,
  simulate,
  stabilityQuery,
  trajectoryBody,
  truingBody,
} from '../src/compute/browser.ts'
import { findBullet } from '../src/compute/resolve.ts'
import { inlineRunner } from '../src/compute/tasks.ts'
import { API_PREFIX } from '../src/version.ts'
import { bundle, file, rifleShot, siValues } from './fixtures.ts'
import { testCatalogue, withApi } from './setup.ts'

const catalogue = testCatalogue(bundle)
const context: ExteriorContext = {
  compute: inlineRunner,
  findBullet: (id) => findBullet(catalogue, id),
}
const api = withApi({ compute: inlineRunner })

/** The 200 body of the route for `payload`: the run's answer as JSON with the identity fields. */
async function routeBody(path: string, payload?: unknown) {
  const url = `${API_PREFIX}${path}`
  const res = payload === undefined ? await api.get(url) : await api.post(url, payload)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const { inputHash, apiVersion, dataHash, ...rest } = res.body
  expect(typeof inputHash).toBe('string')
  return rest
}

/** `answer` as the route writes it: NaN and infinite numbers become null. */
const asJson = (answer: unknown) => JSON.parse(JSON.stringify(answer))

const shot: TrajectoryInput = rifleShot
const byId = { ...shot, projectile: { bullet: 'example-a-1', dragModel: 'G1' } }
const tight = { relativeTolerance: 1e-10, absoluteTolerance: 1e-9, zeroTolerance: 1e-9 }

describe('exterior run functions without Fastify', () => {
  it('runTrajectory answers as POST /exterior/trajectory, with the bullet of an id', async () => {
    const request = { shot: byId, ranges: [0, 100, 300] }
    const answer = await runTrajectory(context, trajectoryBody.parse(request))
    expect(answer.resolved).toMatchObject({ bullet: { id: 'example-a-1' } })
    expect(asJson(answer)).toEqual(await routeBody('/exterior/trajectory', request))
  })

  it('runTruing answers as POST /exterior/truing', async () => {
    const exact = trajectory(shot, [300, 500], tight).points
    const request = {
      shot,
      observations: exact.map((p) => ({ kind: 'height', range: p.range, value: p.height })),
      fit: { kind: 'muzzleVelocity' },
    }
    const answer = await runTruing(context, truingBody.parse(request))
    expect(asJson(answer)).toEqual(await routeBody('/exterior/truing', request))
  })

  it('runRangeStringsPlan answers as POST /exterior/range-strings/plan', async () => {
    const request = {
      shot,
      clickValue: 0.1e-3,
      dispersion: 0.2e-3,
      candidates: [{ entries: [{ kind: 'impact', range: 300, shotCount: 5 }] }],
    }
    const answer = await runRangeStringsPlan(context, rangeStringsPlanBody.parse(request))
    expect(asJson(answer)).toEqual(await routeBody('/exterior/range-strings/plan', request))
  })

  it('runRangeStringsFit answers as POST /exterior/range-strings/fit', async () => {
    const points = trajectory(shot, [300, 600], tight).points
    const request = {
      shot,
      clickValue: 0.1e-3,
      entries: points.map((p) => ({
        kind: 'impact',
        range: p.range,
        value: p.height,
        shotCount: 5,
        standardDeviation: 0.2e-3 * p.range,
      })),
    }
    const answer = await runRangeStringsFit(context, rangeStringsFitBody.parse(request))
    expect(asJson(answer)).toEqual(await routeBody('/exterior/range-strings/fit', request))
  })

  it('runStability answers as GET /exterior/stability, without a compute runner', async () => {
    const query = { bullet: 'example-a-1', length: '0.0312', twist: '0.254', muzzleVelocity: '800' }
    const answer = await runStability(
      { findBullet: context.findBullet },
      stabilityQuery.parse(query),
    )
    expect(answer.resolved).toMatchObject({ bullet: { id: 'example-a-1' } })
    const path = `/exterior/stability?${new URLSearchParams(query)}`
    expect(asJson(answer)).toEqual(await routeBody(path))
  })

  it('throws the 404 error of the lookup for an unknown bullet', async () => {
    const request = {
      shot: { ...byId, projectile: { bullet: 'nope', dragModel: 'G1' } },
      ranges: [0],
    }
    await expect(runTrajectory(context, trajectoryBody.parse(request))).rejects.toMatchObject({
      statusCode: 404,
      message: 'bullet nope not found',
    })
  })
})

describe('simulate without Fastify', () => {
  it('answers as POST /interior/load-file', async () => {
    const body = file({ siValues, cartridge: 'beta-pistol' })
    const { status, payload } = await simulate({ catalogue, compute: inlineRunner }, {}, body)
    expect(status).toBe(200)
    expect(asJson(payload)).toEqual(await routeBody('/interior/load-file', body))
  })
})
