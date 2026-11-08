import { describe, expect, it } from 'vitest'
import { interiorFields } from '../src/lib/interior-input.ts'

describe('the help of the interior fields', () => {
  it('is there for every field', () => {
    for (const f of interiorFields) expect('help' in f && f.help, f.key).toBeTruthy()
  })
})
