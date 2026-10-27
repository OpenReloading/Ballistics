/**
 * Writes public/sw.js after `next build` (out/sw.js in the Pages edition, `PAGES_BASE_PATH` set):
 * the build id as `version`, the files of .next/static (in the Pages edition also the catalogue
 * index) as `precache`, the base path as `base`, the pages' trailing slash as `slash`, the Pages edition
 * (`next` or empty) as `edition`, every export of
 * src/lib/offline.ts (Node strips their types, so their source is JavaScript), then src/service-worker.js.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import * as offline from '../src/lib/offline.ts'

const at = (p: string) => new URL(`../${p}`, import.meta.url)
const version = readFileSync(at('.next/BUILD_ID'), 'utf8').trim()
const files = readdirSync(at('.next/static'), { recursive: true, encoding: 'utf8' }).filter((f) =>
  statSync(new URL(f, `${at('.next/static/')}`)).isFile(),
)
const base = process.env.PAGES_BASE_PATH
const dir = base === undefined ? 'public' : 'out'
const constants = {
  version,
  precache: offline.precacheList(files, base, base !== undefined),
  base: base ?? '',
  slash: base === undefined ? '' : '/',
  edition: process.env.PAGES_EDITION === 'next' ? 'next' : '',
}
const helpers = Object.entries({ ...constants, ...offline }).map(
  ([name, v]) => `const ${name} = ${typeof v === 'function' ? String(v) : JSON.stringify(v)}`,
)
mkdirSync(at(dir), { recursive: true })
writeFileSync(
  at(`${dir}/sw.js`),
  `${helpers.join('\n')}\n${readFileSync(at('src/service-worker.js'), 'utf8')}`,
)
console.log(`${dir}/sw.js: build ${version}, ${constants.precache.length} static files`)
