// The CI jobs and test groups a change needs, failing closed: apps/docs/docs/ci-tools.md#which-jobs-a-pull-request-runs
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const webRoot = path.join(import.meta.dirname, '..')
const repoRoot = path.join(webRoot, '../..')

/** Files whose change feeds the web build: without one, only the checks and the jobs of `e2eInputs` run. */
const webInputs = [
  /^apps\/web\//,
  /^packages\/(units|locale-format|statistics|ballistics|shot-groups|schema|importers|drawing|catalog|use-cases|api)\//,
  // the catalog reader that writes the bundle the API serves
  /^tools\/src\/catalog\//,
  /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.base\.json|\.nvmrc)$/,
  /^\.github\/(pnpm|actions)\//,
  /^\.github\/workflows\/ci\.yml$/,
]

/** Changes that no check reads: prose outside the documents the app, its tests and the tools read, and GitHub's templates. */
const docsOnly = [
  // the docs site's pages are checked by the docs tests (bibliography and code lines), the home page
  // prerenders the news items, the build compares a package's API report (`*.api.md`)
  /^(?!README\.md$)(?!apps\/docs\/docs\/)(?!apps\/web\/news\/)(?!.*\.api\.md$).*\.md$/,
  // the web tests read the user report template, the licence check the generated block of NOTICE
  /^\.github\/(ISSUE_TEMPLATE\/(?!user-report\.yml$)|pull_request_template\.md$)/,
  /^(LICENSE|\.coderabbit\.yaml)$/,
]

/**
 * Files the e2e job reads besides those that feed the web build: its specs, the compose stack that runs
 * the API, the build context of its image and the scripts that build and serve the export.
 */
const e2eInputs = [
  /^apps\/e2e\//,
  /^(compose\.yaml|\.dockerignore)$/,
  /^tools\/src\/(pages|pages-serve|pages-payload|executable)\.ts$/,
]

/** Tests and notes of the packages and the web app do not change the build. */
const ignored = [/^(apps|packages)\/[^/]+\/test\//, /^(apps|packages)\/[^/]+\/[^/]*\.md$/]

/** Files whose change needs every record page prerendered (`prerender=full`), besides the import closure. */
const recordInputs = [
  /^packages\/units\//,
  /^packages\/locale-format\//,
  /^packages\/statistics\//,
  /^packages\/ballistics\//,
  /^packages\/catalog\//,
  /^tools\/src\/catalog\//,
  /^packages\/schema\//,
  /^packages\/api\//,
  /^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.base\.json|\.nvmrc)$/,
  /^\.github\/(pnpm|actions)\//,
  /^\.github\/workflows\/ci\.yml$/,
  /^apps\/web\/(package\.json|next\.config\.ts|tsconfig\.json)$/,
  /^apps\/web\/scripts\/(ci-plan|check-prerender)\.mts$/,
  /^apps\/web\/src\/lib\/prerender-sample\.ts$/,
]

/** The pages that take the ids of `generateStaticParams`. */
const recordRoutes = [
  'cartridges',
  'bullets',
  'powders',
  'cases',
  'primers',
  'targets',
  'disciplines',
  'federations',
].map((r) => `apps/web/src/app/${r}/[id]`)

