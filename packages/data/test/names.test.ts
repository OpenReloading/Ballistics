import type {
  Bullet,
  Cartridge,
  Manufacturer,
  Powder,
  Primer,
  RangeFirings,
  TargetFace,
} from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { checkNames, normaliseName } from '../src/names.ts'

const provenance = { kind: 'published' as const, sources: [{ title: 'Test' }] }
const empty = {
  cartridges: [],
  manufacturers: [],
  powders: [],
  primers: [],
  bullets: [],
  cases: [],
  rangeFirings: [],
  targetFaces: [],
}
const lines = (bundle: Partial<Parameters<typeof checkNames>[0]>) =>
  checkNames({ ...empty, ...bundle }).map((f) => `${f.file}: ${f.finding}`)

const cartridge = (id: string, name: string, aliases?: string[]): Cartridge => ({
  id,
  name,
  aliases,
  table: 'I',
  published: '2020-01-01',
  verification: 'unverified',
  values: [],
  provenance,
})
const manufacturer = (id: string, name: string, aliases?: string[]): Manufacturer => ({
  id,
  name,
  aliases,
  provenance,
})
const powder = (id: string, manufacturer: string, name: string, aliases?: string[]): Powder => ({
  id,
  manufacturer,
  name,
  aliases,
  provenance,
})
const primer = (id: string, manufacturer: string, name: string): Primer => ({
  id,
  manufacturer,
  name,
  size: 'large-rifle',
  provenance,
})
const bullet = (id: string, manufacturer: string, name: string): Bullet => ({
  id,
  manufacturer,
  productNumber: id,
  name,
  diameter: { value: 7.8 },
  mass: { value: 10 },
  provenance,
})
const range = (
  id: string,
  projectile: string,
  sha256?: string,
  url = 'https://example.org',
): RangeFirings => ({
  id,
  projectile,
  bulletDiameter: { value: 7.8 },
  bulletMass: { value: 10 },
  rounds: [
    { label: '1', mach: { value: 2 }, totalYaw: { value: 1 }, dragCoefficient: { value: 0.3 } },
  ],
  provenance: { kind: 'measured', sources: [{ title: 'R', url, sha256 }] },
})

describe('normaliseName', () => {
  it('keeps lower-case letters and digits only, without accents', () => {
    expect(normaliseName('22 lang für Büchsen')).toBe('22langfurbuchsen')
    expect(normaliseName('P-140')).toBe('p140')
  })

  it('keeps a decimal point between digits only', () => {
    expect(normaliseName('6.5x55')).toBe('6.5x55')
    expect(normaliseName('65x55')).toBe('65x55')
    expect(normaliseName('.357 Mag.')).toBe('357mag')
    expect(normaliseName('3.57')).toBe('3.57')
    expect(lines({ cartridges: [cartridge('a', '6.5x55'), cartridge('b', '65x55')] })).toEqual([])
  })
})

