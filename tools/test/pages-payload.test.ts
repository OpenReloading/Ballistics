import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterAll, expect, it } from 'vitest'
import { dropFullPayloads } from '../src/pages-payload.ts'

const dir = mkdtempSync(path.join(tmpdir(), 'pages-payload-'))
const record = path.join(dir, 'cartridges', '308-win')
mkdirSync(record, { recursive: true })
for (const f of ['index.html', 'index.txt', '__next._full.txt', '__next._tree.txt'])
  writeFileSync(path.join(dir, f), '')
for (const f of ['index.txt', '__next._full.txt', '__next.cartridges.$d$id.__PAGE__.txt'])
  writeFileSync(path.join(record, f), '')
afterAll(() => rmSync(dir, { recursive: true }))

it('deletes the full payloads and keeps index.txt and the segment files', () => {
  expect(dropFullPayloads(dir).sort()).toEqual([
    '__next._full.txt',
    path.join('cartridges', '308-win', '__next._full.txt'),
  ])
  expect(readdirSync(dir).sort()).toEqual([
    '__next._tree.txt',
    'cartridges',
    'index.html',
    'index.txt',
  ])
  expect(readdirSync(record).sort()).toEqual(['__next.cartridges.$d$id.__PAGE__.txt', 'index.txt'])
})
