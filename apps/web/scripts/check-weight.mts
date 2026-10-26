/**
 * Fails when the JavaScript a route of the built web app loads grows past the budget of its group in
 * `weight-budget.json`, and prints a table of the change per route against the recorded values (to
 * $GITHUB_STEP_SUMMARY too, when set).
 *
 * Read from `.next` after `next build` (server edition): the routes of `app-path-routes-manifest.json`,
 * for each its client reference manifest (client component chunks, `entryJSFiles`), the root main and polyfill
 * files of `build-manifest.json` and the `react-loadable-manifest.json` of the page (lazy `next/dynamic` chunks).
 * Counted per route, in bytes of gzip level 9, each file once:
 *   initial  the files a first visit loads: root main, polyfill, the client chunks of the page and its layouts
 *   total    initial plus the lazy chunks the page can load on demand
 * Content only, so the number does not depend on the API, `PRERENDER`, the clock or the build directory.
 *
 * A route in no group, or a group route the build does not have, fails: a new route needs a budget in the pull
 * request. Raising a number is an edit of `weight-budget.json` that review sees.
 *
 *   node scripts/check-weight.mts
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const webRoot = path.join(import.meta.dirname, '..')

/** Bytes of gzip level 9 of the JavaScript of one route. */
export type Weight = { initial: number; total: number }

export type Budget = {
  groups: Record<string, { budget: Weight; routes: Record<string, Weight> }>
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(file, 'utf8'))

/** The object a client reference manifest assigns to `globalThis.__RSC_MANIFEST[<route>]`. */
export function parseClientManifest(source: string) {
  const assign = /__RSC_MANIFEST\["[^"]*"\] = /.exec(source)
  if (assign === null) throw new Error('no __RSC_MANIFEST assignment')
  const json = source
    .slice(assign.index + assign[0].length)
    .trim()
    .replace(/;$/, '')
  return JSON.parse(json) as {
    clientModules: Record<string, { chunks: string[] }>
    entryJSFiles?: Record<string, string[]>
  }
}

const js = (files: Iterable<string>) =>
  [...files].map((f) => f.replace(/^\/_next\//, '')).filter((f) => f.endsWith('.js'))

/** The files one page loads at first and on demand, from the manifests in `dir` (its `server/app` folder). */
function pageFiles(dir: string, route: string, shared: string[]) {
  const clientFile = `${dir}/page_client-reference-manifest.js`
  // a missing manifest would measure the route as empty and let it pass
  if (!existsSync(clientFile))
    throw new Error(`${route}: no client reference manifest at ${clientFile}`)
  const client = parseClientManifest(readFileSync(clientFile, 'utf8'))
  const initial = new Set(
    js([
      ...shared,
      ...Object.values(client.clientModules).flatMap((m) => m.chunks),
      ...Object.values(client.entryJSFiles ?? {}).flat(),
    ]),
  )
  const loadableFile = `${dir}/page/react-loadable-manifest.json`
  const loadable = existsSync(loadableFile)
    ? Object.values(readJson(loadableFile) as Record<string, { files: string[] }>)
    : []
  const lazy = new Set(js(loadable.flatMap((l) => l.files)).filter((f) => !initial.has(f)))
  return { initial, lazy }
}

/** The page routes of a build and the files each loads. */
export function routeFiles(next: string) {
  const routes = readJson(path.join(next, 'app-path-routes-manifest.json')) as Record<
    string,
    string
  >
  const build = readJson(path.join(next, 'build-manifest.json')) as {
    rootMainFiles: string[]
    polyfillFiles: string[]
  }
  const shared = [...build.rootMainFiles, ...build.polyfillFiles]
  return Object.fromEntries(
    Object.entries(routes)
      .filter(([key]) => key.endsWith('/page'))
      .map(([key, route]) => [
        route,
        pageFiles(path.join(next, 'server/app', key.slice(0, -'/page'.length)), route, shared),
      ]),
  )
}

/** Weight per route of the build in `next`. */
export function measure(next: string): Record<string, Weight> {
  const sizes = new Map<string, number>()
  const size = (f: string) => {
    const known = sizes.get(f)
    if (known !== undefined) return known
    const bytes = gzipSync(readFileSync(path.join(next, f)), { level: 9 }).length
    sizes.set(f, bytes)
    return bytes
  }
  const sum = (files: Set<string>) => [...files].reduce((n, f) => n + size(f), 0)
  return Object.fromEntries(
    Object.entries(routeFiles(next)).map(([route, { initial, lazy }]) => {
      const first = sum(initial)
      return [route, { initial: first, total: first + sum(lazy) }]
    }),
  )
}

/** Lines for the weights of one group's routes that are missing or over its budget. */
function groupViolations(
  name: string,
  group: Budget['groups'][string],
  measured: Record<string, Weight>,
) {
  return Object.keys(group.routes).flatMap((route) => {
    const weight = measured[route]
    if (weight === undefined) return [`${route}: in group ${name} but not in the build`]
    return (['initial', 'total'] as const)
      .filter((key) => weight[key] > group.budget[key])
      .map(
        (key) =>
          `${route}: ${key} ${weight[key]} B over the ${name} budget of ${group.budget[key]} B`,
      )
  })
}

/** Failures of the measured weights against the budget file: one line each. */
export function violations(measured: Record<string, Weight>, budget: Budget) {
  const listed = new Set(Object.values(budget.groups).flatMap((g) => Object.keys(g.routes)))
  return [
    ...Object.entries(budget.groups).flatMap(([name, g]) => groupViolations(name, g, measured)),
    ...Object.keys(measured)
      .filter((route) => !listed.has(route))
      .map((route) => `${route}: in no group of weight-budget.json`),
  ]
}

const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`
const change = (now: number, was: number | undefined) =>
  was === undefined ? 'new' : now === was ? '0' : `${now > was ? '+' : '-'}${Math.abs(now - was)} B`

/** Markdown table: per route the recorded weight, the weight now, the change and the group budget. */
export function table(measured: Record<string, Weight>, budget: Budget) {
  const rows = [
    '| Group | Route | Initial | Change | Total | Change | Budget (initial / total) |',
    '|---|---|---:|---:|---:|---:|---:|',
  ]
  for (const [name, group] of Object.entries(budget.groups)) {
    for (const [route, recorded] of Object.entries(group.routes)) {
      const now = measured[route]
      if (now === undefined) continue
      rows.push(
        `| ${name} | \`${route}\` | ${kb(now.initial)} | ${change(now.initial, recorded.initial)} | ${kb(now.total)} | ${change(now.total, recorded.total)} | ${kb(group.budget.initial)} / ${kb(group.budget.total)} |`,
      )
    }
  }
  return rows.join('\n')
}

if (import.meta.main) {
  const budget = readJson(path.join(webRoot, 'weight-budget.json')) as Budget
  const measured = measure(path.join(webRoot, '.next'))
  const failures = violations(measured, budget)
  const report = `## Web JavaScript per route (gzip)\n\n${table(measured, budget)}\n`
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exit(1)
  }
}
