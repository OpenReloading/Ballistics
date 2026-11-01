import { describe, expect, it } from 'vitest'
import { pressureMethod, publishedLoad, publishedLoads } from '../src/index.ts'
import { expectIssueAt } from './issue-at.ts'

const source = {
  title: 'Example Powder manual, rifle tables',
  publisher: 'Example Powder',
  url: 'https://example.org/manual.pdf',
  retrieved: '2026-10-12',
  edition: '2025',
  origin: 'manufacturer',
}

/** Six loads that follow the hard cases of the printed tables. */
const loads = [
  {
    // psi and CUP in one load, the barrel with a twist
    id: 'example-a-150gr',
    bullet: { printed: 'Demo SP', mass: { value: 9.719865, raw: '150 gr' } },
    powder: { printed: 'Example 4895', record: 'catalogue:example-4895' },
    primer: { printed: 'Demo LR, Large Rifle', size: 'large-rifle', magnum: false },
    case: 'Demo brass',
    coal: { value: 71.12, raw: '2.800"' },
    barrel: {
      length: { value: 609.6, raw: '24"' },
      twist: { value: 304.8, raw: '1:12"' },
    },
    charges: [
      {
        kind: 'start',
        charge: { value: 2.916, raw: '45.0 gr' },
        velocity: { value: 731.52, raw: '2400 fps' },
        pressure: {
          unit: 'CUP',
          peak: { raw: '35,400 CUP' },
          method: 'crusher',
          methodBasis: 'stated',
        },
      },
      {
        kind: 'max',
        charge: { value: 3.2399455, raw: '50.0 gr' },
        velocity: { value: 801.624, raw: '2630 fps' },
        pressure: {
          unit: 'psi',
          peak: { value: 937.687, raw: '13,600 PSI' },
          method: 'case-contact',
          methodBasis: 'stated',
        },
        marks: ['compressed'],
      },
    ],
    page: '76',
    url: 'https://example.org/manual.pdf#page=76',
  },
  {
    // no unit printed, no velocity
    id: 'example-b',
    bullet: { printed: 'Demo FMJ', mass: { value: 8.0, raw: '123 gr' } },
    powder: { printed: 'DP35' },
    charges: [
      {
        kind: 'max',
        charge: { value: 2.1, raw: '32.7', assumedUnit: 'gr' },
      },
    ],
    page: 'row 12',
  },
  {
    // a minimum overall length that is flush, a velocity point with its distance
    id: 'example-c',
    bullet: {
      printed: 'Demo 2001',
      mass: { value: 4.5, raw: '4,5 g / 69 grs' },
      diameter: { value: 7.823, raw: '.308' },
    },
    powder: { printed: 'R-1' },
    coal: { raw: 'Flush', limit: 'min' },
    charges: [
      {
        kind: 'max',
        charge: { value: 1.2, raw: '1,2 g' },
        velocity: {
          value: 800,
          raw: '800 m/s',
          point: { label: 'V5', distance: { value: 5000, raw: '5 m' } },
        },
      },
    ],
    page: '3',
  },
  {
    // a single load, a method read from the unit
    id: 'example-d',
    bullet: { printed: 'LRN', mass: { value: 10.2, raw: '158 gr' } },
    powder: { printed: 'Example Pistol' },
    primer: {
      printed: 'Demo 101 und 102',
      records: ['catalogue:demo-primer-101', 'catalogue:demo-primer-102'],
    },
    charges: [
      {
        kind: 'single',
        charge: { value: 0.3, raw: '4.6 gr' },
        pressure: {
          unit: 'psi',
          peak: { value: 1000, raw: '14,504 psi' },
          method: 'case-contact',
          methodBasis: 'from-unit',
        },
        printedMarks: ['F'],
      },
    ],
    page: '9',
    source: 1,
  },
  {
    // proof-house mark of a customer table, no method printed
    id: 'example-e',
    bullet: { printed: 'x', mass: { value: 10, raw: '10 g' } },
    powder: { printed: 'y' },
    charges: [
      {
        kind: 'max',
        charge: { value: 1, raw: '1 g' },
        pressure: { unit: 'bar', peak: { value: 3000, raw: '3000 bar' } },
        marks: ['proof-tested'],
      },
    ],
    page: '2',
  },
  {
    // a JSON position as URL fragment
    id: 'example-f',
    bullet: { printed: 'x', mass: { value: 10, raw: '10 g' } },
    powder: { printed: 'y' },
    charges: [{ kind: 'recommended', charge: { value: 1, raw: '1 g' } }],
    page: 'Relodata[3368]',
    url: 'https://example.org/data.json#Relodata[3368]',
  },
]

const file = {
  id: 'example-powder',
  maker: 'example-powder',
  producedBy: 'maker',
  cartridgeName: '.308 Win.',
  cartridge: 'catalogue:308-winchester',
  loads,
  provenance: { kind: 'published', sources: [source, { ...source, edition: '2026' }] },
}

const load = loads[0]

