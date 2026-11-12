import { describe, expect, it } from 'vitest'
import {
  type BulletProfile,
  type BulletValues,
  bulletDimensions,
  bulletFigureModel,
  bulletProfile,
  bulletScreenEm,
  recordProfile,
  sourceTitle,
} from '../src/bullet/index.ts'
import { radiusAt } from '../src/core/section.ts'

/** Synthetic record; the numbers are made up. */
const synthetic = (fields: Partial<BulletValues>, sourced?: string[]): BulletValues => ({
  diameter: { value: 7.82 },
  length: { value: 31.2 },
  ...fields,
  provenance: { sources: [{ title: 'Test sheet', ...(sourced && { fields: sourced }) }] },
})

const profile = (r: BulletValues) => {
  const p = recordProfile(r)
  if ('reason' in p) throw new Error(p.reason)
  return p
}

const symbols = (p: BulletProfile) =>
  [...p.annotation.dimensions, ...p.annotation.radii]
    .map((d) => d.symbol)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))

describe('bullet record to shape', () => {
  it('maps the record fields to plain mm and degrees', () => {
    expect(
      bulletDimensions(
        synthetic({
          noseLength: { value: 15 },
          base: { type: 'boat-tail', length: { value: 4 }, angle: { value: 9 } },
          ogive: { form: 'secant', radiusRatio: { value: 0.5 } },
          tip: { type: 'polymer-tip', length: { value: 3 } },
        }),
      ),
    ).toEqual({
      diameter: 7.82,
      length: 31.2,
      noseLength: 15,
      base: { type: 'boat-tail', length: 4, angle: 9 },
      ogive: { form: 'secant', radiusRatio: 0.5 },
      tip: { type: 'polymer-tip', length: 3 },
    })
  })

  it('maps a record cannelure', () => {
    expect(
      bulletDimensions(
        synthetic({
          cannelure: { start: { value: 9 }, width: { value: 1.2 }, depth: { value: 0.2 } },
        }),
      )?.cannelure,
    ).toEqual({ start: 9, width: 1.2, depth: 0.2 })
  })

  it('gives no shape and a reason without a length', () => {
    const r = synthetic({ length: undefined })
    expect(bulletDimensions(r)).toBeUndefined()
    expect(recordProfile(r)).toEqual({ reason: 'The record has no length.', fields: ['length'] })
  })

  it('gives no shape and a reason without a diameter', () => {
    const r = synthetic({ diameter: undefined })
    expect(bulletDimensions(r)).toBeUndefined()
    expect(recordProfile(r)).toEqual({
      reason: 'The record has no diameter.',
      fields: ['diameter'],
    })
  })

  it('takes a source without fields for the whole record, a listed path for its subfields', () => {
    const r = synthetic({}, ['diameter', 'base'])
    expect(sourceTitle(r, 'diameter')).toBe('Test sheet')
    expect(sourceTitle(r, 'base.length')).toBe('Test sheet')
    expect(sourceTitle(r, 'length')).toBeUndefined()
    expect(sourceTitle(synthetic({}), 'length')).toBe('Test sheet')
  })
})

describe('bullet dimensions follow the drawing', () => {
  it('dimensions the length and the diameter of a record that gives only these', () => {
    const p = profile(synthetic({}))
    expect(symbols(p)).toEqual(['L', 'd'])
    const m = bulletFigureModel(p, 'screen', bulletScreenEm(p))
    expect(m.bullet.approximate).not.toBe('')
  })

  it('leaves out a field without a source, though the outline draws it', () => {
    const p = profile(synthetic({}, ['diameter']))
    expect(symbols(p)).toEqual(['d'])
    expect(p.points.at(-1)).toEqual([0, 31.2])
  })

  it('leaves out base and bearing lengths where the base is drawn flat', () => {
    const p = profile(
      synthetic(
        {
          length: { value: 32 },
          base: { length: { value: 5.5 } },
          noseLength: { value: 20 },
          baseToOgive: { value: 14 },
          bearingLength: { value: 6.5 },
        },
        ['diameter', 'length', 'base.length', 'noseLength', 'baseToOgive', 'bearingLength'],
      ),
    )
    expect(symbols(p)).toEqual(['BTO', 'L', 'd', 'n'])
    expect(p.undimensioned).toEqual(['bearing length', 'boat-tail length'])
  })

  it('dimensions a drawn boat tail, its base diameter, the bearing, meplat and ogive radius', () => {
    const p = profile(
      synthetic({
        noseLength: { value: 18 },
        bearingLength: { value: 9.2 },
        meplatDiameter: { value: 1.6 },
        base: { type: 'boat-tail', length: { value: 4 }, diameter: { value: 6.6 } },
        ogive: { form: 'secant', radius: { value: 60 } },
      }),
    )
    expect(symbols(p)).toEqual(['L', 'R', 'b', 'd', 'db', 'dm', 'n', 't'])
    expect(p.undimensioned).toEqual([])
    const m = bulletFigureModel(p, 'print', 2.5)
    expect(m.bullet.approximate).toBe('')
    // every station lies on the drawn outline
    for (const d of p.annotation.dimensions)
      if (d.kind === 'diameter')
        expect(radiusAt(p.points, d.from)).toBeGreaterThanOrEqual((d.radius as number) - 1e-9)
    for (const r of p.annotation.radii)
      expect(p.points.some(([pr, pz]) => pr === r.corner[0] && pz === r.corner[1])).toBe(true)
  })

  it('dimensions a polymer tip and Rt/R; the meplat of a sharp point is not dimensioned', () => {
    const p = profile(
      synthetic({
        noseLength: { value: 17 },
        meplatDiameter: { value: 0 },
        base: { type: 'flat' },
        ogive: { form: 'secant', radiusRatio: { value: 0.6 } },
        tip: { type: 'polymer-tip', length: { value: 4 } },
      }),
    )
    expect(symbols(p)).toEqual(['L', 'Rt/R', 'd', 'lt', 'n'])
    expect(p.undimensioned).toEqual(['meplat diameter'])
    expect(p.annotation.edges).toContain(27.2)
  })

  it('dimensions a hollow-point mouth inside the meplat', () => {
    const p = profile(
      synthetic({
        noseLength: { value: 18 },
        meplatDiameter: { value: 2 },
        tip: { type: 'hollow-point', mouthDiameter: { value: 1 } },
      }),
    )
    expect(symbols(p)).toEqual(['L', 'd', 'dh', 'dm', 'n'])
  })

  it('dimensions an entered cannelure and keeps the diameter off it', () => {
    const p = bulletProfile(
      {
        diameter: 7.82,
        length: 31.2,
        noseLength: 18,
        base: { type: 'flat' },
        cannelure: { start: 9, width: 1.2, depth: 0.2 },
      },
      () => true,
      'entered',
    )
    if ('reason' in p) throw new Error(p.reason)
    expect(symbols(p)).toEqual(['L', 'c', 'd', 'n', 'w'])
    const d = p.annotation.dimensions.find((x) => x.symbol === 'd')
    expect(d?.from).toBeCloseTo(4.5)
  })

  it('gives the outline reason for a record whose lengths do not add up', () => {
    const p = recordProfile(
      synthetic({
        noseLength: { value: 18 },
        bearingLength: { value: 5 },
        base: { type: 'flat' },
      }),
    )
    expect(p).toEqual({
      reason: expect.stringContaining('do not add up'),
      fields: ['noseLength', 'bearingLength', 'length', 'base.length'],
    })
  })
})
