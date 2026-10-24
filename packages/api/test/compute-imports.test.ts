import { readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'

/** The packages `@openreloading/api/compute` may import: it runs in the browser. */
const allowed = ['@openreloading/core', '@openreloading/schema', 'zod']

/** The packages `@openreloading/api/catalogue` may import: core and schema, no Node API. */
const catalogueAllowed = ['@openreloading/core', '@openreloading/schema']

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
    for (const [, spec] of source.matchAll(/(?:from|import)\s*\(?\s*'([^']+)'/g))
      if (spec.startsWith('.')) visit(posix.join(posix.dirname(file), spec))
      else found.push(`${file}: ${spec}`)
  }
  visit(entry)
  return { files, found }
}

describe('compute entry', () => {
  it('imports only core, schema and zod, also through the modules it imports', () => {
    const { files, found } = imports('compute/browser.ts')
    expect(files.size).toBeGreaterThan(5)
    expect(found.filter((f) => !allowed.includes(f.split(': ')[1]))).toEqual([])
  })

  it('names a runtime import outside the allowed packages', () => {
    expect(imports('static.ts').found).toContain('static.ts: @electric-sql/pglite')
  })
})

describe('catalogue entry', () => {
  it('imports only core and schema, no Node API, also through the modules it imports', () => {
    const { files, found } = imports('catalogue/browser.ts')
    expect([...files].sort()).toEqual([
      'catalogue/browser.ts',
      'catalogue/build.ts',
      'catalogue/derive.ts',
      'catalogue/list.ts',
      'catalogue/open.ts',
      'catalogue/types.ts',
    ])
    expect(found.filter((f) => !catalogueAllowed.includes(f.split(': ')[1]))).toEqual([])
  })

  it('names the Node imports of the module that reads and writes the files', () => {
    expect(imports('catalogue/node.ts').found).toContain('catalogue/node.ts: node:fs')
  })
})
