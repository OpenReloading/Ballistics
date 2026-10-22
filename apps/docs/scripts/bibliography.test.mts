import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { equationErrors, filesUnder, missingSources, recordSources } from './bibliography.mts'

const root = fileURLToPath(new URL('../../../', import.meta.url))
const docs = fileURLToPath(new URL('../docs/', import.meta.url))
const bibliography = readFileSync(`${docs}bibliography.md`, 'utf8')
const pages = readdirSync(`${docs}models`)
  .filter((f) => f.endsWith('.md'))
  .map((f) => ({ name: f, text: readFileSync(`${docs}models/${f}`, 'utf8') }))

const source = (title: string, url?: string) => ({ file: 'f', title, url })

test('a source matches by URL, DOI, the C.I.P. entry or its title', () => {
  const bib =
    '- <a id="cip-tdcc"></a>**C.I.P.** https://www.Example.org/a/ and doi:10.1000/xyz.\n- Book Title.'
  const found = [
    source('A', 'https://example.org/a'),
    source('B, doi:10.1000/xyz', 'https://other.org/b'),
    source('C.I.P. TDCC Cal. 10', 'https://bobp.cip-bobp.org/x.pdf'),
    source('Book Title'),
    source('Synthetic test data'),
  ]
  assert.deepEqual(missingSources(found, bib), [])
  const missing = [source('D', 'https://example.org/b'), source('Other Book')]
  assert.deepEqual(missingSources(missing, bib), missing)
  assert.equal(missingSources([source('C.I.P. TDCC Cal. 10')], 'no entry').length, 1)
})

test('every source of the records has a bibliography entry', () => {
  const missing = missingSources(recordSources(`${root}packages/data/records`), bibliography)
  assert.deepEqual(
    missing.map((s) => `${s.file}: ${s.title}`),
    [],
  )
})

test('an equation needs a Code line that names existing files and names in them', () => {
  const page = [
    '$$',
    'a = b',
    '$$',
    '',
    'Code: `apps/docs/scripts/bibliography.mts`, `entryIds`.',
    '$$ c $$',
    'text',
    '$$ d $$',
    'Code: `nope/x.ts`, `f`.',
    '$$ e $$',
    'Code: `apps/docs/scripts/bibliography.mts`, `noSuchName`.',
  ].join('\n')
  assert.deepEqual(equationErrors(page, root), [
    'line 6: equation without a Code line',
    'line 9: no file nope/x.ts',
    'line 9: f not in nope/x.ts',
    'line 11: noSuchName not in apps/docs/scripts/bibliography.mts',
  ])
})

test('every display equation of a model page names its code', () => {
  const errors = pages.flatMap((p) => equationErrors(p.text, root).map((e) => `${p.name} ${e}`))
  assert.deepEqual(errors, [])
})

test('every core source file is named on a model page', () => {
  const text = pages.map((p) => p.text).join('\n')
  const internal = new Set(['index.ts', 'errors.ts', 'bisect.ts'])
  const unnamed = filesUnder(`${root}packages/core/src`).filter(
    (f) => !internal.has(f) && !text.includes(`packages/core/src/${f}`),
  )
  assert.deepEqual(unnamed, [])
})
