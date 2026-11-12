// Fails when a route's JavaScript outgrows its group's budget: apps/docs/docs/ci-tools.md#web-javascript-budget
import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

const webRoot = path.join(import.meta.dirname, '..')

/** Bytes of gzip level 9 of the JavaScript of one route; `chunk` is its largest lazy chunk. */
export type Weight = { initial: number; total: number; chunk: number }

/** A group's limits: `initial`, and `total` or `chunk` (each lazy chunk, the total then reported only). */
export type Limits = { initial: number; total?: number; chunk?: number }

export type Budget = {
  groups: Record<string, { budget: Limits; routes: Record<string, Partial<Weight>> }>
}

const keys = ['initial', 'total', 'chunk'] as const

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
      return [
        route,
        { initial: first, total: first + sum(lazy), chunk: Math.max(0, ...[...lazy].map(size)) },
      ]
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
    return keys
      .filter((key) => weight[key] > (group.budget[key] ?? Number.POSITIVE_INFINITY))
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
    // a group with neither (or a misspelt key) would leave its lazy part ungated
    ...Object.entries(budget.groups)
      .filter(([, g]) => (g.budget.total === undefined) === (g.budget.chunk === undefined))
      .map(([name]) => `group ${name}: the budget must set exactly one of total and chunk`),
    ...Object.entries(budget.groups).flatMap(([name, g]) => groupViolations(name, g, measured)),
    ...Object.keys(measured)
      .filter((route) => !listed.has(route))
      .map((route) => `${route}: in no group of weight-budget.json`),
  ]
}

/** Share of a budget under which the headroom left is warned about: half the 2 % margin of the budget rule. */
const nearShare = 0.01

/** Warnings for routes within budget but with less than `nearShare` of it left: one line per route. */
export function nearLimit(measured: Record<string, Weight>, budget: Budget) {
  return Object.entries(budget.groups).flatMap(([name, group]) =>
    Object.keys(group.routes).flatMap((route) => {
      const weight = measured[route]
      if (weight === undefined) return []
      const near = keys
        .flatMap((key) => {
          const limit = group.budget[key]
          return limit === undefined ? [] : [{ key, limit, left: limit - weight[key] }]
        })
        .filter(({ limit, left }) => left >= 0 && left < limit * nearShare)
      if (near.length === 0) return []
      return [
        `${route}: near the limit of the ${name} budget, ${near.map(({ key, left }) => `${key} ${left} B left`).join(', ')}`,
      ]
    }),
  )
}

const kb = (n: number) => `${(n / 1000).toFixed(1)} kB`
const change = (now: number, was: number | undefined) =>
  was === undefined ? 'new' : now === was ? '0' : `${now > was ? '+' : '-'}${Math.abs(now - was)} B`

const perKey = (limits: Limits, cell: (limit: number, key: (typeof keys)[number]) => string) =>
  keys.map((key) => (limits[key] === undefined ? 'none' : cell(limits[key], key))).join(' / ')

/** Markdown table: per route the weight now, the change against the recorded weight, the group budget and the headroom under it. */
export function table(measured: Record<string, Weight>, budget: Budget) {
  const rows = [
    '| Group | Route | Initial | Change | Total | Change | Largest lazy chunk | Change | Budget (initial / total / chunk) | Headroom (initial / total / chunk) |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|',
  ]
  for (const [name, group] of Object.entries(budget.groups)) {
    for (const [route, recorded] of Object.entries(group.routes)) {
      const now = measured[route]
      if (now === undefined) continue
      rows.push(
        `| ${name} | \`${route}\` | ${kb(now.initial)} | ${change(now.initial, recorded.initial)} | ${kb(now.total)} | ${change(now.total, recorded.total)} | ${kb(now.chunk)} | ${change(now.chunk, recorded.chunk)} | ${perKey(group.budget, kb)} | ${perKey(group.budget, (limit, key) => `${limit - now[key]} B`)} |`,
      )
    }
  }
  const listed = new Set(Object.values(budget.groups).flatMap((g) => Object.keys(g.routes)))
  for (const [route, now] of Object.entries(measured)) {
    if (!listed.has(route)) {
      rows.push(
        `| none | \`${route}\` | ${kb(now.initial)} | new | ${kb(now.total)} | new | ${kb(now.chunk)} | new | none | none |`,
      )
    }
  }
  return rows.join('\n')
}

if (import.meta.main) {
  const budget = readJson(path.join(webRoot, 'weight-budget.json')) as Budget
  const next = path.join(webRoot, '.next')
  if (!existsSync(path.join(next, 'app-path-routes-manifest.json'))) {
    console.error('check-weight: no build in .next, run `pnpm run static:build` first')
    process.exit(1)
  }
  const measured = measure(next)
  const failures = violations(measured, budget)
  const warnings = nearLimit(measured, budget)
  const notes = warnings.map((line) => `\n- Warning: ${line}`).join('')
  const report = `## Web JavaScript per route (gzip)\n\n${table(measured, budget)}\n${notes ? `${notes}\n` : ''}`
  console.log(report)
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, report)
  if (failures.length > 0) {
    console.error(failures.join('\n'))
    process.exit(1)
  }
}
