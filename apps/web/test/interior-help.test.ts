import { describe, expect, it } from 'vitest'
import de from '../src/i18n/de.json'
import { interiorFields } from '../src/lib/interior-input.ts'

describe('the help of the interior fields', () => {
  it('is there for every field, in English and German', () => {
    const catalogue = de as Record<string, unknown>
    for (const f of interiorFields) {
      expect('help' in f && f.help, f.key).toBeTruthy()
      if ('help' in f) expect(catalogue[f.help], f.key).toBeTruthy()
    }
  })

  it('makes no safe claim', () => {
    for (const f of interiorFields) if ('help' in f) expect(f.help).not.toMatch(/\bsafe/i)
  })
})
