/**
 * Licence policy of the production dependencies of the API and web images, read from
 * package-lock.json: fails on a package whose licence is not in `allow-licenses` of
 * .github/dependency-review-config.yml (the list the dependency review step reads) and not excepted
 * there by `allow-dependencies-licenses`, and on a package without a declared licence. Fails too
 * when the generated list of shipped packages in NOTICE differs. `--write` rewrites that list.
 * The licence table goes to the job summary.
 */
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'yaml'

/** The two images: the workspaces whose production dependencies ship. */
const images = ['packages/api', 'apps/web']

/** Packages the image build deletes after the install, by name or `@scope/*`, with why. */
export const notShipped: Record<string, string> = {
  sharp: 'apps/web/Dockerfile removes node_modules/sharp from the image (no image optimisation)',
  '@img/*': 'apps/web/Dockerfile removes node_modules/@img from the image (the sharp binaries)',
}

const begin = 'BEGIN GENERATED: shipped packages'
const end = 'END GENERATED: shipped packages'

/** The parts of package-lock.json the check reads. */
export interface Lock {
  packages: Record<
    string,
    {
      version?: string
      license?: unknown
      link?: boolean
      resolved?: string
      os?: string[]
      cpu?: string[]
      libc?: string[]
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
    }
  >
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

const nameOf = (key: string) => key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length)

/** The lock key of `name` as seen from `from`: the nearest node_modules folder up the tree that has it. */
function resolve(lock: Lock, from: string, name: string) {
  for (let dir = from; ; ) {
    const key = `${dir ? `${dir}/` : ''}node_modules/${name}`
    if (key in lock.packages) return key
    if (!dir) return
    const up = dir.lastIndexOf('/node_modules/')
    dir = up < 0 ? '' : dir.slice(0, up)
  }
}

/** A platform package that the Linux images (glibc, x64 or arm64) never install. */
const otherPlatform = (e: Lock['packages'][string]) =>
  (e.os && !e.os.includes('linux')) ||
  (e.cpu && !e.cpu.some((c) => c === 'x64' || c === 'arm64')) ||
  (e.libc && !e.libc.includes('glibc'))

const id = (p: Shipped) => `${p.name}@${p.version}`

const isNotShipped = (name: string) =>
  name in notShipped || name.replace(/\/.*/, '/*') in notShipped

/** The lock keys of the dependencies of one lock entry, as installed beside it. */
function dependenciesOf(lock: Lock, key: string) {
  const entry = lock.packages[key]
  if (!entry) return []
  const names = [entry.dependencies, entry.optionalDependencies, entry.peerDependencies].flatMap(
    (field) => Object.keys(field ?? {}),
  )
  return names.map((name) => resolve(lock, key, name)).filter((found) => found !== undefined)
}

/** Every third-party package installed for the production dependencies of the image workspaces. */
export function shippedPackages(lock: Lock, roots = images, skip = isNotShipped): Shipped[] {
  const seen = new Set<string>()
  const todo = [...roots]
  for (let key = todo.pop(); key !== undefined; key = todo.pop()) {
    const entry = lock.packages[key]
    if (!entry || seen.has(key)) continue
    if (entry.link) {
      if (entry.resolved) todo.push(entry.resolved)
    } else if (!key.includes('node_modules/') || !(skip(nameOf(key)) || otherPlatform(entry))) {
      seen.add(key)
      todo.push(...dependenciesOf(lock, key))
    }
  }
  const third = [...seen].filter((k) => k.includes('node_modules/'))
  const list = third.map((key): Shipped => {
    const { version = '', license } = lock.packages[key] ?? {}
    return {
      name: nameOf(key),
      version,
      license: typeof license === 'string' ? license : undefined,
    }
  })
  const unique = new Map(list.map((p) => [`${p.name}@${p.version}`, p]))
  // code-unit order, so the list does not depend on the ICU data of the running Node
  return [...unique.values()].sort((a, b) => (id(a) < id(b) ? -1 : 1))
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
    'Third-party packages installed for the API and web images, by name, version and the licence',
    'package-lock.json declares. Written by `node tools/src/licences.ts --write`.',
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
    '### Licences of the production dependencies of the API and web images',
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
  const lock = JSON.parse(readFileSync(`${root}package-lock.json`, 'utf8')) as Lock
  const policy = readPolicy(configText)
  const packages = shippedPackages(lock)
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
