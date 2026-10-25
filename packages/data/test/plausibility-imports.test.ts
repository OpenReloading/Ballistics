import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// the web app runs checkSpec in the browser through this subpath
describe('@open-reloading/data/plausibility', () => {
  it('imports types from @open-reloading/schema only', () => {
    const source = readFileSync(new URL('../src/plausibility.ts', import.meta.url), 'utf8')
    const imports = [...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gms)].map(
      ([, type, from]) => `${type ? 'type ' : ''}${from}`,
    )
    expect(imports).toEqual(['type @open-reloading/schema'])
  })
})
