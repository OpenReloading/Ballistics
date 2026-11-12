// Weighs the JavaScript of each S11 route from the Vite manifest, in gzip level 9 bytes as apps/web/scripts/check-weight.mts.
// Usage: node scripts/weigh.ts [dist/client] [--json]
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'

type Chunk = {
  file: string
  src?: string
  isEntry?: boolean
  isDynamicEntry?: boolean
  imports?: string[]
  dynamicImports?: string[]
}
type Manifest = Record<string, Chunk>

export const routes = [
  { path: '/', file: 'src/routes/index.tsx', group: 'shell' },
  { path: '/bullets/', file: 'src/routes/bullets/index.tsx', group: 'lists' },
  { path: '/powders/demo-powder-dp40/', file: 'src/routes/powders/$id.tsx', group: 'curve charts' },
  { path: '/bullets/designer/', file: 'src/routes/bullets/designer.tsx', group: 'designers' },
  { path: '/firearms/', file: 'src/routes/firearms.tsx', group: 'tools' },
  { path: '/workbench/', file: 'src/routes/workbench.tsx', group: 'workbench' },
] as const

export const chunkLimit = 190_000

/** The packages whose chunks the report names, by their folder under node_modules/.pnpm. */
const packages = { Dexie: ['dexie@'], ECharts: ['echarts@', 'zrender@'], Mantine: ['@mantine+'] }

