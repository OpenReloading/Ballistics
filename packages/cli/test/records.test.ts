import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { loadRecords } from '../src/records.ts'
import { recordRoots } from './fixture.ts'

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
    const after = loadRecords([...recordRoots, rootWith(`${capacity.id}-z`, 9.9)])
    expect(after.capacities.get(cartridge)?.id).toBe(capacity.id)
    const before = loadRecords([...recordRoots, rootWith(`a-${capacity.id}`, 9.9)])
    expect(before.capacities.get(cartridge)?.waterCapacity.value).toBe(9.9)
    expect(before.issues).toBe(0)
  })
})
