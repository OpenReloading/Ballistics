import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { checkPages } from '../scripts/check-prerender.mts'
import { sampleIds } from '../src/lib/prerender-sample.ts'
import { defined } from './defined.ts'

const kinds = [
  ['cartridges', 'cartridge'],
  ['bullets', 'bullet'],
  ['powders', 'powder'],
  ['cases', 'case'],
  ['primers', 'primer'],
  ['target-faces', 'target-face'],
  ['disciplines', 'discipline'],
  ['federations', 'federation'],
] as const
const routeOf = (dir: string) => (dir === 'target-faces' ? 'targets' : dir)
const first = (what: string) => defined(defined(sampleIds[what])[0])

const dirs: string[] = []
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

const head =
  '<title>x</title><meta name="description" content="x"/><meta property="og:title" content="x"/><meta property="og:description" content="x"/><meta name="twitter:title" content="x"/><meta name="twitter:description" content="x"/>'

const put = (file: string, content = '') => {
  mkdirSync(path.dirname(file), { recursive: true })
  writeFileSync(file, content)
}

/** An export with the data files of two records per kind (the sample's first id and `x-1`) and the pages of `pages`. */
function site(pages: (route: string) => boolean = () => true) {
  const dir = mkdtempSync(path.join(tmpdir(), 'export-'))
  dirs.push(dir)
  for (const [data, what] of kinds)
    for (const id of [first(what), 'x-1']) {
      put(path.join(dir, 'api', data, `${id}.json`))
      for (const route of [routeOf(data), `${routeOf(data)}/${id}`])
        if (pages(route)) {
          put(path.join(dir, route, 'index.html'), head)
          put(path.join(dir, route, 'index.txt'))
        }
    }
  return dir
}

it('finds every list and record page of a full export', () => {
  const { expected, missing } = checkPages(site(), { PRERENDER: 'full' })
  expect(expected).toHaveLength(8 * 3)
  expect(missing).toEqual([])
})

it('names a record page the export lacks, and one that has only its HTML', () => {
  const no = checkPages(
    site((r) => r !== 'bullets/x-1'),
    { PRERENDER: 'full' },
  )
  expect(no.missing).toEqual(['bullets/x-1'])
  const dir = site()
  rmSync(path.join(dir, 'targets/x-1/index.txt'))
  expect(checkPages(dir, { PRERENDER: 'full' }).missing).toEqual(['targets/x-1'])
})

it("names a cartridge page whose HTML lacks the record's own head tags", () => {
  const dir = site()
  const page = path.join(dir, 'cartridges', 'x-1', 'index.html')
  writeFileSync(page, head.replace('<meta property="og:title" content="x"/>', ''))
  expect(checkPages(dir, { PRERENDER: 'full' }).noHead).toEqual(['cartridges/x-1'])
  // a kind that renders on the server holds its content in the HTML: its head is not checked
  writeFileSync(path.join(dir, 'bullets', 'x-1', 'index.html'), '')
  expect(checkPages(dir, { PRERENDER: 'full' }).noHead).toEqual(['cartridges/x-1'])
  rmSync(page)
  const { missing, noHead } = checkPages(dir, { PRERENDER: 'full' })
  expect(missing).toEqual(['cartridges/x-1'])
  expect(noHead).toEqual([])
})

it('expects the sample cartridge pages only, and every other record, when sampling', () => {
  const dir = site((r) => r !== 'cartridges/x-1')
  expect(checkPages(dir, { PRERENDER: 'sample' }).missing).toEqual([])
  expect(checkPages(dir, { PRERENDER: 'full' }).missing).toEqual(['cartridges/x-1'])
  const bullet = site((r) => r !== 'bullets/x-1')
  expect(checkPages(bullet, { PRERENDER: 'sample' }).missing).toEqual(['bullets/x-1'])
})

it('fails on a kind without data files', () => {
  const dir = site()
  rmSync(path.join(dir, 'api/primers'), { recursive: true })
  mkdirSync(path.join(dir, 'api/primers'))
  expect(() => checkPages(dir, {})).toThrow('no primer data files')
})
