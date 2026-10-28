/**
 * Checks that the export in `pages/` (`npm run pages:build`, `npm run static:build`) holds the page and
 * the data file of the cartridge, bullet, powder, case, primer, target face, discipline and federation
 * lists and of every record whose data file the export holds. With PRERENDER=sample (the same value as
 * for the build) the cartridge records are those of `src/lib/prerender-sample.ts`. A record page must
 * carry the record's own title, description, Open Graph and Twitter tags, with the values of its data
 * file: its HTML holds nothing else of the record, the browser renders the rest.
 *
 *   node scripts/check-prerender.mts [<export folder>]
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { type ManufacturerNames, noManufacturerNames } from '../src/lib/manufacturers.ts'
import { exportIds, isSampling } from '../src/lib/prerender-sample.ts'
import {
  type HeadSource,
  type RecordKind,
  recordHeadText,
  titleTemplate,
} from '../src/lib/record-metadata.ts'

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
] as const satisfies readonly (readonly [RecordKind, string, string?])[]

/** The attribute pattern of each head tag, in the order `headValues` lists the values. */
const headTags = [
  /<title>([^<]*)<\/title>/,
  /<meta name="description" content="([^"]*)"/,
  /<meta property="og:title" content="([^"]*)"/,
  /<meta property="og:description" content="([^"]*)"/,
  /<meta name="twitter:title" content="([^"]*)"/,
  /<meta name="twitter:description" content="([^"]*)"/,
]
const entities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  '#x27': "'",
  '#39': "'",
}
const decodeEntities = (s: string) =>
  s.replace(/&(amp|lt|gt|quot|#x27|#39);/g, (_, e: string) => entities[e] ?? _)

/** The title and description of a record page, each as it stands in the title (with the layout's template), description, Open Graph and Twitter tags. */
const headValues = (kind: RecordKind, record: HeadSource, names: ManufacturerNames) => {
  const { title, description } = recordHeadText(kind, record, names)
  return [titleTemplate.replace('%s', title), description, title, description, title, description]
}

/** The names of the export's manufacturers by id, from their data files. */
function manufacturerNamesOf(site: string): ManufacturerNames {
  if (!existsSync(path.join(site, 'api', 'manufacturers'))) return noManufacturerNames
  return new Map(
    readdirSync(path.join(site, 'api', 'manufacturers'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => {
        const m = JSON.parse(readFileSync(path.join(site, 'api', 'manufacturers', f), 'utf8')) as {
          id: string
          name: string
        }
        return [m.id, m.name]
      }),
  )
}

/** Whether the page of record `id` at `route` has a head with the record's own values: an empty or another record's tag fails. */
function hasOwnHead(
  site: string,
  route: string,
  kind: RecordKind,
  id: string,
  names: ManufacturerNames,
) {
  const html = readFileSync(path.join(site, route, id, 'index.html'), 'utf8')
  const record = JSON.parse(
    readFileSync(path.join(site, 'api', kind, `${id}.json`), 'utf8'),
  ) as HeadSource
  const expected = headValues(kind, { ...record, id }, names)
  return headTags.every((tag, i) => {
    const found = tag.exec(html)?.[1]
    return found !== undefined && decodeEntities(found) === expected[i]
  })
}

/**
 * The routes the export must hold, those of them with no `index.html` or no `index.txt`, and the
 * record pages whose HTML lacks one of the record's own head values.
 */
export function checkPages(site: string, env: Record<string, string | undefined> = process.env) {
  const expected: string[] = []
  const records: { route: string; kind: RecordKind; id: string }[] = []
  for (const [dir, what, route = dir] of lists) {
    const ids = readdirSync(path.join(site, 'api', dir))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.slice(0, -'.json'.length))
    // an empty folder would pass without checking a record
    if (ids.length === 0) throw new Error(`no ${what} data files in ${site}/api/${dir}`)
    const exported = exportIds(what, ids, env)
    expected.push(route, ...exported.map((id) => `${route}/${id}`))
    records.push(...exported.map((id) => ({ route, kind: dir, id })))
  }
  const held = (route: string) =>
    ['index.html', 'index.txt'].every((f) => existsSync(path.join(site, route, f)))
  const missing = expected.filter((route) => !held(route))
  const names = manufacturerNamesOf(site)
  const noHead = records
    .filter(
      (r) =>
        !missing.includes(`${r.route}/${r.id}`) && !hasOwnHead(site, r.route, r.kind, r.id, names),
    )
    .map((r) => `${r.route}/${r.id}`)
  return { expected, missing, noHead }
}

if (import.meta.main) {
  const root = path.resolve(import.meta.dirname, '../../..')
  const site = path.resolve(root, process.argv[2] ?? 'pages')
  const inside = path.relative(root, site)
  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    console.error(`the export folder must be inside the repository: ${site}`)
    process.exit(2)
  }
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