const importRe = /(?:\bfrom|\bimport)\s*(?:\(\s*)?['"]([^'"]+)['"]/g
const extensions = ['', '.ts', '.tsx', '.mts', '.js', '.css']

/** The module specifiers of a source file: `from '...'`, `import '...'` and `import('...')`. */
export const importSpecifiers = (source: string) =>
  [...source.matchAll(importRe)].map(([, spec = '']) => spec)

/** The repo-relative file a relative or `@/` specifier of `file` names, null for any other specifier. */
function resolveImport(root: string, file: string, spec: string) {
  const target = spec.startsWith('@/')
    ? path.posix.join('apps/web/src', spec.slice(2))
    : spec.startsWith('.')
      ? path.posix.join(path.posix.dirname(file), spec)
      : null
  if (target === null) return null
  const found = extensions
    .map((e) => target + e)
    .find((f) => existsSync(path.join(root, f)) && statSync(path.join(root, f)).isFile())
  if (!found) throw new Error(`${file} imports ${spec}, which does not resolve`)
  return found
}

/** The repo-relative files `recordRoutes` import, directly or not, and the workspace packages among them. */
export function recordClosure(root = repoRoot) {
  const files = new Set<string>()
  const packages = new Set<string>()
  const queue: string[] = []
  const add = (file: string) => {
    if (!files.has(file)) {
      files.add(file)
      queue.push(file)
    }
  }
  for (const dir of recordRoutes)
    for (const name of readdirSync(path.join(root, dir))) add(`${dir}/${name}`)
  for (let file = queue.pop(); file !== undefined; file = queue.pop()) {
    if (!/\.(ts|tsx|mts|js)$/.test(file)) continue
    const source = readFileSync(path.join(root, file), 'utf8')
    for (const spec of importSpecifiers(source)) {
      const pkg = /^@open-reloading\/([^/]+)/.exec(spec)
      if (pkg?.[1]) packages.add(pkg[1])
      const found = resolveImport(root, file, spec)
      if (found === null) continue
      add(found)
    }
  }
  return { files, packages }
}

/**
 * The test jobs of ci.yml and their workspaces; of `e2e` only the unit tests run (`test:unit`), in `packages`. A test
 * that reads another workspace's files declares it as a devDependency, so pnpm's selection reaches it.
 */
export const testGroups: Record<string, string[]> = {
  drawing: ['drawing'],
  web: ['web'],
  packages: [
    'units',
    'locale-format',
    'design-tokens',
    'statistics',
    'ballistics',
    'shot-groups',
    'schema',
    'importers',
    'catalog',
    'use-cases',
    'api',
    'cli',
    'docs',
    'tools',
    'test-kit',
    'e2e',
  ],
  // its job also runs the stories as browser tests (ci.yml)
  ui: ['ui'],
}

/** One test job: its group, the pnpm filters of its workspaces to test, whether it runs the e2e unit tests. */
export type TestJob = { name: string; filter: string; e2eUnit: boolean }

/**
 * The test jobs for the workspaces in `affected` (names without the scope); every group's for undefined and for a
 * workspace no group lists (a new one), which the completeness test of `testGroups` then names.
 */
export function testJobs(affected?: string[]): TestJob[] {
  const listed = Object.values(testGroups).flat()
  const only = affected?.every((m) => listed.includes(m)) ? affected : undefined
  return Object.entries(testGroups).flatMap(([name, members]) => {
    const hit = members.filter((m) => only === undefined || only.includes(m))
    const tested = hit.filter((m) => m !== 'e2e')
    const e2eUnit = hit.includes('e2e')
    if (tested.length === 0 && !e2eUnit) return []
    return [{ name, filter: tested.map((m) => `--filter @open-reloading/${m}`).join(' '), e2eUnit }]
  })
}

export type Plan = {
  check: boolean
  e2e: boolean
  prerender: 'full' | 'sample'
  tests: TestJob[]
  reason: string
}

const everything = (reason: string): Plan => ({
  check: true,
  e2e: true,
  prerender: 'full',
  tests: testJobs(),
  reason,
})

/**
 * A file of a workspace (a folder with a `package.json`): pnpm finds the workspaces a change reaches from these alone.
 * The catalog reader of tools is not one: it writes the bundle that the web and API tests read, which pnpm does not see.
 */
const inWorkspace = (file: string) => {
  if (/^tools\/src\/catalog\//.test(file)) return false
  const folder = /^((packages|apps|tooling)\/[^/]+|tools)\//.exec(file)?.[1]
  return folder !== undefined && existsSync(path.join(repoRoot, folder, 'package.json'))
}

/**
 * The plan for the changed files `all`; `affected` are the workspaces pnpm selects for them (names
 * without the scope), undefined when unknown. Unknown, or none for a code change, tests every group.
 */
export function plan(all: string[], closure = recordClosure(), affected?: string[]): Plan {
  if (all.length === 0) return everything('no changed files found')
  const code = all.filter((f) => !docsOnly.some((re) => re.test(f)))
  if (code.length === 0)
    return {
      check: false,
      e2e: false,
      prerender: 'sample',
      tests: [],
      reason: 'only prose changed',
    }
  const tests = testJobs(code.every(inWorkspace) && affected?.length ? affected : undefined)
  const changed = code.filter((f) => !ignored.some((re) => re.test(f)))
  if (!changed.some((f) => webInputs.some((re) => re.test(f)))) {
    const e2e = changed.some((f) => e2eInputs.some((re) => re.test(f)))
    return {
      check: true,
      e2e,
      prerender: 'sample',
      tests,
      reason: 'no changed file feeds the web build',
    }
  }
  const packageInputs = [...closure.packages].map((p) => new RegExp(`^packages/${p}/`))
  const record = changed.find(
    (f) =>
      closure.files.has(f) ||
      recordInputs.some((re) => re.test(f)) ||
      packageInputs.some((re) => re.test(f)),
  )
  return record
    ? { ...everything(`${record} feeds the record pages`), tests }
    : { ...everything('no changed file feeds the record pages'), prerender: 'sample', tests }
}

/** git by an absolute path of a system directory, never through `PATH`. */
const gitPath = ['/usr/bin', '/usr/local/bin', '/bin'].map((d) => `${d}/git`).find(existsSync)
/** pnpm next to the running Node (where CI links it) or in a system directory, never through `PATH`. */
const pnpmPath = [path.dirname(process.execPath), '/usr/local/bin', '/usr/bin', '/bin']
  .map((d) => `${d}/pnpm`)
  .find(existsSync)

/**
 * The workspaces (names without the scope) pnpm selects with `filter`, such as `...[<base>]`: the changed ones and
 * every workspace that depends on them, devDependencies included; undefined when pnpm fails.
 */
export function selected(filter: string): string[] | undefined {
  try {
    if (pnpmPath === undefined) return
    const listed = JSON.parse(
      execFileSync(pnpmPath, ['--filter', filter, 'ls', '--depth', '-1', '--json'], {
        cwd: repoRoot,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    ) as { name: string; path: string }[]
    // the root project: plan reads the files outside the workspaces itself
    return listed
      .filter((p) => path.resolve(p.path) !== path.resolve(repoRoot))
      .map((p) => p.name.replace(/^@open-reloading\//, ''))
  } catch {
    return
  }
}

function git(...args: string[]) {
  if (gitPath === undefined) throw new Error('git not found in the system directories')
  return execFileSync(gitPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** Files that differ from `base`: committed, staged, unstaged and untracked ones. */
function changedSince(base: string) {
  git('cat-file', '-e', `${base}^{commit}`)
  const lines = (out: string) => out.split('\n').filter(Boolean)
  return [
    ...new Set([
      ...lines(git('diff', '--name-only', '--no-renames', base)),
      ...lines(git('ls-files', '--others', '--exclude-standard')),
    ]),
  ]
}

function argument(name: string) {
  const i = process.argv.indexOf(name)
  return i < 0 ? undefined : process.argv[i + 1]
}

const nothingChanged: Plan = {
  check: false,
  e2e: false,
  prerender: 'sample',
  tests: [],
  reason: 'nothing changed since the recorded build',
}

function settle(p: Plan, stamped: boolean, built: string): Plan {
  if (argument('--require') === 'full' && p.prerender === 'sample') p.prerender = 'full'
  // an earlier sample build does not stand in for a full one
  if (stamped && p.prerender === 'full' && built !== 'full')
    return everything('the earlier build is a sample')
  return p
}

function decide(): Plan {
  const full = everything
  try {
    const stampFile = argument('--stamp')
    if (stampFile === undefined && process.env.EVENT_NAME !== 'pull_request')
      return full(`event ${process.env.EVENT_NAME ?? '(unset)'} is not a pull request`)
    let base = process.env.BASE_SHA
    let built = ''
    if (stampFile !== undefined) {
      if (!existsSync(stampFile)) return full('no earlier build recorded')
      const [stampedBase, stampedBuilt = ''] = readFileSync(stampFile, 'utf8').trim().split(' ')
      base = stampedBase
      built = stampedBuilt
    }
    if (!base) return full('no base commit given')
    const changed = changedSince(base)
    // an empty list is a doubt in CI, but the answer for a local run against its own last build
    const p: Plan =
      stampFile !== undefined && changed.length === 0
        ? { ...nothingChanged }
        : plan(
            changed,
            recordClosure(),
            stampFile === undefined ? selected(`...[${base}]`) : undefined,
          )
    return settle(p, stampFile !== undefined, built)
  } catch (e) {
    return full(`plan failed: ${e instanceof Error ? e.message.split('\n')[0] : String(e)}`)
  }
}

if (import.meta.main) {
  const stamp = argument('--write-stamp')
  if (stamp !== undefined) {
    const mode = argument('--prerender')
    if (mode !== 'full' && mode !== 'sample') throw new Error('--prerender full|sample is required')
    if (git('status', '--porcelain').trim() !== '') {
      console.error('ci-plan: the tree has uncommitted changes, so no build is recorded')
      process.exit(1)
    }
    writeFileSync(stamp, `${git('rev-parse', 'HEAD').trim()} ${mode}\n`)
  } else {
    const p = decide()
    const out = `check=${p.check}\ne2e=${p.e2e}\nprerender=${p.prerender}\ntests=${JSON.stringify(p.tests)}`
    console.log(out)
    console.error(`ci-plan: ${out.replaceAll('\n', ' ')}: ${p.reason}`)
  }
}
