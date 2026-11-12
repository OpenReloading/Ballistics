import { describe, expect, it } from 'vitest'
import { pairedChange, type RowError } from '../src/paired.ts'

const e = (row: number, cartridge: string, velocity: number, pressure?: number): RowError => ({
  row,
  cartridge,
  velocity,
  pressure,
})

describe('pairedChange', () => {
  it('compares the absolute errors of the rows both sides ran', () => {
    const baseline = [e(0, 'a', 0.03), e(1, 'a', -0.05), e(2, 'b', 0.01), e(7, 'b', 0.5)]
    const candidate = [e(0, 'a', -0.02), e(1, 'a', 0.04), e(2, 'b', 0.01), e(9, 'c', 0.9)]
    const r = pairedChange(baseline, candidate)
    // rows 7 and 9 have one side only
    expect(r.velocity).toMatchObject({ rows: 3, cartridges: 2 })
    // 0.01, 0.03, 0.05 against 0.01, 0.02, 0.04
    expect(r.velocity?.median.baseline).toBeCloseTo(0.03, 12)
    expect(r.velocity?.median.candidate).toBeCloseTo(0.02, 12)
    expect(r.velocity?.median.change).toBeCloseTo(-0.01, 12)
    // rank 0.9 * 2 = 1.8: 0.03 + 0.8 * 0.02 and 0.02 + 0.8 * 0.02
    expect(r.velocity?.p90.baseline).toBeCloseTo(0.046, 12)
    expect(r.velocity?.p90.candidate).toBeCloseTo(0.036, 12)
    expect(r.pressure).toBeNull()
  })

  it('pairs a pressure only on the rows that print one', () => {
    const baseline = [e(0, 'a', 0.01, 0.2), e(1, 'a', 0.01), e(2, 'b', 0.01, -0.1)]
    const candidate = [e(0, 'a', 0.01, 0.1), e(1, 'a', 0.01), e(2, 'b', 0.01, -0.1)]
    const r = pairedChange(baseline, candidate)
    expect(r.velocity?.rows).toBe(3)
    expect(r.pressure).toMatchObject({ rows: 2, cartridges: 2 })
    // 0.1 and 0.2 against 0.1 and 0.1
    expect(r.pressure?.median.change).toBeCloseTo(-0.05, 12)
  })

  it('draws whole cartridges: cartridges with the same rows give no spread', () => {
    const rows = (errors: number[]) =>
      ['a', 'b', 'c'].flatMap((cartridge, k) =>
        errors.map((error, i) => e(3 * k + i, cartridge, error)),
      )
    const r = pairedChange(rows([0.01, 0.03, 0.05]), rows([0.02, 0.02, 0.09]))
    // every draw of three cartridges holds each row equally often, so a draw of rows would spread and a draw of cartridges does not
    expect(r.velocity?.median).toMatchObject({
      change: expect.closeTo(-0.01, 12),
      standardError: expect.closeTo(0, 12),
    })
    expect(r.velocity?.p90.standardError).toEqual(expect.closeTo(0, 12))
  })

  it('gives the spread of the change over the draws of two unlike cartridges', () => {
    // a alone changes by -0.02, b alone by +0.02, both together by 0: the draws are -0.02, 0, 0, +0.02, each equally likely
    const r = pairedChange([e(0, 'a', 0.03), e(1, 'b', 0.03)], [e(0, 'a', 0.01), e(1, 'b', 0.05)])
    expect(r.velocity?.median.change).toBeCloseTo(0, 12)
    // the standard deviation of that distribution is the root of 0.0002; 2,000 draws estimate it to about 2 %
    expect(Math.abs((r.velocity?.median.standardError ?? 0) - Math.sqrt(0.0002))).toBeLessThan(
      0.001,
    )
  })
})
