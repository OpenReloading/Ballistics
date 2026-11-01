import { performance } from 'node:perf_hooks'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '../src/bundle.ts'
import { buildCatalogue } from '../src/catalogue/build.ts'
import { openCatalogue } from '../src/catalogue/open.ts'

/**
 * The best wall time of `run` in ms over `rounds` runs after one warm-up run: other test files
 * share the CPU, and a slow slice of one run says nothing about the code.
 */
function best(run: () => unknown, rounds = 15) {
  run()
  return Math.min(
    ...Array.from({ length: rounds }, () => {
      const start = performance.now()
      run()
      return performance.now() - start
    }),
  )
}

describe('catalogue budgets', () => {
  const bundle = loadBundle()

  // about 17 ms on a desktop and 50 to 70 ms on a CI runner under the coverage run, since the bundle grew
  // with the published records (#850)
  it('has the index of the public bundle ready in under 100 ms from the records', () => {
    expect(best(() => openCatalogue(buildCatalogue(bundle)))).toBeLessThan(100)
  })

  // about 3 ms on a desktop and 9 to 10 ms on a CI runner under the coverage run, since the index
  // carries the bullet construction columns (#872) and the powders' training rows (#885)
  it('has it ready in under 15 ms from the prebuilt index text', () => {
    const text = JSON.stringify(buildCatalogue(bundle).index)
    expect(
      best(() => openCatalogue({ index: JSON.parse(text), records: () => ({}) as never })),
    ).toBeLessThan(15)
  })

  it('answers a ranked page of cartridges in under 5 ms', () => {
    const catalogue = openCatalogue(buildCatalogue(bundle))
    expect(catalogue.cartridges({ q: 'win 308', limit: 50 }).total).toBeGreaterThan(0)
    expect(best(() => catalogue.cartridges({ q: 'win 308', limit: 50 }))).toBeLessThan(5)
  })

  it('keeps the index the static site downloads under 1.5 MB, 160 KB gzipped', () => {
    const text = Buffer.from(JSON.stringify(buildCatalogue(bundle).index))
    expect(text.length).toBeLessThan(1_500_000)
    expect(gzipSync(text).length).toBeLessThan(160_000)
  })
})
