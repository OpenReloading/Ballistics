import { readdirSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'
import bad from './fixtures/bad-imports.json' with { type: 'json' }

/** The entry points each source folder may import from; `index.ts` at the root is the core. */
const allowed: Record<string, string[]> = {
  core: ['core'],
  cartridge: ['core', 'cartridge'],
  bullet: ['core', 'bullet'],
  seating: ['core', 'cartridge', 'bullet', 'seating'],
}

const folder = (file: string) => (file.includes('/') ? file.split('/')[0] : 'core')

/** The imports of sources keyed by their path below `src/` that break the import rules. */
function violations(files: Record<string, string>) {
  const found: string[] = []
  for (const [file, source] of Object.entries(files))
    for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
      const target = spec.startsWith('.') ? posix.join(posix.dirname(file), spec) : undefined
      const ok =
        target !== undefined &&
        !target.startsWith('..') &&
        allowed[folder(file)].includes(folder(target))
      if (!ok) found.push(`${file}: ${spec}`)
    }
  return found
}

const src = new URL('../src/', import.meta.url)
const sources = Object.fromEntries(
  readdirSync(src, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.ts'))
    .map((f) => [f.split('\\').join('/'), readFileSync(new URL(f, src), 'utf8')]),
)

describe('import rules', () => {
  it('hold for every source file', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(10)
    expect(violations(sources)).toEqual([])
  })

  it('name each import of the fixture that breaks a rule', () => {
    expect(violations(bad)).toEqual(
      Object.entries(bad).map(([f, s]) => `${f}: ${s.match(/'([^']+)'/)?.[1]}`),
    )
  })

  it('let seating use cartridge and bullet', () => {
    expect(
      violations({
        'seating/a.ts':
          "import { profile } from '../cartridge/profile.ts'\nimport { outline } from '../bullet/outline.ts'",
      }),
    ).toEqual([])
  })
})
