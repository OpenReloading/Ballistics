// Usage: VITE_EDITION=stable|next node scripts/inject-precache.ts <dir> <report.json>; exits 1 over the budget
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { gzipSync } from 'node:zlib'
import { injectManifest, type ManifestEntry } from '@serwist/build'
import { build } from 'vite'

/** ARCHITECTURE.md section 3, measured as summed gzip level 9 sizes (the measure of apps/web/scripts/check-weight.mts). */
const budget = 1_500_000

const [dir, report] = process.argv.slice(2)
if (!dir || !report) throw new Error('usage: node scripts/inject-precache.ts <dir> <report.json>')
const next = process.env.VITE_EDITION === 'next'
const swSrc = 'dist/sw-bundle/sw.js'

await build({
  configFile: false,
  base: next ? '/next/' : '/',
  logLevel: 'warn',
  // Serwist core reads process.env.NODE_ENV, which lib mode leaves in place
  define: { 'process.env.NODE_ENV': '"production"' },
  build: {
    outDir: 'dist/sw-bundle',
    emptyOutDir: false,
    // a classic script: today's page registers `sw.js` without `type: 'module'`
    lib: { entry: 'src/sw.ts', formats: ['iife'], name: 'sw', fileName: () => 'sw.js' },
  },
})

const read = (file: string) => readFileSync(path.join(dir, file), 'utf8')
/** The `assets/` files a page references, and the static imports of each script, transitively. */
function shellFiles() {
  const files = new Set<string>()
  const add = (file: string) => {
    if (files.has(file)) return
    files.add(file)
    if (file.endsWith('.js'))
      for (const m of read(file).matchAll(
        /\bimport\s*(?:[\w$*{},][\w$*{}\s,]*from\s*)?["']\.\/([\w.-]+\.js)["']/g,
      ))
        add(`assets/${m[1]}`)
    if (file.endsWith('.css'))
      for (const m of read(file).matchAll(
        /url\(["']?(?:\.\/|\/(?:next\/)?assets\/)?([\w.-]+\.woff2)/g,
      ))
        add(`assets/${m[1]}`)
  }
  for (const page of ['_shell.html', 'index.html'])
    for (const m of read(page).matchAll(
      /(?:href|src)="\/(?:next\/)?(assets\/[\w.-]+\.(?:js|css))"/g,
    ))
      add(m[1] as string)
  return [...files]
}

const globPatterns = [
  '_shell.html',
  'index.html',
  ...shellFiles(),
  '*.{png,svg,ico,webmanifest}',
  'api/catalogue/index.json',
]
let entries: (ManifestEntry & { size: number })[] = []
const result = await injectManifest({
  swSrc,
  swDest: path.join(dir, 'sw.js'),
  globDirectory: dir,
  globPatterns,
  // Vite's content hash in the name: the URL is the revision
  dontCacheBustURLsMatching: /^assets\/.+-[\w-]{8}\.\w+$/,
  manifestTransforms: [
    (manifest) => {
      entries = manifest
      return { manifest, warnings: [] }
    },
  ],
})

const rows = entries
  .map((e) => {
    const bytes = readFileSync(path.join(dir, e.url))
    return {
      url: e.url,
      revision: e.revision ?? null,
      raw: bytes.length,
      gzip: gzipSync(bytes, { level: 9 }).length,
    }
  })
  .sort((a, b) => b.gzip - a.gzip)
const gzip = rows.reduce((n, r) => n + r.gzip, 0)
const worker = readFileSync(path.join(dir, 'sw.js'), 'utf8')
const summary = {
  dir,
  count: result.count,
  raw: result.size,
  gzip,
  budget,
  workerBytes: worker.length,
  workerMentionsIndexedDB: worker.includes('indexedDB'),
  warnings: result.warnings,
  entries: rows,
}
writeFileSync(report, `${JSON.stringify(summary, null, 2)}\n`)
for (const r of rows)
  console.log(`${String(r.gzip).padStart(9)} ${String(r.raw).padStart(9)}  ${r.url}`)
console.log(
  `${dir}: ${result.count} entries, ${result.size} bytes raw, ${gzip} bytes gzip 9 (budget ${budget})`,
)
for (const w of result.warnings) console.warn(w)
if (gzip > budget) {
  console.error(`precache over budget by ${gzip - budget} bytes`)
  process.exit(1)
}
