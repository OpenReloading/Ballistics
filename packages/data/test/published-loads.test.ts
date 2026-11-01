import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import type { PublishedLoads } from '@open-reloading/schema'
import { describe, expect, it } from 'vitest'
import { checkPublishedLoadPlausibility } from '../src/published-loads.ts'
import { readRecords } from '../src/records.ts'

const fixtures = join(import.meta.dirname, 'fixtures', 'valid')

const tableSource = [
  {
    title: 'Test Manufacturer load table',
    publisher: 'Test Manufacturer',
    url: 'https://example.org/table.pdf',
    retrieved: '2026-10-12',
    origin: 'manufacturer',
  },
]

const sources = [{ source: 'test-table' }]

const nameOnlyBullet = {
  id: 'test-manufacturer-fmj-123gr-308',
  manufacturer: 'test-manufacturer',
  name: 'FMJ 123 gr .308',
  nameOnly: true,
  mass: { value: 7.970266, raw: '123 gr' },
  provenance: { kind: 'published', sources: [{ source: 'test-table', fields: ['mass'] }] },
}

const powder = {
  id: 'test-powder',
  manufacturer: 'test-manufacturer',
  name: 'Test powder',
  provenance: { kind: 'published', sources },
}

const load = (id: string, extra: object = {}) => ({
  id,
  bullet: {
    printed: 'FMJ',
    mass: { value: 7.970266, raw: '123 gr' },
    record: `catalogue:${nameOnlyBullet.id}`,
  },
  powder: { printed: 'Test powder' },
  primer: {
    printed: 'Test primer, Large Rifle',
    records: ['catalogue:test-primer'],
    size: 'large-rifle',
    magnum: false,
  },
  barrel: { length: { value: 609.6, raw: '24"' }, twist: { value: 304.8, raw: '1:12"' } },
  charges: [
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
    },
  ],
  page: '76',
  ...extra,
})

const file = (loads: object[] = [load('a'), load('b')], extra: object = {}) => ({
  id: 'test-manufacturer',
  maker: 'test-manufacturer',
  producedBy: 'maker',
  cartridgeName: 'Test cartridge',
  cartridge: 'catalogue:test-cartridge',
  loads: loads.map((l) => ({
    ...l,
    powder: { printed: 'Test powder', record: 'catalogue:test-powder' },
  })),
  provenance: { kind: 'published', sources },
  ...extra,
})

/** The read of a copy of the valid fixtures with the name-only bullet, the powder and `change`. */
function readAfter(change: (write: (path: string, json: object) => void) => void) {
  const root = mkdtempSync(join(tmpdir(), 'published-loads-'))
  cpSync(fixtures, root, { recursive: true })
  const write = (path: string, json: object) => {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), JSON.stringify(json))
  }
  try {
    write('sources/test-table.json', { id: 'test-table', ...tableSource[0] })
    write(`bullets/${nameOnlyBullet.id}.json`, nameOnlyBullet)
    write('powders/test-powder.json', powder)
    change(write)
    return readRecords(root)
  } finally {
    rmSync(root, { recursive: true })
  }
}

const errorsOf = (content: object, path = 'loads/test-cartridge/test-manufacturer.json') =>
  readAfter((write) => write(path, content)).errors

