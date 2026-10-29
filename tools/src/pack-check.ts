/**
 * The npm tarball of each published library, as `npm pack --dry-run` lists it after the build: fails
 * when an entry point of `exports`, `main` or `types` is missing, or when the list holds a test file,
 * a source map without its sources, a file outside the `files` field, or a bare import in a packed
 * `.js` or `.d.ts` file of a package that is not in `dependencies` or `peerDependencies`.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { isBuiltin } from 'node:module'
import { dirname, join, matchesGlob, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { executable } from './executable.ts'

/** The workspaces published to npm. */
const published = ['schema', 'core', 'drawing', 'importers', 'data']

/** The fields of package.json the check reads. */
interface Manifest {
  name?: string
  main?: string
  types?: string
  exports?: unknown
  files?: string[]
  dependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

/** npm packs these whatever `files` says. */
const alwaysPacked = /^(package\.json|(readme|license|licence|changelog)([.-][^/]*)?)$/i
const code = /\.(?:[cm]?js|d\.[cm]?ts)$/
/** The specifier of a static or dynamic `import`, an `export ... from` or a `require` (not text such as `from "${x}"`). */
const specifier = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"])([^'"\s${}]+)\1/g
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

/** What is wrong with the tarball of the package in `dir`, one line each. */
export function packProblems(dir: string): string[] {
  const manifest = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) as Manifest
  const [pack] = JSON.parse(
    execFileSync(executable('npm'), ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: dir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  ) as { files: { path: string }[] }[]
  if (!pack) return ['npm pack listed no package']
  const files = new Set(pack.files.map((f) => f.path))
  const problems: string[] = []
  const entries = [manifest.main, manifest.types, ...exportTargets(manifest.exports)]
  for (const entry of new Set(entries.filter((e) => e !== undefined).map((e) => normalize(e))))
    if (!files.has(entry)) problems.push(`entry point ${entry} is not in the tarball`)
  for (const file of files) {
    if (testFile.test(file)) problems.push(`test file ${file} is in the tarball`)
    if (!alwaysPacked.test(file) && !inFiles(file, manifest.files ?? []))
      problems.push(`${file} is outside the files field`)
    if (file.endsWith('.map')) problems.push(...mapProblems(dir, file, files))
    if (code.test(file)) problems.push(...importProblems(dir, file, manifest))
  }
  return problems
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  let failed = false
  for (const name of published) {
    const problems = packProblems(join(root, 'packages', name))
    for (const problem of problems) console.error(`@open-reloading/${name}: ${problem}`)
    failed ||= problems.length > 0
  }
  if (failed) process.exit(1)
  console.log(`npm pack: ${published.length} packages checked`)
}
