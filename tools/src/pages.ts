/**
 * Builds the Pages site into `pages/` at the repository root (README, Pages edition): the web app
 * as a static export under `PAGES_BASE_PATH`, every record page prerendered from the API on PGlite
 * seeded from the data bundle (`@open-reloading/api/static`), its read answers as data files under
 * `api/`, the docs site under `docs/`, LICENSE, NOTICE, the data license (`data/LICENSE`) and
 * `.nojekyll`.
 * `PAGES_URL` (the site's origin) sets the docs' `url` and the app's `metadataBase`. Needs
 * `npm run build` at the root first.
 */
import { spawn } from 'node:child_process'
import { cpSync, rmSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startBundleApi, writeStaticApi } from '@open-reloading/api/static'
import { dropFullPayloads } from './pages-payload.ts'

const base = process.env.PAGES_BASE_PATH
// Next's basePath: empty, or a path that starts with a slash and does not end in one
if (base === undefined || !/^(\/[^/]+)*$/.test(base))
  throw new Error('PAGES_BASE_PATH must be set: "" or a path such as /Ballistics')

const at = (p: string) => fileURLToPath(new URL(`../../${p}`, import.meta.url))
const site = at('pages')

/** Runs npm without blocking this process: the build reads the API it serves. */
function run(args: string[], env: Record<string, string | undefined>) {
  return new Promise<void>((resolve, reject) => {
    spawn('npm', args, { cwd: at(''), env: { ...process.env, ...env }, stdio: 'inherit' })
      .on('error', reject)
      .on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`npm ${args.join(' ')} failed`)),
      )
  })
}

// the web app's build directory and Turbopack cache: one edition's cache fails the other's build
const clearWebBuild = () => rmSync(at('apps/web/.next'), { recursive: true, force: true })
const api = await startBundleApi()
clearWebBuild()
try {
  // `full`: the dev container sets `sample`, and an export has no page it did not prerender
  await run(['run', 'build', '-w', '@open-reloading/web'], { API_URL: api.url, PRERENDER: 'full' })
  rmSync(site, { recursive: true, force: true })
  cpSync(at('apps/web/out'), site, { recursive: true })
  dropFullPayloads(site)
  await writeStaticApi(api.app, `${site}/api`)
} finally {
  clearWebBuild()
  await api.close()
}
// no API on the Pages site: the docs' REST page has no link to one
const docsEnv = {
  DOCS_BASE_URL: `${base}/docs/`,
  APP_URL: process.env.PAGES_URL && `${process.env.PAGES_URL}${base}/`,
  API_URL: undefined,
  PAGES_BASE_PATH: undefined,
}
await run(['run', 'site:build', '-w', '@open-reloading/docs', '--', '--out-dir', `${site}/docs`], {
  ...docsEnv,
  ...(process.env.PAGES_URL && { DOCS_URL: process.env.PAGES_URL }),
})
for (const file of ['LICENSE', 'NOTICE']) cpSync(at(file), `${site}/${file}`)
cpSync(at('packages/data/LICENSE'), `${site}/data/LICENSE`)
// GitHub Pages serves the files as they are, `_next/` among them, without Jekyll
writeFileSync(`${site}/.nojekyll`, '')
console.log(`pages/: the Pages site under ${base || '/'}`)
