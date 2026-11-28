/** The npm tarball of each published package, as `pnpm pack --dry-run` lists it after the build: fails on a missing README or entry of `exports`, `bin`, `main` or `types` (a `*` pattern matching no file), a test file, a source map without its sources, a file outside `files`, a bare import in a packed `.js` or `.d.ts` not in `dependencies` or `peerDependencies`, or a dependency on a private workspace package, which npm never gets. Then installs the packed command line offline and runs it. */
import { execFileSync, spawnSync } from 'node:child_process'
import {
  globSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  writeFileSync,
} from 'node:fs'
import { isBuiltin } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, matchesGlob, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse, stringify } from 'yaml'
import { executable } from './executable.ts'

/** The folders of the workspaces published to npm. */
const published = [
  'packages/schema',
  'packages/svg-drawings',
  'packages/importers',
  'packages/catalog',
  'packages/catalog-files',
  'apps/cli',
]

/** The folder of the command line, which the check also installs and runs. */
const cli = 'apps/cli'

/** Marked `private` until the 0.1.0 release publishes them, so a dependency of the command line on one passes the private-dependency check. */
const releasedWith010 = new Set(
  [
    'units',
    'statistics',
    'locale-format',
    'ballistics',
    'shot-groups',
    'target-recognition',
    'design-tokens',
    'ui',
    'use-cases',
    'catalog',
    'importers',
    'schema',
    'svg-drawings',
    'catalog-files',
  ].map((name) => `@rangefoundry/${name}`),
)

