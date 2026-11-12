import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The packages `@open-reloading/use-cases/catalog` may import: ballistics and schema, no Node API. */
const catalogueAllowed = ['@open-reloading/ballistics', '@open-reloading/schema']

/** The files below `src/` that `entry` reaches by relative imports, and their other imports. */
function imports(entry: string) {
  const files = new Set<string>()
  const found: string[] = []
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
      // type-only imports are erased, the browser never loads them
      .replace(/^(?:import|export) type\b.*?from '[^']+'/gms, '')
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g)) {
      const spec = match[1] ?? ''
      if (spec.startsWith('.')) visit(posix.join(posix.dirname(file), spec))
      else found.push(`${file}: ${spec}`)
    }
  }
  visit(entry)
  return { files, found }
}

describe('catalogue entry', () => {
  it('imports only ballistics and schema, no Node API, also through the modules it imports', () => {
    const { files, found } = imports('catalog/browser.ts')
    expect([...files].toSorted()).toEqual([
      'catalog/browser.ts',
      'catalog/build.ts',
      'catalog/derive.ts',
      'catalog/hash.ts',
      'catalog/list.ts',
      'catalog/open.ts',
      'catalog/types.ts',
    ])
    expect(found.filter((f) => !catalogueAllowed.includes(f.split(': ')[1] ?? ''))).toEqual([])
  })
})