describe('published load files', () => {
  it('reads a valid file next to the plain loads, and keeps it out of the bundle', () => {
    const { bundle, publishedLoads, errors } = readAfter((write) =>
      write('loads/test-cartridge/test-manufacturer.json', file()),
    )
    expect(errors).toEqual([])
    expect(publishedLoads.map((f) => f.id)).toEqual(['test-manufacturer'])
    expect(publishedLoads[0]?.loads.map((l) => l.id)).toEqual(['a', 'b'])
    expect(bundle.loads.map((l) => l.id)).toEqual(['test-load'])
    expect(Object.keys(bundle)).not.toContain('publishedLoads')
  })

  it('reads no file where there is no cartridge folder', () => {
    expect(readAfter(() => {}).publishedLoads).toEqual([])
  })

  it('reports a schema break with the file path', () => {
    const errors = errorsOf(file(undefined, { producedBy: 'nobody' }))
    expect(
      errors.some((e) => e.startsWith('loads/test-cartridge/test-manufacturer.json: producedBy')),
    ).toBe(true)
  })

  it('needs the folder to be the cartridge and the cartridge to exist', () => {
    expect(errorsOf(file(undefined, { cartridge: 'catalogue:other' }))).toContain(
      'loads/test-cartridge/test-manufacturer.json: cartridge "catalogue:other" is not the folder "test-cartridge"',
    )
    expect(
      errorsOf(
        file(undefined, { cartridge: 'catalogue:missing' }),
        'loads/missing/test-manufacturer.json',
      ),
    ).toContain('loads/missing/test-manufacturer.json: unknown cartridge "catalogue:missing"')
  })

  it('needs a maker record and a file named for the maker, or for its customers', () => {
    expect(
      errorsOf(
        file(undefined, { maker: 'nobody', id: 'nobody' }),
        'loads/test-cartridge/nobody.json',
      ),
    ).toContain('loads/test-cartridge/nobody.json: unknown maker "nobody"')
    expect(errorsOf(file(undefined, { id: 'other' }), 'loads/test-cartridge/other.json')).toContain(
      'loads/test-cartridge/other.json: a table produced by the maker is named "test-manufacturer"',
    )
    expect(
      errorsOf(
        file(undefined, { producedBy: 'customer' }),
        'loads/test-cartridge/test-manufacturer.json',
      ),
    ).toContain(
      'loads/test-cartridge/test-manufacturer.json: a table produced by the customer is named "test-manufacturer-customer"',
    )
    expect(
      errorsOf(
        file(undefined, { producedBy: 'customer', id: 'test-manufacturer-customer' }),
        'loads/test-cartridge/test-manufacturer-customer.json',
      ),
    ).toEqual([])
  })

  it('keeps the loads unique and sorted by id', () => {
    const where = 'loads/test-cartridge/test-manufacturer.json'
    expect(errorsOf(file([load('b'), load('a')]))).toContain(
      `${where}: load "a" is not in id order`,
    )
    expect(errorsOf(file([load('a'), load('a')]))).toContain(`${where}: duplicate load id "a"`)
  })

  it('needs the bullet, powder and primer records a load names', () => {
    const where = 'loads/test-cartridge/test-manufacturer.json: loads a'
    const bullet = {
      printed: 'FMJ',
      mass: { value: 7.970266, raw: '123 gr' },
      record: 'catalogue:missing-bullet',
    }
    const errors = errorsOf(
      file([
        load('a', { bullet, primer: { printed: 'x', records: ['catalogue:missing-primer'] } }),
      ]),
    )
    expect(errors).toContain(`${where}: unknown bullet "catalogue:missing-bullet"`)
    expect(errors).toContain(`${where}: unknown primer "catalogue:missing-primer"`)
    const unknownPowder = file([load('a')])
    unknownPowder.loads = unknownPowder.loads.map((l) => ({
      ...l,
      powder: { printed: 'x', record: 'catalogue:missing-powder' },
    }))
    expect(errorsOf(unknownPowder)).toContain(`${where}: unknown powder "catalogue:missing-powder"`)
  })

  it('takes an old primer id that renames.json replaces as a known primer', () => {
    const { errors } = readAfter((write) => {
      write(
        'loads/test-cartridge/test-manufacturer.json',
        file([load('a', { primer: { printed: 'x', records: ['catalogue:old-primer'] } })]),
      )
      write('renames.json', { primers: { 'old-primer': 'test-primer' } })
    })
    expect(errors).toEqual([])
  })

  it('reports a printed size or magnum that differs from the primer record', () => {
    const where = 'loads/test-cartridge/test-manufacturer.json: loads a'
    const { errors } = readAfter((write) => {
      write('primers/stated-primer.json', {
        id: 'stated-primer',
        manufacturer: 'test-manufacturer',
        name: 'Stated primer',
        size: 'large-rifle',
        magnum: false,
        provenance: { kind: 'published', sources: [{ title: 'Test', fields: ['size', 'magnum'] }] },
      })
      write(
        'loads/test-cartridge/test-manufacturer.json',
        file([
          load('a', {
            primer: {
              printed: 'x',
              records: ['catalogue:stated-primer'],
              size: 'small-rifle',
              magnum: true,
            },
          }),
        ]),
      )
    })
    expect(errors).toContain(
      `${where}: primer size small-rifle differs from stated-primer (large-rifle)`,
    )
    expect(errors).toContain(`${where}: primer magnum differs from stated-primer`)
  })

  it('reports a value that does not follow its printed text', () => {
    const where = 'loads/test-cartridge/test-manufacturer.json: loads a'
    const wrong = load('a', {
      barrel: { length: { value: 600, raw: '24"' } },
      charges: [
        {
          kind: 'max',
          charge: { value: 3.24, raw: '50.0 gr' },
          velocity: { value: 801.6, raw: '2630 fps' },
          pressure: { unit: 'psi', peak: { value: 938, raw: '13,600 PSI' } },
        },
      ],
    })
    const errors = errorsOf(file([wrong]))
    expect(errors).toContain(`${where}: barrel.length: value 600 does not follow "24""`)
    expect(errors).toContain(`${where}: charges.0.charge: value 3.24 does not follow "50.0 gr"`)
    expect(errors).toContain(`${where}: charges.0.velocity: value 801.6 does not follow "2630 fps"`)
    expect(errors).toContain(
      `${where}: charges.0.pressure.peak: value 938 does not follow "13,600 PSI"`,
    )
  })

  it('reads the printed text of a pair, a decimal comma, a unit-less figure, a twist and a distance', () => {
    const l = load('a', {
      bullet: {
        printed: 'FMJ',
        mass: { value: 7.970266, raw: '7,97 g / 123 grs' },
        diameter: { value: 7.8232, raw: '.308 in' },
      },
      coal: { value: 70, raw: 'Flush', limit: 'min' },
      barrel: { length: { value: 609.6, raw: '24 in' }, twist: { value: 177.8, raw: '1 - 7"' } },
      charges: [
        {
          kind: 'max',
          charge: { value: 2.118924, raw: '32.7', assumedUnit: 'gr' },
          pressure: { unit: 'CUP', peak: { raw: '35,400 CUP' } },
          velocity: {
            value: 800,
            raw: '800 m/s',
            point: { label: 'V5', distance: { value: 5000, raw: '5 m' } },
          },
        },
      ],
    })
    // a printed text with no unit and none assumed is not read, and the CUP figure has no value
    expect(errorsOf(file([l]))).toEqual([])
  })

  it('does not read a figure that prints no unit, an unknown unit or a number without a unit after the first', () => {
    const charge = (raw: string, assumedUnit?: string) => ({
      kind: 'max',
      charge: { value: 1, raw, ...(assumedUnit && { assumedUnit }) },
    })
    for (const c of [charge('32.7'), charge('3 tr'), charge('1 g / 7', 'g')])
      expect(errorsOf(file([load('a', { charges: [c] })]))).toEqual([])
  })

  it('takes a magnum primer record with a printed magnum', () => {
    const { errors } = readAfter((write) => {
      write('primers/magnum-primer.json', {
        id: 'magnum-primer',
        manufacturer: 'test-manufacturer',
        name: 'Magnum primer',
        size: 'large-rifle',
        magnum: true,
        provenance: { kind: 'published', sources: [{ title: 'Test', fields: ['size', 'magnum'] }] },
      })
      write(
        'loads/test-cartridge/test-manufacturer.json',
        file([
          load('a', {
            primer: { printed: 'LRM', records: ['catalogue:magnum-primer'], magnum: true },
          }),
        ]),
      )
    })
    expect(errors).toEqual([])
  })

  it('does not compare a printed magnum with a primer record that states none', () => {
    const { errors } = readAfter((write) => {
      write('primers/magnum-primer.json', {
        id: 'magnum-primer',
        manufacturer: 'test-manufacturer',
        name: 'Magnum primer',
        size: 'large-rifle',
        provenance: { kind: 'published', sources: [{ title: 'Test', fields: ['size'] }] },
      })
      write(
        'loads/test-cartridge/test-manufacturer.json',
        file([
          load('a', {
            primer: { printed: 'LRM', records: ['catalogue:magnum-primer'], magnum: true },
          }),
        ]),
      )
    })
    expect(errors).toEqual([])
  })

  it('rejects a value shifted by a decimal mark and a pressure unit the text does not print', () => {
    const where = 'loads/test-cartridge/test-manufacturer.json: loads a'
    const shifted = load('a', {
      bullet: { printed: 'x', mass: { value: 330, raw: '3,30 g' } },
      barrel: { length: { value: 71120, raw: '2.800"' } },
      charges: [
        {
          kind: 'max',
          charge: { value: 1, raw: '1 g' },
          pressure: { unit: 'bar', peak: { value: 3792.3, raw: '55,000 psi' } },
        },
      ],
    })
    const errors = errorsOf(file([shifted]))
    expect(errors).toContain(`${where}: bullet.mass: value 330 does not follow "3,30 g"`)
    expect(errors).toContain(`${where}: barrel.length: value 71120 does not follow "2.800""`)
    expect(errors).toContain(`${where}: charges.0.pressure.unit bar is not in "55,000 psi"`)
  })

  it('reads a twist written 1 in 10', () => {
    const l = load('a', { barrel: { twist: { value: 254, raw: '1 in 10"' } } })
    expect(errorsOf(file([l]))).toEqual([])
  })

  it('refuses a full bullet record without its diameter or product number, and a name-only one with a product number', () => {
    const { errors } = readAfter((write) => {
      write('bullets/full-bullet.json', {
        ...nameOnlyBullet,
        id: 'full-bullet',
        nameOnly: undefined,
        name: 'Full',
      })
      write('bullets/named-bullet.json', {
        ...nameOnlyBullet,
        id: 'named-bullet',
        name: 'Named',
        productNumber: '1',
      })
    })
    expect(errors).toContain(
      'bullets/full-bullet.json: productNumber: a full record needs a product number',
    )
    expect(errors).toContain('bullets/full-bullet.json: diameter: a full record needs a diameter')
    expect(errors).toContain(
      'bullets/named-bullet.json: productNumber: a name-only record has no product number',
    )
  })
})

