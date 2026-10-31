import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  trajectoryBody,
  trajectoryExample,
  truingBody,
  truingExample,
} from '../src/compute/exterior-schema.ts'
import {
  rangeStringsFitBody,
  rangeStringsFitExample,
  rangeStringsPlanBody,
  rangeStringsPlanExample,
} from '../src/compute/strings-schema.ts'
import { undescribed } from './setup.ts'

const bodies = {
  trajectory: [trajectoryBody, trajectoryExample],
  truing: [truingBody, truingExample],
  rangeStringsPlan: [rangeStringsPlanBody, rangeStringsPlanExample],
  rangeStringsFit: [rangeStringsFitBody, rangeStringsFitExample],
} as const

describe('exterior request schemas', () => {
  it.each(Object.entries(bodies))('the %s example is a valid body', (_, [body, example]) => {
    expect(() => body.parse(example)).not.toThrow()
  })

  it.each(Object.entries(bodies))(
    'every property of the %s schema has a description',
    (_, [schema]) => {
      const json = z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' })
      expect(undescribed(json)).toEqual([])
    },
  )

  // one value outside and one inside each bound; a unit slip (degrees, grams as kg) is refused
  const shot = trajectoryExample.shot
  const projectile = { ...shot.projectile, length: 0.0312 }
  const zero = (elevationAngle: number, windageAngle = 0) => ({ elevationAngle, windageAngle })
  const cases = [
    ['muzzleVelocity', { muzzleVelocity: 1e12 }, { muzzleVelocity: 3000 }],
    ['muzzleVelocity', { muzzleVelocity: 0.5 }, { muzzleVelocity: 1 }],
    ['projectile.mass', { projectile: { ...projectile, mass: 11.34 } }, {}],
    ['projectile.diameter', { projectile: { ...projectile, diameter: 7.82 } }, {}],
    ['zero.elevationAngle', { zero: zero(45) }, { zero: zero(0.01) }],
    ['zero.windageAngle', { zero: zero(0, -Math.PI / 2) }, { zero: zero(0, -1.5) }],
    ['lookAngle', { lookAngle: Math.PI / 2 }, { lookAngle: 1.5 }],
    [
      'zero.lookAngle',
      { zero: { range: 100, lookAngle: 30 } },
      { zero: { range: 100, lookAngle: 0.5 } },
    ],
  ] as const

  it.each(Object.entries(bodies))(
    'bounds the angles, velocity, mass and diameter of the %s shot',
    (_, [body, example]) => {
      for (const [path, outside, inside] of cases) {
        const parsed = body.safeParse({ ...example, shot: { ...shot, ...outside } })
        expect(
          parsed.error?.issues.map((i) => i.path.join('.')),
          path,
        ).toEqual([`shot.${path}`])
        expect(body.safeParse({ ...example, shot: { ...shot, ...inside } }).success, path).toBe(
          true,
        )
      }
    },
  )
})
