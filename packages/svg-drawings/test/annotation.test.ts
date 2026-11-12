import { describe, expect, it } from 'vitest'
import { cipProfile, type Profile, shotshellProfile } from '../src/cartridge/profile.ts'
import type { Annotation } from '../src/core/types.ts'
import { defined } from './defined.ts'
import { sheet } from './sheets.ts'

const record = sheet

const annotation = (file: string, side: 'cartridge' | 'chamber', variant?: string) => {
  const { table, values } = record(file)
  return (
    (table === 'VII'
      ? shotshellProfile(values, side, variant)
      : cipProfile(values, side, table)) as Profile
  ).annotation
}

/** `<kind> <symbol>` with the flags, in order. */
const kinds = ({ dimensions }: Annotation) =>
  dimensions.map(
    (d) =>
      `${d.kind} ${d.symbol}${['behindHeadFace', 'front', 'far', 'derived'].flatMap((k) => (d[k as 'front'] ? [` ${k}`] : [])).join('')}`,
  )

describe('annotation', () => {
  it('dimensions the 308 Win. cartridge', () => {
    const a = annotation('cip-308-win-2008-09-23', 'cartridge')
    expect(kinds(a)).toEqual([
      'length f behindHeadFace',
      'diameter R1 behindHeadFace',
      'length R behindHeadFace',
      'diameter E1 behindHeadFace',
      'length E behindHeadFace',
      'chain e behindHeadFace',
      'diameter P1',
      'length L1',
      'length L2',
      'length S far',
      'diameter P2',
      'diameter H1',
      'diameter H2',
      'length L3',
      'length L6',
      'diameter G1 front',
      'chain L3−L2 derived',
    ])
    const neck = a.dimensions.find((d) => d.derived)
    expect([neck?.value, neck?.from, neck?.to]).toEqual([7.7, 43.48, 51.18])
    // P2 before the r1 arc, H1 after the r2 arc
    const at = (symbol: string) => a.dimensions.find((d) => d.symbol === symbol)?.from as number
    expect(at('P2')).toBeLessThan(39.62)
    expect(at('H1')).toBeGreaterThan(43.48)
    const alpha = a.angles.find((x) => x.symbol === 'alpha')
    // the cone through P2 11.53 at L1 39.62 and H1 8.72 at L2 43.48 meets the axis at 55.458 mm
    expect(alpha?.vertex[0]).toBe(0)
    expect(alpha?.vertex[1]).toBeCloseTo(55.458, 3)
    expect(alpha?.flanks).toEqual([
      [5.765, 39.62],
      [-5.765, 39.62],
    ])
    expect(a.angles.find((x) => x.symbol === 'delta')?.vertex).toEqual([5.195, 2.77])
    expect(a.radii.map((r) => [r.symbol, r.corner])).toEqual([
      ['r1', [5.765, 39.62]],
      ['r2', [4.36, 43.48]],
    ])
    // no edge at the open mouth
    expect(a.edges).toEqual([1.37, 2.77, 3.85, 39.62, 43.48])
    expect(a.conventions).toEqual([])
  })

  it('chains h, s and G from the 308 Win. chamber L3 and ends at the bore stub', () => {
    const a = annotation('cip-308-win-2008-09-23', 'chamber')
    const chains = a.dimensions.filter((d) => d.kind === 'chain')
    expect(chains.map((d) => [d.symbol, d.from, d.to])).toEqual([
      ['h', 51.44, 52.04],
      ['G', 51.44, 58.42],
      ['s', 51.44, 54.33],
    ])
    expect(a.dimensions.find((d) => d.symbol === 'F')?.from).toBe(58.42)
    expect(a.angles.map((x) => x.symbol)).toEqual(['alpha', 'alpha1', 'i'])
    expect(defined(a.angles[2]).vertex).toEqual([3.935, 54.33])
    expect(a.conventions).toEqual([{ kind: 'boreStub', r: 3.81, from: 58.42, to: 63.564 }])
  })

  it('dimensions the 300 Win. Mag. belt below the head and delta up to R3', () => {
    const a = annotation('cip-300-win-mag-2002-05-15', 'cartridge')
    expect(
      kinds(a).filter((k) => k.startsWith('diameter') && k.includes('behindHeadFace')),
    ).toEqual([
      'diameter R1 behindHeadFace',
      'diameter E1 behindHeadFace',
      'diameter R3 behindHeadFace',
    ])
    const delta = a.angles.find((x) => x.symbol === 'delta')
    expect(delta?.flanks[1][0]).toBe(6.755)
  })

  it('dimensions P0 at L0 on the 8 x 51 R Lebel chamber', () => {
    const a = annotation('cip-8-x-51-r-lebel-2015-05-19', 'chamber')
    expect(a.dimensions.filter((d) => ['P0', 'L0'].includes(d.symbol)).map((d) => d.to)).toEqual([
      23.09, 23.09,
    ])
  })

  it('dimensions the 284 Win. rebated rim and its stored e', () => {
    const a = annotation('cip-284-win-2005-05-25', 'cartridge')
    const [R1, P1] = ['R1', 'P1'].map((s) => a.dimensions.find((d) => d.symbol === s))
    expect([R1?.radius, P1?.radius]).toEqual([6.005, 6.36])
    expect(a.dimensions.find((d) => d.symbol === 'e')).toMatchObject({ from: 1.37, to: 2.39 })
  })

  it('gives the 22 Long Rifle a straight case and a short chamber G', () => {
    const cartridge = annotation('cip-22-long-rifle-2024-05-14', 'cartridge')
    expect(kinds(cartridge)).toEqual([
      'diameter R1 behindHeadFace',
      'length R behindHeadFace',
      'diameter P1',
      'diameter H2',
      'length L3',
      'length L6',
      'diameter G1 front',
    ])
    expect(cartridge.angles).toEqual([])
    const chamber = annotation('cip-22-long-rifle-2024-05-14', 'chamber')
    expect(chamber.dimensions.find((d) => d.symbol === 'G')).toMatchObject({
      kind: 'chain',
      from: 16.33,
      to: 18.27,
    })
  })

  it('dimensions a Cal. 12 variant by its own symbols', () => {
    expect(kinds(annotation('cip-12-2018-10-17', 'cartridge', '12/70'))).toEqual([
      'diameter g behindHeadFace',
      'diameter d behindHeadFace',
      'length t behindHeadFace',
      'length l',
      'diameter h',
    ])
    const chamber = annotation('cip-12-2018-10-17', 'chamber', '12/70')
    expect(chamber.dimensions.find((d) => d.symbol === 'L')?.value).toBe(69.9)
    expect(chamber.angles.map((x) => x.symbol)).toEqual(['alpha1'])
    expect(chamber.conventions.map((c) => c.kind)).toEqual(['boreStub'])
  })

  it('draws no neck chain where L2 equals L3', () => {
    // 56-50 Spencer stores L2 = L3 29.44 and H1 = H2 13.5: a shoulder with no neck
    const a = annotation('cip-56-50-spencer-2006-09-19', 'cartridge')
    expect(a.dimensions.map((d) => d.symbol)).toEqual(expect.arrayContaining(['L2', 'L3', 'H1']))
    expect(a.dimensions.some((d) => d.derived)).toBe(false)
  })

  it('leaves a derived e out', () => {
    // 454 Casull publishes E, E1 and delta without e
    const a = annotation('cip-454-casull-2015-05-19', 'cartridge')
    expect(a.dimensions.map((d) => d.symbol)).not.toContain('e')
    expect(a.dimensions.map((d) => d.symbol)).toContain('E')
  })

  it('marks the G1 stub of a chamber without G or F as a convention', () => {
    const a = annotation('cip-22-long-shot-2000-06-07', 'chamber')
    expect(a.conventions.map((c) => c.kind)).toEqual(['g1Stub'])
    const G1 = a.dimensions.find((d) => d.symbol === 'G1')
    expect(G1?.from).toBe(defined(a.conventions[0]).from)
  })
})
