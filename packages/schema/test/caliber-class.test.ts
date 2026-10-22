import { describe, expect, it } from 'vitest'
import { caliberClasses } from '../src/index.ts'

describe('caliber classes', () => {
  it('has unique ids and every cartridge in one class only', () => {
    const all = caliberClasses.flatMap((c) => c.cartridges)
    expect(new Set(caliberClasses.map((c) => c.id)).size).toBe(caliberClasses.length)
    expect(new Set(all).size).toBe(all.length)
  })
})