describe('plausibility warnings of published loads', () => {
  const where = 'loads/test-cartridge/test-manufacturer.json: loads a'
  const testCartridge = JSON.parse(
    readFileSync(join(fixtures, 'cartridges', 'test-cartridge.json'), 'utf8'),
  )
  /** The test cartridge with a maximum cartridge length L6 of 60 mm. */
  const withL6 = {
    ...testCartridge,
    values: [
      ...testCartridge.values,
      { side: 'cartridge', symbol: 'L6', quantity: 'length', value: 60 },
    ],
  }
  const bar = (value: number, method = 'transducer') => ({
    unit: 'bar',
    peak: { value, raw: `${value} bar` },
    method,
    methodBasis: 'stated',
  })
  const charge = (kind: string, grams: number, extra: object = {}) => ({
    kind,
    charge: { value: grams, raw: `${grams} g` },
    ...extra,
  })
  const velocity = (value: number) => ({ value, raw: `${value} m/s` })
  /** A start and a max charge in order, each with a velocity and a transducer pressure. */
  const consistent = [
    charge('start', 2.5, { velocity: velocity(700), pressure: bar(3000) }),
    charge('max', 2.8, { velocity: velocity(750), pressure: bar(3500) }),
  ]
  const readWith = (extra: object, cartridge: object = withL6) =>
    readAfter((write) => {
      write('cartridges/test-cartridge.json', cartridge)
      write('loads/test-cartridge/test-manufacturer.json', file([load('a', extra)]))
    })

  it('finds nothing in a consistent load', () => {
    const { errors, warnings } = readWith({
      charges: consistent,
      coal: { value: 59, raw: '59 mm' },
    })
    expect(errors).toEqual([])
    expect(warnings).toEqual([])
  })

  it('warns, without an error, of a start charge above the max charge', () => {
    const { errors, warnings } = readWith({
      charges: [charge('start', 3), charge('max', 2.8)],
    })
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      `${where}: start-above-max: the start charge 3 g is above the max charge 2.8 g`,
    ])
  })

  it('warns of a max charge velocity below the start charge at the same point only', () => {
    const slow = [
      charge('start', 2.5, { velocity: velocity(760) }),
      charge('max', 2.8, { velocity: velocity(750) }),
    ]
    const { errors, warnings } = readWith({ charges: slow })
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      `${where}: velocity-order: the velocity of the max charge, 750 m/s, is below that of the start charge, 760 m/s`,
    ])
    const elsewhere = [
      charge('start', 2.5, { velocity: { ...velocity(760), point: { label: 'V0' } } }),
      charge('max', 2.8, { velocity: { ...velocity(750), point: { label: 'V5' } } }),
    ]
    expect(readWith({ charges: elsewhere }).warnings).toEqual([])
    const sameSymbol = [
      charge('start', 2.5, { velocity: { ...velocity(760), point: { label: 'V0' } } }),
      charge('max', 2.8, {
        velocity: { ...velocity(750), point: { label: 'V0', distance: { value: 0, raw: '0 m' } } },
      }),
    ]
    expect(readWith({ charges: sameSymbol }).warnings).toHaveLength(1)
    const otherDistance = [
      charge('start', 2.5, {
        velocity: { ...velocity(760), point: { label: 'V', distance: { value: 0, raw: '0 m' } } },
      }),
      charge('max', 2.8, {
        velocity: {
          ...velocity(750),
          point: { label: 'V', distance: { value: 5000, raw: '5 m' } },
        },
      }),
    ]
    expect(readWith({ charges: otherDistance }).warnings).toEqual([])
  })

  it('warns of a max charge pressure below the start charge on the same unit and method only', () => {
    const low = [
      charge('start', 2.5, { pressure: bar(3500) }),
      charge('max', 2.8, { pressure: bar(3000) }),
    ]
    const { errors, warnings } = readWith({ charges: low })
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      `${where}: pressure-order: the pressure of the max charge, 3000 bar, is below that of the start charge, 3500 bar`,
    ])
    const otherMethod = [
      charge('start', 2.5, { pressure: bar(3500) }),
      charge('max', 2.8, { pressure: bar(3000, 'case-contact') }),
    ]
    expect(readWith({ charges: otherMethod }).warnings).toEqual([])
  })

  it('warns of a pressure above Pmax on the cartridge record method, and compares no other basis', () => {
    const high = [charge('max', 2.8, { pressure: bar(4100) })]
    const { errors, warnings } = readWith({ charges: high })
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      `${where}: pressure-above-cartridge-max: the max pressure 4100 bar (transducer) is above Pmax 4000 bar of test-cartridge`,
    ])
    const cup = {
      unit: 'CUP',
      peak: { raw: '60,000 CUP' },
      method: 'crusher',
      methodBasis: 'from-unit',
    }
    for (const pressure of [
      bar(4100, 'case-contact'),
      cup,
      { unit: 'bar', peak: { value: 4100, raw: '4100 bar' } },
    ])
      expect(readWith({ charges: [charge('max', 2.8, { pressure })] }).warnings).toEqual([])
    const { pressureMethod: _, ...noMethod } = withL6
    expect(readWith({ charges: high }, noMethod).warnings).toEqual([])
  })

  it('warns of a COAL above L6', () => {
    const { errors, warnings } = readWith({ coal: { value: 61, raw: '61 mm' } })
    expect(errors).toEqual([])
    expect(warnings).toEqual([
      `${where}: coal-above-cartridge-max: COAL 61 mm is above L6 60 mm of test-cartridge`,
    ])
    // without an L6 the COAL is not compared
    expect(readWith({ coal: { value: 61, raw: '61 mm' } }, testCartridge).warnings).toEqual([])
  })

  it('checks only the order without a cartridge record', () => {
    const findings = checkPublishedLoadPlausibility(
      file([
        load('a', { charges: [charge('start', 3), charge('max', 2.8)] }),
      ]) as unknown as PublishedLoads,
      undefined,
    )
    expect(findings.map((f) => [f.load, f.finding])).toEqual([['a', 'start-above-max']])
  })
})
