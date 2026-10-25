import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readRecords } from '../src/records.ts'

const provenance = { kind: 'published', sources: [{ title: 'Test' }] }

/** The result of a copy of the valid fixtures after `change`, which gets the root. */
function readAfter(change: (root: string) => void) {
  const root = mkdtempSync(join(tmpdir(), 'renames-'))
  cpSync(join(import.meta.dirname, 'fixtures', 'valid'), root, { recursive: true })
  try {
    change(root)
    return readRecords(root)
  } finally {
    rmSync(root, { recursive: true })
  }
}

const write = (root: string, path: string, json: object) =>
  writeFileSync(join(root, path), JSON.stringify(json))

/** Points the field of a fixture record at `value`. */
function point(root: string, path: string, field: string, value: string) {
  const file = join(root, path)
  writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), [field]: value }))
}

describe('renames.json', () => {
  it('fails on a dangling reference and accepts one that a rename covers', () => {
    const dangling = (root: string) =>
      write(root, 'capacities/test-capacity.json', {
        id: 'test-capacity',
        cartridge: 'old-cartridge',
        waterCapacity: { value: 3.5 },
        provenance,
      })
    expect(readAfter(dangling).errors).toEqual([
      'capacities/test-capacity.json: unknown cartridge "old-cartridge"',
    ])
    const covered = readAfter((root) => {
      dangling(root)
      write(root, 'renames.json', { cartridges: { 'old-cartridge': 'test-cartridge' } })
    })
    expect(covered.errors).toEqual([])
    expect(covered.bundle.renames).toEqual({ cartridges: { 'old-cartridge': 'test-cartridge' } })
  })

  it('covers a manufacturer, a discipline and a target face by their renames', () => {
    const { errors } = readAfter((root) => {
      write(root, 'powders/test-powder.json', {
        id: 'test-powder',
        manufacturer: 'old-manufacturer',
        name: 'Test',
        provenance,
      })
      point(root, 'target-mappings/test-discipline-test-face.json', 'face', 'old-face')
      point(root, 'target-mappings/test-discipline-test-face.json', 'discipline', 'old-discipline')
      write(root, 'renames.json', {
        manufacturers: { 'old-manufacturer': 'test-manufacturer' },
        'target-faces': { 'old-face': 'test-face' },
        disciplines: { 'old-discipline': 'test-discipline' },
      })
    })
    expect(errors).not.toContainEqual(expect.stringContaining('unknown'))
    expect(errors).not.toContainEqual(expect.stringContaining('no target mapping'))
  })

  it('reports a rename of a record that still exists, a replacement that does not, and a bad file', () => {
    const { errors } = readAfter((root) =>
      write(root, 'renames.json', {
        cartridges: { 'test-cartridge': 'test-cartridge', 'old-a': 'gone' },
      }),
    )
    expect(errors).toEqual([
      'renames.json: cartridges.test-cartridge: "test-cartridge" is still a record',
      'renames.json: cartridges.old-a: replacement "gone" is no record',
    ])
    expect(
      readAfter((root) => write(root, 'renames.json', { loads: { a: 'b' } })).errors,
    ).toHaveLength(1)
    expect(
      readAfter((root) => writeFileSync(join(root, 'renames.json'), '{ "a": ')).errors[0],
    ).toMatch(/^renames\.json: invalid JSON/)
  })

  it('reads the renames of every root', () => {
    const second = mkdtempSync(join(tmpdir(), 'renames-second-'))
    try {
      write(second, 'renames.json', { cartridges: { 'old-b': 'test-cartridge' } })
      const { bundle, errors } = readRecords([
        join(import.meta.dirname, 'fixtures', 'valid'),
        second,
      ])
      expect(errors).toEqual([])
      expect(bundle.renames).toEqual({ cartridges: { 'old-b': 'test-cartridge' } })
    } finally {
      rmSync(second, { recursive: true })
    }
  })
})
