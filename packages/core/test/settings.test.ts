import { describe, expect, it } from 'vitest'
import { overlay } from '../src/settings.ts'

describe('overlay', () => {
  it('keeps the base value for an entry that is absent or undefined', () => {
    const base = { a: 1, b: 2, c: 3 }
    const settings = { a: 10, b: undefined }
    expect(overlay(base, settings)).toEqual({ a: 10, b: 2, c: 3 })
    expect(overlay(base, undefined)).toEqual(base)
    expect(base).toEqual({ a: 1, b: 2, c: 3 })
  })
})
