import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// the web app runs checkSpec in the browser through this subpath
describe('@openreloading/data/plausibility', () => {
  it('imports types from @openreloading/schema only', () => {
    const source = readFileSync(new URL('../src/plausibility.ts', import.meta.url), 'utf8')
    const imports = [...source.matchAll(/^import\s+(type\s+)?[^;]*?from\s+'([^']+)'/gms)].map(
      ([, type, from]) => `${type ? 'type ' : ''}${from}`,
    )
    expect(imports).toEqual(['type @openreloading/schema'])
  })
})
