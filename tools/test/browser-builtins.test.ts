import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'

const root = fileURLToPath(new URL('../../', import.meta.url))

/** The code that runs in the browser: the web app and the packages it bundles. */
const browserSources = [
  'apps/web/src',
  ...['core', 'drawing', 'schema', 'api', 'importers', 'data'].map((p) => `packages/${p}/src`),
]

/**
 * Built-ins that Chrome and Edge 111, Firefox 115 or Safari 16.4 lack (MDN browser compatibility
 * data), as each is called. The Set methods `union`, `intersection` and `difference` are left out:
 * zod's `z.union` would match.
 */
const newer: [name: string, pattern: RegExp][] = [
  ['URL.canParse', /\bURL\.canParse\b/],
  ['URL.parse', /\bURL\.parse\b/],
  ['AbortSignal.any', /\bAbortSignal\.any\b/],
  ['Response.json (static)', /\bResponse\.json\b/],
  ['Array.fromAsync', /\bArray\.fromAsync\b/],
  ['Object.groupBy', /\bObject\.groupBy\b/],
  ['Map.groupBy', /\bMap\.groupBy\b/],
  ['Promise.withResolvers', /\bPromise\.withResolvers\b/],
  ['Promise.try', /\bPromise\.try\b/],
  ['RegExp.escape', /\bRegExp\.escape\b/],
  ['Iterator.from', /\bIterator\.from\b/],
  ['String isWellFormed, toWellFormed', /\.(isWellFormed|toWellFormed)\(/],
  [
    'Set symmetricDifference, isSubsetOf, isSupersetOf, isDisjointFrom',
    /\.(symmetricDifference|isSubsetOf|isSupersetOf|isDisjointFrom)\(/,
  ],
  ['ArrayBuffer transfer, transferToFixedLength', /\.(transfer|transferToFixedLength)\(/],
  ['Float16Array, Math.f16round', /\b(Float16Array|Math\.f16round)\b/],
  ['Math.sumPrecise', /\bMath\.sumPrecise\b/],
  ['Error.isError', /\bError\.isError\b/],
  ['Uint8Array base64 and hex', /\b(fromBase64|fromHex|setFromBase64|setFromHex|toBase64|toHex)\(/],
  ['DisposableStack, Symbol.dispose', /\b(Async)?DisposableStack\b|\bSymbol\.(asyncD|d)ispose\b/],
  ['JSON.rawJSON', /\bJSON\.(rawJSON|isRawJSON)\b/],
  ['Map getOrInsert', /\.getOrInsert(Computed)?\(/],
  ['Response and Blob bytes', /\.bytes\(\)/],
]

/** The source files under `dir`, without tests and declaration files. */
function sources(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((f) => /\.(ts|tsx|mts)$/.test(f) && !f.endsWith('.d.ts') && !/(^|\/)test\//.test(f))
    .map((f) => join(dir, f))
}

/** `file:line name` for each newer built-in a file calls; comments are not code. */
function findNewer(files: string[]): string[] {
  const found: string[] = []
  for (const file of files) {
    const lines = readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, (c) => c.replace(/[^\n]/g, ''))
      .split('\n')
    lines.forEach((line, i) => {
      const code = line.replace(/(^|\s)\/\/.*$/, '')
      for (const [name, pattern] of newer)
        if (pattern.test(code)) found.push(`${relative(root, file)}:${i + 1} ${name}`)
    })
  }
  return found
}

it('finds a newer built-in, not one in a comment', () => {
  const dir = mkdtempSync(join(tmpdir(), 'builtins-'))
  writeFileSync(
    join(dir, 'a.ts'),
    '// URL.canParse is newer\nexport const ok = (s: string) => URL.canParse(s)\n',
  )
  expect(findNewer(sources(dir)).map((f) => f.replace(/^.*a\.ts/, 'a.ts'))).toEqual([
    'a.ts:2 URL.canParse',
  ])
})

it('the browser code calls no built-in newer than the supported browsers', () => {
  expect(findNewer(browserSources.flatMap((d) => sources(join(root, d))))).toEqual([])
})