describe('publishedLoads', () => {
  it('accepts the hard cases of the printed tables, kept as printed', () => {
    for (const l of loads) expect(publishedLoad.parse(l)).toEqual(l)
    expect(publishedLoads.parse(file)).toEqual(file)
  })

  it('has the case-contact method next to the C.I.P. one', () => {
    expect(pressureMethod.options).toContain('case-contact')
    expect(pressureMethod.options).toContain('transducer')
  })

  it('refuses a figure without its printed text and an unknown field', () => {
    const noRaw = { ...load, bullet: { ...load?.bullet, mass: { value: 9.7 } } }
    expectIssueAt(publishedLoad, noRaw, 'bullet.mass.raw')
    expectIssueAt(publishedLoad, { ...load, extra: 1 }, '')
  })

  it('refuses a bar value on a CUP figure and a psi figure without a value', () => {
    const pressure = (p: object) => ({
      ...load,
      charges: [{ kind: 'max', charge: { value: 1, raw: '1 g' }, pressure: p }],
    })
    const cup = { unit: 'CUP', peak: { value: 2400, raw: '35,400 CUP' } }
    expectIssueAt(publishedLoad, pressure(cup), 'charges.0.pressure.peak.value')
    expectIssueAt(
      publishedLoad,
      pressure({ unit: 'psi', peak: { raw: '13,600 PSI' } }),
      'charges.0.pressure.peak.value',
    )
  })

  it('takes a method and its basis together, and no crusher method for a bar figure', () => {
    const pressure = (p: object) => ({
      ...load,
      charges: [{ kind: 'max', charge: { value: 1, raw: '1 g' }, pressure: p }],
    })
    const peak = { value: 937.687, raw: '13,600 PSI' }
    expectIssueAt(
      publishedLoad,
      pressure({ unit: 'psi', peak, method: 'case-contact' }),
      'charges.0.pressure.methodBasis',
    )
    expectIssueAt(
      publishedLoad,
      pressure({ unit: 'psi', peak, methodBasis: 'stated' }),
      'charges.0.pressure.methodBasis',
    )
    expectIssueAt(
      publishedLoad,
      pressure({ unit: 'psi', peak, method: 'crusher', methodBasis: 'stated' }),
      'charges.0.pressure.method',
    )
  })

  it('takes one charge of each kind and a single charge alone', () => {
    const charge = (kind: string) => ({ kind, charge: { value: 1, raw: '1 g' } })
    expectIssueAt(publishedLoad, { ...load, charges: [charge('max'), charge('max')] }, 'charges')
    expectIssueAt(publishedLoad, { ...load, charges: [charge('single'), charge('max')] }, 'charges')
    expectIssueAt(publishedLoad, { ...load, charges: [] }, 'charges')
  })

  it('keeps a start charge above the maximum charge as printed (a data:validate warning)', () => {
    const charge = (kind: string, value: number) => ({ kind, charge: { value, raw: `${value} g` } })
    expect(
      publishedLoad.safeParse({ ...load, charges: [charge('start', 4), charge('max', 3)] }).success,
    ).toBe(true)
  })

  it('names a source of the file that exists', () => {
    expectIssueAt(publishedLoads, { ...file, loads: [{ ...load, source: 2 }] }, 'loads.0.source')
  })

  it('needs a cartridge reference, a maker and who produced the loads', () => {
    for (const key of ['cartridge', 'maker', 'producedBy', 'cartridgeName']) {
      const { [key]: _gone, ...rest } = file as Record<string, unknown>
      expectIssueAt(publishedLoads, rest, key)
    }
    expectIssueAt(
      publishedLoads,
      { ...file, cartridge: 'user:0b0e1a5e-0f45-4f4e-8f4c-1d3a2b4c5d6e' },
      'cartridge',
    )
  })

  it('needs published provenance with the maker as publisher, URL, retrieval date and origin', () => {
    const sources = (s: object) => ({
      ...file,
      loads: loads.map(({ source: _source, ...l }) => l),
      provenance: { kind: 'published', sources: [s] },
    })
    expectIssueAt(
      publishedLoads,
      { ...file, provenance: { kind: 'measured', sources: [source] } },
      'provenance.kind',
    )
    for (const key of ['publisher', 'url', 'retrieved', 'origin']) {
      const { [key]: _gone, ...rest } = source as Record<string, unknown>
      expectIssueAt(publishedLoads, sources(rest), `provenance.sources.0.${key}`)
    }
  })

  it('gives maker data no project licence, only the maker own terms', () => {
    const sources = (s: object) => ({
      ...file,
      loads: loads.map(({ source: _source, ...l }) => l),
      provenance: { kind: 'published', sources: [s] },
    })
    const own = {
      ...source,
      license: 'LicenseRef-Example-Powder',
      terms: 'https://example.org/terms',
    }
    expect(publishedLoads.safeParse(sources(own)).success).toBe(true)
    expect(
      publishedLoads.safeParse(sources({ ...source, terms: 'Free for private use.' })).success,
    ).toBe(true)
    expectIssueAt(
      publishedLoads,
      sources({ ...source, license: 'CC-BY-4.0' }),
      'provenance.sources.0.license',
    )
    expectIssueAt(
      publishedLoads,
      sources({ ...source, license: 'LicenseRef-Example-Powder' }),
      'provenance.sources.0.license',
    )
  })

  it('keeps the primer as printed: size and records are optional, the text is not', () => {
    expect(publishedLoad.safeParse({ ...load, primer: { printed: 'Large Rifle' } }).success).toBe(
      true,
    )
    expectIssueAt(publishedLoad, { ...load, primer: { size: 'large-rifle' } }, 'primer.printed')
    expectIssueAt(
      publishedLoad,
      { ...load, primer: { printed: 'x', records: [] } },
      'primer.records',
    )
    expectIssueAt(
      publishedLoad,
      { ...load, primer: { printed: 'x', records: ['demo-primer-101'] } },
      'primer.records.0',
    )
    expectIssueAt(
      publishedLoad,
      { ...load, primer: { printed: 'x', size: 'medium' } },
      'primer.size',
    )
  })
})
