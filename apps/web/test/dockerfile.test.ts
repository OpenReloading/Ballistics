import { readdirSync, readFileSync } from 'node:fs'
import { posix } from 'node:path'
import { describe, expect, it } from 'vitest'
import { defined, missing } from './defined.ts'

const repo = new URL('../../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, repo), 'utf8')

/** The build stage of the web image: its COPY sources and RUN commands. */
function buildStage(dockerfile: string) {
  const stage = defined(dockerfile.split(/^FROM /m)[1])
  const lines = stage.replace(/\\\n/g, ' ').split('\n')
  return {
    copied: lines.flatMap((l) => (l.startsWith('COPY ') ? l.split(/\s+/).slice(1, -1) : [])),
    run: lines.filter((l) => l.startsWith('RUN ')).join(' && '),
  }
}

/** Every `@open-reloading/<package>[/<entry>]` the web app's sources and scripts import (the image's `.dockerignore` leaves out `test/`). */
function webImports(dir = 'apps/web'): Set<string> {
  const found = new Set<string>()
  for (const entry of readdirSync(new URL(`${dir}/`, repo), { withFileTypes: true })) {
    if (['node_modules', '.next', 'out', 'test'].includes(entry.name)) continue
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) for (const spec of webImports(path)) found.add(spec)
    else if (/\.(m?ts|tsx)$/.test(entry.name))
      for (const [, spec = missing()] of read(path).matchAll(/'(@open-reloading\/[^']+)'/g))
        found.add(spec)
  }
  return found
}

/** The sources below `src/` that `entries` reach by relative imports, type imports included. */
function reached(pkg: string, entries: string[]): Set<string> {
  const files = new Set<string>()
  const visit = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    for (const [, spec = missing()] of read(`packages/${pkg}/${file}`).matchAll(
      /(?:from|import)\s*\(?\s*'(\.[^']*)'/g,
    ))
      visit(posix.join(posix.dirname(file), spec))
  }
  for (const entry of entries) visit(entry)
  return files
}

/** What the image build writes to `dist/` of `pkg`: the whole package, or the `tsc -p` projects it runs. */
function built(pkg: string, run: string): Set<string> | 'all' {
  if (run.includes(`npm run build -w @open-reloading/${pkg}`)) return 'all'
  const out = new Set<string>()
  for (const [, config] of run.matchAll(new RegExp(`tsc -p packages/${pkg}/(\\S+)`, 'g'))) {
    const files = JSON.parse(read(`packages/${pkg}/${config}`)).files as string[]
    for (const file of reached(pkg, files)) out.add(file.replace(/^src\/(.*)\.ts$/, 'dist/$1.js'))
  }
  return out
}

const { copied, run } = buildStage(read('apps/web/Dockerfile'))
const covered = (path: string) => copied.some((c) => path === c || path.startsWith(`${c}/`))

describe('web image', () => {
  const imports = [...webImports()].sort()

  it('finds the imports of the web app', () => {
    expect(imports).toContain('@open-reloading/api/catalogue')
    expect(imports).toContain('@open-reloading/data/plausibility')
  })

  it.each(imports)('builds %s', (spec) => {
    const [, pkg = missing(), ...rest] = spec.split('/')
    const manifest = JSON.parse(read(`packages/${pkg}/package.json`))
    const target: string = manifest.exports[rest.length ? `./${rest.join('/')}` : '.'].default

    expect(run, `npm ci of ${pkg}`).toContain(`-w @open-reloading/${pkg}`)
    const output = built(pkg, run)
    if (output === 'all') expect(covered(`packages/${pkg}`), `COPY of ${pkg}`).toBe(true)
    else {
      expect(output, `${target} written by the image`).toContain(target.replace(/^\.\//, ''))
      const configs = [...run.matchAll(new RegExp(`tsc -p packages/${pkg}/(\\S+)`, 'g'))]
      for (const [, config] of configs)
        for (const file of reached(pkg, JSON.parse(read(`packages/${pkg}/${config}`)).files))
          expect(covered(`packages/${pkg}/${file}`), `COPY of packages/${pkg}/${file}`).toBe(true)
    }
  })
})
