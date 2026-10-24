import { performance } from 'node:perf_hooks'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '../src/bundle.ts'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { openCatalogue } from '../src/catalogue/open.ts'

/** The median wall time of `run` in ms over `rounds` runs after one warm-up run. */
function median(run: () => unknown, rounds = 5) {
  run()
  const times = Array.from({ length: rounds }, () => {
    const start = performance.now()
    run()
    return performance.now() - start
  }).sort((a, b) => a - b)
  return times[Math.floor(rounds / 2)]
}

describe('catalogue budgets', () => {
  const bundle = loadBundle()

  it('has the index of the public bundle ready in under 50 ms from the records', () => {
    expect(median(() => openCatalogue(buildCatalogue(bundle)))).toBeLessThan(50)
  })

  it('has it ready in under 9 ms from the prebuilt index text', () => {
    const text = JSON.stringify(buildCatalogue(bundle).index)
    expect(
      median(() => openCatalogue({ index: JSON.parse(text), records: () => ({}) as never })),
    ).toBeLessThan(9)
  })

  it('answers a ranked page of cartridges in under 5 ms', () => {
    const catalogue = openCatalogue(buildCatalogue(bundle))
    expect(catalogue.cartridges({ q: 'win 308', limit: 50 }).total).toBeGreaterThan(0)
    expect(median(() => catalogue.cartridges({ q: 'win 308', limit: 50 }))).toBeLessThan(5)
  })
})
