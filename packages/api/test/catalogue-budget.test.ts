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

  it('has the index of the public bundle ready in under 50 ms from the records', () => {
    expect(best(() => openCatalogue(buildCatalogue(bundle)))).toBeLessThan(50)
  })

  it('has it ready in under 9 ms from the prebuilt index text', () => {
    const text = JSON.stringify(buildCatalogue(bundle).index)
    expect(
      best(() => openCatalogue({ index: JSON.parse(text), records: () => ({}) as never })),
    ).toBeLessThan(9)
  })

  it('answers a ranked page of cartridges in under 5 ms', () => {
    const catalogue = openCatalogue(buildCatalogue(bundle))
    expect(catalogue.cartridges({ q: 'win 308', limit: 50 }).total).toBeGreaterThan(0)
    expect(best(() => catalogue.cartridges({ q: 'win 308', limit: 50 }))).toBeLessThan(5)
  })

  it('keeps the index the static site downloads under 600 KB, 80 KB gzipped', () => {
    const text = Buffer.from(JSON.stringify(buildCatalogue(bundle).index))
    expect(text.length).toBeLessThan(600_000)
    expect(gzipSync(text).length).toBeLessThan(80_000)
  })
})
