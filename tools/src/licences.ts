/**
 * Licence policy of the production dependencies of the API image and the web app, read from
 * pnpm-lock.yaml and the licenses pnpm reads from the installed packages: fails on a package whose
 * licence is not in `allow-licenses` of .github/dependency-review-config.yml (the list the
 * dependency review step reads) and not excepted there by `allow-dependencies-licenses`, and on a
 * package without a declared licence. Fails too when the generated list of shipped packages in
 * NOTICE differs. `--write` rewrites that list. The licence table goes to the job summary.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'
import { executable } from './executable.ts'

/** The API image and the web app (its bundles ship in the static site): the workspaces whose production dependencies ship. */
const images = ['packages/api', 'apps/web']

/** Packages installed for a shipped workspace that no shipped file contains, by name or name prefix (`*`), with why. */
export const notShipped: Record<string, string> = {
  sharp: 'the static export has no image optimisation, so the site holds no sharp code',
  '@img/*': 'the sharp binaries: the static export holds none',
  '@next/swc-*': 'the Next.js compiler, a build tool: the static export holds no native code',
}

const begin = 'BEGIN GENERATED: shipped packages'
const end = 'END GENERATED: shipped packages'

/** Dependencies by name: a version (with the peers it resolved, `1.0.0(react@19.0.0)`) or `link:` to a workspace. */
type Dependencies = Record<string, string | { version: string }>

interface Entry {
  dependencies?: Dependencies
  optionalDependencies?: Dependencies
}

/** The parts of pnpm-lock.yaml the check reads. */
export interface Lock {
  importers: Record<string, Entry>
  packages?: Record<
    string,
    {
      os?: string[]
      cpu?: string[]
      libc?: string[]
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
    }
  >
  snapshots?: Record<string, Entry>
}

/** One shipped package and the licence the lock declares for it. */
export interface Shipped {
  name: string
  version: string
  license: string | undefined
}

/** The licence policy of the configuration file. */
export interface Policy {
  allow: Set<string>
  excepted: Set<string>
}

/** The license of each installed package by `name@version`, as `pnpm licenses list --json` reads it. */
export type Licenses = Map<string, string | undefined>

/** A dependency to visit: its name, its version or `link:`, and the workspace a `link:` is relative to. */
interface Step {
  name: string
  version: string
  from: string
}

const id = (p: Shipped) => `${p.name}@${p.version}`

const isNotShipped = (name: string) =>
  Object.keys(notShipped).some((k) =>
    k.endsWith('*') ? name.startsWith(k.slice(0, -1)) : name === k,
  )

/** The production dependencies of a lock entry, without the peers `optional` names. */
const stepsOf = (
  entry: Entry = {},
  from = '',
  optional: Record<string, { optional?: boolean }> = {},
) =>
  Object.entries({ ...entry.dependencies, ...entry.optionalDependencies })
    .filter(([name]) => !optional[name]?.optional)
    .map(([name, v]): Step => ({ name, version: typeof v === 'string' ? v : v.version, from }))

/**
 * Every third-party package installed for the production dependencies of the shipped workspaces;
 * an optional peer that the lock resolved from elsewhere in the workspace is not installed for it.
 * Throws on a platform package (`os`, `cpu` or `libc` in the lock) that `skip` does not name: which
 * one is installed differs per machine, so the list cannot hold it.
 */
export function shippedPackages(
  lock: Lock,
  licenses: Licenses,
  roots = images,
  skip = isNotShipped,
): Shipped[] {
  const seen = new Set<string>()
  const found = new Map<string, Shipped>()
  const todo = roots.map((root): Step => ({ name: '', version: `link:${root}`, from: '' }))
  for (let step = todo.pop(); step !== undefined; step = todo.pop()) {
    const { name, version, from } = step
    if (version.startsWith('link:')) {
      const importer = posix.join(from, version.slice('link:'.length))
      if (!seen.has(importer)) todo.push(...stepsOf(lock.importers[importer], importer))
      seen.add(importer)
      continue
    }
    const plain = version.replace(/\(.*$/, '')
    const meta = lock.packages?.[`${name}@${plain}`]
    if (seen.has(`${name}@${version}`) || skip(name)) continue
    if (meta?.os || meta?.cpu || meta?.libc)
      throw new Error(
        `${name}@${plain} is a platform package in a shipped closure: name it in notShipped with why, or list it by hand`,
      )
    seen.add(`${name}@${version}`)
    found.set(`${name}@${plain}`, {
      name,
      version: plain,
      license: licenses.get(`${name}@${plain}`),
    })
    todo.push(...stepsOf(lock.snapshots?.[`${name}@${version}`], '', meta?.peerDependenciesMeta))
  }
  // code-unit order, so the list does not depend on the ICU data of the running Node
  return [...found.values()].sort((a, b) => (id(a) < id(b) ? -1 : 1))
}

/** The licenses of the installed production dependencies of the shipped workspaces, read by pnpm. */
export function installedLicenses(root: string): Licenses {
  const filters = images.flatMap((dir) => ['--filter', `./${dir}`])
  const listed = JSON.parse(
    execFileSync(executable('pnpm'), [...filters, 'licenses', 'list', '--prod', '--json'], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 << 20,
    }),
  ) as Record<string, { name: string; versions: string[]; license?: unknown }[]>
  const licenses: Licenses = new Map()
  for (const p of Object.values(listed).flat())
    for (const v of p.versions)
      licenses.set(`${p.name}@${v}`, typeof p.license === 'string' ? p.license : undefined)
  return licenses
}

