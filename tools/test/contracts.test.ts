import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

// The exported names of each published package, read from the declarations the build writes, so a
// type counts as much as a value. `npm run baselines` at the root rewrites the lists.
const published = ['schema', 'core', 'drawing', 'importers', 'data']

/** The names a declaration file exports, following `export *` through its relative imports. */
function exportedNames(file: URL, seen = new Set<string>()): string[] {
  if (seen.has(file.href)) return []
  seen.add(file.href)
  const text = readFileSync(file, 'utf8')
  const names = [
    ...text.matchAll(
      /^export (?:declare )?(?:abstract )?(?:const|let|var|function|class|interface|type|enum|namespace) (\w+)/gm,
    ),
  ].map((m) => m[1] as string)
  for (const [, list] of text.matchAll(/^export (?:type )?\{([^}]*)\}/gm))
    for (const item of (list as string).split(',')) {
      const name = item
        .trim()
        .replace(/^type /, '')
        .split(/\s+as\s+/)
        .at(-1)
      if (name) names.push(name)
    }
  for (const [, ns] of text.matchAll(/^export \* as (\w+) from/gm)) names.push(ns as string)
  for (const [, from] of text.matchAll(/^export \* from '(\.[^']+)\.ts'/gm))
    names.push(...exportedNames(new URL(`${from}.d.ts`, file), seen))
  return names
}

/** The declaration file of each entry of a package's `exports`, by subpath. */
function entries(name: string): [string, URL][] {
  const dir = new URL(`../../packages/${name}/`, import.meta.url)
  const pkg = JSON.parse(readFileSync(new URL('package.json', dir), 'utf8')) as {
    exports: Record<string, string | { types: string }>
  }
  return Object.entries(pkg.exports).flatMap(([path, target]) =>
    typeof target === 'string' ? [] : [[path, new URL(target.types, dir)] as [string, URL]],
  )
}

describe('export lists of the published packages', () => {
  it('reads every kind of export statement', () => {
    // declaration files as the build writes them, kept out of the repository's lint and knip
    const dir = mkdtempSync(join(tmpdir(), 'exports-'))
    writeFileSync(
      join(dir, 'index.d.ts'),
      [
        "export * from './deep.ts';",
        "export * as ns from './deep.ts';",
        "export { value, type Shape as Alias } from './deep.ts';",
        'export declare function make(): void;',
        'export interface Visible {',
        '}',
        "export type Kind = 'a';",
      ].join('\n'),
    )
    writeFileSync(
      join(dir, 'deep.d.ts'),
      [
        "export * from './index.ts';",
        'export declare const deep = 1;',
        'export declare const value = 2;',
        'export interface Shape {',
        '}',
      ].join('\n'),
    )
    const names = exportedNames(pathToFileURL(join(dir, 'index.d.ts')))
    rmSync(dir, { recursive: true })
    expect([...new Set(names)].sort()).toEqual([
      'Alias',
      'Kind',
      'Shape',
      'Visible',
      'deep',
      'make',
      'ns',
      'value',
    ])
  })

  it.each(published)('@open-reloading/%s exports the names of its baseline', async (name) => {
    const list = entries(name).flatMap(([path, file]) =>
      [...new Set(exportedNames(file))].sort().map((n) => `${path} ${n}`),
    )
    await expect(`${list.join('\n')}\n`).toMatchFileSnapshot(`golden/exports/${name}.txt`)
  })
})
