import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadRecords, withoutEstimates } from '../src/records.ts'
import { recordRoots, rootWithEstimate } from './fixture.ts'

const capacity = JSON.parse(
  readFileSync(
    join(import.meta.dirname, 'fixtures/records/capacities/synthetic-capacity-308-match.json'),
    'utf8',
  ),
)

/** A records root with one more capacity of the fixture's cartridge, `id` and `value` its own. */
function rootWith(id: string, value: number) {
  const root = mkdtempSync(join(tmpdir(), 'cli-records-'))
  mkdirSync(join(root, 'capacities'))
  writeFileSync(
    join(root, 'capacities', `${id}.json`),
    JSON.stringify({ ...capacity, id, waterCapacity: { value } }),
  )
  return root
}

describe('loadRecords', () => {
  it('takes the capacity of a cartridge that is first by id, whatever root it comes from', () => {
    const cartridge = capacity.cartridge.replace('catalogue:', '')
    const after = loadRecords([...recordRoots, rootWith(`${capacity.id}-z`, 4.2)])
    expect(after.capacities.get(cartridge)?.id).toBe(capacity.id)
    const before = loadRecords([...recordRoots, rootWith(`a-${capacity.id}`, 4.2)])
    expect(before.capacities.get(cartridge)?.waterCapacity.value).toBe(4.2)
    expect(before.issues).toBe(0)
  })

  it('takes the default of the cartridge over a capacity first by id and over a case', () => {
    const root = mkdtempSync(join(tmpdir(), 'cli-default-'))
    const write = (kind: string, record: { id: string; [field: string]: unknown }) => {
      mkdirSync(join(root, kind))
      writeFileSync(join(root, kind, `${record.id}.json`), JSON.stringify(record))
    }
    const cartridge = 'catalogue:223-rem'
    write('capacities', { ...capacity, id: '0-223-rem', cartridge, waterCapacity: { value: 1.8 } })
    write('cases', {
      id: 'test-case-223-rem',
      origin: 'catalogue',
      name: 'Test case',
      productNumber: 'T223',
      manufacturer: 'catalogue:demo-bullets',
      cartridge,
      material: 'brass',
      waterCapacity: { value: 1.9 },
      provenance: { kind: 'published', sources: [{ title: 'Test case maker' }] },
    })
    const r = loadRecords([...recordRoots, root])
    expect(r.capacities.get('223-rem')?.id).toBe('223-rem-wikipedia')
    expect(r.cases.has('223-rem')).toBe(false)
    expect(r.issues).toBe(0)
  })
})

describe('loadRecords with estimated capacities', () => {
  it('takes an estimate only for a cartridge without a measured capacity', () => {
    const cartridge = capacity.cartridge.replace('catalogue:', '')
    const r = loadRecords([
      ...recordRoots,
      rootWithEstimate(cartridge, 9.9),
      rootWithEstimate('7-62-x-54-r', 4.1),
    ])
    expect(r.capacities.get(cartridge)?.id).toBe(capacity.id)
    expect(r.capacities.get('7-62-x-54-r')?.waterCapacity.value).toBe(4.1)
    expect(withoutEstimates(r).capacities.has('7-62-x-54-r')).toBe(false)
  })
})
