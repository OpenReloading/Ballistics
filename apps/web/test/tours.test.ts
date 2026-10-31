import { readdirSync, readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import { parseSeen, tours } from '../src/lib/tours.ts'

const dir = new URL('../src/components/', import.meta.url)
const sources = readdirSync(dir)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => readFileSync(new URL(f, dir), 'utf8'))
  .join('\n')

/** Whether a component sets the class `.name` or the id `#name` of a step's target. */
const rendered = (selector: string) => {
  const name = selector.slice(1)
  const pattern = selector.startsWith('#')
    ? new RegExp(`\\bid="${name}"`)
    : new RegExp(`className=["{\`][^"}\`]*\\b${name}\\b`)
  return pattern.test(sources)
}

it('every step of every tour points at an element a component renders', () => {
  for (const [page, steps] of Object.entries(tours))
    for (const step of steps) {
      for (const selector of step.target.split(', ').map((s) => s.replace(/ button$/, ''))) {
        expect(selector, `${page}: ${selector}`).toMatch(/^[.#][a-z][a-z-]*$/)
        expect(rendered(selector), `${page}: ${selector}`).toBe(true)
      }
    }
})

it('reads the seen pages one per line, an empty or missing value as none', () => {
  expect([...parseSeen('workbench\nsession\n')]).toEqual(['workbench', 'session'])
  expect(parseSeen('').size).toBe(0)
  expect(parseSeen(null).size).toBe(0)
})
