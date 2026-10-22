import { expect, it } from 'vitest'
import { chronoFormats } from '../src/index.ts'

it('gives each entry of chronoFormats its own id', () => {
  const ids = chronoFormats.map((f) => f.id)
  expect(new Set(ids).size).toBe(ids.length)
})
