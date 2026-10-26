/**
 * Checks that the last `next build` prerendered the cartridge, bullet, powder, case, target face, discipline and federation lists and the page of
 * every record the API at API_URL lists. Run after building with the API reachable. With PRERENDER=sample
 * (the same value as for the build) it checks the lists and the records of `src/lib/prerender-sample.ts`.
 */
import { readFileSync } from 'node:fs'
import { API_PREFIX } from '../src/lib/api-version.ts'
import { isSampling, pickIds } from '../src/lib/prerender-sample.ts'

const apiUrl = process.env.API_URL ?? 'http://localhost:3000'
const manifest = JSON.parse(
  readFileSync(new URL('../.next/prerender-manifest.json', import.meta.url), 'utf8'),
) as { routes: Record<string, unknown> }

async function ids(list: string) {
  const out: string[] = []
  for (let offset = 0; ; offset += 200) {
    const res = await fetch(`${apiUrl}${API_PREFIX}/${list}?limit=200&offset=${offset}`)
    if (!res.ok) throw new Error(`GET /${list} answered ${res.status}`)
    const body = (await res.json()) as { total: number; items: { id: string }[] }
    out.push(...body.items.map((c) => c.id))
    if (out.length >= body.total || body.items.length === 0) return out
  }
}

const expected: string[] = []
for (const [list, what, route = list] of [
  ['cartridges', 'cartridge'],
  ['bullets', 'bullet'],
  ['powders', 'powder'],
  ['cases', 'case'],
  ['target-faces', 'target-face', 'targets'],
  ['disciplines', 'discipline'],
  ['federations', 'federation'],
] as const)
  expected.push(`/${route}`, ...pickIds(what, await ids(list)).map((id) => `/${route}/${id}`))
const missing = expected.filter((route) => !(route in manifest.routes))
if (missing.length > 0) {
  console.error(
    `${missing.length} of ${expected.length} data routes are not prerendered, for example ${missing.slice(0, 10).join(', ')}`,
  )
  process.exit(1)
}
console.log(`${expected.length} data routes prerendered${isSampling() ? ' (sample)' : ''}`)
