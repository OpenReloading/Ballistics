import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { loadBundle } from '../src/bundle.ts'
import { buildCatalogue } from '../src/catalogue/build.ts'

describe('catalogue budgets', () => {
  const bundle = loadBundle()

  it('keeps the index the static site downloads under 1.5 MB, 160 KB gzipped', () => {
    const text = Buffer.from(JSON.stringify(buildCatalogue(bundle).index))
    expect(text.length).toBeLessThan(1_500_000)
    expect(gzipSync(text).length).toBeLessThan(160_000)
  })
})