describe('checkNames', () => {
  it('reports cartridge names and aliases shared by two records, the later file only', () => {
    expect(lines({ cartridges: [cartridge('a', 'A'), cartridge('b', 'B', ['C'])] })).toEqual([])
    expect(lines({ cartridges: [cartridge('a', 'A', ['X']), cartridge('b', 'B', ['X'])] })).toEqual(
      ['cartridges/b.json: duplicate-name:X'],
    )
    expect(lines({ cartridges: [cartridge('b', 'B'), cartridge('a', 'A', ['b.'])] })).toEqual([
      'cartridges/b.json: duplicate-normalised-name:b',
    ])
  })

  it('skips the normalised comparison for names without ASCII letters or digits', () => {
    expect(lines({ cartridges: [cartridge('a', 'Винтовка'), cartridge('b', 'Патрон')] })).toEqual(
      [],
    )
  })

  it('reports every later record of three sharing one name, each with the first file', () => {
    expect(
      checkNames({
        ...empty,
        cartridges: [cartridge('c', 'X'), cartridge('a', 'X'), cartridge('b', 'X')],
      }).map((f) => `${f.file}: ${f.message}`),
    ).toEqual([
      'cartridges/b.json: "X" is also a name of cartridges/a.json',
      'cartridges/c.json: "X" is also a name of cartridges/a.json',
    ])
  })

  it('ignores a name repeated inside one record', () => {
    expect(lines({ cartridges: [cartridge('a', '22 LR', ['22LR', '22 LR'])] })).toEqual([])
  })

  it('compares powder names per manufacturer and aliases across manufacturers', () => {
    expect(
      lines({ powders: [powder('a', 'M', 'P140', ['O 1']), powder('b', 'O', 'P140', ['M P140'])] }),
    ).toEqual([])
    expect(lines({ powders: [powder('a', 'M', 'P-140'), powder('b', 'M', 'P140')] })).toEqual([
      'powders/b.json: duplicate-normalised-name:p140',
    ])
    expect(
      lines({ powders: [powder('a', 'M', 'A', ['O 1']), powder('b', 'N', 'B', ['O 1'])] }),
    ).toEqual(['powders/b.json: duplicate-name:O 1'])
    expect(
      lines({ powders: [powder('a', 'M', 'A', ['O-1']), powder('b', 'N', 'B', ['o 1'])] }),
    ).toEqual(['powders/b.json: duplicate-normalised-name:o1'])
  })

  it('compares primer names within a manufacturer', () => {
    expect(
      lines({ primers: [primer('a', 'M', 'Large Rifle'), primer('b', 'N', 'Large Rifle')] }),
    ).toEqual([])
    expect(
      lines({ primers: [primer('a', 'M', 'Large Rifle'), primer('b', 'M', 'Large Rifle')] }),
    ).toEqual(['primers/b.json: duplicate-name:Large Rifle'])
  })

  it('compares manufacturer names and aliases across manufacturers', () => {
    expect(lines({ manufacturers: [manufacturer('a', 'A Co.'), manufacturer('b', 'B')] })).toEqual(
      [],
    )
    expect(
      lines({ manufacturers: [manufacturer('a', 'A Co.', ['Old A']), manufacturer('b', 'Old A')] }),
    ).toEqual(['manufacturers/b.json: duplicate-name:Old A'])
  })

  it('compares bullet names per manufacturer', () => {
    expect(lines({ bullets: [bullet('a', 'M', 'FMJ'), bullet('b', 'N', 'FMJ')] })).toEqual([])
    expect(lines({ bullets: [bullet('a', 'M', 'FMJ'), bullet('b', 'M', 'FMJ')] })).toEqual([
      'bullets/b.json: duplicate-name:FMJ',
    ])
  })

  it('compares range projectiles per report', () => {
    expect(lines({ rangeFirings: [range('a', 'P', '1'), range('b', 'P', '2')] })).toEqual([])
    expect(lines({ rangeFirings: [range('a', 'P', '1'), range('b', 'P', '1')] })).toEqual([
      'range/b.json: duplicate-name:P',
    ])
    expect(
      lines({
        rangeFirings: [
          range('a', 'P', undefined, 'https://example.org/1'),
          range('b', 'P', undefined, 'https://example.org/2'),
        ],
      }),
    ).toEqual([])
  })

  it('reports target faces of one federation sharing a name', () => {
    const face = (id: string, federation: string): TargetFace => ({
      id,
      name: '10m Air Rifle Target',
      federation,
      rings: [
        { value: 9, diameter: { value: 5.5 } },
        { value: 10, diameter: { value: 0.5 } },
      ],
      blackDiameter: { value: 30.5 },
      decimal: true,
      events: [{ id: 'air-rifle', name: '10m Air Rifle', distance: { value: 10000 } }],
      provenance,
    })
    expect(
      lines({ targetFaces: [face('a', 'issf'), face('b', 'issf'), face('c', 'other')] }),
    ).toEqual(['target-faces/b.json: duplicate-name:10m Air Rifle Target'])
  })
})
