import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { alphaNote } from '../src/lib/alpha.ts'

it("the README's early-alpha note says what the Alpha badge's tooltip says", () => {
  const readme = readFileSync(new URL('../../../README.md', import.meta.url), 'utf8')
  expect(alphaNote).toBe('Alpha version: breaking changes are to be expected.')
  expect(readme).toContain('**Alpha version:** breaking changes are to be expected')
})
