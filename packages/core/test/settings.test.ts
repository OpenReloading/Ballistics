import { describe, expect, it } from 'vitest'
import { overlay } from '../src/errors.ts'

describe('overlay', () => {
  it('keeps the base value for an entry that is absent or undefined', () => {
    const base = { a: 1, b: 2, c: 3 }
    const settings = { a: 10, b: undefined }
    expect(overlay(base, settings)).toEqual({ a: 10, b: 2, c: 3 })
    expect(overlay(base, undefined)).toEqual(base)
    expect(base).toEqual({ a: 1, b: 2, c: 3 })
  })

  it('ignores inherited entries, as a spread does', () => {
    const inherited: { a?: number } = Object.create({ a: 10 })
    expect(overlay({ a: 1 }, inherited)).toEqual({ a: 1 })
  })
})
