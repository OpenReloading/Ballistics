import { describe, expect, it } from 'vitest'
import { renames } from '../src/index.ts'

describe('renames', () => {
  it('accepts old ids by kind, each with its replacement', () => {
    const file = { cartridges: { '308-win-old': '308-win' }, bullets: { a: 'b' } }
    expect(renames.parse(file)).toEqual(file)
    expect(renames.parse({})).toEqual({})
  })

  it('rejects a kind without an id route and an id that is no record id', () => {
    expect(renames.safeParse({ loads: { a: 'b' } }).success).toBe(false)
    expect(renames.safeParse({ cartridges: { 'Old Id': 'b' } }).success).toBe(false)
    expect(renames.safeParse({ cartridges: { a: 'New Id' } }).success).toBe(false)
  })
})
