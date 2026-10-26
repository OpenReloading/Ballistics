import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkCase } from '../src/plausibility.ts'
import { readRecords } from '../src/records.ts'

const fixtures = join(import.meta.dirname, 'fixtures', 'valid')

const provenance = { kind: 'published', sources: [{ title: 'Test catalogue' }] }
const record = {
  id: 'test-case',
  origin: 'catalogue',
  name: 'Test case',
  manufacturer: 'catalogue:test-manufacturer',
  cartridge: 'catalogue:test-cartridge',
  productNumber: 'T1',
  material: 'brass',
  provenance,
}

/** The errors of a copy of the valid fixtures that holds `cases` (file name without `.json` to record). */
function errorsWith(cases: Record<string, object>, renames?: object) {
  const root = mkdtempSync(join(tmpdir(), 'cases-'))
  cpSync(fixtures, root, { recursive: true })
  try {
    for (const [id, json] of Object.entries(cases))
      writeFileSync(join(root, 'cases', `${id}.json`), JSON.stringify(json))
    if (renames) writeFileSync(join(root, 'renames.json'), JSON.stringify(renames))
    return readRecords(root)
  } finally {
    rmSync(root, { recursive: true })
  }
}

describe('case records', () => {
  it('reads a valid record into the bundle', () => {
    const { bundle, errors } = errorsWith({ 'test-case': record })
    expect(errors).toEqual([])
    expect(bundle.cases.map((c) => c.id)).toEqual(['test-case'])
  })

  it('reports a record that breaks the schema, with its path', () => {
    const { errors } = errorsWith({ 'test-case': { ...record, material: 'titanium' } })
    expect(errors.some((e) => e.startsWith('cases/test-case.json: material:'))).toBe(true)
  })

  it('reports an unknown cartridge and an unknown manufacturer', () => {
    const { errors } = errorsWith({
      'test-case': {
        ...record,
        cartridge: 'catalogue:missing-cartridge',
        manufacturer: 'catalogue:missing-maker',
      },
    })
    expect(errors).toContain(
      'cases/test-case.json: unknown cartridge "catalogue:missing-cartridge"',
    )
    expect(errors).toContain('cases/test-case.json: unknown manufacturer "missing-maker"')
  })

  it('needs a source for every data field', () => {
    const { errors } = errorsWith({
      'test-case': {
        ...record,
        mass: { value: 11 },
        provenance: {
          kind: 'published',
          sources: [{ title: 'Test catalogue', fields: ['material'] }],
        },
      },
    })
    expect(errors).toContain('cases/test-case.json: field mass has no source')
  })

  it('reports a name two cases of one maker and cartridge share', () => {
    const { errors } = errorsWith({
      'test-case': record,
      'test-case2': { ...record, id: 'test-case2', productNumber: 'T2' },
    })
    expect(errors.some((e) => e.includes('cases/test-case2.json: duplicate-name:Test case'))).toBe(
      true,
    )
  })

  it('resolves a renamed case id through renames.json', () => {
    const { errors } = errorsWith({ 'test-case': record }, { cases: { 'old-case': 'test-case' } })
    expect(errors).toEqual([])
    const stale = errorsWith({ 'test-case': record }, { cases: { 'old-case': 'missing-case' } })
    expect(stale.errors).toContain(
      'renames.json: cases.old-case: replacement "missing-case" is no record',
    )
  })

  /** The errors about the case of a catalogue load over the valid fixtures plus the test case. */
  function caseErrors(load: { cartridge: string; record: string }, renames?: object) {
    const root = mkdtempSync(join(tmpdir(), 'cases-'))
    cpSync(fixtures, root, { recursive: true })
    try {
      writeFileSync(join(root, 'cases', 'test-case.json'), JSON.stringify(record))
      if (renames) writeFileSync(join(root, 'renames.json'), JSON.stringify(renames))
      writeFileSync(
        join(root, 'loads', 'test-load.json'),
        JSON.stringify({
          id: 'test-load',
          origin: 'catalogue',
          name: 'Test load',
          cartridge: load.cartridge,
          bullet: 'catalogue:test-bullet',
          powder: 'catalogue:test-powder',
          charge: { value: 3 },
          case: { record: load.record },
          provenance,
        }),
      )
      return readRecords(root).errors.filter((e) => /case "|unknown case/.test(e))
    } finally {
      rmSync(root, { recursive: true })
    }
  }

  it('reports a load whose case record is no record', () => {
    expect(
      caseErrors({ cartridge: 'catalogue:test-cartridge', record: 'catalogue:missing-case' }),
    ).toEqual(['loads/test-load.json: unknown case "catalogue:missing-case"'])
  })

  it('accepts a load whose case is a case of its cartridge', () => {
    expect(
      caseErrors({ cartridge: 'catalogue:test-cartridge', record: 'catalogue:test-case' }),
    ).toEqual([])
  })

  it('reports a load whose case belongs to another cartridge', () => {
    expect(
      caseErrors({ cartridge: 'catalogue:other-cartridge', record: 'catalogue:test-case' }),
    ).toEqual(['loads/test-load.json: case "catalogue:test-case" is a case of another cartridge'])
  })

  it('resolves a renamed case id and a renamed cartridge id of a load', () => {
    expect(
      caseErrors(
        { cartridge: 'catalogue:old-cartridge', record: 'catalogue:old-case' },
        { cases: { 'old-case': 'test-case' }, cartridges: { 'old-cartridge': 'test-cartridge' } },
      ),
    ).toEqual([])
  })

  it('accepts the demo case of the committed records', () => {
    const { bundle, errors } = readRecords()
    expect(errors).toEqual([])
    expect(bundle.cases.map((c) => c.id)).toContain('demo-case-308-brass')
  })
})

describe('checkCase', () => {
  const sheet = {
    values: [
      { side: 'cartridge' as const, symbol: 'P1', quantity: 'length' as const, value: 11.9 },
      { side: 'cartridge' as const, symbol: 'L3', quantity: 'length' as const, value: 51 },
    ],
  }

  it('accepts values in range, a capacity inside the case cylinder included', () => {
    expect(
      checkCase(
        { flashHole: { value: 2 }, mass: { value: 11.4 }, waterCapacity: { value: 3.6 } },
        sheet,
      ),
    ).toEqual([])
    expect(checkCase({}, undefined)).toEqual([])
  })

  it('reports a flash hole or mass outside the range, and a capacity above the cylinder', () => {
    const findings = checkCase(
      { flashHole: { value: 20 }, mass: { value: 0.01 }, waterCapacity: { value: 9 } },
      sheet,
    )
    expect(findings.map((f) => f.finding)).toEqual([
      'flashHole-range',
      'mass-range',
      'capacity-range',
    ])
  })
})
