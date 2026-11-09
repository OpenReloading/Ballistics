import { describe, expect, it } from 'vitest'
import { bundle } from '../../catalog/test/bundle.ts'
import {
  type ExteriorContext,
  findBullet,
  inlineRunner,
  runStability,
  runTrajectory,
  stabilityQuery,
  trajectoryBody,
  trajectoryExample,
} from '../src/index.ts'
import { testCatalogue } from './catalogue.ts'

const catalogue = testCatalogue(bundle)
const context: ExteriorContext = {
  compute: inlineRunner,
  findBullet: (id) => findBullet(catalogue, id),
}
const byId = (bullet: string) => ({
  ...trajectoryExample.shot,
  projectile: { bullet, dragModel: 'G1' },
})

describe('exterior runs', () => {
  it('runTrajectory takes the bullet of an id', async () => {
    const request = { shot: byId('example-a-1'), ranges: [0, 100, 300] }
    const answer = await runTrajectory(context, trajectoryBody.parse(request))
    expect(answer).toMatchObject({ resolved: { bullet: { id: 'example-a-1' } } })
  })

  it('runStability takes the bullet of an id, without a compute runner', async () => {
    const query = { bullet: 'example-a-1', length: '0.0312', twist: '0.254', muzzleVelocity: '800' }
    const answer = await runStability(
      { findBullet: context.findBullet },
      stabilityQuery.parse(query),
    )
    expect(answer).toMatchObject({ resolved: { bullet: { id: 'example-a-1' } } })
  })

  it('throws the not-found of the lookup for an unknown bullet', async () => {
    const request = { shot: byId('nope'), ranges: [0] }
    await expect(runTrajectory(context, trajectoryBody.parse(request))).rejects.toMatchObject({
      issue: { code: 'recordNotFound', params: { kind: 'bullet', id: 'nope' } },
    })
  })
})
