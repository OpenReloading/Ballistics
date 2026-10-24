import type { CaliberClass, Cartridge } from '@openreloading/schema'
import { describe, expect, it } from 'vitest'
import { checkCaliberClasses } from '../src/caliber-classes.ts'
import { readRecords } from '../src/records.ts'

const provenance = { kind: 'derived' as const, sources: [{ title: 'Test' }] }
const cartridge = (id: string, g1?: number): Cartridge =>
  ({
    id,
    values:
      g1 === undefined ? [] : [{ side: 'cartridge', symbol: 'G1', quantity: 'length', value: g1 }],
  }) as unknown as Cartridge
const cls = (id: string, diameter: number, cartridges: string[]): CaliberClass => ({
  id,
  name: id,
  diameter: { value: diameter },
  cartridges,
  provenance,
})
const check = (
  caliberClasses: CaliberClass[],
  disciplineClasses: string[] = [],
  renames?: Parameters<typeof checkCaliberClasses>[0]['renames'],
) =>
  checkCaliberClasses({
    caliberClasses,
    cartridges: [cartridge('a', 5.6), cartridge('b', 5.65), cartridge('c', 6.2), cartridge('d')],
    disciplines: [
      { id: 'disc', caliberClasses: { ids: disciplineClasses, basis: 'stated' } },
    ] as never,
    renames,
  })

describe('checkCaliberClasses', () => {
  it('accepts members within 0.15 mm of G1 and a class without members', () => {
    expect(check([cls('x', 5.6, ['a', 'b']), cls('air', 4.5, [])], ['x', 'air'])).toEqual([])
  })

  it('names an unknown member, a member of two classes, a missing G1 and a diameter off G1', () => {
    expect(check([cls('x', 5.6, ['a', 'gone', 'd', 'c']), cls('y', 5.6, ['a'])])).toEqual([
      'caliber-classes/x.json: unknown cartridge "gone"',
      'caliber-classes/x.json: cartridge "d" has no G1',
      'caliber-classes/x.json: diameter 5.6 mm is more than 0.15 mm from G1 6.2 mm of "c"',
      'caliber-classes/y.json: cartridge "a" is also in x',
    ])
  })

  it('resolves a renamed cartridge and class, and names a class no record answers', () => {
    const renames = { cartridges: { old: 'a' }, 'caliber-classes': { 'old-class': 'x' } }
    expect(check([cls('x', 5.6, ['old'])], ['old-class'], renames)).toEqual([])
    expect(check([cls('x', 5.6, [])], ['nope'])).toEqual([
      'disciplines/disc.json: unknown caliber class "nope"',
    ])
  })
})

describe('the caliber class records', () => {
  const { bundle, errors } = readRecords()
  it('are valid against the C.I.P. records and every discipline', () => {
    expect(errors).toEqual([])
    expect(bundle.caliberClasses.length).toBeGreaterThan(0)
  })
})