export function load(dir: string) {
  const manifest: Manifest = JSON.parse(readFileSync(path.join(dir, '.vite/manifest.json'), 'utf8'))
  const modulesFile = path.join(dir, '.vite/chunk-modules.json')
  const modules: Record<string, string[]> = existsSync(modulesFile)
    ? JSON.parse(readFileSync(modulesFile, 'utf8'))
    : {}
  const sizes = new Map<string, number>()
  const gzip = (file: string) => {
    let n = sizes.get(file)
    if (n === undefined) {
      n = gzipSync(readFileSync(path.join(dir, file)), { level: 9 }).length
      sizes.set(file, n)
    }
    return n
  }
  const entry = Object.keys(manifest).find((k) => manifest[k]?.isEntry)
  if (!entry) throw new Error('no entry in the manifest')
  const byFile = new Map(Object.entries(manifest).map(([k, c]) => [c.file, k]))

  const closure = (keys: string[]) => {
    const seen = new Set<string>()
    const walk = (k: string) => {
      if (seen.has(k)) return
      seen.add(k)
      for (const i of manifest[k]?.imports ?? []) walk(i)
    }
    for (const k of keys) walk(k)
    return seen
  }

  // workers are separate bundles outside the manifest: found by the file name in `new URL(...)`, their chunks by relative imports
  const workerRefs = (file: string) => {
    const text = readFileSync(path.join(dir, file), 'utf8')
    return [
      ...new Set(
        [...text.matchAll(/assets\/([\w.-]+\.worker-[\w-]+\.js)/g)].map((m) => `assets/${m[1]}`),
      ),
    ]
  }
  const workerFiles = (worker: string) => {
    const seen = new Set<string>()
    const walk = (file: string) => {
      if (seen.has(file) || !existsSync(path.join(dir, file))) return
      seen.add(file)
      const text = readFileSync(path.join(dir, file), 'utf8')
      for (const m of text.matchAll(/["'`]\.\/([\w.-]+\.js)["'`]/g)) walk(`assets/${m[1]}`)
    }
    walk(worker)
    return seen
  }

  function weigh(route: (typeof routes)[number]) {
    // the router loads every split component of the matched route before it renders (component, notFoundComponent, ...)
    const leaves = Object.keys(manifest).filter((k) => k.startsWith(`${route.file}?tsr-split=`))
    if (!leaves.length)
      throw new Error(`${route.path}: no split chunk of ${route.file} in the manifest`)
    const initialKeys = closure([entry as string, ...leaves])
    const initial = new Set([...initialKeys].map((k) => manifest[k]?.file as string))
    // every chunk loaded later from this route, with the dynamic import that reaches it; other routes' split chunks are not
    const lazy = new Map<string, { size: number; via: string; worker?: boolean }>()
    const queue = [...initialKeys]
    const done = new Set(queue)
    while (queue.length) {
      const k = queue.shift() as string
      for (const d of manifest[k]?.dynamicImports ?? []) {
        if (d.includes('?tsr-split=') || done.has(d)) continue
        for (const c of closure([d])) {
          if (done.has(c)) continue
          done.add(c)
          queue.push(c)
          const file = manifest[c]?.file as string
          if (!initial.has(file)) lazy.set(file, { size: gzip(file), via: `${k} -> import(${d})` })
        }
      }
    }
    for (const file of [...initial, ...lazy.keys()])
      for (const w of workerRefs(file))
        for (const f of workerFiles(w))
          if (!lazy.has(f))
            lazy.set(f, {
              size: gzip(f),
              via: `${byFile.get(file) ?? file} -> new Worker(${w})`,
              worker: true,
            })
    const initialBytes = [...initial].reduce((n, f) => n + gzip(f), 0)
    return { initial: [...initial].sort(), initialBytes, lazy }
  }

  const packageChunks = (names: string[]) =>
    Object.entries(modules)
      .filter(([, ids]) =>
        ids.some((id) => names.some((n) => id.includes(`/node_modules/.pnpm/${n}`))),
      )
      .map(([file]) => file)

  return { manifest, weigh, gzip, packageChunks }
}

function main() {
  const args = process.argv.slice(2)
  const dir = args.find((a) => !a.startsWith('--')) ?? 'dist/client'
  const budgets = JSON.parse(
    readFileSync(path.join(import.meta.dirname, '../../web/weight-budget.json'), 'utf8'),
  ).groups as Record<string, { budget: { initial: number } }>
  const { weigh, gzip, packageChunks } = load(dir)
  const report = routes.map((r) => {
    const w = weigh(r)
    const budget = budgets[r.group]?.budget.initial ?? 0
    const lazy = [...w.lazy.entries()]
      .map(([file, l]) => ({ file, ...l }))
      .sort((a, b) => b.size - a.size)
    return { ...r, budget, initialBytes: w.initialBytes, initialFiles: w.initial, lazy }
  })
  const pkgs = Object.fromEntries(
    Object.entries(packages).map(([name, dirs]) => [
      name,
      packageChunks(dirs).map((file) => ({
        file,
        size: gzip(file),
        routes: Object.fromEntries(
          report.map((r) => [
            r.path,
            r.initialFiles.includes(file)
              ? 'initial'
              : r.lazy.some((l) => l.file === file)
                ? 'lazy'
                : '-',
          ]),
        ),
      })),
    ]),
  )
  if (args.includes('--json')) {
    console.log(JSON.stringify({ routes: report, packages: pkgs }, null, 2))
    return
  }
  for (const r of report) {
    const over = r.lazy.filter((l) => l.size > chunkLimit)
    console.log(
      `${r.path} (${r.group}): initial ${r.initialBytes} / ${r.budget} ${r.initialBytes <= r.budget ? 'ok' : 'OVER'}, ` +
        `${r.initialFiles.length} files; lazy ${r.lazy.length} chunks, largest ${r.lazy[0]?.size ?? 0} (${r.lazy[0]?.file ?? '-'}); over ${chunkLimit}: ${over.length}`,
    )
    for (const l of over) console.log(`  OVER ${l.file} ${l.size} via ${l.via}`)
  }
  for (const [name, chunks] of Object.entries(pkgs)) {
    console.log(`${name}:`)
    for (const c of chunks) console.log(`  ${c.file} ${c.size} ${JSON.stringify(c.routes)}`)
  }
}

if (import.meta.main) main()
