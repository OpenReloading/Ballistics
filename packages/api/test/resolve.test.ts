import { type Aerodynamics, InputError, lbPerSqInToKgPerSqM } from '@open-reloading/core'
import { type Bullet, toSi } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import {
  bulletProjectile,
  bulletSi,
  findBullet,
  findCartridge,
  findPowder,
} from '../src/compute/resolve.ts'
import { defined } from './defined.ts'
import { bundle } from './fixtures.ts'
import { testCatalogue } from './setup.ts'

describe('stored to SI', () => {
  it('uses the solver factor for the ballistic coefficient', () => {
    expect(toSi('ballisticCoefficient', 1)).toBe(lbPerSqInToKgPerSqM)
  })
})

const g7: Bullet = {
  ...defined(bundle.bullets[0]),
  length: { value: 31.2 },
  ballisticCoefficients: [
    { dragModel: 'G1', value: 0.46 },
    { dragModel: 'G7', value: 0.22, minVelocity: { value: 600 } },
    { dragModel: 'G7', value: 0.21 },
  ],
}

describe('record lookups', () => {
  const catalogue = testCatalogue(bundle)

  it('finds each kind by id and answers 404 naming the kind and id', () => {
    expect(findBullet(catalogue, 'example-a-1').id).toBe('example-a-1')
    expect(findPowder(catalogue, 'example-a-fast').id).toBe('example-a-fast')
    expect(findCartridge(catalogue, 'alpha-rifle').id).toBe('alpha-rifle')
    for (const [find, kind] of [
      [findBullet, 'bullet'],
      [findPowder, 'powder'],
      [findCartridge, 'cartridge'],
    ] as const) {
      const error = (() => {
        try {
          find(catalogue, 'nope')
        } catch (e) {
          return e as { statusCode: number; message: string }
        }
      })()
      expect(error).toMatchObject({ statusCode: 404, message: `${kind} nope not found` })
    }
  })
})

describe('bullet record to projectile', () => {
  it('converts mass, diameter and length to SI and leaves out a missing length', () => {
    expect(bulletSi(g7)).toEqual({
      mass: toSi('mass', 10.89),
      diameter: toSi('length', 7.82),
      length: toSi('length', 31.2),
    })
    expect(bulletSi(defined(bundle.bullets[0])).length).toBeUndefined()
  })

  it('leaves out the diameter of a name-only record and refuses a projectile without one', () => {
    const { productNumber: _p, diameter: _d, ...rest } = g7
    const nameOnly = { ...rest, nameOnly: true as const }
    expect(bulletSi(nameOnly).diameter).toBeUndefined()
    expect(() => bulletProjectile(nameOnly, { dragModel: 'G1' })).toThrow(
      new InputError('bullet example-a-1 has no diameter'),
    )
  })

  it('takes the bands of the drag model, a band without a start speed from 0', () => {
    const { projectile, bullet } = bulletProjectile(g7, { dragModel: 'G7' })
    expect(projectile).toEqual({
      mass: toSi('mass', 10.89),
      diameter: toSi('length', 7.82),
      length: toSi('length', 31.2),
      drag: {
        kind: 'bc',
        model: 'G7',
        bands: [
          { ballisticCoefficient: 0.22 * lbPerSqInToKgPerSqM, minVelocity: 600 },
          { ballisticCoefficient: 0.21 * lbPerSqInToKgPerSqM, minVelocity: 0 },
        ],
      },
    })
    expect(bullet).toMatchObject({
      id: g7.id,
      dragModel: 'G7',
      suppliedFields: ['mass', 'diameter', 'length', 'ballisticCoefficients'],
    })
  })

  it('keeps a stated length and aerodynamics and leaves out the length of neither', () => {
    const aerodynamics = { liftSlope: 2.5 } as unknown as Aerodynamics
    const stated = bulletProjectile(g7, { dragModel: 'G1', length: 0.03, aerodynamics })
    expect(stated.projectile.length).toBe(0.03)
    expect(stated.projectile.aerodynamics).toBe(aerodynamics)
    expect(stated.bullet.suppliedFields).toEqual(['mass', 'diameter', 'ballisticCoefficients'])
    const none = bulletProjectile(defined(bundle.bullets[0]), { dragModel: 'G1' })
    expect(none.projectile).not.toHaveProperty('length')
    expect(none.projectile).not.toHaveProperty('aerodynamics')
    expect(none.bullet.suppliedFields).toEqual(['mass', 'diameter', 'ballisticCoefficients'])
  })

  it('refuses a record without a BC of the model or with two BCs of one start speed', () => {
    const plain = defined(bundle.bullets[0])
    expect(() => bulletProjectile(plain, { dragModel: 'G7' })).toThrow(
      new InputError('bullet example-a-1 has no G7 ballistic coefficient'),
    )
    expect(() =>
      bulletProjectile({ ...plain, ballisticCoefficients: undefined }, { dragModel: 'G1' }),
    ).toThrow(InputError)
    const twice = {
      ...plain,
      ballisticCoefficients: [
        { dragModel: 'G1' as const, value: 0.46 },
        { dragModel: 'G1' as const, value: 0.45, minVelocity: { value: 0 } },
      ],
    }
    expect(() => bulletProjectile(twice, { dragModel: 'G1' })).toThrow(
      new InputError(
        'bullet example-a-1 has 2 G1 values without distinct velocity bands; send drag explicitly',
      ),
    )
  })
})