/** Whether an SPDX licence expression is met by `allowed` (OR: one side, AND: both, WITH: its licence). Throws when unreadable. */
export function satisfies(expression: string, allowed: ReadonlySet<string>): boolean {
  const tokens = expression.match(/[()]|[^\s()]+/g) ?? []
  let at = 0
  const atom = (): boolean => {
    const token = tokens[at++]
    if (token === '(') {
      const inner = or()
      if (tokens[at++] !== ')') throw new Error(`unbalanced brackets in "${expression}"`)
      return inner
    }
    if (token === undefined || token === ')' || ['AND', 'OR', 'WITH'].includes(token))
      throw new Error(`cannot read the licence expression "${expression}"`)
    const ok = allowed.has(token)
    if (tokens[at] === 'WITH') at += 2
    return ok
  }
  const and = (): boolean => {
    let ok = atom()
    while (tokens[at] === 'AND') {
      at++
      ok = atom() && ok
    }
    return ok
  }
  const or = (): boolean => {
    let ok = and()
    while (tokens[at] === 'OR') {
      at++
      ok = and() || ok
    }
    return ok
  }
  const ok = or()
  if (at !== tokens.length) throw new Error(`cannot read the licence expression "${expression}"`)
  return ok
}

/** The policy of the dependency review configuration file. */
export function readPolicy(text: string): Policy {
  const config = parse(text) as Record<string, unknown>
  const list = (key: string) => {
    const value = config[key]
    if (!Array.isArray(value) || value.some((v) => typeof v !== 'string'))
      throw new Error(`${key} must be a list of strings`)
    return value as string[]
  }
  const excepted = (
    config['allow-dependencies-licenses'] ? list('allow-dependencies-licenses') : []
  ).map((purl) => {
    if (!purl.startsWith('pkg:npm/')) throw new Error(`${purl}: only pkg:npm/ entries`)
    return decodeURIComponent(purl.slice('pkg:npm/'.length))
  })
  return { allow: new Set(list('allow-licenses')), excepted: new Set(excepted) }
}

/** The `allow-dependencies-licenses` entries of the file that carry no reason comment on their line. */
export function withoutReason(text: string) {
  return text.split('\n').filter((l) => /^\s*- ['"]?pkg:/.test(l) && !/\s#\s*\S/.test(l))
}

/** One line per shipped package that breaks the policy. */
export function problems(packages: Shipped[], policy: Policy) {
  const lines: string[] = []
  for (const { name, version, license } of packages) {
    const id = `${name}@${version}`
    if (policy.excepted.has(name)) continue
    if (!license) lines.push(`${id}: no licence declared`)
    else
      try {
        if (!satisfies(license, policy.allow))
          lines.push(`${id}: ${license} is not in allow-licenses`)
      } catch (error) {
        lines.push(`${id}: ${(error as Error).message}`)
      }
  }
  return lines
}

/** The generated block of NOTICE: one line per shipped package. */
export function noticeBlock(packages: Shipped[]) {
  const rows = packages.map((p) => `${p.name} ${p.version} ${p.license ?? 'UNDECLARED'}`)
  return [
    begin,
    'Third-party packages installed for the API image and the web app, by name, version and the licence',
    'the package declares. Written by `node tools/src/licences.ts --write`.',
    '',
    ...rows,
    end,
  ].join('\n')
}

const blockPattern = new RegExp(`${begin}[\\s\\S]*?${end}`)

/** The job summary: a table of licences, then the list. */
export function summary(packages: Shipped[], excepted: Set<string>) {
  const count = new Map<string, number>()
  for (const p of packages)
    count.set(p.license ?? 'UNDECLARED', (count.get(p.license ?? 'UNDECLARED') ?? 0) + 1)
  const table = [...count].sort((a, b) => b[1] - a[1]).map(([l, n]) => `| ${l} | ${n} |`)
  const named = packages.filter((p) => excepted.has(p.name)).map((p) => `${p.name} ${p.version}`)
  return [
    '### Licences of the production dependencies of the API image and the web app',
    '',
    '| Licence | Packages |',
    '| --- | --- |',
    ...table,
    '',
    named.length ? `Excepted by name in the review configuration: ${named.join(', ')}` : '',
    '',
    '<details><summary>All packages</summary>',
    '',
    '```',
    ...packages.map((p) => `${p.name} ${p.version} ${p.license ?? 'UNDECLARED'}`),
    '```',
    '',
    '</details>',
    '',
  ].join('\n')
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const configPath = `${root}.github/dependency-review-config.yml`
  const noticePath = `${root}NOTICE`
  const configText = readFileSync(configPath, 'utf8')
  const lock = parse(readFileSync(`${root}pnpm-lock.yaml`, 'utf8')) as Lock
  const policy = readPolicy(configText)
  const packages = shippedPackages(lock, installedLicenses(root))
  const found = [
    ...withoutReason(configText).map((l) => `no reason comment on: ${l.trim()}`),
    ...problems(packages, policy),
  ]
  const notice = readFileSync(noticePath, 'utf8')
  const block = noticeBlock(packages)
  if (process.argv.includes('--write')) {
    if (!blockPattern.test(notice)) {
      console.error(`NOTICE has no "${begin}" block to rewrite`)
      process.exit(1)
    }
    writeFileSync(
      noticePath,
      notice.replace(blockPattern, () => block),
    )
  } else if (notice.match(blockPattern)?.[0] !== block) {
    found.push('NOTICE differs from the shipped packages: run node tools/src/licences.ts --write')
  }
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary(packages, policy.excepted))
  for (const line of found) console.error(line)
  if (found.length) process.exit(1)
  console.log(`licences: ${packages.length} shipped packages within the policy, NOTICE in step`)
}
