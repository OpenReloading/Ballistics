/**
 * Decides which CI jobs a run needs and how much of the web app it builds, from the files changed
 * since a base commit. Prints `check=true|false` (lint, build, types and unit tests), `e2e=true|false`
 * (the compose stack with the e2e tests), `web=true|false` (build the web app) and
 * `prerender=full|sample` (every record page or the sample of `src/lib/prerender-sample.ts`) as lines
 * for $GITHUB_OUTPUT; the reason goes to stderr.
 *
 * Fail closed: anything but a pull request, a missing base commit, a failed git call or an empty change
 * list gives every job and `prerender=full`.
 *
 *   node scripts/ci-plan.mts                      CI: EVENT_NAME and BASE_SHA from the environment
 *   node scripts/ci-plan.mts --stamp FILE         local: changes since the build recorded in FILE
 *   node scripts/ci-plan.mts --stamp FILE --require full   same, for a run that needs every record page
 *   node scripts/ci-plan.mts --write-stamp FILE --prerender full|sample   record a finished build (clean tree only)
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const webRoot = path.join(import.meta.dirname, '..')
const repoRoot = path.join(webRoot, '../..')

/** Files whose change needs a build of the web app (`web=true`). */
const webInputs = [
  /^apps\/web\//,
  /^packages\/(schema|importers|core|drawing|data|api)\//,
  /^(package\.json|package-lock\.json|tsconfig\.base\.json|\.nvmrc)$/,
  /^patches\//,
  /^\.github\/workflows\/ci\.yml$/,
]

/** Changes that no check reads: prose outside the documents the app, its tests and the tools read, and GitHub's templates. */
const docsOnly = [
  // the docs site's pages are checked by the docs tests (bibliography and code lines)
  /^(?!README\.md$)(?!apps\/docs\/docs\/).*\.md$/,
  /^\.github\/(ISSUE_TEMPLATE\/|pull_request_template\.md$)/,
  /^(LICENSE|NOTICE|\.coderabbit\.yaml)$/,
]

/** Files the e2e job reads besides those that feed the web build: its specs and the compose stack. */
const e2eInputs = [/^apps\/e2e\//, /^compose\.yaml$/]

/** Tests and notes of the packages and the web app do not change the build. */
const ignored = [/^(apps|packages)\/[^/]+\/test\//, /^(apps|packages)\/[^/]+\/[^/]*\.md$/]

/** Files whose change needs every record page prerendered (`prerender=full`), besides the import closure. */
const recordInputs = [
  /^packages\/data\//,
  /^packages\/schema\//,
  /^packages\/api\//,
  /^(package\.json|package-lock\.json|tsconfig\.base\.json|\.nvmrc)$/,
  /^patches\//,
  /^\.github\/workflows\/ci\.yml$/,
  /^apps\/web\/(package\.json|next\.config\.ts|tsconfig\.json|Dockerfile)$/,
  /^apps\/web\/scripts\/(ci-plan|check-prerender)\.mts$/,
  /^apps\/web\/src\/lib\/prerender-sample\.ts$/,
]

/** The pages that take the ids of `generateStaticParams`. */
const recordRoutes = [
  'cartridges',
  'bullets',
  'powders',
  'targets',
  'disciplines',
  'federations',
].map((r) => `apps/web/src/app/${r}/[id]`)

const importRe = /(?:\bfrom|\bimport)\s*\(?\s*['"]([^'"]+)['"]/g
const extensions = ['', '.ts', '.tsx', '.mts', '.js', '.css']

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
    for (const [, spec = ''] of source.matchAll(importRe)) {
      const pkg = /^@open-reloading\/([^/]+)/.exec(spec)
      if (pkg?.[1]) packages.add(pkg[1])
      const target = spec.startsWith('@/')
        ? path.posix.join('apps/web/src', spec.slice(2))
        : spec.startsWith('.')
          ? path.posix.join(path.posix.dirname(file), spec)
          : null
      if (target === null) continue
      const found = extensions
        .map((e) => target + e)
        .find((f) => existsSync(path.join(root, f)) && statSync(path.join(root, f)).isFile())
      if (!found) throw new Error(`${file} imports ${spec}, which does not resolve`)
      add(found)
    }
  }
  return { files, packages }
}

export type Plan = {
  check: boolean
  e2e: boolean
  web: boolean
  prerender: 'full' | 'sample'
  reason: string
}

const everything = (reason: string): Plan => ({
  check: true,
  e2e: true,
  web: true,
  prerender: 'full',
  reason,
})

export function plan(all: string[], closure = recordClosure()): Plan {
  if (all.length === 0) return everything('no changed files found')
  const code = all.filter((f) => !docsOnly.some((re) => re.test(f)))
  if (code.length === 0)
    return {
      check: false,
      e2e: false,
      web: false,
      prerender: 'sample',
      reason: 'only prose changed',
    }
  const changed = code.filter((f) => !ignored.some((re) => re.test(f)))
  if (!changed.some((f) => webInputs.some((re) => re.test(f)))) {
    const e2e = changed.some((f) => e2eInputs.some((re) => re.test(f)))
    return {
      check: true,
      e2e,
      web: false,
      prerender: 'sample',
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
    ? everything(`${record} feeds the record pages`)
    : { ...everything('no changed file feeds the record pages'), prerender: 'sample' }
}

function git(...args: string[]) {
  return execFileSync('git', args, {
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
      ;[base, built] = readFileSync(stampFile, 'utf8').trim().split(' ')
    }
    if (!base) return full('no base commit given')
    const changed = changedSince(base)
    // an empty list is a doubt in CI, but the answer for a local run against its own last build
    const p: Plan =
      stampFile !== undefined && changed.length === 0
        ? {
            check: false,
            e2e: false,
            web: false,
            prerender: 'sample',
            reason: 'nothing changed since the recorded build',
          }
        : plan(changed)
    if (argument('--require') === 'full' && p.prerender === 'sample') p.prerender = 'full'
    // an earlier sample build does not stand in for a full one
    if (stampFile !== undefined && !p.web && p.prerender === 'full' && built !== 'full')
      return full('the earlier build is a sample')
    return p
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
    const out = `check=${p.check}\ne2e=${p.e2e}\nweb=${p.web}\nprerender=${p.prerender}`
    console.log(out)
    console.error(`ci-plan: ${out.replaceAll('\n', ' ')}: ${p.reason}`)
  }
}
