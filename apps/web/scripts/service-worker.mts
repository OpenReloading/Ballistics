/**
 * Writes out/sw.js after `next build`: the build id as `version`, the files of .next/static and the
 * catalogue index as `precache`, the base path (`PAGES_BASE_PATH`, `''` at a domain root) as `base`,
 * the pages' trailing slash as `slash`, the Pages edition (`next` or empty) as `edition`, every
 * export of src/lib/offline.ts (Node strips their types, so their source is JavaScript), then
 * src/service-worker.js.
 */
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import * as offline from '../src/lib/offline.ts'

const at = (p: string) => new URL(`../${p}`, import.meta.url)
const version = readFileSync(at('.next/BUILD_ID'), 'utf8').trim()
const files = readdirSync(at('.next/static'), { recursive: true, encoding: 'utf8' }).filter((f) =>
  statSync(new URL(f, `${at('.next/static/')}`)).isFile(),
)
const base = process.env.PAGES_BASE_PATH ?? ''
const constants = {
  version,
  precache: offline.precacheList(files, base),
  base,
  slash: '/',
  edition: process.env.PAGES_EDITION === 'next' ? 'next' : '',
}
const helpers = Object.entries({ ...constants, ...offline }).map(
  ([name, v]) => `const ${name} = ${typeof v === 'function' ? String(v) : JSON.stringify(v)}`,
)
mkdirSync(at('out'), { recursive: true })
writeFileSync(
  at('out/sw.js'),
  `${helpers.join('\n')}\n${readFileSync(at('src/service-worker.js'), 'utf8')}`,
)
console.log(`out/sw.js: build ${version}, ${constants.precache.length} static files`)
