/**
 * Checks that the export in `pages/` (`npm run pages:build`, `npm run static:build`) holds the page and
 * the data file of the cartridge, bullet, powder, case, primer, target face, discipline and federation
 * lists and of every record whose data file the export holds. With PRERENDER=sample (the same value as
 * for the build) the cartridge records are those of `src/lib/prerender-sample.ts`. The page of a record
 * kind that renders in the browser (`ownHead`) must carry the record's own title, description, Open
 * Graph and Twitter tags: its HTML holds nothing else of the record.
 *
 *   node scripts/check-prerender.mts [<export folder>]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { exportIds, isSampling } from '../src/lib/prerender-sample.ts'

/** The data folder of each list, its record kind for the sample and its page route. */
const lists = [
  ['cartridges', 'cartridge'],
  ['bullets', 'bullet'],
  ['powders', 'powder'],
  ['cases', 'case'],
  ['primers', 'primer'],
  ['target-faces', 'target-face', 'targets'],
  ['disciplines', 'discipline'],
  ['federations', 'federation'],
] as const

/** The record kinds whose page renders in the browser from the data file (`useRecord`): their HTML is the head tags and a loading state. */
const ownHead = ['cartridges']
/** What the head of such a page holds, one marker per tag. */
const headTags = [
  '<title>',
  '<meta name="description"',
  '<meta property="og:title"',
  '<meta property="og:description"',
  '<meta name="twitter:title"',
  '<meta name="twitter:description"',
]

/**
 * The routes the export must hold, those of them with no `index.html` or no `index.txt`, and the
 * record pages of `ownHead` kinds whose HTML lacks one of `headTags`.
 */
export function checkPages(site: string, env: Record<string, string | undefined> = process.env) {
  const expected: string[] = []
  for (const [dir, what, route = dir] of lists) {
    const ids = readdirSync(path.join(site, 'api', dir))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
    // an empty folder would pass without checking a record
    if (ids.length === 0) throw new Error(`no ${what} data files in ${site}/api/${dir}`)
    expected.push(route, ...exportIds(what, ids, env).map((id) => `${route}/${id}`))
  }
  const held = (route: string) =>
    ['index.html', 'index.txt'].every((f) => existsSync(path.join(site, route, f)))
  const missing = expected.filter((route) => !held(route))
  const noHead = expected.filter(
    (route) =>
      ownHead.some((dir) => route.startsWith(`${dir}/`)) &&
      !missing.includes(route) &&
      !headTags.every((tag) =>
        readFileSync(path.join(site, route, 'index.html'), 'utf8').includes(tag),
      ),
  )
  return { expected, missing, noHead }
}

if (import.meta.main) {
  const site = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, '../../../pages'))
  const { expected, missing, noHead } = checkPages(site)
  if (missing.length > 0) {
    console.error(
      `${missing.length} of ${expected.length} data routes are not exported, for example ${missing.slice(0, 10).join(', ')}`,
    )
    process.exit(1)
  }
  if (noHead.length > 0) {
    console.error(
      `${noHead.length} record pages lack their own title, description, Open Graph or Twitter tags, for example ${noHead.slice(0, 10).join(', ')}`,
    )
    process.exit(1)
  }
  console.log(`${expected.length} data routes exported${isSampling() ? ' (sample)' : ''}`)
}