/** The fields of package.json the check reads. */
interface Manifest {
  name?: string
  main?: string
  types?: string
  exports?: unknown
  bin?: string | Record<string, string>
  files?: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** A package in the output of `pnpm pack --json`. */
interface Packed {
  files: { path: string }[]
}

/** Packed whatever `files` says. */
const alwaysPacked = /^(package\.json|(readme|license|licence|changelog)([.-][^/]*)?)$/i
const code = /\.(?:[cm]?js|d\.[cm]?ts)$/
/** The specifier of a static or dynamic `import`, an `export ... from` or a `require` (not text such as `from "${x}"`). */
const specifier = /(?:\bfrom|\bimport|\brequire)\s*(?:\(\s*)?(['"])([^'"\s${}]+)\1/g
const testFile = /(?:(?:^|\/)(?:__tests__|test|tests)\/)|(?:\.(?:test|spec)\.[cm]?[jt]sx?$)/

/** Every path named by `exports`, through its conditions and subpaths. */
function exportTargets(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  if (value === null || typeof value !== 'object') return []
  return Object.values(value).flatMap(exportTargets)
}

const inFiles = (file: string, patterns: string[]) =>
  patterns
    .filter((p) => !p.startsWith('!'))
    .some((p) => {
      const pattern = normalize(p).replace(/\/$/, '')
      return file === pattern || file.startsWith(`${pattern}/`) || matchesGlob(file, pattern)
    })

/** Whether `files` holds the entry point `entry`, or a file that its `*` pattern matches. */
const packed = (entry: string, files: Set<string>) =>
  entry.includes('*') ? [...files].some((f) => matchesGlob(f, entry)) : files.has(entry)

/** The sources of the shipped source map `file` that the tarball leaves out. */
function mapProblems(dir: string, file: string, files: Set<string>) {
  const map = JSON.parse(readFileSync(join(dir, file), 'utf8')) as {
    sourceRoot?: string
    sources?: string[]
  }
  return (map.sources ?? [])
    .map((source) => normalize(join(dirname(file), map.sourceRoot ?? '', source)))
    .filter((path) => !files.has(path))
    .map((path) => `source map ${file} ships without its source ${path}`)
}

/** The packages that the packed file `file` imports and the manifest does not declare. */
function importProblems(dir: string, file: string, manifest: Manifest) {
  const declared = new Set([
    manifest.name,
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
  ])
  const names = [...readFileSync(join(dir, file), 'utf8').matchAll(specifier)]
    .map((m) => m[2] ?? '')
    .filter((s) => !/^[./#]/.test(s) && !s.includes(':') && !isBuiltin(s))
    .map((s) => s.split('/', s.startsWith('@') ? 2 : 1).join('/'))
  return [...new Set(names)]
    .filter((name) => !declared.has(name))
    .map((name) => `${file} imports ${name}, which is not in dependencies or peerDependencies`)
}

/** The package `pnpm pack --dry-run` would write for `dir` (no package has a pack script). */
function packOf(dir: string): Packed | undefined {
  const listed = JSON.parse(
    execFileSync(executable('pnpm'), ['pack', '--dry-run', '--json'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  ) as Packed | undefined
  return listed?.files ? listed : undefined
}

/** The workspace packages of `root` by name, each with its folder. */
function workspaces(root: string) {
  const { packages = [] } = parse(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')) as {
    packages?: string[]
  }
  const found = globSync(
    packages.map((p) => `${p}/package.json`),
    { cwd: root },
  ).map((file) => {
    const manifest = JSON.parse(readFileSync(join(root, file), 'utf8')) as Manifest & {
      private?: boolean
    }
    return [manifest.name ?? '', { dir: join(root, dirname(file)), manifest }] as const
  })
  return new Map(found)
}

/** The names of the workspace packages marked `private` that the folder `dir` may not depend on: for the command line, which the release does not publish to npm, those the 0.1.0 release does not publish; for a library, all of them. */
const privateWorkspaces = (all: ReturnType<typeof workspaces>, dir: string) =>
  new Set(
    [...all]
      .filter(
        ([name, { manifest }]) =>
          manifest.private === true && (dir !== cli || !releasedWith010.has(name)),
      )
      .map(([name]) => name),
  )

/** The dependencies of `manifest` among the private workspace packages `privates`. */
const privateDependencyProblems = (manifest: Manifest, privates: Set<string>) =>
  Object.keys({ ...manifest.dependencies, ...manifest.peerDependencies })
    .filter((name) => privates.has(name))
    .map((name) => `depends on ${name}, a private workspace package that npm does not have`)

/** One line each; `privates` are the names of the unpublished workspace packages, which no published package may depend on. */
export function packProblems(dir: string, privates = new Set<string>()): string[] {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
  const pack = packOf(dir)
  if (!pack) return ['pnpm pack listed no package']
  const files = new Set(pack.files.map((f) => f.path))
  const problems = ['README.md']
    .filter((f) => !files.has(f))
    .map((f) => `${f} is not in the tarball`)
  problems.push(...privateDependencyProblems(manifest, privates))
  const entries = [
    manifest.main,
    manifest.types,
    ...exportTargets(manifest.exports),
    ...exportTargets(manifest.bin),
  ]
  for (const entry of new Set(entries.filter((e) => e !== undefined).map((e) => normalize(e))))
    if (!packed(entry, files)) problems.push(`entry point ${entry} is not in the tarball`)
  for (const file of files) {
    if (testFile.test(file)) problems.push(`test file ${file} is in the tarball`)
    if (!alwaysPacked.test(file) && !inFiles(file, manifest.files ?? []))
      problems.push(`${file} is outside the files field`)
    if (file.endsWith('.map')) problems.push(...mapProblems(dir, file, files))
    if (code.test(file)) problems.push(...importProblems(dir, file, manifest))
  }
  return problems
}

/** {@link packProblems} of the published folder `dir` of the workspace `root`, against the private packages that folder may not depend on. */
export const publishedProblems = (root: string, dir: string) =>
  packProblems(join(root, dir), privateWorkspaces(workspaces(root), dir))

/** The workspace packages `name` depends on, itself included, each once. */
function closure(name: string, all: ReturnType<typeof workspaces>, seen = new Set<string>()) {
  seen.add(name)
  for (const dependency of Object.keys(all.get(name)?.manifest.dependencies ?? {}))
    if (all.has(dependency) && !seen.has(dependency)) closure(dependency, all, seen)
  return seen
}

/** Packs the command line at `dir` of `root` with its workspace dependencies, installs it offline into a new folder, the other dependencies linked from the workspace, and runs its command from a folder whose own `@rangefoundry/catalog` is no JSON; one line per run that fails or writes to stderr. */
export function installProblems(root: string, dir: string): string[] {
  const all = workspaces(root)
  const self = [...all.values()].find((w) => w.dir === join(root, dir))
  if (!self?.manifest.name) return [`${dir} holds no workspace package`]
  const { name } = self.manifest
  const temp = mkdtempSync(join(tmpdir(), 'pack-install-'))
  const pnpm = (args: string[], cwd: string) =>
    execFileSync(executable('pnpm'), args, { cwd, encoding: 'utf8', stdio: 'pipe' })
  const overrides: Record<string, string> = {}
  for (const packed of closure(name, all)) {
    const workspace = all.get(packed) as { dir: string; manifest: Manifest }
    const out = pnpm(['pack', '--json', '--pack-destination', join(temp, 'packed')], workspace.dir)
    overrides[packed] = `file:${(JSON.parse(out) as { filename: string }).filename}`
    for (const dependency of Object.keys(workspace.manifest.dependencies ?? {}))
      if (!all.has(dependency))
        overrides[dependency] =
          `link:${realpathSync(join(workspace.dir, 'node_modules', dependency))}`
  }
  const app = join(temp, 'app')
  mkdirSync(app)
  writeFileSync(join(app, 'package.json'), '{ "name": "pack-install", "private": true }\n')
  writeFileSync(join(app, 'pnpm-workspace.yaml'), stringify({ overrides }))
  pnpm(['add', '--offline', '--ignore-scripts', overrides[name] as string], app)
  const installed = join(app, 'node_modules', name)
  const bin = exportTargets(self.manifest.bin)[0] ?? ''
  const decoy = join(temp, 'cwd', 'node_modules', '@rangefoundry', 'catalog')
  mkdirSync(decoy, { recursive: true })
  writeFileSync(
    join(decoy, 'package.json'),
    '{ "name": "@rangefoundry/catalog", "exports": { "./bundle.json": "./bundle.json" } }\n',
  )
  writeFileSync(join(decoy, 'bundle.json'), '{')
  const runs = [
    ['--version'],
    ['operations'],
    ['run', 'interior', '--input', join(installed, 'examples/interior.json')],
  ]
  return runs.flatMap((args) => {
    const ran = spawnSync(process.execPath, [join(installed, bin), ...args], {
      cwd: join(temp, 'cwd'),
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
    return ran.status === 0 && ran.stderr === ''
      ? []
      : [`${args.join(' ')} exits ${ran.status}: ${ran.stderr.trim()}`]
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  let failed = false
  for (const dir of published) {
    const problems = publishedProblems(root, dir)
    if (dir === cli) problems.push(...installProblems(root, dir))
    for (const problem of problems) console.error(`${dir}: ${problem}`)
    failed ||= problems.length > 0
  }
  if (failed) process.exit(1)
  console.log(`pnpm pack: ${published.length} packages checked, the command line installed and run`)
}
