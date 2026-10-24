import { describe, expect, it } from 'vitest'
import { caliberClass } from '../src/index.ts'

const valid = {
  id: 'rimfire-22',
  name: '.22 rimfire',
  diameter: { value: 5.6 },
  cartridges: ['22-long-rifle'],
  provenance: { kind: 'derived', sources: [{ title: 'Test' }] },
}

describe('caliberClass', () => {
  it('accepts a class with and without member cartridges', () => {
    expect(caliberClass.safeParse(valid).success).toBe(true)
    expect(caliberClass.safeParse({ ...valid, cartridges: [] }).success).toBe(true)
  })

  it('rejects a bad id, a zero diameter, a member that is no record id and an unknown key', () => {
    for (const bad of [
      { ...valid, id: 'Rimfire 22' },
      { ...valid, diameter: { value: 0 } },
      { ...valid, cartridges: ['22 LR'] },
      { ...valid, label: 'x' },
    ])
      expect(caliberClass.safeParse(bad).success).toBe(false)
  })
})
